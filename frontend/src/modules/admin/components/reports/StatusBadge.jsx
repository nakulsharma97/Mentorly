import { STATUS_META } from "./reportsConfig";

/**
 * StatusBadge — pill for report status (Open / Under investigation /
 * Resolved / Rejected) with a colored dot.
 */
export default function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status || "Unknown", tone: "open" };
  return (
    <span className={`rpt-badge rpt-badge--${meta.tone}`} role="status" aria-label={meta.label}>
      <span className="rpt-badge__dot" aria-hidden="true" />
      {meta.label}
    </span>
  );
}
