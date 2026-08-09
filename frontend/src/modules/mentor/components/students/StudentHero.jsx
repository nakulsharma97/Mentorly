import HeroSection from "../../../../components/HeroSection";

/**
 * Rating → status caption (mirrors the Reviews page hero stat treatment).
 */
function ratingStatus(avg) {
  if (avg <= 0) return { label: "No ratings yet", tone: "muted" };
  if (avg >= 4.5) return { label: "Excellent", tone: "excellent" };
  if (avg >= 4) return { label: "Good", tone: "good" };
  if (avg >= 3) return { label: "Fair", tone: "fair" };
  return { label: "Needs work", tone: "needs" };
}

const STAT_CARDS = [
  {
    key: "total",
    icon: "groups",
    label: "Total Students",
    status: "All Time",
    statusTone: "muted",
  },
  {
    key: "active",
    icon: "bolt",
    label: "Active Students",
    status: "Currently active",
    statusTone: "muted",
  },
  {
    key: "completed",
    icon: "task_alt",
    label: "Completed Sessions",
    status: "Across all learners",
    statusTone: "muted",
  },
  {
    key: "rating",
    icon: "star",
    label: "Average Rating",
    statusTone: "dynamic",
  },
];

/**
 * StudentHero — Students page hero. Delegates to the shared <HeroSection />
 * so every page renders the same unified gradient / radius / buttons / glass
 * cards. The right-hand art column shows four REAL, dynamically-computed KPI
 * cards (total / active / completed / average rating) — same treatment as the
 * Reviews & Ratings hero — instead of decorative mock glass cards.
 */
export default function StudentHero({
  stats = {},
  loading = false,
  onRefresh,
  onNewSession,
  refreshing,
}) {
  const values = {
    total: Number(stats.total) || 0,
    active: Number(stats.active) || 0,
    completed: Number(stats.completed) || 0,
    rating:
      typeof stats.avgRating === "number" && stats.avgRating > 0
        ? stats.avgRating.toFixed(1)
        : "\u2014",
  };

  return (
    <HeroSection
      className="hero-section--compact hero-section--students"
      badge="👨‍🎓 My Students"
      title="My Students"
      subtitle="Track learner progress, manage mentoring sessions and monitor achievements."
      secondaryButton={
        <button
          type="button"
          className="hero-section__btn hero-section__btn--secondary"
          onClick={onRefresh}
          disabled={refreshing}
        >
          <span className="material-symbols-outlined">refresh</span>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      }
      primaryButton={
        <button
          type="button"
          className="hero-section__btn hero-section__btn--primary"
          onClick={onNewSession}
        >
          <span className="material-symbols-outlined">add</span>
          New Session
        </button>
      }
      ariaLabel="My students overview"
      floatingCards={
        <div className="ss-hero-stats" role="group" aria-label="Student statistics">
          {STAT_CARDS.map((card) => {
            const status =
              card.statusTone === "dynamic"
                ? ratingStatus(Number(stats.avgRating) || 0)
                : { label: card.status, tone: card.statusTone };
            return (
              <div key={card.key} className="ss-hero-stat">
                <span className="ss-hero-stat__icon">
                  <span className="material-symbols-outlined">{card.icon}</span>
                </span>
                <div className="ss-hero-stat__info">
                  {loading ? (
                    <span className="ss-hero-stat__skeleton" aria-hidden="true" />
                  ) : (
                    <span className="ss-hero-stat__value">{values[card.key]}</span>
                  )}
                  <span className="ss-hero-stat__label">{card.label}</span>
                  {!loading && (
                    <span
                      className={`ss-hero-stat__status ss-hero-stat__status--${status.tone}`}
                    >
                      {status.label}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      }
    />
  );
}
