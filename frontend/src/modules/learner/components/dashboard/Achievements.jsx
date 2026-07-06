import SectionCard from "../../../common/dashboard/SectionCard";
import Icon from "../../../common/dashboard/Icon";

/** Achievement badges derived from the learner's activity. */
export default function Achievements({ stats, certificates = 0, streak = 0 }) {
  const badges = [
    {
      icon: "rocket_launch",
      label: "First Steps",
      desc: "Booked a session",
      unlocked: stats.totalBookings > 0,
    },
    {
      icon: "military_tech",
      label: "Finisher",
      desc: "Completed 5 sessions",
      unlocked: stats.completedSessions >= 5,
    },
    {
      icon: "local_fire_department",
      label: "On Fire",
      desc: "7-day streak",
      unlocked: streak >= 7,
    },
    {
      icon: "workspace_premium",
      label: "Certified",
      desc: "Earned a certificate",
      unlocked: certificates > 0,
    },
    {
      icon: "auto_stories",
      label: "Explorer",
      desc: "3+ skills learning",
      unlocked: stats.skillsLearning >= 3,
    },
    {
      icon: "diamond",
      label: "Scholar",
      desc: "Completed 10 sessions",
      unlocked: stats.completedSessions >= 10,
    },
  ];

  return (
    <SectionCard title="Achievements" icon="military_tech">
      <div className="ld-badges">
        {badges.map((b) => (
          <div key={b.label} className={`ld-badge${b.unlocked ? " is-unlocked" : ""}`}>
            <span className="ld-badge__icon">
              <Icon name={b.unlocked ? b.icon : "lock"} />
            </span>
            <span className="ld-badge__label">{b.label}</span>
            <span className="ld-badge__desc">{b.desc}</span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
