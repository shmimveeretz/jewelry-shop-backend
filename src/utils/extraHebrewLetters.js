const HEBREW_LETTER_RE = /[\u05D0-\u05EA]/g;
const SINGLE_HEBREW_LETTER_RE = /^[\u05D0-\u05EA]$/;

/** Max extra letters a customer can add to one letter product. */
export const MAX_EXTRA_LETTERS = 5;

/**
 * Default per-letter pricing by metal type. Used for letter products whose
 * DB document has no `extraLetterForBracelet` entry (mirrors letter-chain pricing).
 */
export const DEFAULT_EXTRA_LETTER_PRICING = {
  "כסף 925": 90,
  "ציפוי זהב": 110,
  "זהב 14 קראט": 240,
};

/** Flatten extraLetters array so each entry is exactly one Hebrew letter. */
export function normalizeExtraHebrewLetters(extraLetters) {
  if (!Array.isArray(extraLetters)) return [];

  const letters = [];
  for (const entry of extraLetters) {
    if (typeof entry !== "string") continue;
    const matches = entry.match(HEBREW_LETTER_RE);
    if (matches) letters.push(...matches);
  }
  return letters.slice(0, MAX_EXTRA_LETTERS);
}

export function isValidHebrewLetter(letter) {
  return typeof letter === "string" && SINGLE_HEBREW_LETTER_RE.test(letter);
}

export function getExtraLetterPerBraceletCost(priceAdditions, metalType) {
  const val = priceAdditions?.extraLetterForBracelet;
  if (typeof val === "number") return val;
  if (val && typeof val === "object" && metalType) return val[metalType] ?? 0;
  if (!val && metalType) return DEFAULT_EXTRA_LETTER_PRICING[metalType] ?? 0;
  return 0;
}

const EXTRA_LETTERS_NAME_MARKER = "(צירוף:";

/**
 * Order-item name format: `[Main Item Name] (צירוף: [Letter 1],[Letter 2])`.
 * Example: "אלף" + ["ד", "ר"] → "אלף (צירוף: ד,ר)".
 * Idempotent — a name that already carries the marker is returned unchanged.
 */
export function formatItemNameWithExtraLetters(name, extraLetters) {
  const baseName = typeof name === "string" ? name : "";
  const letters = Array.isArray(extraLetters)
    ? extraLetters.filter(Boolean)
    : [];
  if (letters.length === 0 || baseName.includes(EXTRA_LETTERS_NAME_MARKER)) {
    return baseName;
  }
  return `${baseName} (צירוף: ${letters.join(",")})`;
}

/** Hebrew-letter category products (single letters + letter chain). */
export function isHebrewLetterProduct(product) {
  return (
    product?.category === "אותיות עבריות" ||
    product?.categoryEn === "Hebrew Letters" ||
    product?.id === "letter-chain"
  );
}

/**
 * Whether extra letters should be priced for this product/selection.
 * letter-chain and other Hebrew-letter products: yes when letters are present.
 * Fallback for other products: only when jewelryType is bracelet.
 */
export function allowsExtraLettersPricing(product, jewelryType) {
  if (!product) return false;
  if (product.id === "letter-chain") return true;
  if (isHebrewLetterProduct(product)) return true;
  if (!product?.priceAdditions?.extraLetterForBracelet) return false;
  return jewelryType === "צמיד" || (jewelryType && String(jewelryType).startsWith("צמיד"));
}

export { SINGLE_HEBREW_LETTER_RE };
