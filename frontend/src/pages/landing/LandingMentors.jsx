import { useMemo } from "react";
import { useNavigate } from "react-router";
import { normalizeSkills } from "../../utils/skills";
import OptimizedImage from "../../components/OptimizedImage";

const getMentorInitials = (fullName) => {
  const safeName = String(fullName || "").trim();
  if (!safeName) return "M";
  return safeName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
};

const getSkillTags = (rawSkills) => {
  const tags = normalizeSkills(rawSkills, { limit: 2 });
  return tags.length ? tags : ["Mentorship"];
};

export default function LandingMentors({ mentors, mentorsLoading, onSelectSignup }) {
  const navigate = useNavigate();
  const displayMentors = useMemo(() => (mentors ?? []).slice(0, 3), [mentors]);

  const openMentor = (mentor) => {
    if (!mentor.id) {
      onSelectSignup();
      return;
    }
    navigate(`/mentors/${mentor.id}`);
  };

  return (
    <section id="mentors" className="landing-section landing-mentors">
      <div className="landing-section-heading landing-reveal">
        <span className="landing-kicker">Expert network</span>
        <h2>
          Premium mentor cards that reflect real marketplace expertise.
        </h2>
        <p>
          Mentor profiles are loaded from the backend and shown only when
          verified mentors are available.
        </p>
      </div>

      <div className="landing-mentor-grid">
        {mentorsLoading ? (
          [0, 1, 2].map((key) => (
            <div
              className="landing-mentor-card landing-mentor-card--skeleton"
              key={key}
            >
              <div className="skeleton landing-mentor-skeleton-img" />
              <div className="landing-mentor-body">
                <div className="skeleton landing-skeleton-line landing-skeleton-line--lg" />
                <div className="skeleton landing-skeleton-line" />
                <div className="skeleton landing-skeleton-line landing-skeleton-line--sm" />
              </div>
            </div>
          ))
        ) : displayMentors.length === 0 ? (
          <div className="landing-mentor-empty">
            <span
              className="landing-mentor-empty-icon material-symbols-outlined"
              aria-hidden="true"
            >
              groups
            </span>
            <p className="landing-mentor-empty-title">
              No verified mentors available yet.
            </p>
            <p className="landing-mentor-empty-sub">
              Check back soon for new mentors joining the marketplace.
            </p>
          </div>
        ) : (
          displayMentors.map((mentor) => {
            const tags = getSkillTags(mentor.skills);
            const rating = Number(mentor.averageRating || 0).toFixed(1);
            const reviews = Number(mentor.totalReviews || 0);
            const initials = getMentorInitials(mentor.fullName);

            return (
              <article
                className="landing-mentor-card landing-reveal"
                key={`${mentor.fullName}-${tags.join("-")}`}
              >
                <div className="landing-mentor-image">
                  {mentor.profileImageUrl ? (
                    <OptimizedImage
                      alt={`Portrait of ${mentor.fullName}`}
                      src={mentor.profileImageUrl}
                    />
                  ) : (
                    <span>{initials}</span>
                  )}
                  <span
                    className={
                      mentor.liveNow
                        ? "landing-presence is-live"
                        : "landing-presence"
                    }
                  >
                    {mentor.liveNow ? "Live now" : "Available"}
                  </span>
                </div>
                <div className="landing-mentor-body">
                  <div>
                    <h3>{mentor.fullName}</h3>
                    <p>{tags.join(" / ")}</p>
                  </div>
                  <div className="landing-mentor-meta">
                    <span>
                      <strong>{rating}</strong> rating
                    </span>
                    <span>
                      <strong>{reviews || "New"}</strong> reviews
                    </span>
                  </div>
                  <button
                    className="landing-text-button"
                    type="button"
                    onClick={() => openMentor(mentor)}
                  >
                    View profile
                    <span
                      className="material-symbols-outlined"
                      aria-hidden="true"
                    >
                      arrow_forward
                    </span>
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
