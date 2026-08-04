import { motion } from "framer-motion";
import Icon from "../../../common/dashboard/Icon";
import { clamp } from "./data";

/* ──────────────────────────────────────────────────────────────────────────
   Motion primitives
   ────────────────────────────────────────────────────────────────────────── */

/** Fade-up reveal on scroll (Framer Motion). */
export function Reveal({ children, delay = 0, y = 24, className = "" }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Section header
   ────────────────────────────────────────────────────────────────────────── */

export function SectionHeader({ icon, title, subtitle, action, actionLabel }) {
  return (
    <div className="lp-section-head">
      <div className="lp-section-head__title-wrap">
        {icon && (
          <span className="lp-section-head__icon">
            <Icon name={icon} />
          </span>
        )}
        <div>
          <h2 className="lp-section-head__title">{title}</h2>
          {subtitle && <p className="lp-section-head__sub">{subtitle}</p>}
        </div>
      </div>
      {action && (
        <span
          className="lp-section-head__action"
          role="link"
          tabIndex={0}
          onClick={action}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              action();
            }
          }}
        >
          {actionLabel || "View all"} <Icon name="arrow_forward" />
        </span>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Progress ring
   ────────────────────────────────────────────────────────────────────────── */

export function ProgressRing({ value, size = 88, stroke = 7, label, sublabel, id }) {
  const pct = clamp(Math.round(Number(value || 0)), 0, 100);
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const gradientId = id || "lpRingGrad";
  return (
    <div className="lp-ring" style={{ width: size, height: size }} role="img" aria-label={`${pct}% ${label || "complete"}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0f766e" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
        </defs>
        <circle className="lp-ring__track" cx={cx} cy={cy} r={r} strokeWidth={stroke} fill="none" />
        <motion.circle
          className="lp-ring__value"
          cx={cx}
          cy={cy}
          r={r}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          whileInView={{ strokeDashoffset: circumference - (pct / 100) * circumference }}
          viewport={{ once: true }}
          transition={{ duration: 1.1, ease: "easeOut", delay: 0.2 }}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </svg>
      <div className="lp-ring__label">
        <strong>{label ?? `${pct}%`}</strong>
        {sublabel && <span>{sublabel}</span>}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Trend chip
   ────────────────────────────────────────────────────────────────────────── */

export function TrendChip({ up, children }) {
  return (
    <span className={`lp-trend${up ? " is-up" : " is-neutral"}`}>
      <Icon name={up ? "trending_up" : "trending_flat"} /> {children}
    </span>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Empty state (beautiful, never blank)
   ────────────────────────────────────────────────────────────────────────── */

export function EmptyState({
  icon = "auto_awesome",
  emoji,
  title,
  description,
  actions,
  compact = false,
}) {
  return (
    <div className={`lp-empty${compact ? " is-compact" : ""}`}>
      <div className="lp-empty__art">
        {emoji ? <span className="lp-empty__emoji">{emoji}</span> : <Icon name={icon} />}
        <span className="lp-empty__orbit" />
      </div>
      <h3 className="lp-empty__title">{title}</h3>
      {description && <p className="lp-empty__desc">{description}</p>}
      {actions && <div className="lp-empty__actions">{actions}</div>}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Loading skeletons
   ────────────────────────────────────────────────────────────────────────── */

export function SkeletonBlock({ className = "", style }) {
  return <div className={`lp-skel ${className}`} style={style} />;
}

export function PageSkeleton() {
  return (
    <div className="lp-shell lp-page-loading" aria-busy="true" aria-label="Loading your learning dashboard">
      <SkeletonBlock className="lp-skel-hero" />
      <div className="lp-skel-stats">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((k) => (
          <SkeletonBlock key={k} className="lp-skel-stat" />
        ))}
      </div>
      <div className="lp-skel-cols">
        <div>
          <SkeletonBlock style={{ height: 28, width: "40%", marginBottom: 16 }} />
          {[1, 2, 3].map((k) => (
            <SkeletonBlock key={k} style={{ height: 96, marginBottom: 12, borderRadius: 16 }} />
          ))}
        </div>
        <div>
          <SkeletonBlock style={{ height: 28, width: "55%", marginBottom: 16 }} />
          <SkeletonBlock style={{ height: 220, borderRadius: 20 }} />
          <SkeletonBlock style={{ height: 120, marginTop: 12, borderRadius: 20 }} />
        </div>
      </div>
      <div className="lp-skel-cards">
        {[1, 2, 3, 4].map((k) => (
          <SkeletonBlock key={k} style={{ height: 240, borderRadius: 20 }} />
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Avatar
   ────────────────────────────────────────────────────────────────────────── */

export function Avatar({ url, name, size = 44 }) {
  if (url) {
    return (
      <span className="lp-avatar" style={{ width: size, height: size }}>
        <img src={url} alt={name} />
      </span>
    );
  }
  return (
    <span className="lp-avatar lp-avatar--fallback" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {String(name || "?")
        .split(/\s+/)
        .map((p) => p.charAt(0))
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()}
    </span>
  );
}
