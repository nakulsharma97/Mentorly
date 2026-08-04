/**
 * Shared configuration + formatters for the Reports & Complaints admin page.
 */

/** Status → badge tone + label. */
export const STATUS_META = {
  OPEN: { label: "Open", tone: "open" },
  IN_REVIEW: { label: "Under investigation", tone: "in-review" },
  RESOLVED: { label: "Resolved", tone: "resolved" },
  REJECTED: { label: "Rejected", tone: "rejected" },
};

/** Priority → badge tone + label. */
export const PRIORITY_META = {
  LOW: { label: "Low", tone: "low" },
  MEDIUM: { label: "Medium", tone: "medium" },
  HIGH: { label: "High", tone: "high" },
  CRITICAL: { label: "Critical", tone: "critical" },
};

/** Target type → human label. */
export const TARGET_LABELS = {
  MENTOR: "Mentor",
  LEARNER: "Learner",
  SESSION: "Session",
  SKILL: "Skill",
  USER: "User",
  CONTENT: "Content",
};

export const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "OPEN", label: "Open" },
  { value: "IN_REVIEW", label: "Under investigation" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "REJECTED", label: "Rejected" },
];

export const TARGET_OPTIONS = [
  { value: "", label: "All targets" },
  { value: "MENTOR", label: "Mentor" },
  { value: "LEARNER", label: "Learner" },
  { value: "SESSION", label: "Session" },
  { value: "SKILL", label: "Skill" },
];

export const PRIORITY_OPTIONS = [
  { value: "", label: "All priorities" },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

export const PAGE_SIZE = 10;

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
