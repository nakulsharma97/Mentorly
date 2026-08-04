import { useMemo } from "react";
import { bookingStatusLabel, formatSessionTime, formatDuration } from "../utils";

const JOIN_EARLY_MINUTES = 15;

export default function SessionCard({ conversation, variant = "LEARNER" }) {
  const c = conversation?.conversation || conversation || {};
  const booking = conversation?.kind === "booking";

  if (!booking) return null;

  const canJoin = useMemo(() => {
    if (!c.startTime) return false;
    const startTime = new Date(c.startTime);
    if (Number.isNaN(startTime.getTime())) return false;
    return Date.now() >= startTime.getTime() - JOIN_EARLY_MINUTES * 60 * 1000;
  }, [c.startTime]);

  const meetingLink = c.meetingLink;
  const meetingPlatform = String(c.meetingPlatform || "GOOGLE_CALENDAR")
    .replace("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
  const duration = formatDuration(c.durationMinutes);
  const paymentStatus = String(c.paymentStatus || "PENDING");
  const bookingStatus = String(c.bookingStatus || "PENDING").toUpperCase();

  return (
    <div className="ms-details__session ms-session-card">
      <div className="ms-details__session-head">
        <span className="material-symbols-outlined">calendar_month</span>
        <strong className="ms-session-card__title">
          {c.sessionTitle || conversation?.sessionTitle || "Session"}
        </strong>
        <span className="ms-booking-pill" data-status={bookingStatus}>
          {bookingStatusLabel(bookingStatus)}
        </span>
      </div>

      <div className="ms-details__rows">
        <div className="ms-details__row">
          <span>Booking ID</span>
          <strong>#{c.bookingId || conversation?.convId}</strong>
        </div>
        {c.startTime ? (
          <div className="ms-details__row">
            <span>Date &amp; Time</span>
            <strong>{formatSessionTime(c.startTime)}</strong>
          </div>
        ) : null}
        <div className="ms-details__row">
          <span>Duration</span>
          <strong>{duration}</strong>
        </div>
        <div className="ms-details__row">
          <span>Meeting Platform</span>
          <strong>{meetingPlatform}</strong>
        </div>
        <div className="ms-details__row">
          <span>Payment</span>
          <strong
            className={
              paymentStatus === "COMPLETED" ? "ms-details__value--ok" : ""
            }
          >
            {paymentStatus === "COMPLETED"
              ? "Paid"
              : paymentStatus === "PENDING"
              ? "Pending"
              : paymentStatus}
          </strong>
        </div>
      </div>

      {meetingLink ? (
        canJoin ? (
          <a
            href={meetingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="ms-btn ms-btn--primary ms-details__join ms-session-card__btn"
          >
            <span className="material-symbols-outlined">videocam</span>
            Join Session
          </a>
        ) : (
          <div
            className="ms-details__join-locked"
            title={`Available ${formatSessionTime(c.startTime)}`}
          >
            <span className="material-symbols-outlined">lock_clock</span>
            Available 15 min before the session
          </div>
        )
      ) : (
        <div className="ms-details__join-locked">
          <span className="material-symbols-outlined">link_off</span>
          Meeting not generated
        </div>
      )}
    </div>
  );
}
