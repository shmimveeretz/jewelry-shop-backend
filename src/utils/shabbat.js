import axios from "axios";

/**
 * Server-side Shabbat / Yom Tov guard.
 *
 * The storefront hides itself during Shabbat and holidays (ShabbatMode.jsx),
 * but that is only visual: a page left open, or a direct API call, could
 * still place an order. New payments are refused here between candle
 * lighting and havdalah in Tel Aviv, using the same HebCal data as the site.
 *
 * Fails open: if HebCal cannot be reached, sales are never blocked by mistake.
 * Only *new* payments are blocked; a payment already in progress is still
 * recorded by the webhook (see paymentController).
 */

const TEL_AVIV_ID = 293397;
const CACHE_MS = 60 * 60 * 1000;
const cache = { at: 0, periods: [] };

async function loadClosedPeriods() {
  if (Date.now() - cache.at < CACHE_MS) return cache.periods;

  const year = new Date().getFullYear();
  const params = `geonameid=${TEL_AVIV_ID}&m=50&cfg=json`;

  const [shabbat, holidays] = await Promise.all([
    axios.get(`https://www.hebcal.com/shabbat?${params}&leyning=off`, { timeout: 5000 }),
    axios.get(
      `https://www.hebcal.com/hebcal?v=1&maj=on&min=off&nx=off&year=${year}&ss=off&mf=off&c=on&geo=geonameid&s=off&i=on&${params}`,
      { timeout: 5000 },
    ),
  ]);

  // Pair each candle lighting with the next havdalah (a Shabbat that runs
  // into Yom Tov has two candle lightings and one havdalah).
  const toPeriods = (items) => {
    const periods = [];
    let start = null;
    for (const item of items) {
      if (item.category === "candles") start ??= item.date;
      else if (item.category === "havdalah" && start) {
        periods.push({ start: new Date(start), end: new Date(item.date) });
        start = null;
      }
    }
    return periods;
  };

  cache.periods = [
    ...toPeriods(shabbat.data?.items || []),
    ...toPeriods(holidays.data?.items || []),
  ];
  cache.at = Date.now();
  return cache.periods;
}

/** True between candle lighting and havdalah (Tel Aviv). Never throws. */
export async function isStoreClosedForShabbat(now = new Date()) {
  try {
    const periods = await loadClosedPeriods();
    return periods.some(({ start, end }) => now >= start && now <= end);
  } catch (error) {
    console.warn("Shabbat check unavailable, allowing sales:", error.message);
    return false;
  }
}
