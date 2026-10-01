export default function LandingOutcomes({ heroCompletion, onSelectSignup }) {
  return (
    <section id="outcomes" className="landing-section landing-outcomes">
      <div className="landing-outcome-copy landing-reveal">
        <span className="landing-kicker">Follow-through</span>
        <h2>Booked sessions actually happen.</h2>
        <p>
          Bookings on Mentorly are meant to be kept. Here is how
          sessions have actually gone, straight from real bookings.
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
            Easy to read, with clear focus states
          </p>
          <p>
            <span className="material-symbols-outlined" aria-hidden="true">
              done
            </span>{" "}
            Works on phone, tablet, and desktop
          </p>
          <p>
            <span className="material-symbols-outlined" aria-hidden="true">
              done
            </span>{" "}
            Quick animations, or none if you prefer
          </p>
        </div>
      </div>
    </section>
  );
}
