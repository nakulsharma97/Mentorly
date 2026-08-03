import { Link } from "react-router";
import SectionCard, { EmptyState } from "../../../common/dashboard/SectionCard";
import Icon from "../../../common/dashboard/Icon";
import { initials } from "../../../common/dashboard/dashboardUtils";

function skillTags(skills) {
  return String(skills || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);
}

/** Recommended mentors: avatar, rating, skills, experience, book / view. */
export default function MentorRecommendations({ mentors = [] }) {
  return (
    <SectionCard
      title="Recommended Mentors"
      icon="workspace_premium"
      action="Explore"
      actionTo="/learner/mentors"
    >
      {mentors.length === 0 ? (
        <EmptyState
          icon="person_search"
          title="No recommendations yet"
          description="Add skills to your watchlist to get tailored mentor matches."
          actionLabel="Find mentors"
          actionTo="/learner/mentors"
        />
      ) : (
        <div className="ld-mentors">
          {mentors.slice(0, 3).map((m) => {
            const id = m.mentorId || m.id;
            const rating = Number(m.averageRating || m.rating || 0);
            return (
              <div key={id} className="ld-mentor">
                <div className="ld-mentor__head">
                  <span className="md-avatar">{initials(m.fullName)}</span>
                  <div className="md-row__main">
                    <p className="md-row__title">{m.fullName || "Mentor"}</p>
                    <p className="md-row__meta">
                      <Icon name="star" className="is-on" style={{ color: "#f59e0b" }} />
                      {rating > 0 ? rating.toFixed(1) : "New"}
                      {m.experienceYears ? (
                        <>
                          <span>·</span>
                          <Icon name="work" /> {m.experienceYears}y exp
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>
                {skillTags(m.skills).length > 0 && (
                  <div className="ld-mentor__tags">
                    {skillTags(m.skills).map((tag) => (
                      <span key={tag} className="md-badge md-badge--info">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="ld-mentor__actions">
                  <Link to={`/mentors/${id}`} className="md-btn md-btn--brand md-btn--sm">
                    Book Session
                  </Link>
                  <Link to={`/mentors/${id}`} className="md-btn md-btn--outline md-btn--sm">
                    View Profile
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}
