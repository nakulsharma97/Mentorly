import { getStatusMeta } from "./requestsConfig";

/**
 * StatusBadge — pill badge with a colored dot, driven by STATUS_META.
 * Inline styles keep the vivid status colors intact in both themes.
 */
export default function StatusBadge({ status }) {
  const meta = getStatusMeta(status);
  return (
    <span
      className="lqr-badge"
      style={{
        color: meta.color,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
      }}
      role="status"
      aria-label={meta.label}
    >
      <span className="lqr-badge__dot" style={{ background: meta.dot }} aria-hidden="true" />
      {meta.label}
    </span>
  );
}
