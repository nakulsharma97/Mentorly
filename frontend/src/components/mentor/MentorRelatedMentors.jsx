import { Link } from "react-router-dom";

const parseFirstSkill = (rawSkills) => {
  if (!rawSkills) return null;
  return (
    String(rawSkills)
      .split(/[\n,;|]+/)
      .map((skill) => skill.trim())
      .filter(Boolean)[0] || null
  );
};

export default function MentorRelatedMentors({ mentors, loading }) {
  return (
    <section className="dashboard-card mentor-section-card mentor-related-card">
      <div className="mentor-section-header">
        <div>
          <h3>Similar mentors</h3>
          <p className="mentor-section-copy">
            Explore other top-rated mentors with matching expertise.
          </p>
        </div>
        <Link className="meeting-link" to="/mentors">
          Browse all mentors
        </Link>
      </div>

      {loading ? (
        <div className="mentor-related-loading">Loading mentors…</div>
      ) : mentors.length === 0 ? (
        <div className="mentor-empty-state">
          <p className="mentor-empty-title">No related mentors found</p>
          <p className="mentor-empty-text">
            We’ll surface more relevant mentors once this mentor adds more
            skills.
          </p>
        </div>
      ) : (
        <ul className="mentor-related-list">
          {mentors.map((mentor) => (
            <li key={mentor.id} className="mentor-related-item">
              <div className="mentor-related-avatar">
                {mentor.profileImageUrl ? (
                  <img
                    src={mentor.profileImageUrl}
                    alt={mentor.fullName}
                    loading="lazy"
                  />
                ) : (
                  <span>{mentor.fullName?.charAt(0) || "M"}</span>
                )}
              </div>
              <div className="mentor-related-content">
                <strong>{mentor.fullName}</strong>
                <span>{parseFirstSkill(mentor.skills) || "Expert mentor"}</span>
                <div className="mentor-related-meta">
                  <span>{mentor.averageRating?.toFixed(1) || "0.0"} <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: '#FDB022', verticalAlign: 'middle' }}>star_rate</span></span>
                  <span>{mentor.totalReviews || 0} reviews</span>
                </div>
              </div>
              <Link
                className="meeting-link mentor-related-link"
                to={`/mentors/${mentor.id}`}
              >
                View
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
