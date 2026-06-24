const HEBREW_LETTER_RE = /[\u05D0-\u05EA]/g;
const SINGLE_HEBREW_LETTER_RE = /^[\u05D0-\u05EA]$/;

/** Flatten extraLetters array so each entry is exactly one Hebrew letter. */
export function normalizeExtraHebrewLetters(extraLetters) {
  if (!Array.isArray(extraLetters)) return [];

  const letters = [];
  for (const entry of extraLetters) {
    if (typeof entry !== "string") continue;
    const matches = entry.match(HEBREW_LETTER_RE);
    if (matches) letters.push(...matches);
  }
  return letters;
}

export function isValidHebrewLetter(letter) {
  return typeof letter === "string" && SINGLE_HEBREW_LETTER_RE.test(letter);
}

export function getExtraLetterPerBraceletCost(priceAdditions, metalType) {
  const val = priceAdditions?.extraLetterForBracelet;
  if (typeof val === "number") return val;
  if (val && typeof val === "object" && metalType) return val[metalType] ?? 0;
  return 0;
}

export { SINGLE_HEBREW_LETTER_RE };
