/**
 * Centralized unwrapping for Spring Data `Page` objects.
 *
 * The backend returns paginated list endpoints as `ApiResponse<Page<T>>`,
 * i.e. `{ data: { content: [...], totalElements, totalPages, ... } }`. After
 * the ApiResponse envelope is stripped (see `unwrapResponse` in LearnerPages),
 * consumers receive either the raw `Page` object or — for non-paginated
 * endpoints — the plain value. This helper normalizes both to a plain array:
 *
 * - raw array            → returned as-is (backward compatible)
 * - Page object          → its `.content` array is returned
 * - null / undefined     → the supplied fallback (default `[]`)
 *
 * Every frontend call site hitting a paginated endpoint should consume this
 * helper so the `.content` unwrap is uniform and future-proof.
 */
export function pageContent(value, fallback = []) {
  if (Array.isArray(value)) return value;
  if (value && Array.isArray(value.content)) return value.content;
  return fallback;
}
