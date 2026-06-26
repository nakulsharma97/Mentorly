import { Link } from "react-router-dom";
import OptimizedImage from "../OptimizedImage";

const formatNodeLabel = (value) => value || "N/A";

export default function MentorProfileHeader({
  mentor,
  summary,
  trustSnapshot,
  skillChips,
}) {
  const initials = String(
    (mentor?.fullName || "M").trim().charAt(0),
  ).toUpperCase();
  const links = [
    { label: "GitHub", url: mentor?.githubUrl },
    { label: "LinkedIn", url: mentor?.linkedinUrl },
  ].filter((item) => item.url);

  return (
    <section className="dashboard-card mentor-hero mentor-hero-surface">
      <div className="mentor-hero-topline">
        <p className="muted">Premium mentor profile</p>
        <Link className="meeting-link" to="/home">
          Back to home
        </Link>
      </div>

      <div className="mentor-hero-layout">
        <div className="mentor-avatar-wrap mentor-avatar-hero">
          {mentor?.profileImageUrl ? (
            <OptimizedImage
              src={mentor.profileImageUrl}
              alt={mentor?.fullName || "Mentor"}
              className="mentor-avatar"
            />
          ) : (
            <div className="mentor-avatar-fallback">{initials}</div>
          )}
        </div>

        <div className="mentor-hero-content">
          <div className="mentor-hero-title-row">
            <div>
              <h2>{mentor?.fullName}</h2>
              <p className="mentor-subtitle">
                {mentor?.headline ||
                  "Trusted mentor for skill-building and career growth"}
              </p>
            </div>
            {mentor?.mentorVerified && (
              <span className="mentor-badge mentor-badge-verified">
                Verified mentor
              </span>
            )}
          </div>

          <div className="mentor-badge-row">
            <span className="mentor-chip mentor-chip-soft">Public mentor</span>
            <span className="mentor-chip mentor-chip-soft">
              {mentor?.discipline || "Industry expert"}
            </span>
          </div>

          <div className="mentor-rating-chip">
            <strong>{summary.averageRating.toFixed(1)}</strong>
            <span>/ 5 average rating • {summary.totalReviews} reviews</span>
          </div>

          <div className="mentor-trust-strip">
            <span className="mentor-chip mentor-chip-soft">
              {trustSnapshot.responseLabel}
            </span>
            <span className="mentor-chip mentor-chip-soft">
              Reliability {trustSnapshot.reliabilityScore}%
            </span>
            <span className="mentor-chip mentor-chip-soft">
              {trustSnapshot.sessionsOffered} sessions listed
            </span>
          </div>

          <p className="mentor-bio-copy">
            {mentor?.aboutMe ||
              "This mentor is crafting a thoughtful profile. Check back soon for their full story."}
          </p>

          <div className="mentor-skill-row">
            {skillChips.length ? (
              skillChips.map((skill) => (
                <span key={skill} className="mentor-skill-chip">
                  {skill}
                </span>
              ))
            ) : (
              <span className="mentor-skill-placeholder">
                No skills listed yet
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mentor-card-grid">
        <div className="mentor-meta-tile">
          <strong>Verified skills</strong>
          <p>{formatNodeLabel(mentor?.verifiedSkills)}</p>
        </div>
        <div className="mentor-meta-tile">
          <strong>Upcoming sessions</strong>
          <p>{mentor?.upcomingSessions || 0}</p>
        </div>
        <div className="mentor-meta-tile">
          <strong>Primary links</strong>
          <p className="mentor-link-row">
            {links.length > 0
              ? links.map((link) => (
                  <a
                    key={link.label}
                    className="mentor-link-chip"
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {link.label}
                  </a>
                ))
              : "No external links provided."}
          </p>
        </div>
        <div className="mentor-meta-tile">
          <strong>Mentor ID</strong>
          <p>#{mentor?.id || "—"}</p>
        </div>
      </div>
    </section>
  );
}
