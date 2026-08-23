export default function LandingOutcomes({ heroCompletion, onSelectSignup }) {
  return (
    <section id="outcomes" className="landing-section landing-outcomes">
      <div className="landing-outcome-copy landing-reveal">
        <span className="landing-kicker">Production-ready polish</span>
        <h2>Designed for trust, focus, and repeat use.</h2>
        <p>
          The interface now leans into restrained color, strong spacing,
          crisp cards, and motion that supports the workflow instead of
          distracting from it.
        </p>
        <button
          className="landing-button landing-button-primary"
          type="button"
          onClick={onSelectSignup}
        >
          Create your profile
        </button>
      </div>
      <div className="landing-outcome-panel landing-reveal">
        <div className="landing-score-card">
          <span>Session completion</span>
          <strong>
            {heroCompletion !== null ? `${heroCompletion.toFixed(0)}%` : "—"}
          </strong>
          <p>of bookings completed on Mentorly</p>
        </div>
        <div className="landing-check-list">
          <p>
            <span className="material-symbols-outlined" aria-hidden="true">
              done
            </span>{" "}
            Accessible contrast and focus states
          </p>
          <p>
            <span className="material-symbols-outlined" aria-hidden="true">
              done
            </span>{" "}
            Responsive layouts for all viewports
          </p>
          <p>
            <span className="material-symbols-outlined" aria-hidden="true">
              done
            </span>{" "}
            Smooth, reduced-motion-aware animations
          </p>
        </div>
      </div>
    </section>
  );
}
