import { PRIORITY_META } from "./reportsConfig";

/**
 * PriorityBadge — compact triage badge (Low green / Medium amber /
 * High red / Critical deep red).
 */
export default function PriorityBadge({ priority }) {
  const meta = PRIORITY_META[priority] || { label: priority || "MEDIUM", tone: "medium" };
  return (
    <span className={`rpt-priority rpt-priority--${meta.tone}`}>
      <span className="rpt-priority__dot" aria-hidden="true" />
      {meta.label}
    </span>
  );
}
