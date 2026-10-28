/**
 * Response-envelope readers for the Mentorly admin API.
 *
 * The admin API does not use a single response shape, so call sites pick the
 * reader that matches the endpoint they actually call — no catch-all that would
 * hide a server-side contract change:
 *
 *   GET /api/v1/admin/reports?status=OPEN        → ApiResponse<Page<AdminReportDto>>
 *   GET /api/v1/admin/users, /sessions, …        → ApiResponse<Page<Dto>>
 *   GET /api/v1/admin/conversations              → ApiResponse<List<AdminConversationDto>>
 *   GET /api/v1/admin/conversations/…/messages   → ApiResponse<List<AdminMessageDto>>
 *   GET /api/v1/admin/summary, /reports/stats    → ApiResponse<Dto>
 *
 * `ApiResponse` wraps its body in `data`, so the body arrives as
 * `response.data.data`. A Spring `Page` body is NOT an array — it is
 * `{ content: [...], totalElements, totalPages, number, size, … }`. Treating it
 * as an array is what surfaced as `TypeError: d.map is not a function` on the
 * admin Overview / Reports tabs, where the production minifier had renamed the
 * `reports` state variable to `d`.
 */

const isDev = Boolean(import.meta?.env?.DEV);

const EMPTY_LIST = Object.freeze([]);

function describe(payload) {
  if (payload === null) return "null";
  if (payload === undefined) return "undefined";
  if (Array.isArray(payload)) return "an array";
  if (typeof payload === "object") {
    const keys = Object.keys(payload).slice(0, 8).join(", ");
    return `an object with keys [${keys}]`;
  }
  return `a ${typeof payload}`;
}

/** Dev-only breadcrumb: a server change must not fail silently in development. */
function warnMismatch(endpoint, expected, payload) {
  if (!isDev) return;
  console.warn(
    `[admin-api] ${endpoint || "endpoint"} returned ${describe(payload)}; expected ${expected}.`,
  );
}

function countOr(value, fallback) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

/**
 * Reads an `ApiResponse<Page<T>>` body (Spring Data page payload).
 *
 * @param {unknown} payload `response.data.data`
 * @param {string} [endpoint] endpoint label, used for development warnings
 * @returns {{ items: unknown[], totalElements: number, totalPages: number, page: number, size: number }}
 */
export function readSpringPage(payload, endpoint) {
  if (Array.isArray(payload)) {
    // Defensive: a bare list is still renderable, but the contract mismatch is
    // logged so it gets fixed at the API instead of being papered over.
    warnMismatch(endpoint, "a Spring Page ({ content: [...] })", payload);
    return {
      items: payload,
      totalElements: payload.length,
      totalPages: payload.length ? 1 : 0,
      page: 0,
      size: payload.length,
    };
  }

  if (payload && typeof payload === "object" && Array.isArray(payload.content)) {
    const items = payload.content;
    const size = countOr(payload.size, items.length);
    return {
      items,
      totalElements: countOr(payload.totalElements, items.length),
      totalPages: countOr(
        payload.totalPages,
        size > 0 ? Math.ceil(items.length / size) : 0,
      ),
      page: countOr(payload.number, 0),
      size,
    };
  }

  warnMismatch(endpoint, "a Spring Page ({ content: [...] })", payload);
  return { items: [], totalElements: 0, totalPages: 0, page: 0, size: 0 };
}

/**
 * Reads an `ApiResponse<List<T>>` body.
 *
 * @param {unknown} payload `response.data.data`
 * @param {string} [endpoint] endpoint label, used for development warnings
 * @returns {unknown[]} the list, or an empty list when the body is not an array
 */
export function readList(payload, endpoint) {
  if (Array.isArray(payload)) return payload;
  warnMismatch(endpoint, "a list", payload);
  return EMPTY_LIST;
}

/**
 * Reads an `ApiResponse<Dto>` body (summary, stats, detail).
 *
 * @param {unknown} payload `response.data.data`
 * @param {string} [endpoint] endpoint label, used for development warnings
 * @returns {Record<string, unknown> | null}
 */
export function readObject(payload, endpoint) {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload;
  }
  warnMismatch(endpoint, "an object", payload);
  return null;
}
