import { BADGE_TONES } from "./adminConfig";

/**
 * AuBadge — unified status pill. `tone` picks one of the six semantic
 * colors (green/blue/orange/red/purple/gray); a custom label is passed via
 * `children`. When `live` is set it renders with role="status" for a11y.
 */
export default function AuBadge({ tone = "gray", dot = false, live = false, label, children }) {
  const text = label ?? children;
  const cls = `au-badge au-badge--${BADGE_TONES[tone] || BADGE_TONES.gray}`;
  return (
    <span className={cls} role={live ? "status" : undefined} aria-label={live ? String(text) : undefined}>
      {dot && <span className="au-badge__dot" aria-hidden="true" />}
      {text}
    </span>
  );
}
