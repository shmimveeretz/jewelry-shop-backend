import MarketingPopupMongo from "../models/MarketingPopupMongo.js";
import { validatePopupPayload } from "../utils/popupValidation.js";
import { invalidateAll } from "../utils/dppCache.js";

/**
 * Popup CMS. Every write clears the DPP bootstrap cache: a popup can appear on
 * any number of pages, so there is no single key to invalidate.
 */

const LIST_FIELDS = "name status priority trigger schedule variants updatedAt";

const summarize = (popup) => ({
  _id: popup._id,
  name: popup.name,
  status: popup.status,
  priority: popup.priority,
  triggerType: popup.trigger?.type,
  schedule: popup.schedule,
  variantCount: popup.variants?.length || 0,
  impressions: (popup.variants || []).reduce(
    (total, variant) => total + (variant.stats?.impressions || 0),
    0,
  ),
  conversions: (popup.variants || []).reduce(
    (total, variant) => total + (variant.stats?.conversions || 0),
    0,
  ),
  updatedAt: popup.updatedAt,
});

// @desc    List popups
// @route   GET /api/admin/popups
// @access  Admin
export const listPopups = async (req, res) => {
  try {
    const { status, q } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (q) filter.name = { $regex: String(q).trim(), $options: "i" };

    const popups = await MarketingPopupMongo.find(filter)
      .select(LIST_FIELDS)
      .sort({ priority: -1, updatedAt: -1 })
      .lean();

    res.json({
      success: true,
      data: popups.map(summarize),
      total: popups.length,
    });
  } catch (error) {
    console.error("❌ listPopups:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a popup
// @route   POST /api/admin/popups
// @access  Admin
export const createPopup = async (req, res) => {
  try {
    const { popup, errors } = validatePopupPayload(req.body);
    if (errors.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: errors[0], errors });
    }

    const existing = await MarketingPopupMongo.findOne({
      "frequency.storageKey": popup.frequency.storageKey,
    })
      .select("_id")
      .lean();

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "מזהה התדירות כבר בשימוש בפופאפ אחר",
      });
    }

    const created = await MarketingPopupMongo.create({
      ...popup,
      createdBy: req.user?._id,
      updatedBy: req.user?._id,
    });

    invalidateAll();

    res.status(201).json({
      success: true,
      message: "הפופאפ נוצר בהצלחה",
      data: created,
    });
  } catch (error) {
    console.error("❌ createPopup:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Full popup document for the editor
// @route   GET /api/admin/popups/:id
// @access  Admin
export const getPopup = async (req, res) => {
  try {
    const popup = await MarketingPopupMongo.findById(req.params.id).lean();
    if (!popup) {
      return res.status(404).json({ success: false, message: "פופאפ לא נמצא" });
    }

    res.json({ success: true, data: popup });
  } catch (error) {
    console.error("❌ getPopup:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a popup
// @route   PUT /api/admin/popups/:id
// @access  Admin
export const updatePopup = async (req, res) => {
  try {
    const existing = await MarketingPopupMongo.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "פופאפ לא נמצא" });
    }

    const { popup, errors } = validatePopupPayload(req.body);
    if (errors.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: errors[0], errors });
    }

    const keyClash = await MarketingPopupMongo.findOne({
      "frequency.storageKey": popup.frequency.storageKey,
      _id: { $ne: existing._id },
    })
      .select("_id")
      .lean();

    if (keyClash) {
      return res.status(400).json({
        success: false,
        message: "מזהה התדירות כבר בשימוש בפופאפ אחר",
      });
    }

    // Stats live on the variant and must survive an edit, so they are carried
    // over by key rather than overwritten by the incoming payload.
    const statsByKey = new Map(
      existing.variants.map((variant) => [variant.key, variant.stats]),
    );

    existing.set({
      ...popup,
      variants: popup.variants.map((variant) => ({
        ...variant,
        stats: statsByKey.get(variant.key) || {
          impressions: 0,
          conversions: 0,
          dismissals: 0,
        },
      })),
      updatedBy: req.user?._id,
    });

    await existing.save();
    invalidateAll();

    res.json({ success: true, message: "הפופאפ עודכן", data: existing });
  } catch (error) {
    console.error("❌ updatePopup:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Flip a popup live or paused without opening the editor
// @route   PATCH /api/admin/popups/:id/status
// @access  Admin
export const updatePopupStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["draft", "active", "paused"].includes(status)) {
      return res.status(400).json({ success: false, message: "סטטוס לא תקין" });
    }

    const popup = await MarketingPopupMongo.findByIdAndUpdate(
      req.params.id,
      { status, updatedBy: req.user?._id },
      { new: true },
    ).select(LIST_FIELDS);

    if (!popup) {
      return res.status(404).json({ success: false, message: "פופאפ לא נמצא" });
    }

    invalidateAll();

    res.json({
      success: true,
      message: "הסטטוס עודכן",
      data: summarize(popup),
    });
  } catch (error) {
    console.error("❌ updatePopupStatus:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Copy a popup as a paused draft with fresh counters
// @route   POST /api/admin/popups/:id/duplicate
// @access  Admin
export const duplicatePopup = async (req, res) => {
  try {
    const source = await MarketingPopupMongo.findById(req.params.id).lean();
    if (!source) {
      return res.status(404).json({ success: false, message: "פופאפ לא נמצא" });
    }

    // storageKey must stay unique, and the copy starts with clean stats.
    const copy = await MarketingPopupMongo.create({
      ...source,
      _id: undefined,
      name: `${source.name} (עותק)`,
      status: "draft",
      frequency: {
        ...source.frequency,
        storageKey: `${source.frequency.storageKey}-copy`.slice(0, 40),
      },
      variants: source.variants.map((variant) => ({
        ...variant,
        stats: { impressions: 0, conversions: 0, dismissals: 0 },
      })),
      createdBy: req.user?._id,
      updatedBy: req.user?._id,
    });

    res
      .status(201)
      .json({ success: true, message: "הפופאפ שוכפל", data: copy });
  } catch (error) {
    console.error("❌ duplicatePopup:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Per-variant A/B readout
// @route   GET /api/admin/popups/:id/stats
// @access  Admin
export const getPopupStats = async (req, res) => {
  try {
    const popup = await MarketingPopupMongo.findById(req.params.id)
      .select("name abTest variants")
      .lean();

    if (!popup) {
      return res.status(404).json({ success: false, message: "פופאפ לא נמצא" });
    }

    const variants = (popup.variants || []).map((variant) => {
      const {
        impressions = 0,
        conversions = 0,
        dismissals = 0,
      } = variant.stats || {};

      return {
        key: variant.key,
        label: variant.label,
        weight: variant.weight,
        impressions,
        conversions,
        dismissals,
        conversionRate: impressions > 0 ? conversions / impressions : 0,
      };
    });

    res.json({
      success: true,
      data: { name: popup.name, goal: popup.abTest?.goal, variants },
    });
  } catch (error) {
    console.error("❌ getPopupStats:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Zero the A/B counters (destructive — ROI only)
// @route   POST /api/admin/popups/:id/stats/reset
// @access  ROI
export const resetPopupStats = async (req, res) => {
  try {
    const popup = await MarketingPopupMongo.findById(req.params.id);
    if (!popup) {
      return res.status(404).json({ success: false, message: "פופאפ לא נמצא" });
    }

    popup.variants.forEach((variant) => {
      variant.stats = { impressions: 0, conversions: 0, dismissals: 0 };
    });
    popup.updatedBy = req.user?._id;
    await popup.save();

    res.json({ success: true, message: "הנתונים אופסו" });
  } catch (error) {
    console.error("❌ resetPopupStats:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a popup
// @route   DELETE /api/admin/popups/:id
// @access  Admin
export const deletePopup = async (req, res) => {
  try {
    const popup = await MarketingPopupMongo.findByIdAndDelete(req.params.id);
    if (!popup) {
      return res.status(404).json({ success: false, message: "פופאפ לא נמצא" });
    }

    invalidateAll();

    res.json({ success: true, message: "הפופאפ נמחק" });
  } catch (error) {
    console.error("❌ deletePopup:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
