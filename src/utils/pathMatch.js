/**
 * Glob matching for popup path targeting. Supports a single "*" wildcard per
 * segment plus a trailing "*", which covers everything the admin UI offers
 * ("*", "/lp/*", "/shop").
 */
export function matchesGlob(path, pattern) {
  if (!pattern) return false;
  if (pattern === "*") return true;

  const escaped = pattern
    .trim()
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");

  return new RegExp(`^${escaped}/?$`).test(path);
}

export function matchesAnyGlob(path, patterns = []) {
  return patterns.some((pattern) => matchesGlob(path, pattern));
}
