import client from "../api/client";

/**
 * Module-level cache for /api/v1/users/me responses.
 *
 * The useAuth hook calls /me on every mount (page navigation). Without a
 * cache, this results in 2+ identical HTTP requests per navigation. This
 * module caches the profile for 5 seconds so subsequent calls return the
 * cached result without hitting the network.
 */

const CACHE_TTL_MS = 5_000;

let cachedProfile = null;
let lastFetchTime = 0;
let inflightPromise = null;

/**
 * Fetch /me with module-level deduplication.
 * If a fresh cache exists (< 5s), returns it immediately.
 * If a request is already in-flight, returns the same promise.
 */
export function fetchProfile() {
  // Return cached if fresh
  if (cachedProfile && Date.now() - lastFetchTime < CACHE_TTL_MS) {
    return Promise.resolve(cachedProfile);
  }

  // Deduplicate in-flight requests
  if (inflightPromise) return inflightPromise;

  inflightPromise = client
    .get("/api/v1/users/me")
    .then((res) => {
      const profile = res?.data?.data || null;
      cachedProfile = profile;
      lastFetchTime = Date.now();
      return profile;
    })
    .catch((err) => {
      // Don't cache errors
      lastFetchTime = 0;
      throw err;
    })
    .finally(() => {
      inflightPromise = null;
    });

  return inflightPromise;
}

/**
 * Invalidate the cache (e.g. after logout or profile update).
 */
export function invalidateProfileCache() {
  cachedProfile = null;
  lastFetchTime = 0;
}
