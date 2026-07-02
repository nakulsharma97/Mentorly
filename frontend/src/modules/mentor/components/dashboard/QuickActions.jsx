import { Link } from "react-router-dom";
import SectionCard from "../../../common/dashboard/SectionCard";
import Icon from "../../../common/dashboard/Icon";

const ACTIONS = [
  { to: "/mentor/teach?tab=sessions", icon: "add_circle", label: "Create Session", desc: "New availability slot" },
  { to: "/mentor/teach?tab=packages", icon: "inventory_2", label: "Add Package", desc: "Bundle your sessions" },
  { to: "/mentor/messages", icon: "chat_bubble", label: "Messages", desc: "Reply to learners" },
  { to: "/mentor/calendar", icon: "calendar_month", label: "Calendar", desc: "View schedule" },
  { to: "/mentor/analytics", icon: "insights", label: "Analytics", desc: "Track performance" },
  { to: "/mentor/students", icon: "groups", label: "Students", desc: "Manage learners" },
];

/** Icon-card quick action grid. */
export default function QuickActions() {
  return (
    <SectionCard title="Quick Actions" icon="bolt">
      <div className="md-quick">
        {ACTIONS.map((a) => (
          <Link key={a.label} to={a.to} className="md-quick__item">
            <span className="md-quick__icon">
              <Icon name={a.icon} />
            </span>
            <span className="md-quick__label">{a.label}</span>
            <span className="md-quick__desc">{a.desc}</span>
          </Link>
        ))}
      </div>
    </SectionCard>
  );
}
