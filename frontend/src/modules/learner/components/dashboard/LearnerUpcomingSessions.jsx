import { Link } from "react-router-dom";
import SectionCard, { EmptyState } from "../../../common/dashboard/SectionCard";
import Icon from "../../../common/dashboard/Icon";
import { initials, formatDateParts, formatTime } from "../../../common/dashboard/dashboardUtils";

/** Learner's upcoming booked sessions: mentor avatar, date, time, course, join. */
export default function LearnerUpcomingSessions({ sessions = [] }) {
  return (
    <SectionCard
      title="Upcoming Sessions"
      icon="calendar_today"
      action="View all"
      actionTo="/learner/sessions"
    >
      {sessions.length === 0 ? (
        <EmptyState
          icon="event_available"
          title="No upcoming sessions"
          description="Book a mentor to schedule your next learning session."
          actionLabel="Find a mentor"
          actionTo="/learner/mentors"
        />
      ) : (
        <div className="md-rows">
          {sessions.slice(0, 5).map((b) => {
            const mentor =
              b?.mentor?.fullName || b?.session?.mentor?.fullName || "Mentor";
            const { day, month } = formatDateParts(b?.session?.startTime);
            return (
              <div key={b.id} className="md-row">
                <div className="md-row__date">
                  <span className="md-row__date-day">{day}</span>
                  <span className="md-row__date-mon">{month}</span>
                </div>
                <span className="md-avatar md-avatar--sm">{initials(mentor)}</span>
                <div className="md-row__main">
                  <p className="md-row__title">
                    {b?.session?.skill?.name || b?.session?.title || "Session"}
                  </p>
                  <p className="md-row__meta">
                    <Icon name="person" /> {mentor}
                    <span>·</span>
                    <Icon name="schedule" /> {formatTime(b?.session?.startTime)}
                  </p>
                </div>
                <div className="md-row__actions">
                  <Link
                    to="/learner/messages"
                    className="md-btn md-btn--brand md-btn--sm"
                  >
                    <Icon name="videocam" /> Join
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
