import { motion } from "framer-motion";

/**
 * Gradient hero banner — badge, headline, subtitle and primary actions on the
 * left, a glassy floating-card illustration on the right (pure CSS/SVG).
 * The art layer is z-index 1 (behind, opacity .9) and strictly clipped to the
 * hero, so it can never cover the headline or buttons (z-index 2).
 */
export default function StudentHero({ total, onRefresh, onNewSession, refreshing }) {
  const bars = [38, 62, 46, 80, 58, 92, 70];

  return (
    <motion.section
      className="ss-hero"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      aria-label="My students overview"
    >
      <div className="ss-hero__content">
        <span className="ss-hero__badge">👨‍🎓 My Students</span>
        <h1 className="ss-hero__title">My Students</h1>
        <p className="ss-hero__sub">
          Track learner progress, manage mentoring sessions and monitor
          achievements.
        </p>
        <div className="ss-hero__actions">
          <button
            type="button"
            className="ss-hero__btn ss-hero__btn--ghost"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <span className="material-symbols-outlined">refresh</span>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button
            type="button"
            className="ss-hero__btn ss-hero__btn--solid"
            onClick={onNewSession}
          >
            <span className="material-symbols-outlined">add</span>
            New Session
          </button>
        </div>
      </div>

      {/* Decorative layer — sits behind the content, never covers buttons */}
      <div className="ss-hero__art" aria-hidden="true">
        <div className="ss-hero__blob ss-hero__blob--1" />
        <div className="ss-hero__blob ss-hero__blob--2" />

        <div className="ss-hero__card ss-hero__card--stat">
          <div className="ss-hero__stat-num">{total}</div>
          <div className="ss-hero__stat-label">Active learners</div>
        </div>

        <div className="ss-hero__card ss-hero__card--main">
          <div className="ss-hero__card-head">
            <span className="ss-hero__card-icon">
              <span className="material-symbols-outlined">school</span>
            </span>
            <div>
              <div className="ss-hero__card-title">Mentorship Hub</div>
              <div className="ss-hero__card-sub">Weekly progress</div>
            </div>
          </div>
          <div className="ss-hero__avatars">
            <span className="ss-hero__mini-avatar">AR</span>
            <span className="ss-hero__mini-avatar">PK</span>
            <span className="ss-hero__mini-avatar">RS</span>
            <span className="ss-hero__mini-avatar">+2</span>
          </div>
        </div>

        <div className="ss-hero__card ss-hero__card--chart">
          <div className="ss-hero__card-sub" style={{ marginBottom: 8 }}>
            Sessions this month
          </div>
          <div className="ss-hero__chart-bars">
            {bars.map((h, i) => (
              <span
                key={i}
                className="ss-hero__chart-bar"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
