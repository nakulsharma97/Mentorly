import { formatDateParts, formatTime } from "../../../common/dashboard/dashboardUtils";

const JOIN_EARLY_MINUTES = 15;

/**
 * Next-session card for the details panel — blue date chip, topic, time and
 * platform, with a Join button that unlocks 15 minutes before the session.
 */
export default function StudentSessionCard({ booking }) {
  if (!booking) {
    return (
      <div className="ss-session">
        <div className="ss-session__head">
          <span className="ss-session__date">
            <span className="ss-session__date-day">—</span>
            <span className="ss-session__date-month">TBD</span>
          </span>
          <div>
            <p className="ss-session__title">No upcoming session</p>
            <p className="ss-session__meta" style={{ marginTop: 4 }}>
              Nothing is booked right now.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { day, month } = formatDateParts(booking.start);
  const time = booking.start ? formatTime(booking.start) : "Time TBD";
  const startTime = booking.start ? new Date(booking.start).getTime() : 0;
  const canJoin = Number.isFinite(startTime) &&
    Date.now() >= startTime - JOIN_EARLY_MINUTES * 60 * 1000;

  return (
    <div className="ss-session">
      <div className="ss-session__head">
        <span className="ss-session__date">
          <span className="ss-session__date-day">{day}</span>
          <span className="ss-session__date-month">{month}</span>
        </span>
        <div style={{ minWidth: 0 }}>
          <p className="ss-session__title">{booking.title}</p>
          <div className="ss-session__meta">
            <span>
              <span className="material-symbols-outlined">schedule</span>
              {time}
            </span>
            {booking.platform ? (
              <span>
                <span className="material-symbols-outlined">videocam</span>
                {booking.platform}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {booking.meetingLink ? (
        <a
          href={booking.meetingLink}
          target="_blank"
          rel="noopener noreferrer"
          className={`ss-session__join${canJoin ? "" : " is-locked"}`}
        >
          <span className="material-symbols-outlined">
            {canJoin ? "play_arrow" : "lock_clock"}
          </span>
          {canJoin ? "Join session" : "Join unlocks 15 min before"}
        </a>
      ) : (
        <span className="ss-session__join is-locked">
          <span className="material-symbols-outlined">link_off</span>
          Meeting link not generated yet
        </span>
      )}
    </div>
  );
}
