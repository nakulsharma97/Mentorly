import { motion } from "framer-motion";
import { useId } from "react";

/** Animated horizontal progress bar — shows completed + remaining topics. */
export default function StudentProgress({ value = 0, topics, remaining, showTopics = false }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const done = topics == null ? null : Number(topics) || 0;
  const left = remaining == null ? null : Math.max(0, Number(remaining) || 0);
  return (
    <div className="ss-card__progress">
      <div className="ss-card__progress-head">
        <span className="ss-card__progress-label">Progress</span>
        <span className="ss-card__progress-value">{pct}%</span>
      </div>
      <div className="ss-track" aria-hidden="true">
        <motion.span
          className="ss-track__fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      {showTopics && done != null && (
        <span className="ss-card__progress-topics">
          {done} completed
          {left != null ? ` · ${left} remaining` : ""}
        </span>
      )}
    </div>
  );
}

/** Animated SVG progress ring with a centered percentage. */
export function ProgressRing({ value = 0, size = 108, stroke = 10 }) {
  const uid = useId();
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div
      className="ss-progress-card__ring"
      style={{ width: size, height: size, position: "relative" }}
      aria-label={`${pct}% complete`}
    >
      <svg width={size} height={size} style={{ display: "block" }}>
        <circle
          className="ss-progress-ring__track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
        />
        <motion.circle
          className="ss-progress-ring__value"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          stroke={`url(#${uid})`}
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
        <defs>
          <linearGradient id={uid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#14B8A6" />
            <stop offset="100%" stopColor="#22C55E" />
          </linearGradient>
        </defs>
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span className="ss-progress-card__pct">{pct}%</span>
      </div>
    </div>
  );
}
