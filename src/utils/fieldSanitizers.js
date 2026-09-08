/**
 * Declarative field coercers shared by the DPP block validator and the popup
 * validator. Each returns `undefined` for input it cannot vouch for, and
 * sanitizeAgainst() drops those keys — so an unrecognised or unsafe value is
 * simply absent rather than stored.
 *
 * Each field also carries a `kind` descriptor. That is what lets the admin
 * inspector build its forms from server metadata (GET /api/admin/block-types)
 * instead of keeping a second, drift-prone copy of every field definition.
 */

export const MAX_LIST_ITEMS = 20;

/** Images may only come from our own Cloudinary account or our own origin. */
export const ALLOWED_IMAGE_HOSTS = ["res.cloudinary.com"];

export const str = (max = 200) => ({
  kind: "text",
  max,
  coerce: (value) =>
    typeof value === "string" ? value.trim().slice(0, max) : undefined,
});

export const text = (max = 4000) => ({ ...str(max), kind: "textarea" });

export const bool = () => ({
  kind: "boolean",
  coerce: (value) => (typeof value === "boolean" ? value : undefined),
});

export const num = (min, max) => ({
  kind: "number",
  min,
  max,
  coerce: (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return undefined;
    return Math.min(Math.max(parsed, min), max);
  },
});

export const oneOf = (values) => ({
  kind: "enum",
  options: values,
  coerce: (value) => (values.includes(value) ? value : undefined),
});

export const isoDate = () => ({
  kind: "datetime",
  coerce: (value) => {
    if (typeof value !== "string" || !value) return undefined;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  },
});

/** #rgb or #rrggbb only — colours land in inline styles. */
export const hexColor = () => ({
  kind: "color",
  coerce: (value) =>
    typeof value === "string" &&
    /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim())
      ? value.trim()
      : undefined,
});

export const imageUrl = () => ({
  kind: "image",
  coerce: (value) => {
    if (typeof value !== "string" || !value.trim()) return undefined;
    const trimmed = value.trim();
    if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "https:") return undefined;
      return ALLOWED_IMAGE_HOSTS.includes(parsed.hostname)
        ? parsed.href
        : undefined;
    } catch {
      return undefined;
    }
  },
});

/**
 * Link targets. Blocks javascript:, data: and every other scheme that would
 * turn an href into script execution.
 */
export const linkUrl = () => ({
  kind: "url",
  coerce: (value) => {
    if (typeof value !== "string" || !value.trim()) return undefined;
    const trimmed = value.trim();
    if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === "https:" ? parsed.href : undefined;
    } catch {
      return undefined;
    }
  },
});

/** An array of plain strings, each trimmed and capped. */
export const stringList = (max = 120, maxItems = MAX_LIST_ITEMS) => ({
  kind: "stringList",
  max,
  maxItems,
  coerce: (value) => {
    if (!Array.isArray(value)) return undefined;
    return value
      .filter((item) => typeof item === "string" && item.trim())
      .slice(0, maxItems)
      .map((item) => item.trim().slice(0, max));
  },
});

export const list = (shape, maxItems = MAX_LIST_ITEMS) => ({
  kind: "list",
  shape,
  maxItems,
  coerce: (value) => {
    if (!Array.isArray(value)) return undefined;
    return value
      .slice(0, maxItems)
      .map((item) => sanitizeAgainst(shape, item))
      .filter((item) => Object.keys(item).length > 0);
  },
});

/** Keeps only keys declared in `shape`, coerced through their field type. */
export function sanitizeAgainst(shape, input) {
  const source = input && typeof input === "object" ? input : {};
  const output = {};

  for (const [key, field] of Object.entries(shape)) {
    const coerced = field.coerce(source[key]);
    if (coerced !== undefined) output[key] = coerced;
  }

  return output;
}

/** Serializes a shape into the JSON the admin inspector renders forms from. */
export function describeShape(shape) {
  return Object.entries(shape).map(([key, field]) => {
    const descriptor = { key, kind: field.kind };

    if (field.options) descriptor.options = field.options;
    if (field.max !== undefined) descriptor.max = field.max;
    if (field.min !== undefined) descriptor.min = field.min;
    if (field.maxItems !== undefined) descriptor.maxItems = field.maxItems;
    if (field.shape) descriptor.fields = describeShape(field.shape);

    return descriptor;
  });
}
