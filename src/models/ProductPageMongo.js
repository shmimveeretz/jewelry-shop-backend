import mongoose from "mongoose";

/**
 * A Dedicated Product Page (DPP): a campaign landing page assembled from
 * reorderable blocks instead of hardcoded JSX.
 *
 * Editing writes to `draft`; only `published` is ever served to visitors, so a
 * half-finished edit can never break a live ad.
 */

export const BLOCK_TYPES = [
  "hero", // gallery + title + price + benefits + primary CTA
  "optionSelector", // metal / length / jewelry type picker (drives price)
  "trustSignals",
  "features",
  "story", // description, meaning, biblical quote
  "socialProof", // rating + reviews
  "pricing", // offer box, bundle, shipping note
  "faq",
  "finalCta",
  "stickyCta", // pinned, not part of the scroll flow
  "richText",
  "imageBanner",
  "countdown",
  "videoEmbed",
  "spacer",
];

const blockSchema = new mongoose.Schema(
  {
    // nanoid assigned on insert; stable across reorder so React keys and
    // per-block edit history survive an arrayMove.
    key: { type: String, required: true },
    type: { type: String, enum: BLOCK_TYPES, required: true },
    enabled: { type: Boolean, default: true },
    // "flow" blocks render in array order; "pinned" ones (stickyCta) render
    // outside the flow so reordering can never bury the sticky bar.
    placement: { type: String, enum: ["flow", "pinned"], default: "flow" },
    visibility: {
      mobile: { type: Boolean, default: true },
      desktop: { type: Boolean, default: true },
    },
    // Per-type payload. Mixed on purpose, but every write goes through
    // validateBlocks(), which allowlists keys per type — never trusted as-is.
    props: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const layoutSchema = new mongoose.Schema(
  {
    blocks: { type: [blockSchema], default: [] },
    theme: {
      accent: { type: String, default: "gold" },
      background: { type: String, default: "cream" },
      ctaLabel: { type: String, default: "לרכישה מאובטחת" },
    },
  },
  { _id: false },
);

const ProductPageSchema = new mongoose.Schema(
  {
    // URL segment: /lp/:slug
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    // Matches ProductMongo.id (the string slug), not the ObjectId.
    productSlug: { type: String, required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },

    internalName: { type: String, required: true }, // admin-facing only
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },

    draft: { type: layoutSchema, default: () => ({}) },
    published: { type: layoutSchema, default: null },

    seo: {
      title: String,
      description: String,
      ogImage: String,
      noindex: { type: Boolean, default: true }, // campaign pages stay out of the index
    },

    // Popups eligible on this page; the runtime still applies each popup's own
    // targeting rules on top of this list.
    popups: [{ type: mongoose.Schema.Types.ObjectId, ref: "MarketingPopup" }],

    tracking: {
      fbPixelId: String,
      ga4MeasurementId: String,
      // Merged into the ViewContent / InitiateCheckout payloads.
      customEventParams: { type: mongoose.Schema.Types.Mixed, default: {} },
    },

    // Capped in the controller to MAX_REVISIONS most recent published layouts.
    revisions: [
      {
        layout: layoutSchema,
        publishedAt: Date,
        publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        _id: false,
      },
    ],

    publishedAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "productpages" },
);

// The public read path: one indexed hit, published only.
ProductPageSchema.index({ slug: 1, status: 1 });

export default mongoose.model("ProductPage", ProductPageSchema);
