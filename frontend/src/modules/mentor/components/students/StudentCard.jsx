import { motion } from "framer-motion";
import StudentProgress from "./StudentProgress";
import { initials, formatDateParts, formatTime } from "../../../common/dashboard/dashboardUtils";

/**
 * Premium student card (min-height 220, radius 20) — top row: avatar 72px,
 * identity + skill badge, animated session progress with completed/remaining
 * sessions, next-session block. Bottom action bar: Message / Schedule.
 */
export default function StudentCard({
  student,
  selected,
  onSelect,
  onMessage,
  onSchedule,
  index = 0,
}) {
  const { day, month } = formatDateParts(student.nextBooking?.start);
  const time = student.nextBooking?.start ? formatTime(student.nextBooking.start) : null;
  const platform = student.nextBooking?.platform || "";

  const total = student.totalSessions ?? 0;
  const remaining = Math.max(0, total - (student.completed || 0));

  return (
    <motion.article
      className={`ss-card${selected ? " is-selected" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={`View ${student.name}'s details`}
      onClick={() => onSelect?.(student)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(student);
        }
      }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.4), ease: "easeOut" }}
    >
      <div className="ss-card__row">
        <span className="ss-card__avatar">
          {student.profileImageUrl ? (
            <img src={student.profileImageUrl} alt="" />
          ) : (
            initials(student.name)
          )}
          <span
            className={`ss-card__avatar-dot${student.online ? " is-online" : ""}`}
            aria-hidden="true"
          />
        </span>

        <div className="ss-card__info">
          <h3 className="ss-card__name">{student.name}</h3>
          <p className="ss-card__email">{student.email || "No email on file"}</p>
          <span className="ss-card__skill" title={student.skill}>
            {student.skill}
          </span>
        </div>

        <StudentProgress
          value={student.progress}
          topics={student.completed}
          remaining={remaining}
          showTopics
        />

        <div className="ss-card__next" title={student.nextBooking?.title || "No upcoming session"}>
          {student.nextBooking ? (
            <>
              <span className="ss-card__next-icon">
                <span className="material-symbols-outlined">calendar_month</span>
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="ss-card__next-day">
                  {day} {month}
                </div>
                <div className="ss-card__next-meta">
                  {time}
                  {platform ? ` · ${platform}` : ""}
                </div>
              </div>
            </>
          ) : (
            <>
              <span className="ss-card__next-icon">
                <span className="material-symbols-outlined">event_busy</span>
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="ss-card__next-day">No session</div>
                <div className="ss-card__next-meta">Nothing booked yet</div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="ss-card__actions" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="ss-card__action ss-card__action--primary"
          aria-label={`Message ${student.name}`}
          onClick={() => onMessage?.(student)}
        >
          <span className="material-symbols-outlined">chat_bubble</span>
          Message
        </button>
        <button
          type="button"
          className="ss-card__action ss-card__action--ghost"
          aria-label={`Schedule a session with ${student.name}`}
          onClick={() => onSchedule?.(student)}
        >
          <span className="material-symbols-outlined">event</span>
          Schedule
        </button>
      </div>
    </motion.article>
  );
}
