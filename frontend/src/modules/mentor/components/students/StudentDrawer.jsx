import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../../../common/dashboard/Icon";
import {
  initials,
  formatMoney,
  relativeDate,
} from "../../../common/dashboard/dashboardUtils";

const STATUS_LABEL = {
  active: ["mp-pill--active", "Active"],
  completed: ["mp-pill--completed", "Completed"],
  pending: ["mp-pill--pending", "Pending"],
  inactive: ["mp-pill--inactive", "Inactive"],
};

/** Right-hand drawer showing a full 360° view of one learner (real data). */
export default function StudentDrawer({ student, onClose, onReport }) {
  const navigate = useNavigate();
  const noteKey = `mentor_student_note_${student.id}`;
  const [note, setNote] = useState("");
  const [savedNote, setSavedNote] = useState(false);

  useEffect(() => {
    setNote(localStorage.getItem(noteKey) || "");
    setSavedNote(false);
  }, [noteKey]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const saveNote = () => {
    localStorage.setItem(noteKey, note);
    setSavedNote(true);
  };

  const [pillClass, pillText] =
    STATUS_LABEL[student.status] || STATUS_LABEL.inactive;
  const upcoming = student.bookings.filter((b) => b.isUpcoming);
  const completed = student.bookings.filter((b) => b.status === "COMPLETED");

  return (
    <div className="mp-overlay" onMouseDown={onClose} role="presentation">
      <aside
        className="mp-drawer"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`${student.name} details`}
      >
        <div className="mp-drawer__head">
          <span className="md-avatar" style={{ width: 46, height: 46 }}>
            {initials(student.name)}
          </span>
          <div className="mp-drawer__head-main">
            <h3 className="mp-drawer__title">{student.name}</h3>
            <p className="mp-drawer__sub">
              {student.email || "No email on file"}
            </p>
          </div>
          <span className={`mp-pill ${pillClass}`}>{pillText}</span>
          <button
            type="button"
            className="mp-icon-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="mp-drawer__body">
          {/* KPIs */}
          <div className="mp-kv">
            <div className="mp-kv__item">
              <p className="mp-kv__k">Sessions completed</p>
              <p className="mp-kv__v">{student.completed}</p>
            </div>
            <div className="mp-kv__item">
              <p className="mp-kv__k">Progress</p>
              <p className="mp-kv__v">{student.progress}%</p>
            </div>
            <div className="mp-kv__item">
              <p className="mp-kv__k">Total spent</p>
              <p className="mp-kv__v">{formatMoney(student.totalSpent)}</p>
            </div>
            <div className="mp-kv__item">
              <p className="mp-kv__k">Joined</p>
              <p className="mp-kv__v" style={{ fontSize: "0.9rem" }}>
                {student.joined
                  ? new Date(student.joined).toLocaleDateString(undefined, {
                      month: "short",
                      year: "numeric",
                    })
                  : "—"}
              </p>
            </div>
          </div>

          {/* Bio / goals */}
          {(student.aboutMe || student.skills) && (
            <div>
              <p className="mp-block__label">Learning profile</p>
              {student.skills && (
                <p style={{ margin: "0 0 6px", fontSize: "0.82rem" }}>
                  <strong>Skills:</strong> {student.skills}
                </p>
              )}
              {student.aboutMe && (
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.84rem",
                    color: "var(--md-muted)",
                    lineHeight: 1.55,
                  }}
                >
                  {student.aboutMe}
                </p>
              )}
            </div>
          )}

          {/* Roadmap progress */}
          <div>
            <p className="mp-block__label">Roadmap progress</p>
            <div className="md-progress-track" style={{ height: 8 }}>
              <div
                className="md-progress-fill"
                style={{ width: `${student.progress}%` }}
              />
            </div>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: "0.76rem",
                color: "var(--md-muted)",
              }}
            >
              {student.roadmapTitle
                ? student.roadmapTitle
                : `${student.completed} of ${student.totalSessions} sessions completed`}
            </p>
          </div>

          {/* Upcoming sessions */}
          <div>
            <p className="mp-block__label">
              Upcoming sessions ({upcoming.length})
            </p>
            {upcoming.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  fontSize: "0.82rem",
                  color: "var(--md-muted)",
                }}
              >
                No upcoming sessions booked.
              </p>
            ) : (
              <div className="mp-mini-list">
                {upcoming.slice(0, 4).map((b) => (
                  <div key={b.id} className="mp-mini-row">
                    <Icon name="event" style={{ color: "var(--brand)" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="mp-mini-row__t">{b.title}</p>
                      <p className="mp-mini-row__m">
                        {b.start ? new Date(b.start).toLocaleString() : "TBD"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Completed history */}
          <div>
            <p className="mp-block__label">
              Completed sessions ({completed.length})
            </p>
            {completed.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  fontSize: "0.82rem",
                  color: "var(--md-muted)",
                }}
              >
                No completed sessions yet.
              </p>
            ) : (
              <div className="mp-mini-list">
                {completed.slice(0, 5).map((b) => (
                  <div key={b.id} className="mp-mini-row">
                    <Icon name="task_alt" style={{ color: "#10b981" }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="mp-mini-row__t">{b.title}</p>
                      <p className="mp-mini-row__m">
                        {b.start ? new Date(b.start).toLocaleDateString() : ""}{" "}
                        · {formatMoney(b.price)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reviews from this learner */}
          {student.reviews.length > 0 && (
            <div>
              <p className="mp-block__label">
                Reviews from {student.name.split(" ")[0]}
              </p>
              <div className="mp-mini-list">
                {student.reviews.slice(0, 3).map((r) => (
                  <div
                    key={r.id}
                    className="mp-mini-row"
                    style={{ alignItems: "flex-start" }}
                  >
                    <span className="md-stars">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Icon
                          key={n}
                          name="star"
                          className={n <= Number(r.rating) ? "is-on" : "is-off"}
                        />
                      ))}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {r.comment && (
                        <p
                          className="mp-mini-row__t"
                          style={{ fontWeight: 500, fontStyle: "italic" }}
                        >
                          “{r.comment}”
                        </p>
                      )}
                      <p className="mp-mini-row__m">
                        {relativeDate(r.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Private notes (persisted locally per mentor device) */}
          <div>
            <p className="mp-block__label">Private notes</p>
            <textarea
              className="mp-note-area"
              value={note}
              placeholder="Add private notes about this learner…"
              onChange={(e) => {
                setNote(e.target.value);
                setSavedNote(false);
              }}
            />
            <button
              type="button"
              className="md-btn md-btn--outline md-btn--sm"
              style={{ marginTop: 8 }}
              onClick={saveNote}
            >
              <Icon name={savedNote ? "check" : "save"} />{" "}
              {savedNote ? "Saved" : "Save note"}
            </button>
          </div>
        </div>

        <div className="mp-drawer__foot">
          <button
            type="button"
            className="md-btn md-btn--brand md-btn--sm"
            onClick={() => navigate("/mentor/messages")}
          >
            <Icon name="chat_bubble" /> Message
          </button>
          <button
            type="button"
            className="md-btn md-btn--outline md-btn--sm"
            onClick={() => navigate("/mentor/calendar")}
          >
            <Icon name="event" /> Schedule
          </button>
          <button
            type="button"
            className="md-btn md-btn--outline md-btn--sm"
            onClick={() => onReport(student)}
          >
            <Icon name="download" /> Report
          </button>
        </div>
      </aside>
    </div>
  );
}
