export default function MentorWhatToExpect() {
  return (
    <section className="dashboard-card mentor-section-card mentor-what-to-expect-card">
      <div className="mentor-section-header">
        <div>
          <h3>What to expect</h3>
          <p className="mentor-section-copy">
            A quick overview of how this mentor runs sessions and what learners
            typically accomplish.
          </p>
        </div>
      </div>

      <div className="mentor-details-grid">
        <div>
          <strong>Learning focus</strong>
          <p className="mentor-details-text">
            Practical outcomes, real-world feedback, and action plans tailored
            to your goals.
          </p>
        </div>
        <div>
          <strong>Session experience</strong>
          <p className="mentor-details-text">
            Collaborative meetings with clear next steps, follow-up resources,
            and concise progress check-ins.
          </p>
        </div>
      </div>

      <div className="mentor-details-block">
        <ul className="mentor-details-list">
          <li>Structured preparation based on your current skill level</li>
          <li>Goal-oriented guidance with measurable outcomes</li>
          <li>Flexible pacing and practical examples</li>
        </ul>
      </div>
    </section>
  );
}
