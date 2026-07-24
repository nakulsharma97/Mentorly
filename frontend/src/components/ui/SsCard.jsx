/**
 * SsCard — Reusable card components for the SkillSwap design system.
 */
import SsIcon from "./SsIcon";

/* ────────────────────────────── Stat Card ────────────────────────────── */

export function SsStatCard({ icon, label, value, desc, trend }) {
  const trendClass = trend > 0 ? "ss-stat-card__trend--up" 
    : trend < 0 ? "ss-stat-card__trend--down" 
    : "ss-stat-card__trend--neutral";
  const trendIcon = trend > 0 ? "trending-up" 
    : trend < 0 ? "trending-down" 
    : "minus";

  return (
    <div className="ss-stat-card">
      <div className="ss-stat-card__header">
        <div className="ss-stat-card__icon">
          <SsIcon name={icon} size={22} />
        </div>
        {trend !== undefined && (
          <span className={`ss-stat-card__trend ${trendClass}`}>
            <SsIcon name={trendIcon} size={12} />
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="ss-stat-card__label">{label}</p>
      <p className="ss-stat-card__value">{value}</p>
      {desc && <p className="ss-stat-card__desc">{desc}</p>}
    </div>
  );
}

/* ────────────────────────────── Badge ────────────────────────────── */

export function SsBadge({ status, children }) {
  const s = (status || "").toUpperCase();
  let cls = "ss-badge--neutral";
  if (["CONFIRMED", "ACCEPTED", "COMPLETED", "SUCCESS", "BOOKED", "SCHEDULED"].includes(s)) cls = "ss-badge--success";
  else if (["PENDING", "WARNING", "IN_PROGRESS", "RESCHEDULED"].includes(s)) cls = "ss-badge--warning";
  else if (["CANCELLED", "CANCELED", "REJECTED", "DANGER", "DECLINED", "EXPIRED"].includes(s)) cls = "ss-badge--danger";
  else if (["INFO"].includes(s)) cls = "ss-badge--info";

  return <span className={`ss-badge ${cls}`}>{children || s.charAt(0) + s.slice(1).toLowerCase()}</span>;
}

/* ────────────────────────────── Empty State ────────────────────────────── */

export function SsEmpty({ icon = "inbox", title, desc, actions }) {
  return (
    <div className="ss-empty">
      <div className="ss-empty__icon">
        <SsIcon name={icon} size={36} />
      </div>
      <h3 className="ss-empty__title">{title || "Nothing here yet"}</h3>
      {desc && <p className="ss-empty__desc">{desc}</p>}
      {actions && <div className="ss-empty__actions">{actions}</div>}
    </div>
  );
}

/* ────────────────────────────── Section Header ────────────────────────────── */

export function SsSectionHeader({ title, subtitle, actions }) {
  return (
    <div className="ss-section__header">
      <div>
        <h2 className="ss-section__title">{title}</h2>
        {subtitle && <p className="ss-section__subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="ss-section__actions">{actions}</div>}
    </div>
  );
}

/* ────────────────────────────── Content Card ────────────────────────────── */

export function SsCard({ title, children, className = "" }) {
  return (
    <div className={`ss-card ${className}`}>
      {title && (
        <div className="ss-card__header">
          <h3 className="ss-card__title">{title}</h3>
        </div>
      )}
      <div className="ss-card__body">{children}</div>
    </div>
  );
}

/* ────────────────────────────── Activity Item ────────────────────────────── */

export function SsActivityItem({ icon, iconBg, iconColor, text, time }) {
  return (
    <div className="ss-activity__item">
      <div 
        className="ss-activity__icon" 
        style={{ background: iconBg || "var(--ss-primary-lighter)", color: iconColor || "var(--ss-primary)" }}
      >
        <SsIcon name={icon} size={18} />
      </div>
      <div className="ss-activity__content">
        <p className="ss-activity__text">{text}</p>
        <span className="ss-activity__time">{time || "Just now"}</span>
      </div>
    </div>
  );
}

/* ────────────────────────────── Progress Bar ────────────────────────────── */

export function SsProgress({ value = 0, max = 100 }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="ss-progress">
      <div className="ss-progress__bar" style={{ width: `${pct}%` }} />
    </div>
  );
}
