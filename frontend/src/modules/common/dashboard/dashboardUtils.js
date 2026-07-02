/** Shared, dependency-free helpers for the mentor dashboard surfaces. */

export function initials(name, fallback = "M") {
  const clean = String(name || "").trim();
  if (!clean) return fallback;
  return clean
    .split(/\s+/)
    .map((p) => p[0]?.toUpperCase() || "")
    .slice(0, 2)
    .join("");
}

export function formatMoney(value) {
  const n = Number(value || 0);
  if (n >= 100000) return `₹${(n / 1000).toFixed(0)}k`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export function formatDateParts(input) {
  const d = input ? new Date(input) : null;
  if (!d || Number.isNaN(d.getTime())) return { day: "--", month: "TBD" };
  return {
    day: String(d.getDate()).padStart(2, "0"),
    month: d.toLocaleString(undefined, { month: "short" }),
  };
}

export function formatTime(input) {
  const d = input ? new Date(input) : null;
  if (!d || Number.isNaN(d.getTime())) return "Time TBD";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function relativeDate(input) {
  const d = input ? new Date(input) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const diffDays = Math.round((now - d) / 86400000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.round(diffDays / 7)}w ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
