import mongoose from "mongoose";

/**
 * Per-admin workspace layout: which dashboard widgets are shown and in what
 * order, plus sidebar arrangement.
 *
 * A missing document means "never customized" and the client falls back to
 * DEFAULT_DASHBOARD_LAYOUT, so we don't write a row on first login.
 */

const widgetSchema = new mongoose.Schema(
  {
    // Looked up in WIDGET_REGISTRY; unknown keys are ignored on render, which
    // makes deleting a widget from the code a non-breaking change.
    widgetKey: { type: String, required: true },
    visible: { type: Boolean, default: true },
    // Column span on a 12-column grid. Deliberately not free x/y: order + span
    // stays sane when the grid collapses to a single column on mobile.
    span: { type: Number, default: 4, min: 3, max: 12 },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} }, // e.g. { period: "30d" }
  },
  { _id: false },
);

const AdminLayoutPreferenceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    // Array order IS the widget order, same convention as ProductPage.blocks.
    dashboardWidgets: { type: [widgetSchema], default: [] },

    sidebar: {
      order: { type: [String], default: [] }, // nav keys, top to bottom
      hidden: { type: [String], default: [] },
      pinned: { type: [String], default: [] }, // surfaced above the divider
      collapsed: { type: Boolean, default: false },
    },

    preferences: {
      defaultLanding: { type: String, default: "dashboard" },
      density: {
        type: String,
        enum: ["comfortable", "compact"],
        default: "comfortable",
      },
      theme: {
        type: String,
        enum: ["light", "dark", "system"],
        default: "light",
      },
      statsPeriod: { type: String, default: "30d" },
    },
  },
  { timestamps: true, collection: "adminlayoutpreferences" },
);

export default mongoose.model(
  "AdminLayoutPreference",
  AdminLayoutPreferenceSchema,
);
