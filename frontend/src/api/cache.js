/**
 * Module-level API request deduplication + short-lived cache.
 *
 * Usage:
 *   import { cachedGet } from "../api/cache";
 *   const data = await cachedGet("/api/v1/bookings");
 *
 * Every GET request with the same URL (within TTL) shares one in-flight
 * promise. Subsequent callers get the same result without hitting the
 * network. After the TTL expires the next call re-fetches.
 *
 * This eliminates the "two components on the same page both independently
 * fetch the same endpoint" pattern that causes duplicate API calls.
 */
import client from "./client";

const DEFAULT_TTL_MS = 15_000;

// Map<url, { data, expiry }>
const cache = new Map();
// Map<url, promise> — in-flight deduplication
const inflight = new Map();

/**
 * Cached GET request. Returns the response data (already unwrapped from
 * the { message, data } envelope).
 *
 * @param {string} url   API endpoint (e.g. "/api/v1/bookings")
 * @param {object} [opts]
 * @param {number} [opts.ttl]     Cache TTL in ms (default 15 000)
 * @param {object} [opts.params]  Query params (included in cache key)
 * @param {*}      [opts.fallback] Value returned on error (default [])
 * @returns {Promise<*>}  Unwrapped response data
 */
export async function cachedGet(url, { ttl = DEFAULT_TTL_MS, params, fallback = [] } = {}) {
  // Build a stable cache key that includes params
  const key = params ? `${url}?${new URLSearchParams(params).toString()}` : url;

  // Return cached data if fresh
  const entry = cache.get(key);
  if (entry && Date.now() < entry.expiry) {
    return entry.data;
  }

  // Deduplicate in-flight requests
  if (inflight.has(key)) {
    return inflight.get(key);
  }

  const promise = client
    .get(url, { params })
    .then((res) => {
      // Unwrap the standard { message, data } envelope
      const raw = res?.data;
      const payload = raw && typeof raw === "object" && "data" in raw && "message" in raw ? raw.data : raw;
      // Unwrap paginated { content } if present
      const data = payload?.content ?? payload ?? fallback;
      cache.set(key, { data, expiry: Date.now() + ttl });
      return data;
    })
    .catch(() => {
      // On error return the last cached value if any, else fallback
      const stale = cache.get(key);
      return stale?.data ?? fallback;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

/**
 * Invalidate a specific cached URL (e.g. after a POST/PATCH/DELETE that
 * changes the data behind that endpoint).
 */
export function invalidateCache(url) {
  cache.delete(url);
}

/**
 * Clear the entire cache (e.g. after logout).
 */
export function clearCache() {
  cache.clear();
  inflight.clear();
}
