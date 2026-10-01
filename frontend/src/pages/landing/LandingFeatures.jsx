export default function LandingFeatures() {
  return (
    <>
      <section className="landing-logo-row" aria-label="Trusted categories">
        {[
          "Design Systems",
          "Full Stack",
          "Finance",
          "Marketing",
          "Data Science",
        ].map((item) => (
          <span key={item}>{item}</span>
        ))}
      </section>

      <section className="landing-section landing-feature-band">
        <div className="landing-section-heading landing-reveal">
          <span className="landing-kicker">What you get</span>
          <h2>Everything from search to follow-up stays connected.</h2>
          <p>
            Messages, notes, and links stay attached to each booking, so
            nothing gets lost after the call ends.
          </p>
        </div>

        <div className="landing-feature-grid">
          <article className="landing-feature-card landing-reveal">
            <span className="material-symbols-outlined" aria-hidden="true">
              travel_explore
            </span>
            <h3>Browse with confidence</h3>
            <p>
              Skills, ratings, reviews, and open slots are right on the
              mentor card, so you can decide quickly.
            </p>
          </article>
          <article className="landing-feature-card landing-feature-card-dark landing-reveal">
            <span className="material-symbols-outlined" aria-hidden="true">
              calendar_month
            </span>
            <h3>Book real sessions</h3>
            <p>
              Create sessions, request slots, accept or decline bookings, and
              keep the status visible everywhere.
            </p>
          </article>
          <article className="landing-feature-card landing-reveal">
            <span className="material-symbols-outlined" aria-hidden="true">
              chat
            </span>
            <h3>Message with context</h3>
            <p>
              Conversation, meeting links, attachments, and quick reactions
              stay connected to the booking.
            </p>
          </article>
          <article className="landing-feature-card landing-reveal">
            <span className="material-symbols-outlined" aria-hidden="true">
              account_balance_wallet
            </span>
            <h3>Wallet clarity</h3>
            <p>
              Balance and ledger views make earnings, refunds, and
              admin adjustments easy to understand.
            </p>
          </article>
        </div>
      </section>
    </>
  );
}
