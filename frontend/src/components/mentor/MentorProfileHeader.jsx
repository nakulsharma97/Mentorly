import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import OptimizedImage from "../OptimizedImage";

const formatNodeLabel = (value) => value || "—";
const truncate = (value, limit = 130) => {
  if (!value) return "";
  return value.length <= limit ? value : `${value.slice(0, limit).trim()}…`;
};

export default function MentorProfileHeader({
  mentor,
  summary,
  trustSnapshot,
  skillChips,
}) {
  const initials = String(
    (mentor?.fullName || "M").trim().charAt(0),
  ).toUpperCase();
  const isAvailable = Number(mentor?.upcomingSessions || 0) > 0;
  const headline = mentor?.aboutMe
    ? truncate(mentor.aboutMe.split(". ")[0], 110)
    : "Trusted mentor for skill-building and career growth.";

  const memberSinceYear = mentor?.createdAt
    ? new Date(mentor.createdAt).getFullYear()
    : null;

  const verifiedSkillsCount = mentor?.verifiedSkills
    ? [
        ...new Set(
          String(mentor.verifiedSkills)
            .split(/[\n,;|]+/)
            .map((skill) => skill.trim())
            .filter(Boolean),
        ),
      ].length
    : 0;

  const infoPills = [
    mentor?.upcomingSessions != null && {
      label: `${mentor.upcomingSessions} upcoming sessions`,
      type: "availability",
    },
    memberSinceYear && {
      label: `Mentor since ${memberSinceYear}`,
      type: "memberSince",
    },
    verifiedSkillsCount > 0 && {
      label: `${verifiedSkillsCount} verified skills`,
      type: "verifiedSkills",
    },
  ].filter(Boolean);

  const stats = [
    {
      icon: "⭐",
      value: summary.averageRating.toFixed(1),
      label: "Average rating",
    },
    {
      icon: "👨‍🎓",
      value: summary.totalReviews,
      label: "Learners mentored",
    },
    {
      icon: "📚",
      value: formatNodeLabel(mentor?.upcomingSessions),
      label: "Sessions available",
    },
    {
      icon: "⚡",
      value: trustSnapshot.responseLabel,
      label: "Avg response",
    },
    {
      icon: "🛡",
      value: `${trustSnapshot.reliabilityScore}%`,
      label: "Reliability",
    },
  ];

  return (
    <motion.section
      className="dashboard-card mentor-hero mentor-hero-surface"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      <div className="mentor-hero-topline">
        <p className="muted">Premium mentor profile</p>
        <Link className="meeting-link" to="/home">
          Back to home
        </Link>
      </div>

      <div className="mentor-hero-content-grid">
        <div className="mentor-hero-avatar-shell">
          <div className="mentor-avatar-wrap mentor-avatar-hero">
            {mentor?.profileImageUrl ? (
              <OptimizedImage
                src={mentor.profileImageUrl}
                alt={mentor?.fullName || "Mentor"}
                className="mentor-avatar mentor-avatar-circle"
              />
            ) : (
              <div className="mentor-avatar-fallback mentor-avatar-circle">
                {initials}
              </div>
            )}
          </div>
          {mentor?.mentorVerified && (
            <div className="mentor-avatar-status mentor-avatar-badge">
              <span>Verified mentor</span>
            </div>
          )}
          {isAvailable && (
            <div className="mentor-avatar-status mentor-online-status">
              <span />
              Available now
            </div>
          )}
        </div>

        <div className="mentor-hero-main">
          <div className="mentor-hero-title-row">
            <div>
              <h2>{mentor?.fullName}</h2>
              {mentor?.mentorVerified && (
                <span className="mentor-badge mentor-badge-verified">
                  Verified mentor
                </span>
              )}
              <p className="mentor-hero-subtitle">{headline}</p>
            </div>
          </div>

          <div className="mentor-hero-skill-row">
            {skillChips.length > 0 ? (
              skillChips.map((skill) => (
                <span key={skill} className="mentor-skill-chip">
                  {skill}
                </span>
              ))
            ) : (
              <span className="mentor-skill-chip mentor-skill-chip-empty">
                No verified skills yet
              </span>
            )}
          </div>

          <div className="mentor-hero-info-row">
            {infoPills.map((pill) => (
              <span key={pill.label} className="mentor-info-pill">
                {pill.label}
              </span>
            ))}
          </div>

          <div className="mentor-hero-stat-grid">
            {stats.map((stat) => (
              <div key={stat.label} className="mentor-hero-stat-card">
                <span className="mentor-hero-stat-icon">{stat.icon}</span>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
