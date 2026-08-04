import { Link } from "react-router";
import Icon from "../../../common/dashboard/Icon";
import { Reveal } from "./ui";

const ACTIONS = [
  { to: "/learner/path", icon: "play_circle", label: "Continue Learning", hint: "Resume your roadmap", color: "#0f766e" },
  { to: "/learner/mentors", icon: "person_search", label: "Book Mentor", hint: "Find your ideal mentor", color: "#8b5cf6" },
  { to: "/learner/skills", icon: "terminal", label: "Practice Coding", hint: "Sharpen your skills", color: "#f59e0b" },
  { to: "/learner/resources", icon: "sticky_note_2", label: "Open Notes", hint: "Your study notes", color: "#3b82f6" },
  { to: "/learner/certificates", icon: "download", label: "Download Certificate", hint: "Share your proof", color: "#10b981" },
  { to: "/learner/sessions", icon: "event", label: "View Sessions", hint: "Manage bookings", color: "#f43f5e" },
];

/** Six quick-action shortcuts — the fastest way around the workspace. */
export default function QuickActions() {
  return (
    <section className="lp-section" aria-label="Quick actions">
      <Reveal>
        <div className="lp-quick">
          {ACTIONS.map((a) => (
            <Link
              key={a.label}
              to={a.to}
              className="lp-quick__card"
              style={{ "--qa-color": a.color }}
              data-testid={`quick-action-${a.label.split(" ")[0].toLowerCase()}`}
            >
              <span className="lp-quick__icon" style={{ background: `${a.color}1f`, color: a.color }}>
                <Icon name={a.icon} />
              </span>
              <div>
                <strong>{a.label}</strong>
                <span>{a.hint}</span>
              </div>
              <Icon name="arrow_forward" className="lp-quick__arrow" />
            </Link>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
