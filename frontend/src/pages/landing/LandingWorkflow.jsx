export default function LandingWorkflow() {
  return (
    <section id="workflow" className="landing-section landing-workflow">
      <div className="landing-section-heading landing-reveal">
        <span className="landing-kicker">How it works</span>
        <h2>How a session works, start to finish.</h2>
      </div>

      <div className="landing-step-grid">
        {[
          [
            "01",
            "Choose your goal",
            "Pick a skill, set your level, and say what you want to get better at.",
          ],
          [
            "02",
            "Match with a mentor",
            "Check a mentor's skills, ratings, availability, and price before you book.",
          ],
          [
            "03",
            "Meet and follow up",
            "After the call, messages, links, notes, and payments stay with the booking.",
          ],
        ].map(([number, title, text]) => (
          <article className="landing-step landing-reveal" key={number}>
            <span>{number}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
