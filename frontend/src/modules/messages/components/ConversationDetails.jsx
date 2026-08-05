import { useMemo } from "react";
import { useNavigate } from "react-router";
import Avatar from "./Avatar";
import {
  roleLabel,
  normalizeSkills,
  bookingStatusLabel,
  formatSessionTime,
  formatDuration,
} from "../utils";

const JOIN_EARLY_MINUTES = 15;

/**
 * Right-hand learner details panel — profile identity, live session card
 * (meeting platform, time, duration, payment, join button), learning progress,
 * shared files, assignments and resources with quick navigation actions.
 */
export default function ConversationDetails({
  conversation,
  variant = "LEARNER",
  onAction,
}) {
  const navigate = useNavigate();
  const c = conversation?.conversation || conversation || {};
  const skills = normalizeSkills(c.participantSkills || c.skills);
  const booking = conversation?.kind === "booking";

  const sharedFiles = useMemo(
    () =>
      (conversation?.messages || []).filter((m) =>
        String(m.content || "").startsWith("📎 "),
      ),
    [conversation],
  );

  const sessionsPath =
    variant === "MENTOR" ? "/mentor/teach" : "/learner/sessions";
  const learningPath =
    variant === "MENTOR" ? "/mentor/dashboard" : "/learner/path";

  // Join unlocks 15 minutes before startTime and stays open through the end.
  const canJoin = useMemo(() => {
    if (!booking || !c.startTime) return false;
    const startTime = new Date(c.startTime);
    if (Number.isNaN(startTime.getTime())) return false;
    return Date.now() >= startTime.getTime() - JOIN_EARLY_MINUTES * 60 * 1000;
  }, [booking, c.startTime]);

  const meetingLink = c.meetingLink;
  const meetingPlatform = String(c.meetingPlatform || "GOOGLE_CALENDAR")
    .replace("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
  const duration = formatDuration(c.durationMinutes);
  const paymentStatus = String(c.paymentStatus || "PENDING");
  const bookingStatus = String(c.bookingStatus || "PENDING").toUpperCase();
  const online = Boolean(conversation?.online);
  const presence = online
    ? "Online"
    : conversation?.presence || "Offline";
  const peerName = conversation?.title || "Learner";

  return (
    <aside className="ms-details" aria-label="Conversation details">
      {/* ── Learner Profile ── */}
      <section className="ms-details__section">
        <div className="ms-details__identity">
          <Avatar
            name={peerName}
            imageUrl={c.participantProfileImageUrl}
            online={online}
            size={64}
          />
          <h2>{peerName}</h2>
          <p className="ms-details__role">
            {roleLabel(conversation?.role || c.participantRole)}
          </p>
          <p
            className={`ms-details__presence${online ? " is-online" : ""}`}
          >
            <span className="ms-details__dot" aria-hidden="true" />
            {presence}
          </p>
        </div>

        {skills.length > 0 && (
          <div className="ms-details__block">
            <p className="ms-details__label">Skills</p>
            <div className="ms-details__chips">
              {skills.slice(0, 6).map((skill) => (
                <span className="ms-details__chip" key={skill}>
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Session Details ── */}
      {booking ? (
        <section className="ms-details__section">
          <p className="ms-details__label">Current Session</p>
          <div className="ms-details__session">
            <div className="ms-details__session-head">
              <span className="material-symbols-outlined">
                calendar_month
              </span>
              <strong className="ms-session-card__title">
                {c.sessionTitle || conversation?.sessionTitle || "Session"}
              </strong>
              <span
                className="ms-booking-pill"
                data-status={bookingStatus}
              >
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
                  <span>Date &amp; time</span>
                  <strong>{formatSessionTime(c.startTime)}</strong>
                </div>
              ) : null}
              <div className="ms-details__row">
                <span>Duration</span>
                <strong>{duration}</strong>
              </div>
              <div className="ms-details__row">
                <span>Meeting platform</span>
                <strong>{meetingPlatform}</strong>
              </div>
              <div className="ms-details__row">
                <span>Payment</span>
                <strong
                  className={
                    paymentStatus === "COMPLETED"
                      ? "ms-details__value--ok"
                      : ""
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
                  className="ms-btn ms-btn--primary ms-details__join"
                >
                  <span className="material-symbols-outlined">login</span>
                  Join session
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
                Meeting link not generated yet
              </div>
            )}
          </div>
        </section>
      ) : null}

      {/* ── Learning Progress ── */}
      <section className="ms-details__section">
        <p className="ms-details__label">Learning Progress</p>
        <div className="ms-details__progress">
          <div className="ms-details__progress-head">
            <span className="material-symbols-outlined">trending_up</span>
            <span>Tracked in the learning path</span>
          </div>
          <div className="ms-details__progress-bar" aria-hidden="true">
            <span className="ms-details__progress-fill" />
          </div>
          <button
            type="button"
            className="ms-details__file"
            onClick={() => navigate(learningPath)}
          >
            <span className="material-symbols-outlined">map</span>
            <span>Open learning path</span>
          </button>
        </div>
      </section>

      {/* ── Assignments ── */}
      <section className="ms-details__section">
        <p className="ms-details__label">Assignments</p>
        <div className="ms-details__files">
          <button
            type="button"
            className="ms-details__file"
            onClick={() => navigate(learningPath)}
          >
            <span className="material-symbols-outlined">assignment</span>
            <span>Review practice work</span>
          </button>
          <button
            type="button"
            className="ms-details__file"
            onClick={() => navigate(sessionsPath)}
          >
            <span className="material-symbols-outlined">event_available</span>
            <span>Schedule a review session</span>
          </button>
        </div>
      </section>

      {/* ── Shared Files ── */}
      {sharedFiles.length > 0 ? (
        <section className="ms-details__section">
          <p className="ms-details__label">
            Shared Files ({sharedFiles.length})
          </p>
          <div className="ms-details__files">
            {sharedFiles.slice(0, 4).map((m, i) => {
              const name = String(m.content || "")
                .split("\n")[0]
                .replace("📎 ", "");
              const url = String(m.content || "")
                .split("\n")
                .slice(1)
                .join("\n")
                .trim();
              return (
                <a
                  key={m.id ?? i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ms-details__file"
                >
                  <span className="material-symbols-outlined">
                    description
                  </span>
                  <span>{name}</span>
                </a>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* ── Quick actions ── */}
      <section className="ms-details__section ms-details__section--actions">
        <p className="ms-details__label">Quick actions</p>
        <div className="ms-details__actions">
          <button
            type="button"
            className="ms-btn ms-btn--primary ms-btn--sm"
            onClick={() => onAction?.("reply")}
          >
            <span className="material-symbols-outlined">reply</span>
            Reply
          </button>
          <button
            type="button"
            className="ms-btn ms-btn--outline ms-btn--sm"
            onClick={() => navigate(sessionsPath)}
          >
            <span className="material-symbols-outlined">receipt_long</span>
            View Booking
          </button>
          <button
            type="button"
            className="ms-btn ms-btn--outline ms-btn--sm"
            onClick={() => navigate(learningPath)}
          >
            <span className="material-symbols-outlined">map</span>
            Open Learning Path
          </button>
          <button
            type="button"
            className="ms-btn ms-btn--outline ms-btn--sm"
            onClick={() => onAction?.("schedule")}
          >
            <span className="material-symbols-outlined">event</span>
            Schedule
          </button>
          {booking &&
            bookingStatus !== "COMPLETED" &&
            bookingStatus !== "CANCELLED" && (
              <button
                type="button"
                className="ms-btn ms-btn--outline ms-btn--sm"
                onClick={() => onAction?.("complete")}
              >
                <span className="material-symbols-outlined">check_circle</span>
                Complete
              </button>
            )}
          <button
            type="button"
            className="ms-btn ms-btn--outline ms-btn--sm ms-details__danger"
            onClick={() => onAction?.("block")}
          >
            <span className="material-symbols-outlined">block</span>
            Block
          </button>
        </div>
      </section>
    </aside>
  );
}
