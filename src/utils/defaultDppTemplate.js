/**
 * The layout every /lp/:slug falls back to when no ProductPage document exists
 * for it. It reproduces the hardcoded campaign page this system replaces, so
 * every ad link that already points at /lp/<productId> keeps working untouched
 * and starts rendering through the block pipeline instead.
 *
 * Also the starting point for "create page from template" in the builder.
 */

export const DEFAULT_THEME = {
  accent: "gold",
  background: "cream",
  ctaLabel: "לרכישה מאובטחת",
};

export function buildDefaultBlocks() {
  return [
    {
      key: "default-hero",
      type: "hero",
      enabled: true,
      placement: "flow",
      visibility: { mobile: true, desktop: true },
      props: {
        // benefits intentionally omitted: the hero derives them from the
        // product so an uncustomized page still reads correctly.
        showGallery: true,
        showRating: true,
        showPrice: true,
        showOptions: true,
        showStock: true,
        priceNote: 'כולל מע"מ ומשלוח',
        ctaLabel: "לרכישה מאובטחת",
        reassuranceText: "תשלום מאובטח, ללא התחייבות, 14 יום להחזרה",
        footnote: "נוצר בעבודת יד בהזמנה אישית ונשלח תוך עד 14 ימי עסקים",
        lowStockThreshold: 5,
      },
    },
    {
      key: "default-trust",
      type: "trustSignals",
      enabled: true,
      placement: "flow",
      visibility: { mobile: true, desktop: true },
      props: {
        items: [
          {
            icon: "lock",
            title: "תשלום מאובטח",
            text: "סליקה מוצפנת בתקן PCI, ללא שמירת פרטי כרטיס",
          },
          {
            icon: "truck",
            title: "משלוח חינם לכל הארץ",
            text: "ללא עלות נוספת, בכל הזמנה ולכל יעד בישראל",
          },
          {
            icon: "hammer",
            title: "עבודת יד בישראל",
            text: "כל תכשיט נוצר בהזמנה אישית באולפן שלנו",
          },
          {
            icon: "rotateCcw",
            title: "14 יום להחזרה",
            text: "לא התאהבתם? מחזירים או מחליפים בלי כאב ראש",
          },
        ],
      },
    },
    {
      key: "default-story",
      type: "story",
      enabled: true,
      placement: "flow",
      visibility: { mobile: true, desktop: true },
      props: {
        title: "הסיפור שמאחורי התכשיט",
        showDescription: true,
        showMeaning: true,
        meaningTitle: "המשמעות",
        showQuote: true,
      },
    },
    {
      key: "default-social-proof",
      type: "socialProof",
      enabled: true,
      placement: "flow",
      visibility: { mobile: true, desktop: true },
      props: {
        title: "מה הלקוחות מספרים",
        showRating: true,
        maxReviews: 4,
        fallbackTitle: "תכשיטי מקור בעבודת יד",
        fallbackText:
          "כל תכשיט נוצר אצלנו באולפן בישראל, אחד אחד, מחומרים אמיתיים. זה לא תכשיט שקונים בכל מקום — וזו בדיוק הנקודה.",
      },
    },
    {
      key: "default-faq",
      type: "faq",
      enabled: true,
      placement: "flow",
      visibility: { mobile: true, desktop: true },
      props: {
        title: "שאלות שנשאלות לפני הרכישה",
        items: [
          {
            question: "מתי התכשיט יגיע אליי?",
            answer:
              "כל תכשיט נוצר בעבודת יד בהזמנה אישית ונשלח תוך עד 14 ימי עסקים. המשלוח עצמו הוא ללא עלות לכל הארץ.",
          },
          {
            question: "מה קורה אם המידה לא מתאימה?",
            answer:
              "אפשר להחזיר או להחליף תוך 14 יום מקבלת ההזמנה. אנחנו מטפלים בהחלפת מידה ללא עלות נוספת.",
          },
          {
            question: "מאילו חומרים התכשיט עשוי?",
            answer:
              "אנחנו עובדים עם כסף 925, ציפוי זהב וזהב 14 קראט. סוג המתכת שתבחרו מופיע בבחירה שלמעלה ומשפיע על המחיר הסופי.",
          },
          {
            question: "האם התשלום מאובטח?",
            answer:
              "כן. התשלום מתבצע בעמוד סליקה מוצפן ומאובטח, ופרטי הכרטיס אינם נשמרים אצלנו בשום שלב.",
          },
        ],
      },
    },
    {
      key: "default-final-cta",
      type: "finalCta",
      enabled: true,
      placement: "flow",
      visibility: { mobile: true, desktop: true },
      props: {
        subheadline: "עבודת יד בהזמנה אישית, משלוח חינם לכל הארץ ו-14 יום להחזרה.",
        ctaLabel: "לרכישה מאובטחת",
        background: "navy",
      },
    },
    {
      key: "default-sticky-cta",
      type: "stickyCta",
      enabled: true,
      placement: "pinned",
      visibility: { mobile: true, desktop: true },
      props: {
        ctaLabel: "לרכישה מאובטחת",
        totalLabel: 'סה"כ',
        showOnDesktop: false,
      },
    },
  ];
}

export function buildDefaultLayout() {
  return { blocks: buildDefaultBlocks(), theme: { ...DEFAULT_THEME } };
}
