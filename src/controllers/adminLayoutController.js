import AdminLayoutPreferenceMongo from "../models/AdminLayoutPreferenceMongo.js";

/**
 * Per-admin workspace layout. Every handler scopes to req.user._id — an admin
 * can only ever read or write their own arrangement, never another user's.
 */

const SAFE_KEY = /^[A-Za-z0-9_-]{1,40}$/;
const MAX_WIDGETS = 24;
const MAX_NAV_ITEMS = 40;

const sanitizeWidgets = (widgets) => {
  if (!Array.isArray(widgets)) return undefined;

  const seen = new Set();

  return widgets
    .slice(0, MAX_WIDGETS)
    .filter((widget) => {
      const key = widget?.widgetKey;
      if (typeof key !== "string" || !SAFE_KEY.test(key) || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .map((widget) => ({
      widgetKey: widget.widgetKey,
      visible: widget.visible !== false,
      span: Math.min(Math.max(Number(widget.span) || 4, 3), 12),
      settings:
        widget.settings && typeof widget.settings === "object"
          ? widget.settings
          : {},
    }));
};

const sanitizeKeyList = (value) => {
  if (!Array.isArray(value)) return undefined;
  return [
    ...new Set(
      value.filter((key) => typeof key === "string" && SAFE_KEY.test(key)),
    ),
  ].slice(0, MAX_NAV_ITEMS);
};

const sanitizeSidebar = (sidebar) => {
  if (!sidebar || typeof sidebar !== "object") return undefined;

  const result = {};
  const order = sanitizeKeyList(sidebar.order);
  const hidden = sanitizeKeyList(sidebar.hidden);
  const pinned = sanitizeKeyList(sidebar.pinned);

  if (order) result.order = order;
  if (hidden) result.hidden = hidden;
  if (pinned) result.pinned = pinned;
  if (typeof sidebar.collapsed === "boolean") result.collapsed = sidebar.collapsed;

  return result;
};

const sanitizePreferences = (preferences) => {
  if (!preferences || typeof preferences !== "object") return undefined;

  const result = {};
  if (SAFE_KEY.test(preferences.defaultLanding || "")) {
    result.defaultLanding = preferences.defaultLanding;
  }
  if (["comfortable", "compact"].includes(preferences.density)) {
    result.density = preferences.density;
  }
  if (["light", "dark", "system"].includes(preferences.theme)) {
    result.theme = preferences.theme;
  }
  if (SAFE_KEY.test(preferences.statsPeriod || "")) {
    result.statsPeriod = preferences.statsPeriod;
  }

  return result;
};

// @desc    Current admin's layout, or {} when never customized
// @route   GET /api/admin/layout-preference
// @access  Admin
export const getLayoutPreference = async (req, res) => {
  try {
    const preference = await AdminLayoutPreferenceMongo.findOne({
      userId: req.user._id,
    }).lean();

    // An absent document is the normal case and means "use the defaults" —
    // we don't write a row just because someone opened the dashboard.
    res.json({ success: true, data: preference || {} });
  } catch (error) {
    console.error("❌ getLayoutPreference:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const upsert = async (userId, update) =>
  AdminLayoutPreferenceMongo.findOneAndUpdate({ userId }, update, {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  }).lean();

// @desc    Replace the whole layout
// @route   PUT /api/admin/layout-preference
// @access  Admin
export const saveLayoutPreference = async (req, res) => {
  try {
    const update = { userId: req.user._id };

    const widgets = sanitizeWidgets(req.body.dashboardWidgets);
    const sidebar = sanitizeSidebar(req.body.sidebar);
    const preferences = sanitizePreferences(req.body.preferences);

    if (widgets) update.dashboardWidgets = widgets;
    if (sidebar) update.sidebar = sidebar;
    if (preferences) update.preferences = preferences;

    const saved = await upsert(req.user._id, update);

    res.json({ success: true, message: "הפריסה נשמרה", data: saved });
  } catch (error) {
    console.error("❌ saveLayoutPreference:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Persist a widget drag-and-drop
// @route   PATCH /api/admin/layout-preference/widgets
// @access  Admin
export const saveDashboardWidgets = async (req, res) => {
  try {
    const widgets = sanitizeWidgets(req.body.dashboardWidgets);
    if (!widgets) {
      return res
        .status(400)
        .json({ success: false, message: "dashboardWidgets חייב להיות מערך" });
    }

    const saved = await upsert(req.user._id, {
      userId: req.user._id,
      dashboardWidgets: widgets,
    });

    res.json({
      success: true,
      data: { dashboardWidgets: saved.dashboardWidgets },
    });
  } catch (error) {
    console.error("❌ saveDashboardWidgets:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Persist sidebar order / hidden / pinned
// @route   PATCH /api/admin/layout-preference/sidebar
// @access  Admin
export const saveSidebarPreference = async (req, res) => {
  try {
    const sidebar = sanitizeSidebar(req.body.sidebar ?? req.body);
    if (!sidebar) {
      return res
        .status(400)
        .json({ success: false, message: "נתוני סרגל צד לא תקינים" });
    }

    const saved = await upsert(req.user._id, {
      userId: req.user._id,
      sidebar,
    });

    res.json({ success: true, data: { sidebar: saved.sidebar } });
  } catch (error) {
    console.error("❌ saveSidebarPreference:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Back to the default workspace
// @route   DELETE /api/admin/layout-preference
// @access  Admin
export const resetLayoutPreference = async (req, res) => {
  try {
    await AdminLayoutPreferenceMongo.deleteOne({ userId: req.user._id });
    res.json({ success: true, message: "הפריסה אופסה לברירת המחדל" });
  } catch (error) {
    console.error("❌ resetLayoutPreference:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
