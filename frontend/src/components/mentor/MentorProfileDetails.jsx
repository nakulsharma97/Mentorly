const splitLines = (text) =>
  String(text || "")
    .split(/\r?\n|\|\-|\*|;|\t/)
    .map((line) => line.trim())
    .filter(Boolean);

const summaryText = (text, fallback) =>
  text && String(text).trim().length > 0 ? text.trim() : fallback;

export default function MentorProfileDetails({ mentor }) {
  const certifications = splitLines(mentor?.certificates).slice(0, 4);
  const projectHighlights = splitLines(mentor?.projects).slice(0, 3);
  const experienceHighlights = splitLines(mentor?.pastTeachingSessions).slice(
    0,
    4,
  );

  return (
    <section className="dashboard-card mentor-section-card mentor-details-card">
      <div className="mentor-section-header">
        <div>
          <h3>Mentor story</h3>
          <p className="mentor-section-copy">
            A quick look at the mentor’s background, credentials, and teaching
            record.
          </p>
        </div>
      </div>

      <div className="mentor-details-block">
        <p>
          {summaryText(
            mentor?.aboutMe,
            "This mentor is updating their professional story. Please check back once they add more details.",
          )}
        </p>
      </div>

      <div className="mentor-details-grid">
        <div>
          <strong>Certifications</strong>
          {certifications.length > 0 ? (
            <ul className="mentor-details-list">
              {certifications.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">No certifications listed yet.</p>
          )}
        </div>

        <div>
          <strong>Teaching highlights</strong>
          {experienceHighlights.length > 0 ? (
            <ul className="mentor-details-list">
              {experienceHighlights.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">Mentor session history will appear here.</p>
          )}
        </div>
      </div>

      {projectHighlights.length > 0 && (
        <div className="mentor-details-block">
          <strong>Featured outcomes</strong>
          <ul className="mentor-details-list">
            {projectHighlights.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
