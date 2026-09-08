import MarketingPopupMongo from "../models/MarketingPopupMongo.js";
import { matchesAnyGlob } from "./pathMatch.js";
import { ensureDefaultPopups } from "./defaultPopups.js";

/**
 * Path targeting is resolved on the server so the payload only carries popups
 * that could plausibly fire here. Device, referrer, UTM and frequency rules
 * stay client-side — they depend on the visitor, not the URL, and evaluating
 * them here would make the response uncacheable.
 */

const POPUP_FIELDS = [
  "name",
  "priority",
  "trigger",
  "targeting",
  "frequency",
  "abTest",
  "variants",
].join(" ");

/** Strips admin-only data (stats, authorship, timestamps) before it ships. */
export function toPublicPopup(popup) {
  return {
    _id: String(popup._id),
    priority: popup.priority ?? 0,
    trigger: popup.trigger,
    targeting: {
      devices: popup.targeting?.devices || [],
      referrers: popup.targeting?.referrers || [],
      excludeReferrers: popup.targeting?.excludeReferrers || [],
      utmSource: popup.targeting?.utmSource || [],
      newVisitorsOnly: Boolean(popup.targeting?.newVisitorsOnly),
      languages: popup.targeting?.languages || ["he", "en"],
    },
    frequency: popup.frequency,
    abTest: {
      enabled: Boolean(popup.abTest?.enabled),
      splitBy: popup.abTest?.splitBy || "visitor",
      goal: popup.abTest?.goal || "ctaClick",
    },
    // Variant stats are deliberately not exposed: they are an admin metric and
    // would let anyone read campaign performance off the wire.
    variants: (popup.variants || []).map((variant) => ({
      key: variant.key,
      weight: variant.weight ?? 50,
      content: variant.content,
      style: variant.style,
    })),
  };
}

/**
 * Active, in-schedule popups whose path rules match `path`.
 * `alwaysIncludeIds` are popups explicitly attached to a DPP; they still have
 * to be active and in schedule, but bypass the path globs.
 */
export async function findActivePopupsForPath(path, alwaysIncludeIds = []) {
  await ensureDefaultPopups();

  const now = new Date();

  const popups = await MarketingPopupMongo.find({
    status: "active",
    $and: [
      { $or: [{ "schedule.startAt": null }, { "schedule.startAt": { $lte: now } }] },
      { $or: [{ "schedule.endAt": null }, { "schedule.endAt": { $gte: now } }] },
    ],
  })
    .select(POPUP_FIELDS)
    .sort({ priority: -1 })
    .lean();

  const attached = new Set(alwaysIncludeIds.map(String));

  return popups
    .filter((popup) => {
      if (attached.has(String(popup._id))) return true;

      const { includePaths = ["*"], excludePaths = [] } = popup.targeting || {};
      if (matchesAnyGlob(path, excludePaths)) return false;
      return matchesAnyGlob(path, includePaths);
    })
    .map(toPublicPopup);
}
