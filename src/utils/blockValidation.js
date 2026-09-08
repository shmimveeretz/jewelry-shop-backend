import { randomUUID } from "crypto";
import { BLOCK_TYPES } from "../models/ProductPageMongo.js";
import {
  bool,
  describeShape,
  imageUrl,
  isoDate,
  linkUrl,
  list,
  num,
  oneOf,
  sanitizeAgainst,
  str,
  text,
} from "./fieldSanitizers.js";

/**
 * Block props are admin-authored and stored as Mixed, which makes them an
 * injection surface. Every write goes through validateBlocks(), which drops
 * anything not on the per-type allowlist below, coerces types, caps string
 * lengths, and restricts URLs to hosts we control.
 *
 * Adding a field to a block means adding it here first — a prop that is not
 * declared never reaches the database.
 */

const MAX_BLOCKS = 40;

/** Icons the frontend block registry knows how to render (lucide-react). */
const ALLOWED_ICONS = [
  "lock",
  "truck",
  "hammer",
  "rotateCcw",
  "shieldCheck",
  "badgeCheck",
  "gem",
  "star",
  "quote",
  "sparkles",
  "heart",
  "gift",
  "clock",
  "package",
];

/* -------------------------------------------------------------------------- */
/* Per-block-type prop allowlists                                             */
/* -------------------------------------------------------------------------- */

const iconItemShape = {
  icon: oneOf(ALLOWED_ICONS),
  title: str(80),
  text: str(300),
};

/**
 * The option picker renders in two places (inside the hero and as its own
 * block), so both types accept the same set of labels.
 */
const optionLabelShape = {
  jewelryTypeLabel: str(60),
  metalLabel: str(60),
  lengthLabel: str(60),
  lengthHint: str(120),
  validationMessage: str(160),
};

export const BLOCK_PROP_SCHEMAS = {
  hero: {
    eyebrow: str(60),
    headline: str(160),
    subheadline: str(300),
    // Left empty, the hero derives its benefits from the product (see
    // HeroBlock) — so a page nobody has customized still reads correctly.
    benefits: list({ text: str(160) }),
    showGallery: bool(),
    showRating: bool(),
    showPrice: bool(),
    // The option picker sits inside the hero panel by default: keeping the
    // choice adjacent to the CTA is what makes the above-fold convert. The
    // standalone optionSelector block exists for a second picker further down.
    showOptions: bool(),
    showStock: bool(),
    priceNote: str(120),
    ctaLabel: str(60),
    reassuranceText: str(160),
    footnote: str(200),
    lowStockThreshold: num(0, 100),
    ...optionLabelShape,
  },
  optionSelector: {
    title: str(80),
    showCta: bool(),
    ctaLabel: str(60),
    ...optionLabelShape,
  },
  trustSignals: {
    title: str(120),
    items: list(iconItemShape),
  },
  features: {
    title: str(120),
    items: list(iconItemShape),
    columns: num(1, 4),
  },
  story: {
    title: str(120),
    showDescription: bool(),
    showMeaning: bool(),
    meaningTitle: str(80),
    showQuote: bool(),
    extraBody: text(2000),
  },
  socialProof: {
    title: str(120),
    showRating: bool(),
    maxReviews: num(1, 12),
    fallbackTitle: str(120),
    fallbackText: text(600),
  },
  pricing: {
    title: str(120),
    badgeText: str(60),
    note: str(240),
    showShippingLine: bool(),
    ctaLabel: str(60),
  },
  faq: {
    title: str(120),
    items: list({ question: str(200), answer: text(1200) }),
  },
  finalCta: {
    headline: str(160),
    subheadline: str(300),
    ctaLabel: str(60),
    background: oneOf(["navy", "cream", "white", "gold"]),
  },
  stickyCta: {
    ctaLabel: str(60),
    totalLabel: str(40),
    showOnDesktop: bool(),
  },
  richText: {
    title: str(120),
    body: text(4000),
    align: oneOf(["start", "center", "end"]),
  },
  imageBanner: {
    imageUrl: imageUrl(),
    alt: str(160),
    href: linkUrl(),
    fullWidth: bool(),
  },
  countdown: {
    title: str(120),
    endsAt: isoDate(),
    expiredText: str(160),
  },
  videoEmbed: {
    title: str(120),
    provider: oneOf(["youtube", "vimeo"]),
    // Id only, never a full URL: the frontend builds the iframe src itself so
    // an admin can't point the embed at an arbitrary origin.
    videoId: str(40),
    caption: str(200),
  },
  spacer: {
    size: oneOf(["sm", "md", "lg", "xl"]),
  },
};

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

const SAFE_KEY = /^[A-Za-z0-9_-]{1,40}$/;

/**
 * Validates and sanitizes a block array coming from the DPP builder.
 * Returns the cleaned array plus any errors worth surfacing to the admin.
 */
export function validateBlocks(blocks) {
  const errors = [];

  if (!Array.isArray(blocks)) {
    return { blocks: [], errors: ["blocks חייב להיות מערך"] };
  }

  if (blocks.length > MAX_BLOCKS) {
    errors.push(`ניתן להוסיף עד ${MAX_BLOCKS} בלוקים בעמוד`);
  }

  const seenKeys = new Set();

  const sanitized = blocks.slice(0, MAX_BLOCKS).map((block, index) => {
    const source = block && typeof block === "object" ? block : {};
    const type = source.type;

    if (!BLOCK_TYPES.includes(type)) {
      errors.push(`בלוק ${index + 1}: סוג לא מוכר "${type}"`);
      return null;
    }

    // Keys arrive from the client but must stay unique and printable, since
    // they end up as React keys and in edit history.
    let key = typeof source.key === "string" ? source.key : "";
    if (!SAFE_KEY.test(key) || seenKeys.has(key)) key = randomUUID();
    seenKeys.add(key);

    const visibility = source.visibility || {};

    return {
      key,
      type,
      enabled: source.enabled !== false,
      // stickyCta is the only pinned block; anything else is part of the flow.
      placement: type === "stickyCta" ? "pinned" : "flow",
      visibility: {
        mobile: visibility.mobile !== false,
        desktop: visibility.desktop !== false,
      },
      props: sanitizeAgainst(BLOCK_PROP_SCHEMAS[type], source.props),
    };
  });

  return { blocks: sanitized.filter(Boolean), errors };
}

/** Theme is a small fixed set of tokens, not arbitrary CSS. */
export function validateTheme(theme) {
  const shape = {
    accent: oneOf(["gold", "navy", "cream"]),
    background: oneOf(["cream", "white", "navy"]),
    ctaLabel: str(60),
  };
  return sanitizeAgainst(shape, theme);
}

/**
 * Describes the editable props of every block type so the admin inspector can
 * build its forms from server metadata instead of a duplicated client copy.
 */
export function describeBlockTypes() {
  return BLOCK_TYPES.map((type) => ({
    type,
    placement: type === "stickyCta" ? "pinned" : "flow",
    fields: describeShape(BLOCK_PROP_SCHEMAS[type] || {}),
    icons: ALLOWED_ICONS,
  }));
}

export { ALLOWED_ICONS };
