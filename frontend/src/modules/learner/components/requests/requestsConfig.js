/**
 * Shared configuration + formatters for the Learner "My Requests" page.
 * Single source of truth for status colors and date/time formatting so every
 * card, badge and modal renders identically.
 */

/** All statuses a session request can surface in the UI. */
export const STATUS_META = {
  PENDING: {
    label: "Pending",
    color: "#B45309",
    bg: "rgba(245, 158, 11, 0.14)",
    border: "rgba(245, 158, 11, 0.32)",
    dot: "#F59E0B",
  },
  ACCEPTED: {
    label: "Accepted",
    color: "#15803D",
    bg: "rgba(22, 163, 74, 0.13)",
    border: "rgba(22, 163, 74, 0.32)",
    dot: "#16A34A",
  },
  DECLINED: {
    label: "Declined",
    color: "#DC2626",
    bg: "rgba(239, 68, 68, 0.11)",
    border: "rgba(239, 68, 68, 0.32)",
    dot: "#EF4444",
  },
  COMPLETED: {
    label: "Completed",
    color: "#2563EB",
    bg: "rgba(59, 130, 246, 0.13)",
    border: "rgba(59, 130, 246, 0.32)",
    dot: "#3B82F6",
  },
  CANCELLED: {
    label: "Cancelled",
    color: "#4B5563",
    bg: "rgba(107, 114, 128, 0.13)",
    border: "rgba(107, 114, 128, 0.3)",
    dot: "#6B7280",
  },
};

/** Fallback for unknown statuses — never crash on bad data. */
export function getStatusMeta(status) {
  return STATUS_META[status] || {
    label: String(status || "Unknown"),
    color: "#64748B",
    bg: "rgba(100, 116, 139, 0.12)",
    border: "rgba(100, 116, 139, 0.3)",
    dot: "#64748B",
  };
}

/** Filter options used by the filter popover. */
export const STATUS_FILTERS = [
  { value: "ALL", label: "All requests" },
  { value: "PENDING", label: "Pending" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "DECLINED", label: "Declined" },
];

/** Sort options for the sort dropdown. */
export const SORT_OPTIONS = [
  { value: "newest", label: "Latest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "status", label: "Status" },
];

const datePart = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "Aug 4, 2026" */
export function formatRequestDate(value) {
  const d = datePart(value);
  if (!d) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "11:53 AM" */
export function formatRequestTime(value) {
  const d = datePart(value);
  if (!d) return "—";
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Safe title-case fallback for a missing mentor name. */
export function mentorName(mentor, id) {
  return mentor?.fullName || (id ? `Mentor #${id}` : "Mentor");
}

/** First letter for avatar fallback. */
export function avatarInitial(name) {
  return String(name || "?").trim().charAt(0).toUpperCase();
}
