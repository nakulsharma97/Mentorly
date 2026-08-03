import { Link } from "react-router";
import SectionCard, { EmptyState } from "../../../common/dashboard/SectionCard";
import Icon from "../../../common/dashboard/Icon";
import { formatDateParts, formatTime, formatMoney } from "../../../common/dashboard/dashboardUtils";

/** Professional session list: date chip, course, status badge, join + more. */
export default function UpcomingSessions({ sessions = [] }) {
  return (
    <SectionCard
      title="Upcoming Sessions"
      icon="calendar_today"
      action="Manage"
      actionTo="/mentor/teach?tab=sessions"
    >
      {sessions.length === 0 ? (
        <EmptyState
          icon="event_available"
          title="No upcoming sessions"
          description="Publish your next availability slot so learners can find and book you."
          actionLabel="Create Session"
          actionTo="/mentor/teach?tab=sessions"
        />
      ) : (
        <div className="md-rows">
          {sessions.slice(0, 5).map((s) => {
            const { day, month } = formatDateParts(s?.startTime);
            const booked = Number(s?.confirmedBookings || 0);
            return (
              <div key={s.id} className="md-row">
                <div className="md-row__date">
                  <span className="md-row__date-day">{day}</span>
                  <span className="md-row__date-mon">{month}</span>
                </div>
                <div className="md-row__main">
                  <p className="md-row__title">
                    {s?.skill?.name ? `${s.skill.name} — ` : ""}
                    {s?.title || "Session"}
                  </p>
                  <p className="md-row__meta">
                    <Icon name="schedule" /> {formatTime(s?.startTime)}
                    <span>·</span>
                    <Icon name="payments" /> {formatMoney(s?.pricePerHour || 0)}/hr
                  </p>
                </div>
                <div className="md-row__actions">
                  <span className={`md-badge ${booked > 0 ? "md-badge--ok" : "md-badge--info"}`}>
                    <Icon name="group" /> {booked} booked
                  </span>
                  <Link to="/mentor/teach?tab=sessions" className="md-btn md-btn--brand md-btn--sm">
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
