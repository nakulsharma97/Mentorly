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
          <span aria-hidden="true">✨</span>
          Join thousands of learners
        </span>
        <h2>Ready to accelerate your career?</h2>
        <p>
          Sign up free, find your mentor, and start learning from industry
          experts who have already built the path.
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
