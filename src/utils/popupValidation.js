import { randomUUID } from "crypto";
import {
  bool,
  hexColor,
  imageUrl,
  isoDate,
  linkUrl,
  num,
  oneOf,
  sanitizeAgainst,
  str,
  stringList,
  text,
} from "./fieldSanitizers.js";

/**
 * Popups are admin-authored and rendered into a dialog on every page, so the
 * same rule as blocks applies: nothing reaches the database unless it is
 * declared here and survives coercion.
 *
 * The sharpest edge is `ctaValue` — with ctaAction "url" it becomes an href,
 * so it is validated against the action rather than as a free string.
 */

const MAX_VARIANTS = 4;
const SAFE_KEY = /^[A-Za-z0-9_-]{1,40}$/;
const COUPON_CODE = /^[A-Za-z0-9_-]{2,32}$/;
const ELEMENT_ID = /^[A-Za-z][A-Za-z0-9_-]{0,60}$/;

const contentShape = {
  headline: str(160),
  subheadline: str(240),
  body: text(1000),
  imageUrl: imageUrl(),
  ctaLabel: str(60),
  ctaAction: oneOf(["close", "url", "scrollToCta", "newsletter", "applyCoupon"]),
  dismissLabel: str(40),
};

const styleShape = {
  layout: oneOf(["modal", "slideIn", "bar", "fullscreen"]),
  position: oneOf(["center", "bottom", "bottomStart", "bottomEnd", "top"]),
  accentColor: hexColor(),
  backgroundColor: hexColor(),
  textColor: hexColor(),
  borderRadius: num(0, 48),
  showOverlay: bool(),
  ariaLabel: str(120),
};

const triggerShape = {
  type: oneOf([
    "immediate",
    "timeDelay",
    "scrollDepth",
    "exitIntent",
    "idle",
    "onCtaAbandon",
  ]),
  delayMs: num(0, 10 * 60 * 1000),
  scrollPercent: num(1, 100),
};

const targetingShape = {
  devices: stringList(10, 3),
  referrers: stringList(120, 10),
  excludeReferrers: stringList(120, 10),
  includePaths: stringList(120, 20),
  excludePaths: stringList(120, 20),
  utmSource: stringList(60, 10),
  newVisitorsOnly: bool(),
  languages: stringList(4, 2),
};

const frequencyShape = {
  showOncePerVisitor: bool(),
  cooldownDays: num(0, 365),
  maxImpressionsPerSession: num(1, 10),
};

const scheduleShape = {
  startAt: isoDate(),
  endAt: isoDate(),
};

const abTestShape = {
  enabled: bool(),
  splitBy: oneOf(["visitor", "session"]),
  goal: oneOf(["ctaClick", "newsletterSignup", "couponApplied", "checkoutStarted"]),
};

const DEVICES = ["mobile", "desktop", "tablet"];
const LANGUAGES = ["he", "en"];

/** ctaValue means something different per action, so it is validated per action. */
function sanitizeCtaValue(action, value) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const trimmed = value.trim();

  switch (action) {
    case "url":
      return linkUrl().coerce(trimmed);
    case "applyCoupon":
      return COUPON_CODE.test(trimmed) ? trimmed.toUpperCase() : undefined;
    case "scrollToCta":
      return ELEMENT_ID.test(trimmed) ? trimmed : undefined;
    default:
      // close / newsletter carry no value.
      return undefined;
  }
}

function sanitizeVariant(input, index) {
  const source = input && typeof input === "object" ? input : {};

  const key = SAFE_KEY.test(source.key || "")
    ? source.key
    : String.fromCharCode(97 + index); // a, b, c, d

  const content = sanitizeAgainst(contentShape, source.content);
  const ctaValue = sanitizeCtaValue(content.ctaAction, source.content?.ctaValue);
  if (ctaValue !== undefined) content.ctaValue = ctaValue;

  return {
    key,
    label: str(60).coerce(source.label) || "",
    weight: num(0, 100).coerce(source.weight) ?? 50,
    content,
    style: sanitizeAgainst(styleShape, source.style),
  };
}

export function validatePopupPayload(body = {}) {
  const errors = [];

  const name = str(120).coerce(body.name);
  if (!name) errors.push("יש לתת שם לפופאפ");

  const storageKey = SAFE_KEY.test(body.frequency?.storageKey || "")
    ? body.frequency.storageKey
    : null;
  if (!storageKey) {
    errors.push(
      "מזהה תדירות (storageKey) נדרש ויכול להכיל אותיות אנגליות, ספרות, מקף וקו תחתון בלבד",
    );
  }

  const rawVariants = Array.isArray(body.variants) ? body.variants : [];
  if (rawVariants.length === 0) errors.push("צריך לפחות וריאנט אחד");

  const variants = rawVariants.slice(0, MAX_VARIANTS).map(sanitizeVariant);

  // Variant keys must stay unique — the A/B stats counter targets them by key.
  const seen = new Set();
  for (const variant of variants) {
    if (seen.has(variant.key)) variant.key = randomUUID().slice(0, 8);
    seen.add(variant.key);
  }

  const targeting = sanitizeAgainst(targetingShape, body.targeting);
  if (targeting.devices) {
    targeting.devices = targeting.devices.filter((d) => DEVICES.includes(d));
  }
  if (targeting.languages) {
    targeting.languages = targeting.languages.filter((l) => LANGUAGES.includes(l));
  }

  const schedule = sanitizeAgainst(scheduleShape, body.schedule);
  if (schedule.startAt && schedule.endAt && schedule.endAt <= schedule.startAt) {
    errors.push("תאריך הסיום חייב להיות אחרי תאריך ההתחלה");
  }

  return {
    errors,
    popup: {
      name,
      status: oneOf(["draft", "active", "paused"]).coerce(body.status) || "draft",
      priority: num(-100, 100).coerce(body.priority) ?? 0,
      trigger: sanitizeAgainst(triggerShape, body.trigger),
      targeting,
      frequency: {
        ...sanitizeAgainst(frequencyShape, body.frequency),
        storageKey,
      },
      schedule,
      abTest: sanitizeAgainst(abTestShape, body.abTest),
      variants,
    },
  };
}
