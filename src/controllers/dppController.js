import jwt from "jsonwebtoken";
import ProductPageMongo from "../models/ProductPageMongo.js";
import MarketingPopupMongo from "../models/MarketingPopupMongo.js";
import {
  findCampaignProduct,
  shapeCampaignProduct,
} from "../utils/campaignProduct.js";
import { buildDefaultLayout } from "../utils/defaultDppTemplate.js";
import { findActivePopupsForPath } from "../utils/popupTargeting.js";
import { getCached, setCached } from "../utils/dppCache.js";

/**
 * The public read path for Dedicated Product Pages.
 *
 * Everything a DPP needs — layout, product, popups — comes back in one
 * response so the Netlify edge function makes a single hop before it can
 * inject state into the HTML.
 */

const PAGE_FIELDS = "slug productSlug published seo tracking popups";

const setPublicCacheHeaders = (res) => {
  // Identical for every visitor: let the CDN absorb the ad traffic.
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
};

const shapePage = (page, layout) => ({
  slug: page?.slug || null,
  blocks: layout.blocks || [],
  theme: layout.theme || {},
  seo: page?.seo || { noindex: true },
  tracking: page?.tracking || {},
  // Tells the client it is looking at the fallback template rather than a
  // page someone actually built.
  isDefaultTemplate: !page,
});

/**
 * Resolution order: a published ProductPage by slug, then a product by its
 * `id` rendered with the default template. That second branch is what keeps
 * every existing /lp/<productId> ad link alive with no admin action.
 */
const resolveLayout = (page) => {
  const hasPublishedBlocks = page?.published?.blocks?.length > 0;
  return hasPublishedBlocks ? page.published : buildDefaultLayout();
};

// @desc    Everything needed to render a DPP: layout + product + popups
// @route   GET /api/dpp/:slug
// @access  Public
export const getDppBootstrap = async (req, res) => {
  try {
    const slug = String(req.params.slug || "")
      .trim()
      .toLowerCase();
    if (!slug) {
      return res.status(400).json({ success: false, message: "חסר מזהה עמוד" });
    }

    const cacheKey = `dpp:${slug}`;
    const cached = getCached(cacheKey);
    if (cached) {
      setPublicCacheHeaders(res);
      return res.json(cached);
    }

    const page = await ProductPageMongo.findOne({ slug, status: "published" })
      .select(PAGE_FIELDS)
      .lean();

    const product = await findCampaignProduct(page?.productSlug || slug);

    // Inactive products are treated as missing: an ad should never land on a
    // page for something we have stopped selling.
    if (!product || product.status === "inactive") {
      return res.status(404).json({ success: false, message: "עמוד לא נמצא" });
    }

    const popups = await findActivePopupsForPath(
      `/lp/${slug}`,
      page?.popups || [],
    );

    const payload = {
      success: true,
      data: {
        page: shapePage(page, resolveLayout(page)),
        product: shapeCampaignProduct(product),
        popups,
      },
    };

    setCached(cacheKey, payload);
    setPublicCacheHeaders(res);
    res.json(payload);
  } catch (error) {
    console.error("❌ getDppBootstrap:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Draft layout behind a signed short-lived token (admin preview iframe)
// @route   GET /api/dpp/:slug/preview?token=
// @access  Public with token
export const getDppPreview = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "חסר טוקן תצוגה" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res
        .status(401)
        .json({ success: false, message: "טוקן תצוגה לא תקין או שפג תוקפו" });
    }

    if (decoded.purpose !== "dpp-preview") {
      return res
        .status(401)
        .json({ success: false, message: "טוקן תצוגה לא תקין" });
    }

    const page = await ProductPageMongo.findById(decoded.pageId)
      .select("slug productSlug draft seo tracking popups")
      .lean();

    if (!page) {
      return res.status(404).json({ success: false, message: "עמוד לא נמצא" });
    }

    const product = await findCampaignProduct(page.productSlug);
    if (!product) {
      return res.status(404).json({ success: false, message: "מוצר לא נמצא" });
    }

    const popups = await findActivePopupsForPath(
      `/lp/${page.slug}`,
      page.popups || [],
    );

    // Never cache a draft, at any layer.
    res.set("Cache-Control", "no-store");

    res.json({
      success: true,
      data: {
        page: {
          ...shapePage(page, page.draft || buildDefaultLayout()),
          isPreview: true,
        },
        product: shapeCampaignProduct(product),
        popups,
      },
    });
  } catch (error) {
    console.error("❌ getDppPreview:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Popup rules for a storefront path (non-DPP pages)
// @route   GET /api/popups/active?path=/shop
// @access  Public
export const getActivePopups = async (req, res) => {
  try {
    const path = String(req.query.path || "/").trim() || "/";
    const popups = await findActivePopupsForPath(path);

    setPublicCacheHeaders(res);
    res.json({ success: true, data: popups });
  } catch (error) {
    console.error("❌ getActivePopups:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Allowlisted so the event name can never be interpolated into a field path.
 *
 * A Map rather than an object literal: with a literal, an event named
 * "__proto__" or "constructor" resolves to something truthy off the prototype
 * chain and walks straight past the check below.
 */
const EVENT_FIELDS = new Map([
  ["impression", "impressions"],
  ["conversion", "conversions"],
  ["dismissal", "dismissals"],
]);

// @desc    Increment an A/B variant counter (sendBeacon, fire-and-forget)
// @route   POST /api/popups/:id/events
// @access  Public
export const recordPopupEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { variantKey, event } = req.body || {};

    const field = EVENT_FIELDS.get(event);
    if (!field || typeof variantKey !== "string") {
      return res.status(400).json({ success: false, message: "אירוע לא תקין" });
    }

    await MarketingPopupMongo.updateOne(
      { _id: id },
      { $inc: { [`variants.$[variant].stats.${field}`]: 1 } },
      { arrayFilters: [{ "variant.key": variantKey }] },
    );

    // sendBeacon ignores the body; a bare 204 keeps the response tiny.
    res.status(204).end();
  } catch (error) {
    // An analytics write must never surface as an error on the visitor's page.
    console.error("❌ recordPopupEvent:", error.message);
    res.status(204).end();
  }
};
