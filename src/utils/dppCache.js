/**
 * Process-local TTL cache for DPP bootstrap payloads.
 *
 * An ad campaign sends thousands of identical requests for the same slug, all
 * arriving from a handful of edge node IPs. Without this, each one costs two
 * Mongo round trips. Entries are cleared on publish, so an admin never has to
 * wait out the TTL to see a change go live.
 */

const TTL_MS = 60 * 1000;
const MAX_ENTRIES = 200;

const store = new Map();

export function getCached(key) {
  const entry = store.get(key);
  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }

  // Refresh insertion order so the eviction below stays roughly LRU.
  store.delete(key);
  store.set(key, entry);
  return entry.value;
}

export function setCached(key, value) {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { value, expiresAt: Date.now() + TTL_MS });
}

export function invalidate(key) {
  store.delete(key);
}

/** Used when a popup changes: it can appear on any number of pages. */
export function invalidateAll() {
  store.clear();
}
