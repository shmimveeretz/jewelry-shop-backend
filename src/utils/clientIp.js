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

/**
 * Uses req.ip, which Express derives from X-Forwarded-For according to the
 * "trust proxy" setting (one hop: Render's proxy). Reading the header's first
 * entry directly would let any client spoof its IP and dodge IP blocks.
 */
export const getClientIP = (req) => {
  const raw =
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    "";

  return normalizeIP(raw) || "UNKNOWN";
};
