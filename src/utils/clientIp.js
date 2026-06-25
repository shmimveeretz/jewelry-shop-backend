/**
 * Normalize and extract client IP consistently across the API.
 */
export const normalizeIP = (ip) => {
  if (!ip || typeof ip !== "string") return "";
  let normalized = ip.trim();
  if (normalized.startsWith("::ffff:")) {
    normalized = normalized.slice(7);
  }
  return normalized;
};

export const getClientIP = (req) => {
  const raw =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    "";

  return normalizeIP(raw) || "UNKNOWN";
};
