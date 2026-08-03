import { Link } from "react-router";
import Icon from "../../../common/dashboard/Icon";

/** Emerald/teal glass hero for the learner workspace. */
export default function LearnerHero({
  firstName,
  nextSession,
  roadmapCompletion = 0,
  completedSessions = 0,
  streak = 0,
}) {
  return (
    <header className="md-hero md-animate">
      <div className="md-hero__body">
        <p className="md-hero__eyebrow">Learner Workspace</p>
        <h1 className="md-hero__title">Welcome back, {firstName}</h1>
        <p className="md-hero__sub">
          Keep the momentum going — pick up where you left off, prep for your next
          session, and move closer to your learning goals.
        </p>

        <div className="md-hero__actions">
          <Link to="/learner/mentors" className="md-btn md-btn--primary">
            <Icon name="person_search" /> Browse Mentors
          </Link>
          <Link to="/learner/path" className="md-btn md-btn--ghost">
            <Icon name="route" /> Learning Path
          </Link>
          <Link to="/learner/messages" className="md-btn md-btn--ghost">
            <Icon name="chat_bubble" /> Messages
          </Link>
        </div>

        <div className="md-hero__badges">
          <span className="md-hero__badge">
            <Icon name="local_fire_department" /> {streak}-day streak
          </span>
          <span className="md-hero__badge">
            <Icon name="task_alt" /> {completedSessions} sessions done
          </span>
          <span className="md-hero__badge">
            <Icon name="route" /> {roadmapCompletion}% roadmap
          </span>
        </div>
      </div>

      <div className="md-hero__aside">
        <div className="md-hero-glass">
          <p className="md-hero-glass__label">
            <Icon name="event_upcoming" /> Upcoming Session
          </p>
          <p className="md-hero-glass__value md-hero-glass__value--sm">
            {nextSession
              ? nextSession?.session?.skill?.name ||
                nextSession?.session?.title ||
                "Session booked"
              : "No session booked"}
          </p>
          <p className="md-hero-glass__desc">
            {nextSession?.session?.startTime
              ? new Date(nextSession.session.startTime).toLocaleString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Book a mentor to get started"}
          </p>
        </div>

        <div className="md-hero-glass">
          <p className="md-hero-glass__label">
            <Icon name="trending_up" /> Roadmap Progress
          </p>
          <p className="md-hero-glass__value">{roadmapCompletion}%</p>
          <div
            className="md-progress-track"
            style={{ background: "rgba(255,255,255,0.25)" }}
          >
            <div
              className="md-progress-fill"
              style={{ width: `${roadmapCompletion}%`, background: "#fff" }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
