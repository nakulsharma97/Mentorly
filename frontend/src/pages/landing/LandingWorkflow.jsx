export default function LandingWorkflow() {
  return (
    <section id="workflow" className="landing-section landing-workflow">
      <div className="landing-section-heading landing-reveal">
        <span className="landing-kicker">How it works</span>
        <h2>A cleaner path from intent to outcome.</h2>
      </div>

      <div className="landing-step-grid">
        {[
          [
            "01",
            "Choose your goal",
            "Define the skill, level, and outcome you want from the session.",
          ],
          [
            "02",
            "Match with a mentor",
            "Compare skills, availability, proof, and pricing before you book.",
          ],
          [
            "03",
            "Meet and follow up",
            "Use messages, session links, notes, and wallet history after the call.",
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
