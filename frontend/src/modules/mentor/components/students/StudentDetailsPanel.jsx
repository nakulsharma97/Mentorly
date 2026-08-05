import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ProgressRing } from "./StudentProgress";
import StudentSessionCard from "./StudentSessionCard";
import AssignmentCard from "./AssignmentCard";
import MentorNotes from "./MentorNotes";
import ActionButtons from "./ActionButtons";
import { initials, formatDateParts, formatTime } from "../../../common/dashboard/dashboardUtils";

const TABS = ["Overview", "Roadmap", "Sessions", "Assignments", "Resources"];

function Stars({ value = 0 }) {
  return (
    <span className="ss-panel__stars" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={`material-symbols-outlined${n <= Math.round(value) ? "" : " is-off"}`}
        >
          star
        </span>
      ))}
    </span>
  );
}

/**
 * Sticky right-hand CRM panel — profile, role badge, rating, tabs, progress
 * ring, upcoming session, assignments, private notes and quick actions.
 */
export default function StudentDetailsPanel({
  student,
  tab: tabProp = "Overview",
  onTabChange,
  onMessage,
  onSchedule,
  onDownload,
  onReport,
}) {
  const [tab, setTab] = useState(tabProp);
  const activeTab = tabProp || tab;
  const chooseTab = (t) => {
    setTab(t);
    onTabChange?.(t);
  };
  const s = student;
  const rating = typeof s.rating === "number" ? s.rating : 0;
  const milestones = s.milestones || [];
  const assignments = s.assignments || [];
  const upcoming = s.bookings?.filter((b) => b.isUpcoming) || [];
  const completed = s.bookings?.filter((b) => b.status === "COMPLETED") || [];
  const nextBooking = s.nextBooking || upcoming[0] || null;
  const topicsDone = s.topicsCompleted ?? s.completed;

  const renderTab = () => {
    switch (activeTab) {
      case "Roadmap":
        return (
          <div className="ss-panel__block">
            <p className="ss-panel__label">Learning Progress</p>
            <div className="ss-progress-card">
              <ProgressRing value={s.progress} />
              <div className="ss-progress-card__meta">
                <div className="ss-progress-card__desc">
                  <strong>{s.roadmapTitle || "Active roadmap"}</strong>
                </div>
                <p className="ss-progress-card__desc" style={{ marginTop: 6 }}>
                  {topicsDone} topic{topicsDone === 1 ? "" : "s"} of{" "}
                  {milestones.length || s.totalSessions} completed
                </p>
              </div>
            </div>
            {milestones.length > 0 ? (
              <div className="ss-topic-list">
                {milestones.map((m, i) => {
                  const done = i < Math.round((s.progress / 100) * milestones.length);
                  const current = !done && i === Math.round((s.progress / 100) * milestones.length);
                  return (
                    <div
                      key={`${m}-${i}`}
                      className={`ss-topic${done ? " is-done" : ""}${current ? " is-current" : ""}`}
                    >
                      <span className="ss-topic__check">
                        {done && (
                          <span className="material-symbols-outlined">check</span>
                        )}
                        {current && (
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                            radio_button_checked
                          </span>
                        )}
                      </span>
                      <span className="ss-topic__name">{m}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="ss-muted-note">
                No roadmap topics defined yet for this learner.
              </p>
            )}
          </div>
        );
      case "Sessions":
        return (
          <div className="ss-panel__block">
            <p className="ss-panel__label">Upcoming</p>
            {upcoming.length > 0 ? (
              <div className="ss-session-list">
                {upcoming.map((b) => (
                  <div key={b.id} className="ss-session-row">
                    <span className="ss-session-row__icon">
                      <span className="material-symbols-outlined">event</span>
                    </span>
                    <div className="ss-session-row__body">
                      <p className="ss-session-row__title">{b.title}</p>
                      <p className="ss-session-row__meta">
                        {b.start ? formatDateParts(b.start).day : "--"}{" "}
                        {b.start ? formatDateParts(b.start).month : ""}
                        {b.start ? ` · ${formatTime(b.start)}` : ""}
                      </p>
                    </div>
                    <span className="ss-chip ss-chip--progress">Booked</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="ss-muted-note">No upcoming sessions booked.</p>
            )}
            <p className="ss-panel__label">Completed</p>
            {completed.length > 0 ? (
              <div className="ss-session-list">
                {completed.slice(0, 5).map((b) => (
                  <div key={b.id} className="ss-session-row">
                    <span className="ss-session-row__icon">
                      <span className="material-symbols-outlined">task_alt</span>
                    </span>
                    <div className="ss-session-row__body">
                      <p className="ss-session-row__title">{b.title}</p>
                      <p className="ss-session-row__meta">
                        {b.start ? formatDateParts(b.start).day : "--"}{" "}
                        {b.start ? formatDateParts(b.start).month : ""}
                      </p>
                    </div>
                    <span className="ss-chip ss-chip--reviewed">Done</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="ss-muted-note">No completed sessions yet.</p>
            )}
          </div>
        );
      case "Assignments":
        return (
          <div className="ss-panel__block">
            <p className="ss-panel__label">Assignments & practice work</p>
            {assignments.length > 0 ? (
              <div className="ss-session-list">
                {assignments.map((a, i) => (
                  <AssignmentCard
                    key={`${a.title}-${i}`}
                    title={a.title}
                    sub={a.sub}
                    status={a.status}
                    onDownload={onDownload}
                  />
                ))}
              </div>
            ) : (
              <p className="ss-muted-note">
                No assignments shared yet. Assign practice work from the
                learning path to get started.
              </p>
            )}
          </div>
        );
      case "Resources":
        return (
          <div className="ss-panel__block">
            <p className="ss-panel__label">Learning resources</p>
            {milestones.length > 0 ? (
              <div className="ss-topic-list">
                {milestones.map((m, i) => (
                  <div key={`${m}-${i}`} className="ss-topic">
                    <span className="ss-topic__check">
                      <span className="material-symbols-outlined">menu_book</span>
                    </span>
                    <span className="ss-topic__name">{m}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="ss-muted-note">
                No resources have been shared with this learner yet.
              </p>
            )}
          </div>
        );
      case "Overview":
      default:
        return (
          <div className="ss-panel__block">
            <p className="ss-panel__label">Learning Progress</p>
            <div className="ss-progress-card">
              <ProgressRing value={s.progress} />
              <div className="ss-progress-card__meta">
                <div className="ss-progress-card__desc">
                  <strong>{s.roadmapTitle || "Active roadmap"}</strong>
                </div>
                <p className="ss-progress-card__desc" style={{ marginTop: 6 }}>
                  {topicsDone} topic{topicsDone === 1 ? "" : "s"} completed ·{" "}
                  {s.completed} of {s.totalSessions} sessions done
                </p>
              </div>
            </div>

            <p className="ss-panel__label">Upcoming Session</p>
            <StudentSessionCard booking={nextBooking} />

            <p className="ss-panel__label">Latest Assignment</p>
            {assignments.length > 0 ? (
              <AssignmentCard
                title={assignments[0].title}
                sub={assignments[0].sub}
                status={assignments[0].status}
                onDownload={onDownload}
              />
            ) : (
              <p className="ss-muted-note">No assignments shared yet.</p>
            )}

            <p className="ss-panel__label">Private notes</p>
            <MentorNotes studentId={s.id} />
          </div>
        );
    }
  };

  return (
    <aside className="ss-panel" aria-label={`${s.name} details`}>
      <div className="ss-panel__profile">
        <span className="ss-panel__avatar">
          {s.profileImageUrl ? (
            <img src={s.profileImageUrl} alt="" />
          ) : (
            initials(s.name)
          )}
        </span>
        <h3 className="ss-panel__name">{s.name}</h3>
        <p className="ss-panel__email">{s.email || "No email on file"}</p>
        <span className="ss-panel__role">
          <span className="material-symbols-outlined">verified</span>
          Active Learner
        </span>
        <div className="ss-panel__rating">
          <Stars value={rating} />
          {rating > 0 ? (
            <span>{rating.toFixed(1)} · {s.reviewCount || 0} review{s.reviewCount === 1 ? "" : "s"}</span>
          ) : (
            <span>No reviews yet</span>
          )}
        </div>
      </div>

      <div className="ss-panel__tabs" role="tablist" aria-label="Student sections">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={activeTab === t}
            className={`ss-panel__tab${activeTab === t ? " is-active" : ""}`}
            onClick={() => chooseTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
        >
          {renderTab()}
        </motion.div>
      </AnimatePresence>

      <ActionButtons
        onMessage={onMessage}
        onSchedule={onSchedule}
        onReport={onReport}
      />
    </aside>
  );
}
