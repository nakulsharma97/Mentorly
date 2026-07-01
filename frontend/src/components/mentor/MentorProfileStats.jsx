import { motion } from "framer-motion";

export default function MentorProfileStats({
  summary,
  sessionsCount,
  verifiedSkills,
  trustSnapshot,
  skillChips,
}) {
  const metrics = [
    {
      label: "Average rating",
      value: `${summary.averageRating.toFixed(1)} / 5`,
      detail: `${summary.totalReviews} reviews`,
    },
    {
      label: "Session demand",
      value: `${sessionsCount} available`,
      detail: "Booked and ready learners",
    },
    {
      label: "Verified expertise",
      value: `${verifiedSkills.length} skill${verifiedSkills.length === 1 ? "" : "s"}`,
      detail: "Mentor certifications & proof",
    },
    {
      label: "Response performance",
      value: trustSnapshot.responseLabel,
      detail: `Reliability ${trustSnapshot.reliabilityScore}%`,
    },
  ];

  return (
    <section className="dashboard-card mentor-section-card mentor-stats-card">
      <div className="mentor-section-header">
        <div>
          <h3>Performance snapshot</h3>
          <p className="mentor-section-copy">
            Trusted metrics that help you choose the right mentor faster.
          </p>
        </div>
        <span className="mentor-badge mentor-badge-alt">Data-backed</span>
      </div>

      <div className="mentor-stats-grid">
        {metrics.map((metric) => (
          <motion.div
            key={metric.label}
            className="mentor-metric-tile"
            whileHover={{ y: -4 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
          >
            <strong>{metric.label}</strong>
            <p>{metric.value}</p>
            <span>{metric.detail}</span>
          </motion.div>
        ))}
      </div>

      <div className="mentor-skill-strip">
        {skillChips.length > 0 ? (
          skillChips.map((skill) => (
            <span
              key={skill}
              className="mentor-skill-chip mentor-skill-chip-compact"
            >
              {skill}
            </span>
          ))
        ) : (
          <span className="mentor-skill-chip mentor-skill-chip-compact">
            No skill tags available
          </span>
        )}
      </div>
    </section>
  );
}
