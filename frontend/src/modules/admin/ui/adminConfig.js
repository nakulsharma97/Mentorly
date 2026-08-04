/**
 * Shared configuration + formatters for the unified admin UI.
 */

/** Semantic badge tone names → CSS modifier. */
export const BADGE_TONES = {
  green: "green",
  blue: "blue",
  orange: "orange",
  red: "red",
  purple: "purple",
  gray: "gray",
};

/** Common status → badge tone mapping for admin surfaces. */
export const STATUS_TONES = {
  ACTIVE: "green",
  PENDING: "orange",
  APPROVED: "green",
  REJECTED: "red",
  COMPLETED: "blue",
  CANCELLED: "gray",
  CANCELLED_BY_LEARNER: "gray",
  CANCELLED_BY_MENTOR: "gray",
  INITIATED: "orange",
  ESCROWED: "blue",
  RELEASED: "green",
  REFUNDED: "purple",
  FAILED: "red",
  OPEN: "blue",
  IN_REVIEW: "orange",
  RESOLVED: "green",
  ENABLED: "green",
  DISABLED: "gray",
  SUSPENDED: "red",
  LEARNER: "blue",
  MENTOR: "purple",
  ADMIN: "gray",
  BOOKING: "purple",
  DIRECT: "blue",
  LOW: "green",
  MEDIUM: "orange",
  HIGH: "red",
  CRITICAL: "red",
};

/** Map a raw status/role string to a badge tone (fallback gray). */
export function toneFor(status) {
  if (!status) return "gray";
  return STATUS_TONES[String(status).toUpperCase()] || "gray";
}

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatDay(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(d);
}

export function initialsOf(name) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map((p) => p?.[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function errorMessage(err, fallback) {
  return err?.response?.data?.data?.error || err?.response?.data?.message || fallback;
}
