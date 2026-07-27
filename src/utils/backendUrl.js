/**
 * Build absolute backend URLs without double slashes.
 * BACKEND_URL on Render is often set with a trailing slash.
 */
export function getBackendBaseUrl() {
  return (process.env.BACKEND_URL || "http://localhost:5000").replace(/\/+$/, "");
}

export function buildBackendUrl(path = "") {
  const base = getBackendBaseUrl();
  if (!path) return base;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
