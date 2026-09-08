import MarketingPopupMongo from "../models/MarketingPopupMongo.js";

/**
 * The newsletter offer that used to be a hardcoded React component on the home
 * page. Seeded once so moving it into the CMS does not silently drop a live
 * offer — and so an admin has a working example to copy from.
 */
const DEFAULT_NEWSLETTER_POPUP = {
  name: "ניוזלטר — 10% הנחה",
  status: "active",
  priority: 0,
  trigger: { type: "timeDelay", delayMs: 5000 },
  targeting: {
    devices: ["mobile", "desktop", "tablet"],
    // Home page only, matching the component this replaces.
    includePaths: ["/"],
    excludePaths: ["/checkout", "/payment", "/lp/*"],
    languages: ["he", "en"],
  },
  frequency: {
    storageKey: "newsletter",
    showOncePerVisitor: true,
    cooldownDays: 30,
    maxImpressionsPerSession: 1,
  },
  abTest: { enabled: false, splitBy: "visitor", goal: "newsletterSignup" },
  variants: [
    {
      key: "a",
      label: "מקורי",
      weight: 100,
      content: {
        headline: "הצטרפו לקהילה השמימית שלנו",
        subheadline: "הירשמו ותקבלו 10% הנחה לקנייה הראשונה",
        ctaLabel: "אני רוצה הנחה",
        ctaAction: "newsletter",
        dismissLabel: "לא תודה, אמשיך לגלוש",
      },
      style: {
        layout: "modal",
        position: "center",
        accentColor: "#C9A227",
        backgroundColor: "#FFFFFF",
        textColor: "#1B2A4A",
        borderRadius: 16,
        showOverlay: true,
        ariaLabel: "הרשמה לניוזלטר וקבלת הנחה",
      },
    },
  ],
};

// One check per process, not per request.
let hasChecked = false;

export async function ensureDefaultPopups() {
  if (hasChecked) return;
  hasChecked = true;

  try {
    const count = await MarketingPopupMongo.estimatedDocumentCount();
    if (count === 0) {
      await MarketingPopupMongo.create(DEFAULT_NEWSLETTER_POPUP);
    }
  } catch (error) {
    // Seeding is a convenience, never a reason to fail a visitor's request.
    console.error("❌ ensureDefaultPopups:", error.message);
  }
}
