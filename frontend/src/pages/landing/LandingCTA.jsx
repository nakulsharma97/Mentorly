const scrollToSection = (sectionId) => (event) => {
  event.preventDefault();
  document
    .getElementById(sectionId)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
};

export default function LandingCTA({ onSelectSignup }) {
  return (
    <section className="landing-cta-band">
      <div className="landing-cta-card landing-reveal">
        <div className="landing-cta-shimmer" aria-hidden="true" />
        <span className="landing-cta-kicker">
          Free to start
        </span>
        <h2>Ready to find your mentor?</h2>
        <p>
          Sign up free, browse mentors who have been where you want to
          go, and book your first session.
        </p>
        <div className="landing-cta-actions">
          <button
            className="landing-button landing-button-primary"
            type="button"
            onClick={onSelectSignup}
          >
            Get started free
          </button>
          <button
            className="landing-button landing-button-ghost"
            type="button"
            onClick={scrollToSection("mentors")}
          >
            Browse mentors
          </button>
        </div>
      </div>
    </section>
  );
}
