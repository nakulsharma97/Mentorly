import HeroSection, { HeroGlassCard } from "../../../../components/HeroSection";

/**
 * StudentHero — Students page hero. Delegates to the shared <HeroSection />
 * so every page renders the same unified gradient / radius / buttons / glass
 * cards. Only the badge, copy, buttons and art differ.
 */
export default function StudentHero({ total, onRefresh, onNewSession, refreshing }) {
  const bars = [38, 62, 46, 80, 58, 92, 70];

  return (
    <HeroSection
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
      illustration={
        <>
          <HeroGlassCard className="hero-section__glass--stat">
            <div className="hero-section__glass-num">{total}</div>
            <div className="hero-section__glass-label">Active learners</div>
          </HeroGlassCard>

          <HeroGlassCard className="hero-section__glass--main">
            <div className="hero-section__glass-head">
              <span className="hero-section__glass-icon">
                <span className="material-symbols-outlined">school</span>
              </span>
              <div>
                <div className="hero-section__glass-title">Mentorship Hub</div>
                <div className="hero-section__glass-sub">Weekly progress</div>
              </div>
            </div>
            <div className="hero-section__glass-avatars">
              <span className="hero-section__glass-avatar">AR</span>
              <span className="hero-section__glass-avatar">PK</span>
              <span className="hero-section__glass-avatar">RS</span>
              <span className="hero-section__glass-avatar">+2</span>
            </div>
          </HeroGlassCard>

          <HeroGlassCard className="hero-section__glass--chart">
            <div className="hero-section__glass-sub" style={{ marginBottom: 8 }}>
              Sessions this month
            </div>
            <div className="hero-section__glass-bars">
              {bars.map((h, i) => (
                <span
                  key={i}
                  className="hero-section__glass-bar"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </HeroGlassCard>
        </>
      }
    />
  );
}
