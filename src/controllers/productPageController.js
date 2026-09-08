import jwt from "jsonwebtoken";
import ProductPageMongo from "../models/ProductPageMongo.js";
import ProductMongo from "../models/ProductMongo.js";
import { validateBlocks, validateTheme } from "../utils/blockValidation.js";
import { buildDefaultLayout } from "../utils/defaultDppTemplate.js";
import { invalidate } from "../utils/dppCache.js";

/** Keeps the revision list from growing without bound on a busy page. */
const MAX_REVISIONS = 10;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const normalizeSlug = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");

const LIST_FIELDS =
  "slug productSlug internalName status publishedAt updatedAt createdAt";

// @desc    List product pages for the builder
// @route   GET /api/admin/product-pages
// @access  Admin
export const listProductPages = async (req, res) => {
  try {
    const { status, productSlug, q } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (productSlug) filter.productSlug = productSlug;
    if (q) {
      const term = String(q).trim();
      filter.$or = [
        { slug: { $regex: term, $options: "i" } },
        { internalName: { $regex: term, $options: "i" } },
      ];
    }

    const pages = await ProductPageMongo.find(filter)
      .select(LIST_FIELDS)
      .sort({ updatedAt: -1 })
      .lean();

    res.json({ success: true, data: pages, total: pages.length });
  } catch (error) {
    console.error("❌ listProductPages:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a page, optionally seeded from the default template
// @route   POST /api/admin/product-pages
// @access  Admin
export const createProductPage = async (req, res) => {
  try {
    const { productSlug, internalName, fromTemplate = "default" } = req.body;
    const slug = normalizeSlug(req.body.slug);

    if (!slug || !SLUG_PATTERN.test(slug)) {
      return res.status(400).json({
        success: false,
        message: "כתובת העמוד חייבת להכיל אותיות אנגליות קטנות, ספרות ומקפים בלבד",
      });
    }

    if (!productSlug || !internalName?.trim()) {
      return res.status(400).json({
        success: false,
        message: "יש לבחור מוצר ולתת שם פנימי לעמוד",
      });
    }

    const product = await ProductMongo.findOne({ id: productSlug })
      .select("_id id")
      .lean();

    if (!product) {
      return res.status(400).json({ success: false, message: "מוצר לא נמצא" });
    }

    const existing = await ProductPageMongo.findOne({ slug }).select("_id").lean();
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "כבר קיים עמוד עם הכתובת הזו",
      });
    }

    const page = await ProductPageMongo.create({
      slug,
      productSlug,
      productId: product._id,
      internalName: internalName.trim(),
      status: "draft",
      draft: fromTemplate === "blank" ? { blocks: [] } : buildDefaultLayout(),
      createdBy: req.user?._id,
      updatedBy: req.user?._id,
    });

    res.status(201).json({
      success: true,
      message: "העמוד נוצר בהצלחה",
      data: page,
    });
  } catch (error) {
    console.error("❌ createProductPage:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Full page document for the editor
// @route   GET /api/admin/product-pages/:id
// @access  Admin
export const getProductPage = async (req, res) => {
  try {
    const page = await ProductPageMongo.findById(req.params.id).lean();
    if (!page) {
      return res.status(404).json({ success: false, message: "עמוד לא נמצא" });
    }

    res.json({ success: true, data: page });
  } catch (error) {
    console.error("❌ getProductPage:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update page metadata (not the layout)
// @route   PUT /api/admin/product-pages/:id
// @access  Admin
export const updateProductPage = async (req, res) => {
  try {
    const page = await ProductPageMongo.findById(req.params.id);
    if (!page) {
      return res.status(404).json({ success: false, message: "עמוד לא נמצא" });
    }

    const previousSlug = page.slug;

    if (req.body.slug !== undefined) {
      const slug = normalizeSlug(req.body.slug);
      if (!SLUG_PATTERN.test(slug)) {
        return res.status(400).json({
          success: false,
          message: "כתובת העמוד חייבת להכיל אותיות אנגליות קטנות, ספרות ומקפים בלבד",
        });
      }

      const clash = await ProductPageMongo.findOne({
        slug,
        _id: { $ne: page._id },
      })
        .select("_id")
        .lean();

      if (clash) {
        return res.status(400).json({
          success: false,
          message: "כבר קיים עמוד עם הכתובת הזו",
        });
      }

      page.slug = slug;
    }

    if (req.body.internalName !== undefined) {
      page.internalName = String(req.body.internalName).trim();
    }

    if (req.body.seo) {
      const { title, description, ogImage, noindex } = req.body.seo;
      page.seo = {
        title: title?.slice(0, 120),
        description: description?.slice(0, 300),
        ogImage: ogImage?.slice(0, 500),
        noindex: noindex !== false,
      };
    }

    if (req.body.tracking) {
      const { fbPixelId, ga4MeasurementId, customEventParams } = req.body.tracking;
      page.tracking = {
        fbPixelId: fbPixelId?.slice(0, 40),
        ga4MeasurementId: ga4MeasurementId?.slice(0, 40),
        customEventParams:
          customEventParams && typeof customEventParams === "object"
            ? customEventParams
            : {},
      };
    }

    if (Array.isArray(req.body.popups)) {
      page.popups = req.body.popups;
    }

    page.updatedBy = req.user?._id;
    await page.save();

    invalidate(`dpp:${previousSlug}`);
    invalidate(`dpp:${page.slug}`);

    res.json({ success: true, message: "העמוד עודכן בהצלחה", data: page });
  } catch (error) {
    console.error("❌ updateProductPage:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Replace the draft layout — this is the reorder/add/remove endpoint
// @route   PATCH /api/admin/product-pages/:id/blocks
// @access  Admin
export const updateProductPageBlocks = async (req, res) => {
  try {
    const page = await ProductPageMongo.findById(req.params.id);
    if (!page) {
      return res.status(404).json({ success: false, message: "עמוד לא נמצא" });
    }

    const { blocks, errors } = validateBlocks(req.body.blocks);

    // Reject rather than silently save a layout the admin did not intend.
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0],
        errors,
      });
    }

    page.draft = {
      blocks,
      theme: req.body.theme
        ? validateTheme(req.body.theme)
        : page.draft?.theme || {},
    };
    page.updatedBy = req.user?._id;
    await page.save();

    res.json({
      success: true,
      message: "הטיוטה נשמרה",
      data: { draft: page.draft },
    });
  } catch (error) {
    console.error("❌ updateProductPageBlocks:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Promote the draft to live, archiving the previous published layout
// @route   POST /api/admin/product-pages/:id/publish
// @access  Admin
export const publishProductPage = async (req, res) => {
  try {
    const page = await ProductPageMongo.findById(req.params.id);
    if (!page) {
      return res.status(404).json({ success: false, message: "עמוד לא נמצא" });
    }

    if (!page.draft?.blocks?.length) {
      return res.status(400).json({
        success: false,
        message: "אי אפשר לפרסם עמוד ריק — הוסיפו לפחות בלוק אחד",
      });
    }

    // Keep the outgoing layout so a bad publish is one click from a rollback.
    if (page.published?.blocks?.length) {
      page.revisions = [
        {
          layout: page.published,
          publishedAt: page.publishedAt,
          publishedBy: page.updatedBy,
        },
        ...(page.revisions || []),
      ].slice(0, MAX_REVISIONS);
    }

    page.published = page.draft;
    page.status = "published";
    page.publishedAt = new Date();
    page.updatedBy = req.user?._id;
    await page.save();

    invalidate(`dpp:${page.slug}`);

    res.json({ success: true, message: "העמוד פורסם", data: page });
  } catch (error) {
    console.error("❌ publishProductPage:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Take a page off the air (the draft is kept)
// @route   POST /api/admin/product-pages/:id/unpublish
// @access  Admin
export const unpublishProductPage = async (req, res) => {
  try {
    const page = await ProductPageMongo.findByIdAndUpdate(
      req.params.id,
      { status: "draft", updatedBy: req.user?._id },
      { new: true },
    );

    if (!page) {
      return res.status(404).json({ success: false, message: "עמוד לא נמצא" });
    }

    invalidate(`dpp:${page.slug}`);

    res.json({ success: true, message: "פרסום העמוד הופסק", data: page });
  } catch (error) {
    console.error("❌ unpublishProductPage:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Copy a page as a new draft — the usual way to start an A/B test
// @route   POST /api/admin/product-pages/:id/duplicate
// @access  Admin
export const duplicateProductPage = async (req, res) => {
  try {
    const source = await ProductPageMongo.findById(req.params.id).lean();
    if (!source) {
      return res.status(404).json({ success: false, message: "עמוד לא נמצא" });
    }

    let slug = normalizeSlug(req.body.slug || `${source.slug}-copy`);
    if (!SLUG_PATTERN.test(slug)) {
      return res
        .status(400)
        .json({ success: false, message: "כתובת עמוד לא תקינה" });
    }

    const clash = await ProductPageMongo.findOne({ slug }).select("_id").lean();
    if (clash) {
      return res
        .status(400)
        .json({ success: false, message: "כבר קיים עמוד עם הכתובת הזו" });
    }

    const copy = await ProductPageMongo.create({
      slug,
      productSlug: source.productSlug,
      productId: source.productId,
      internalName: `${source.internalName} (עותק)`,
      status: "draft",
      // Copy whatever is live, falling back to the draft.
      draft: source.published || source.draft,
      seo: source.seo,
      tracking: source.tracking,
      popups: source.popups,
      createdBy: req.user?._id,
      updatedBy: req.user?._id,
    });

    res.status(201).json({ success: true, message: "העמוד שוכפל", data: copy });
  } catch (error) {
    console.error("❌ duplicateProductPage:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Load an archived layout back into the draft
// @route   POST /api/admin/product-pages/:id/revisions/:index/restore
// @access  Admin
export const restoreRevision = async (req, res) => {
  try {
    const page = await ProductPageMongo.findById(req.params.id);
    if (!page) {
      return res.status(404).json({ success: false, message: "עמוד לא נמצא" });
    }

    const index = Number(req.params.index);
    const revision = page.revisions?.[index];
    if (!revision) {
      return res.status(404).json({ success: false, message: "גרסה לא נמצאה" });
    }

    // Restores into the draft, never straight to live: the admin still has to
    // look at it and press publish.
    page.draft = revision.layout;
    page.updatedBy = req.user?._id;
    await page.save();

    res.json({
      success: true,
      message: "הגרסה שוחזרה לטיוטה",
      data: { draft: page.draft },
    });
  } catch (error) {
    console.error("❌ restoreRevision:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Archive a page (soft delete — ad links may still point at it)
// @route   DELETE /api/admin/product-pages/:id
// @access  Admin
export const deleteProductPage = async (req, res) => {
  try {
    const page = await ProductPageMongo.findByIdAndUpdate(
      req.params.id,
      { status: "archived", updatedBy: req.user?._id },
      { new: true },
    );

    if (!page) {
      return res.status(404).json({ success: false, message: "עמוד לא נמצא" });
    }

    invalidate(`dpp:${page.slug}`);

    res.json({ success: true, message: "העמוד הועבר לארכיון" });
  } catch (error) {
    console.error("❌ deleteProductPage:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Short-lived token so the preview iframe can read the draft
// @route   POST /api/admin/product-pages/:id/preview-token
// @access  Admin
export const createPreviewToken = async (req, res) => {
  try {
    const page = await ProductPageMongo.findById(req.params.id)
      .select("slug")
      .lean();

    if (!page) {
      return res.status(404).json({ success: false, message: "עמוד לא נמצא" });
    }

    const token = jwt.sign(
      { pageId: String(page._id), purpose: "dpp-preview" },
      process.env.JWT_SECRET,
      { expiresIn: "30m" },
    );

    res.json({ success: true, data: { token, slug: page.slug } });
  } catch (error) {
    console.error("❌ createPreviewToken:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
