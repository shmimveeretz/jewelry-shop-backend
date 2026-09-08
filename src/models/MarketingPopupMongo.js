import mongoose from "mongoose";

/**
 * A marketing popup rule: what it looks like, when it fires, who sees it, and
 * how its A/B variants split.
 *
 * Content is a structured model rather than a free HTML field, so admin input
 * never reaches dangerouslySetInnerHTML.
 */

const variantSchema = new mongoose.Schema(
  {
    key: { type: String, required: true }, // "a", "b", ...
    label: { type: String, default: "" },
    weight: { type: Number, default: 50, min: 0, max: 100 },

    content: {
      headline: String,
      subheadline: String,
      body: String,
      imageUrl: String,
      ctaLabel: String,
      ctaAction: {
        type: String,
        enum: ["close", "url", "scrollToCta", "newsletter", "applyCoupon"],
        default: "close",
      },
      ctaValue: String, // URL, coupon code, or element id
      dismissLabel: { type: String, default: "לא תודה" },
    },

    style: {
      layout: {
        type: String,
        enum: ["modal", "slideIn", "bar", "fullscreen"],
        default: "modal",
      },
      position: {
        type: String,
        enum: ["center", "bottom", "bottomStart", "bottomEnd", "top"],
        default: "center",
      },
      accentColor: { type: String, default: "#C9A227" },
      backgroundColor: { type: String, default: "#FFFFFF" },
      textColor: { type: String, default: "#1B2A4A" },
      borderRadius: { type: Number, default: 16 },
      showOverlay: { type: Boolean, default: true },
      // Screen-reader label; the popup renders as a focus-trapped dialog.
      ariaLabel: String,
    },

    // Incremented via sendBeacon; powers the A/B readout in the admin.
    stats: {
      impressions: { type: Number, default: 0 },
      conversions: { type: Number, default: 0 },
      dismissals: { type: Number, default: 0 },
    },
  },
  { _id: false },
);

const MarketingPopupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    status: {
      type: String,
      enum: ["draft", "active", "paused"],
      default: "draft",
    },
    priority: { type: Number, default: 0 }, // highest wins when several match at once

    trigger: {
      type: {
        type: String,
        enum: [
          "immediate",
          "timeDelay",
          "scrollDepth",
          "exitIntent",
          "idle",
          "onCtaAbandon",
        ],
        default: "timeDelay",
      },
      delayMs: { type: Number, default: 5000 }, // timeDelay | idle
      scrollPercent: { type: Number, default: 50 }, // scrollDepth
    },

    targeting: {
      devices: {
        type: [String],
        enum: ["mobile", "desktop", "tablet"],
        default: ["mobile", "desktop", "tablet"],
      },
      // Substring match against document.referrer, e.g. "facebook.com".
      referrers: { type: [String], default: [] },
      excludeReferrers: { type: [String], default: [] },
      // Path globs: ["/lp/*"], ["/shop"], ["*"]
      includePaths: { type: [String], default: ["*"] },
      excludePaths: { type: [String], default: ["/checkout", "/payment"] },
      utmSource: { type: [String], default: [] },
      newVisitorsOnly: { type: Boolean, default: false },
      languages: { type: [String], enum: ["he", "en"], default: ["he", "en"] },
    },

    frequency: {
      // localStorage key suffix, e.g. "SUMMER26" -> popup_seen_SUMMER26
      storageKey: { type: String, required: true },
      showOncePerVisitor: { type: Boolean, default: true },
      cooldownDays: { type: Number, default: 7 },
      maxImpressionsPerSession: { type: Number, default: 1 },
    },

    schedule: { startAt: Date, endAt: Date },

    abTest: {
      enabled: { type: Boolean, default: false },
      // Sticky per visitor: hash(visitorId + popupId) % 100 mapped onto the
      // variant weights. Deterministic, so a returning visitor always sees the
      // same variant without a server round trip.
      splitBy: { type: String, enum: ["visitor", "session"], default: "visitor" },
      goal: {
        type: String,
        enum: [
          "ctaClick",
          "newsletterSignup",
          "couponApplied",
          "checkoutStarted",
        ],
        default: "ctaClick",
      },
    },

    variants: {
      type: [variantSchema],
      validate: [(v) => v.length > 0, "A popup needs at least one variant"],
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "marketingpopups" },
);

MarketingPopupSchema.index({ status: 1, priority: -1 });

export default mongoose.model("MarketingPopup", MarketingPopupSchema);
