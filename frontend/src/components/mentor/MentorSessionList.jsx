import { useMemo } from "react";
import { Link } from "react-router-dom";
import DateTimePicker from "../DateTimePicker";
import { trackAnalyticsEvent } from "../../utils/analyticsEvents";

const formatDateTime = (value) => {
  if (!value) {
    return "TBD";
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

export default function MentorSessionList({
  sessions,
  filteredSessions,
  selectedDate,
  onSelectDate,
  onClearDate,
  onBookSession,
  isLoggedIn,
  onRequireLogin,
  mentorId,
}) {
  const summaryLabel = useMemo(() => {
    if (!sessions.length) return "No active session slots yet.";
    if (!selectedDate)
      return `${sessions.length} available slots across all dates`;
    return `${filteredSessions.length} slots on selected date`;
  }, [sessions.length, filteredSessions.length, selectedDate]);

  return (
    <section className="dashboard-card mentor-section-card">
      <div className="mentor-section-header">
        <div>
          <h3>Calendar and booking</h3>
          <p className="mentor-section-copy">{summaryLabel}</p>
        </div>
        <Link className="meeting-link" to="/mentors">
          Browse mentors
        </Link>
      </div>

      <div className="mentor-filter-row">
        <DateTimePicker
          label="Filter by date"
          onSelect={(dateTime) => onSelectDate(dateTime)}
          value={selectedDate}
        />
        <button
          type="button"
          className="mentor-secondary-btn"
          onClick={onClearDate}
        >
          Clear filter
        </button>
      </div>

      {filteredSessions.length === 0 ? (
        <div className="mentor-empty-state">
          <p className="mentor-empty-title">
            No session slots match right now.
          </p>
          <p className="mentor-empty-text">
            We’ll update this schedule as the mentor publishes new availability.
          </p>
        </div>
      ) : (
        <ul className="mentor-list-clean">
          {filteredSessions.map((session) => (
            <li
              key={session.id}
              className="mentor-list-item mentor-session-card"
            >
              <div className="mentor-list-heading">
                <strong>{session.title}</strong>
                <span className="mentor-type-pill">
                  {session.sessionType || "Session"}
                </span>
              </div>
              <div className="mentor-list-meta">
                <span>{formatDateTime(session.startTime)}</span>
                <span>{formatDateTime(session.endTime)}</span>
                <span>INR {session.priceAmount}</span>
              </div>
              <button
                type="button"
                className="mentor-cta-btn"
                onClick={() => {
                  if (!isLoggedIn) {
                    if (onRequireLogin) {
                      onRequireLogin();
                    }
                    return;
                  }
                  trackAnalyticsEvent("mentor_profile_booking_flow_opened", {
                    mentorId,
                    sessionId: session.id,
                  });
                  onBookSession(session.id);
                }}
              >
                Reserve slot
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
