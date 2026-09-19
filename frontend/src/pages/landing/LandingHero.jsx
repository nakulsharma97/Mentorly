const scrollToSection = (sectionId) => (event) => {
  event.preventDefault();
  document
    .getElementById(sectionId)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
};

export default function LandingHero({ mentorCount, heroRating, heroSwaps, navigate }) {
  const mentorCountLabel = String(mentorCount);

  return (
    <section id="product" className="landing-hero">
      <div className="landing-particles" aria-hidden="true">
        <div className="landing-particle" />
        <div className="landing-particle" />
        <div className="landing-particle" />
        <div className="landing-particle" />
        <div className="landing-particle" />
        <div className="landing-particle" />
        <div className="landing-particle" />
        <div className="landing-particle" />
      </div>
      <div className="landing-hero-copy landing-reveal is-visible">
        <span className="landing-eyebrow">
          <span aria-hidden="true" />
          Live mentorship for practical career growth
        </span>
        <h1>Learn from operators who have already built the path.</h1>
        <p>
          Mentorly brings together verified mentors, live sessions, and
          clear follow-up workflows so learners can move faster with less
          friction.
        </p>
        <div className="landing-hero-actions">
          <a
            className="landing-button landing-button-primary"
            href="#mentors"
            onClick={scrollToSection("mentors")}
          >
            Find a Mentor
          </a>
          <button
            className="landing-button landing-button-soft"
            type="button"
            onClick={() => navigate("/become-a-mentor")}
          >
            Become a Mentor
          </button>
        </div>
        <dl className="landing-metrics" aria-label="Platform highlights">
          <div>
            <dt>{mentorCountLabel}</dt>
            <dd>mentor profiles</dd>
          </div>
          <div>
            <dt>{heroRating !== null ? heroRating.toFixed(1) : "—"}</dt>
            <dd>avg. session rating</dd>
          </div>
          <div>
            <dt>{heroSwaps !== null ? heroSwaps : "—"}</dt>
            <dd>skill swaps completed</dd>
          </div>
        </dl>
      </div>

      <div className="landing-hero-visual landing-reveal is-visible">
        <div className="landing-product-card">
          <div className="landing-product-header">
            <div>
              <span>Mentor marketplace</span>
              <strong>Find your next advantage</strong>
            </div>
            <span className="landing-live-pill">Live</span>
          </div>
          <div className="landing-hero-photo-shell">
            <img
              className="landing-hero-photo"
              alt="Mentor and learner reviewing a laptop in a modern workspace"
              src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=800&q=75"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              width="800"
              height="420"
            />
            <div className="landing-hero-badge">
              <span
                className="material-symbols-outlined"
                aria-hidden="true"
              >
                verified
              </span>
              <div>
                <strong>
                  {heroRating !== null
                    ? `${heroRating.toFixed(1)}/5 average`
                    : "—/5 average"}
                </strong>
                <p>Trusted by ambitious learners</p>
              </div>
            </div>
            <div className="landing-hero-mini-card landing-hero-mini-card-top">
              <span>Next match</span>
              <strong>Senior product designer</strong>
            </div>
            <div className="landing-hero-mini-card landing-hero-mini-card-bottom">
              <span>Focus areas</span>
              <strong>System design • Growth</strong>
            </div>
          </div>
          <div
            className="landing-session-panel"
            aria-label="Session summary"
          >
            <div>
              <span className="landing-avatar-stack" aria-hidden="true">
                <span>M</span>
                <span>L</span>
              </span>
              <p>1:1 live feedback</p>
            </div>
            <strong>Booked for Friday • 6:30 PM</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
