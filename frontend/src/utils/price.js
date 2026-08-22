/**
 * Centralized price formatting for the Mentorly marketplace.
 *
 * Rules:
 * - null / undefined / NaN            → freeLabel ("FREE")
 * - 0 or negative                     → freeLabel ("FREE") — mentors can offer
 *                                       free mentoring sessions (₹0).
 * - positive value                    → "₹<amount>" using the en-IN locale.
 *
 * Every marketplace surface (mentor cards, profiles, booking, search) should
 * consume this helper so zero-price sessions always render as "FREE" instead
 * of "₹0". All prices are in Indian Rupees (₹).
 */

export function formatPrice(value, options = {}) {
  const { freeLabel = "FREE", decimals = 0 } = options || {};
  if (value == null) return freeLabel;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return freeLabel;
  const formatted = n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
  return `₹${formatted}`;
}

/** True when a mentor/session is offered free of charge. */
export function isFree(value) {
  if (value == null) return true;
  const n = Number(value);
  return !Number.isFinite(n) || n <= 0;
}
