import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import "./my-learning.css";

const EMPTY = [];

function unwrap(response) {
  return response?.data?.data;
}

function getErrorMessage(error) {
  return (
    error?.response?.data?.data?.error ||
    error?.response?.data?.message ||
    error?.message ||
    "Unable to load data"
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return "—";
  if (minutes < 60) return `${Math.round(minutes)} Min`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours} ${hours === 1 ? "Hour" : "Hours"}`;
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatRelative(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((startOfToday - startOfDay) / 86400000);
  if (dayDiff <= 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff < 7) return `${dayDiff} days ago`;
  if (dayDiff < 30) return "Last week";
  return formatDate(date);
}

function dayKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

const BOOKING_STATUS_LABELS = {
  PENDING: "Pending",
  CONFIRMED: "Accepted",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  RESCHEDULE_REQUESTED: "Reschedule Requested",
};

const STATUS_TONE = {
  pending: "pending",
  confirmed: "accepted",
  accepted: "accepted",
  reschedule_requested: "pending",
  in_progress: "in_progress",
  completed: "completed",
  cancelled: "cancelled",
  rejected: "cancelled",
};

const TIMELINE_META = {
  SESSION_REQUESTED: { icon: "schedule_send", tone: "pending", label: "Session Requested" },
  SESSION_ACCEPTED: { icon: "event_available", tone: "accepted", label: "Session Accepted" },
  SESSION_RESCHEDULED: { icon: "update", tone: "pending", label: "Session Rescheduled" },
  SESSION_STARTED: { icon: "play_circle", tone: "in_progress", label: "Session Started" },
  SESSION_COMPLETED: { icon: "task_alt", tone: "completed", label: "Session Completed" },
  SESSION_CANCELLED: { icon: "event_busy", tone: "cancelled", label: "Session Cancelled" },
  NOTES_ADDED: { icon: "sticky_note_2", tone: "info", label: "Notes Added" },
  CERTIFICATE_EARNED: { icon: "workspace_premium", tone: "warning", label: "Certificate Earned" },
};

const ACTIVITY_META = {
  REQUESTED: { icon: "schedule_send", tone: "ml-activity-icon--info" },
  SCHEDULED: { icon: "event_available", tone: "ml-activity-icon--info" },
  RESCHEDULED: { icon: "update", tone: "ml-activity-icon--warning" },
  STARTED: { icon: "play_circle", tone: "ml-activity-icon--primary" },
  COMPLETED: { icon: "task_alt", tone: "ml-activity-icon--success" },
  CANCELLED: { icon: "event_busy", tone: "ml-activity-icon--danger" },
  CERTIFICATE: { icon: "workspace_premium", tone: "ml-activity-icon--warning" },
  TODO_ADDED: { icon: "add_task", tone: "ml-activity-icon--info" },
  TODO_COMPLETED: { icon: "task_alt", tone: "ml-activity-icon--success" },
  NOTE_SAVED: { icon: "sticky_note_2", tone: "" },
};

/* ════════════════════════════════════════════════════════════════════════
   Empty-state illustration — a layered icon scene built entirely from
   Material Symbols + CSS (no images), so it stays crisp, theme-aware and
   consistent with the rest of the platform.
   ════════════════════════════════════════════════════════════════════════ */

const EMPTY_ART_SCENES = {
  timeline: {
    main: "timeline",
    floats: [
      { icon: "flag", cls: "a", tone: "primary" },
      { icon: "sticky_note_2", cls: "b", tone: "info" },
      { icon: "workspace_premium", cls: "c", tone: "warning" },
    ],
  },
  calendar: {
    main: "calendar_month",
    floats: [
      { icon: "event", cls: "a", tone: "info" },
      { icon: "alarm_add", cls: "b", tone: "warning" },
      { icon: "star", cls: "c", tone: "primary" },
    ],
  },
  history: {
    main: "receipt_long",
    floats: [
      { icon: "event_available", cls: "a", tone: "success" },
      { icon: "task_alt", cls: "b", tone: "primary" },
      { icon: "edit_note", cls: "c", tone: "info" },
    ],
  },
  search: {
    main: "search_off",
    floats: [
      { icon: "filter_alt_off", cls: "a", tone: "muted" },
      { icon: "cleaning_services", cls: "b", tone: "muted" },
      { icon: "refresh", cls: "c", tone: "muted" },
    ],
  },
};

function EmptyArt({ variant, compact = false }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Reduced-motion users and browsers without IntersectionObserver get the
    // scene immediately — it is decorative, never content, so it must not be
    // gated behind an entrance that may never fire.
    if (prefersReducedMotion || typeof window.IntersectionObserver === "undefined") {
      setInView(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -24px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const scene = EMPTY_ART_SCENES[variant] || EMPTY_ART_SCENES.timeline;
  return (
    <div
      ref={ref}
      className={`ml-empty-art${compact ? " ml-empty-art--compact" : ""}${inView ? " is-in-view" : ""}`}
      data-testid={`empty-art-${variant}`}
      aria-hidden="true"
    >
      <span className="ml-empty-art__halo" />
      <span className="ml-empty-art__main">
        <Icon name={scene.main} />
      </span>
      {scene.floats.map((floater) => (
        <span
          className={`ml-empty-art__float ml-empty-art__float--${floater.cls} ml-empty-art__float--${floater.tone}`}
          key={floater.cls}
        >
          <Icon name={floater.icon} />
        </span>
      ))}
      <span className="ml-empty-art__dot ml-empty-art__dot--1" />
      <span className="ml-empty-art__dot ml-empty-art__dot--2" />
      <span className="ml-empty-art__dot ml-empty-art__dot--3" />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Hero — unified platform gradient, compact 320px shell, 2×2 glass stats
   ════════════════════════════════════════════════════════════════════════ */

function Hero({ learnerName, overview, onContinue }) {
  const firstName = (learnerName || "Learner").trim().split(/\s+/)[0];
  const stats = [
    { value: overview.completedSessions, label: "Completed Sessions" },
    { value: overview.upcomingSessions, label: "Upcoming Sessions" },
    { value: overview.activeMentors, label: "Active Mentors" },
    { value: `${overview.learningHours} Hrs`, label: "Learning Hours" },
  ];
  return (
    <section className="ml-hero" aria-label="Welcome">
      <div className="ml-hero-decor" aria-hidden="true">
        <span className="ml-hero-orb ml-hero-orb--1" />
        <span className="ml-hero-orb ml-hero-orb--2" />
        <span className="ml-hero-orb ml-hero-orb--3" />
      </div>
      <div className="ml-hero-copy">
        <span className="ml-hero-eyebrow">
          <Icon name="school" /> My Learning
        </span>
        <h1 className="ml-hero-greet">
          {greeting()}, {firstName}
        </h1>
        <p className="ml-hero-text">
          Track your mentor sessions, continue your learning journey and monitor your progress.
        </p>
        <div className="ml-hero-actions">
          <button type="button" className="ml-btn ml-btn--hero-primary" onClick={onContinue}>
            <Icon name="play_arrow" /> Continue Learning
          </button>
          <Link to="/learner/mentors" className="ml-btn ml-btn--glass">
            <Icon name="person_search" /> Browse Mentors
          </Link>
          <Link to="/learner/sessions" className="ml-btn ml-btn--glass">
            <Icon name="calendar_add_on" /> Book Session
          </Link>
        </div>
      </div>
      <div className="ml-hero-quick" aria-label="Learning summary">
        {stats.map((stat) => (
          <div className="ml-hero-quick-item" key={stat.label}>
            <span className="ml-hero-quick-label">{stat.label}</span>
            <span className="ml-hero-quick-value">{stat.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Learning Overview
   ════════════════════════════════════════════════════════════════════════ */

function Overview({ overview }) {
  const cards = [
    { icon: "task_alt", tone: "ml-stat-icon--success", value: overview.completedSessions, label: "Completed Sessions" },
    { icon: "event", tone: "ml-stat-icon--info", value: overview.upcomingSessions, label: "Upcoming Sessions" },
    { icon: "schedule", tone: "ml-stat-icon--warning", value: `${overview.learningHours} Hrs`, label: "Learning Hours" },
    { icon: "groups", tone: "", value: overview.activeMentors, label: "Active Mentors" },
    { icon: "workspace_premium", tone: "ml-stat-icon--warning", value: overview.certificates, label: "Certificates" },
    { icon: "sticky_note_2", tone: "ml-stat-icon--info", value: overview.notes, label: "Notes" },
  ];
  return (
    <section className="ml-section" aria-label="Learning overview">
      <div className="ml-section-head">
        <h2 className="ml-section-title">
          <Icon name="insights" /> Learning Overview
        </h2>
      </div>
      <div className="ml-overview-grid">
        {cards.map((card) => (
          <div className="ml-stat-card" key={card.label}>
            <span className={`ml-stat-icon ${card.tone}`} aria-hidden="true">
              <Icon name={card.icon} />
            </span>
            <div>
              <div className="ml-stat-value">{card.value}</div>
              <div className="ml-stat-label">{card.label}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Continue Learning — priority 1: in-progress · 2: next upcoming
   3: last completed · 4: empty state
   ════════════════════════════════════════════════════════════════════════ */

function ContinueLearning({ item, onViewNotes, onBookFollowUp, onAddReminder, onContinueResources }) {
  if (!item) {
    return (
      <section className="ml-section" aria-label="Continue learning">
        <div className="ml-section-head">
          <h2 className="ml-section-title">
            <Icon name="play_circle" /> Continue Learning
          </h2>
        </div>
        <div className="ml-empty" style={{ padding: 32 }}>
          <span className="ml-empty-icon">
            <Icon name="school" />
          </span>
          <h3>No active learning sessions yet</h3>
          <p>Book a session with a mentor to start building your skills.</p>
          <Link to="/learner/mentors" className="ml-btn ml-btn--primary">
            <Icon name="person_search" /> Explore Mentors
          </Link>
        </div>
      </section>
    );
  }

  const isUpcoming = item.type === "UPCOMING";
  const isInProgress = item.type === "IN_PROGRESS";
  const statusTone = STATUS_TONE[(item.status || "").toLowerCase()] || "";

  return (
    <section className="ml-section" aria-label="Continue learning">
      <div className="ml-section-head">
        <h2 className="ml-section-title">
          <Icon name="play_circle" /> Continue Learning
        </h2>
        <span className={`ml-chip ml-chip--${statusTone || "muted"}`}>
          <Icon name={isUpcoming ? "event" : isInProgress ? "radio_button_checked" : "history"} />
          {isUpcoming ? "Upcoming Session" : isInProgress ? "In Progress" : "Last Session"}
        </span>
      </div>
      <div className="ml-continue">
        <div className="ml-continue-main">
          <span className={`ml-continue-thumb ml-continue-thumb--${statusTone || "muted"}`} aria-hidden="true">
            <Icon name={isUpcoming ? "event_available" : isInProgress ? "play_circle" : "co_present"} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="ml-continue-title">{item.title}</div>
            <div className="ml-continue-meta">
              {item.mentorName && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {item.mentorPhotoUrl ? (
                    <img className="ml-avatar-mini" src={item.mentorPhotoUrl} alt="" />
                  ) : (
                    <Icon name="account_circle" />
                  )}
                  {item.mentorName}
                </span>
              )}
              <span>·</span>
              {isUpcoming ? (
                <>
                  <span>
                    {formatDate(item.date)} · {formatTime(item.date)}
                  </span>
                  <span>·</span>
                  <span>{formatDuration(item.durationMinutes)}</span>
                </>
              ) : (
                <>
                  <span>{isInProgress ? "Started" : "Completed"} {formatRelative(item.date)}</span>
                  <span>·</span>
                  <span>{formatDuration(item.durationMinutes)}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="ml-continue-actions">
          {isUpcoming && (
            <>
              <button
                type="button"
                className="ml-btn ml-btn--outline"
                onClick={() => onAddReminder(item)}
              >
                <Icon name="alarm_add" /> Add Reminder
              </button>
              <Link to="/learner/sessions" className="ml-btn ml-btn--primary">
                <Icon name="visibility" /> View Session
              </Link>
            </>
          )}
          {isInProgress && (
            <>
              <button type="button" className="ml-btn ml-btn--outline" onClick={() => onViewNotes(item)}>
                <Icon name="sticky_note_2" /> View Notes
              </button>
              <Link to="/learner/sessions" className="ml-btn ml-btn--primary">
                <Icon name="play_arrow" /> Continue Session
              </Link>
            </>
          )}
          {!isUpcoming && !isInProgress && (
            <>
              <button type="button" className="ml-btn ml-btn--outline" onClick={() => onViewNotes(item)}>
                <Icon name="sticky_note_2" /> View Notes
              </button>
              <button type="button" className="ml-btn ml-btn--ghost" onClick={onContinueResources}>
                <Icon name="menu_book" /> Continue Resources
              </button>
              <button type="button" className="ml-btn ml-btn--primary" onClick={() => onBookFollowUp(item)}>
                <Icon name="event_repeat" /> Book Next Session
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Session Timeline — every learning event, newest first
   ════════════════════════════════════════════════════════════════════════ */

function SessionTimeline({ items }) {
  return (
    <section className="ml-section" aria-label="Session timeline">
      <div className="ml-section-head">
        <h2 className="ml-section-title">
          <Icon name="timeline" /> Session Timeline
        </h2>
        <p className="ml-section-hint">Your learning journey, newest first</p>
      </div>
      {items.length === 0 ? (
        <div className="ml-empty ml-empty--illustrated">
          <EmptyArt variant="timeline" />
          <h3>Your learning timeline will appear here</h3>
          <p>Every session you request, attend and complete — plus your notes and certificates — will build this story.</p>
        </div>
      ) : (
        <div className="ml-timeline">
          {items.map((item, index) => {
            const meta = TIMELINE_META[item.eventType] || { icon: "circle", tone: "muted", label: item.eventLabel || "Event" };
            return (
              <div className="ml-timeline-item" key={`${item.eventType}-${item.bookingId || item.sessionId || index}`}>
                <span className={`ml-timeline-dot ml-tl-dot--${meta.tone}`} aria-hidden="true">
                  <Icon name={meta.icon} />
                </span>
                <div className="ml-timeline-content">
                  <div className="ml-timeline-main">
                    <p className="ml-timeline-title">{meta.label}</p>
                    <p className="ml-timeline-topic">{item.topic}</p>
                    <div className="ml-timeline-sub">
                      {item.mentorName && (
                        <span>
                          <Icon name="person" /> {item.mentorName}
                        </span>
                      )}
                      {item.durationMinutes > 0 && (
                        <span>
                          <Icon name="timelapse" /> {formatDuration(item.durationMinutes)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="ml-timeline-side">
                    <span className="ml-timeline-date">{formatDate(item.eventTime)}</span>
                    <span className="ml-timeline-time">{formatTime(item.eventTime)}</span>
                    {item.status && (
                      <span className={`ml-status ml-status--${STATUS_TONE[(item.status || "").toLowerCase()] || "muted"}`}>
                        {BOOKING_STATUS_LABELS[item.status] || item.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Learning History (table + search + filter + pagination)
   ════════════════════════════════════════════════════════════════════════ */

function HistoryTable({ history, searchInput, onSearchInput, statusFilter, onStatusChange, onPageChange, onOpenNotes }) {
  const totalPages = history?.totalPages || 0;
  const page = history?.page || 0;
  const items = history?.items || EMPTY;
  const isSearching = Boolean(searchInput.trim()) || Boolean(statusFilter);
  const showEmptyState = history !== null && items.length === 0;
  const emptyTitle = isSearching ? "No sessions match" : "No sessions yet";
  const emptyCopy = isSearching
    ? "Try a different search term or clear the filters."
    : "Book your first mentor session — it will show up here.";
  return (
    <section className="ml-section" aria-label="Learning history">
      <div className="ml-section-head">
        <h2 className="ml-section-title">
          <Icon name="history" /> Learning History
        </h2>
        <p className="ml-section-hint">
          {history ? `${history.total} session${history.total === 1 ? "" : "s"}` : "All your sessions"}
        </p>
      </div>

      <div className="ml-history-toolbar">
        <div className="ml-search">
          <Icon name="search" />
          <input
            type="search"
            placeholder="Search by topic or mentor..."
            value={searchInput}
            onChange={(event) => onSearchInput(event.target.value)}
            aria-label="Search learning history"
          />
        </div>
        <select
          className="ml-select"
          value={statusFilter}
          onChange={(event) => onStatusChange(event.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          {Object.entries(BOOKING_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {history === null ? (
        <div className="ml-skeleton">
          <div className="ml-skeleton__block--sm" />
          <div className="ml-skeleton__block--sm" />
        </div>
      ) : showEmptyState ? (
        <div className="ml-empty ml-empty--illustrated">
          <EmptyArt variant={isSearching ? "search" : "history"} compact={isSearching} />
          <h3>{emptyTitle}</h3>
          <p>{emptyCopy}</p>
          {!isSearching && (
            <Link to="/learner/mentors" className="ml-btn ml-btn--primary ml-btn--sm">
              <Icon name="person_search" /> Find a Mentor
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="ml-table-wrap">
            <table className="ml-table">
              <thead>
                <tr>
                  <th>Session Topic</th>
                  <th>Mentor</th>
                  <th>Date</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th>Certificate</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.bookingId}>
                    <td>
                      <span className="ml-cell-title">{item.title}</span>
                      {item.description && (
                        <div className="ml-cell-sub" style={{ maxWidth: 260 }}>
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="ml-mentor-cell">
                        {item.mentorPhotoUrl ? (
                          <img className="ml-avatar" src={item.mentorPhotoUrl} alt="" />
                        ) : (
                          <span className="ml-avatar" aria-hidden="true">
                            <Icon name="account_circle" />
                          </span>
                        )}
                        <b>{item.mentorName || "—"}</b>
                      </div>
                    </td>
                    <td>{formatDate(item.date)}</td>
                    <td>{formatDuration(item.durationMinutes)}</td>
                    <td>
                      <span className={`ml-status ml-status--${STATUS_TONE[(item.status || "").toLowerCase()] || "muted"}`}>
                        {BOOKING_STATUS_LABELS[item.status] || item.status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="ml-note-link"
                        onClick={() => onOpenNotes(item)}
                      >
                        <Icon name={item.hasNote ? "sticky_note_2" : "edit_note"} />
                        {item.hasNote ? "View Notes" : "Add Notes"}
                      </button>
                    </td>
                    <td>
                      {history?.certificatesAvailable ? (
                        <Link to="/learner/certificates" className="ml-note-link">
                          <Icon name="workspace_premium" /> View
                        </Link>
                      ) : (
                        <span className="ml-cell-sub">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="ml-pagination">
              <span className="ml-page-info">
                Page {page + 1} of {totalPages}
              </span>
              <button
                type="button"
                className="ml-page-btn"
                disabled={page === 0}
                onClick={() => onPageChange(page - 1)}
                aria-label="Previous page"
              >
                <Icon name="chevron_left" />
              </button>
              {Array.from({ length: totalPages }, (_, index) => index).map((index) => (
                <button
                  type="button"
                  key={index}
                  className={`ml-page-btn ${index === page ? "is-active" : ""}`}
                  onClick={() => onPageChange(index)}
                >
                  {index + 1}
                </button>
              ))}
              <button
                type="button"
                className="ml-page-btn"
                disabled={page >= totalPages - 1}
                onClick={() => onPageChange(page + 1)}
                aria-label="Next page"
              >
                <Icon name="chevron_right" />
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Active Mentors — hidden entirely when the learner has no mentors
   ════════════════════════════════════════════════════════════════════════ */

function ActiveMentors({ mentors, onViewProfile, onBookAgain, onMessage }) {
  if (mentors.length === 0) return null;
  return (
    <section className="ml-section" aria-label="Active mentors">
      <div className="ml-section-head">
        <h2 className="ml-section-title">
          <Icon name="groups" /> Active Mentors
        </h2>
        <p className="ml-section-hint">Mentors you have learned from</p>
      </div>
      <div className="ml-mentor-grid">
        {mentors.map((mentor) => (
          <div className="ml-mentor-card" key={mentor.mentorId}>
            {mentor.photoUrl ? (
              <img className="ml-mentor-photo" src={mentor.photoUrl} alt={mentor.name} />
            ) : (
              <span className="ml-mentor-photo ml-mentor-photo--placeholder" aria-hidden="true">
                {(mentor.name || "M")[0]}
              </span>
            )}
            <h3 className="ml-mentor-name">{mentor.name}</h3>
            <p className="ml-mentor-spec">{mentor.specialization}</p>
            <div className="ml-mentor-meta">
              <span>
                <Icon name="task_alt" /> {mentor.totalSessions} completed
              </span>
              {mentor.upcomingSessions > 0 && (
                <span>
                  <Icon name="event" /> {mentor.upcomingSessions} upcoming
                </span>
              )}
              <span className="ml-mentor-rating">
                <Icon name="star" /> {mentor.rating ? mentor.rating.toFixed(1) : "—"}
              </span>
            </div>
            <div className="ml-mentor-actions">
              <button type="button" className="ml-btn ml-btn--ghost ml-btn--sm" onClick={() => onViewProfile(mentor)}>
                View Profile
              </button>
              <button type="button" className="ml-btn ml-btn--outline ml-btn--sm" onClick={() => onBookAgain(mentor)}>
                Book Again
              </button>
              <button type="button" className="ml-btn ml-btn--ghost ml-btn--sm" onClick={() => onMessage(mentor)}>
                <Icon name="chat" /> Message
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Learning Calendar — month grid of booked sessions, clickable events
   ════════════════════════════════════════════════════════════════════════ */

function LearningCalendar({ items, onSelectEvent }) {
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const eventsByDay = useMemo(() => {
    const map = {};
    items.forEach((item) => {
      const date = new Date(item.startTime);
      if (Number.isNaN(date.getTime())) return;
      const key = dayKey(date);
      (map[key] = map[key] || []).push(item);
    });
    return map;
  }, [items]);

  const monthLabel = viewDate.toLocaleString(undefined, { month: "long", year: "numeric" });
  const firstWeekday = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const changeMonth = (delta) =>
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + delta, 1));

  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${viewDate.getFullYear()}-${viewDate.getMonth()}-${day}`;
    cells.push({ day, events: eventsByDay[key] || [] });
  }

  return (
    <section className="ml-section" aria-label="Learning calendar">
      <div className="ml-section-head">
        <h2 className="ml-section-title">
          <Icon name="calendar_month" /> Learning Calendar
        </h2>
        <div className="ml-cal-nav">
          <button type="button" className="ml-icon-btn" aria-label="Previous month" onClick={() => changeMonth(-1)}>
            <Icon name="chevron_left" />
          </button>
          <span className="ml-cal-month-label">{monthLabel}</span>
          <button type="button" className="ml-icon-btn" aria-label="Next month" onClick={() => changeMonth(1)}>
            <Icon name="chevron_right" />
          </button>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="ml-empty ml-empty--illustrated">
          <EmptyArt variant="calendar" />
          <h3>No upcoming sessions</h3>
          <p>Once you book a session, it lands here with its date, time and join link.</p>
          <Link to="/learner/mentors" className="ml-btn ml-btn--primary ml-btn--sm">
            <Icon name="person_search" /> Book a Session
          </Link>
        </div>
      ) : (
        <div className="ml-cal-grid" role="grid" aria-label="Monthly calendar">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((weekday) => (
            <div className="ml-cal-weekday" key={weekday}>
              {weekday}
            </div>
          ))}
          {cells.map((cell, index) =>
            cell === null ? (
              <div className="ml-cal-cell ml-cal-cell--empty" key={`blank-${index}`} />
            ) : (
              <div className="ml-cal-cell" key={cell.day} role="gridcell">
                <span className="ml-cal-daynum">{cell.day}</span>
                {cell.events.map((event) => (
                  <button
                    type="button"
                    key={event.bookingId}
                    className={`ml-cal-chip ml-cal-chip--${STATUS_TONE[(event.status || "").toLowerCase()] || "muted"}`}
                    onClick={() => onSelectEvent(event)}
                    title={event.title}
                  >
                    {formatTime(event.startTime)} · {event.title}
                  </button>
                ))}
              </div>
            ),
          )}
        </div>
      )}
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Today's Todo List — saved tasks + auto-generated suggestions + progress
   ════════════════════════════════════════════════════════════════════════ */

function TodoList({ todos, suggestions, busy, onAdd, onToggle, onSaveEdit, onDelete, onAddSuggestion }) {
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState("");
  const editInputRef = useRef(null);

  const doneCount = todos.filter((todo) => todo.done).length;
  const totalCount = todos.length + suggestions.length;
  const progress = totalCount ? Math.round((doneCount / totalCount) * 100) : 0;

  useEffect(() => {
    if (editingId !== null) {
      editInputRef.current?.focus();
    }
  }, [editingId]);

  const submit = (event) => {
    event.preventDefault();
    if (!text.trim() || busy) return;
    onAdd(text);
    setText("");
  };

  const startEdit = (todo) => {
    setEditingId(todo.id);
    setEditingText(todo.task);
  };

  const saveEdit = (event) => {
    event.preventDefault();
    if (!editingText.trim()) return;
    onSaveEdit(editingId, editingText);
    setEditingId(null);
  };

  return (
    <section className="ml-section" aria-label="Today's todo list">
      <div className="ml-section-head">
        <h2 className="ml-section-title">
          <Icon name="checklist" /> Today's Todo List
        </h2>
        <Link to="/learner/tasks" className="ml-btn ml-btn--outline ml-btn--sm">
          <Icon name="task_alt" /> View Daily Tasks
        </Link>
      </div>

      {totalCount > 0 && (
        <div className="ml-todo-progress" aria-label={`${progress}% of tasks complete`}>
          <div className="ml-todo-progress-head">
            <span>
              {doneCount} of {totalCount} tasks done
            </span>
            <b>{progress}%</b>
          </div>
          <div className="ml-progress-bar">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <form className="ml-todo-form" onSubmit={submit}>
        <input
          className="ml-input"
          type="text"
          placeholder="Add a task, e.g. Revise Collections"
          value={text}
          maxLength={500}
          onChange={(event) => setText(event.target.value)}
          aria-label="New task"
        />
        <button type="submit" className="ml-btn ml-btn--primary" disabled={busy || !text.trim()}>
          <Icon name="add" /> Add
        </button>
      </form>

      {suggestions.length > 0 && (
        <div className="ml-suggestions">
          <p className="ml-suggestions-head">
            <Icon name="auto_awesome" /> Suggested for you
          </p>
          {suggestions.map((suggestion) => (
            <div className="ml-suggestion" key={suggestion.key}>
              <button
                type="button"
                className="ml-suggestion-check"
                aria-label={`Complete suggested task: ${suggestion.text}`}
                disabled={busy}
                onClick={() => onAddSuggestion(suggestion)}
              >
                <Icon name="add" />
              </button>
              <span className="ml-suggestion-text">{suggestion.text}</span>
            </div>
          ))}
        </div>
      )}

      {todos.length === 0 && suggestions.length === 0 ? (
        <div className="ml-todo-empty">No tasks yet — add your first one above.</div>
      ) : (
        <div className="ml-todo-list">
          {todos.map((todo) => (
            <div className={`ml-todo-item ${todo.done ? "is-done" : ""}`} key={todo.id}>
              <button
                type="button"
                className="ml-todo-check"
                aria-label={todo.done ? `Mark "${todo.task}" as not done` : `Mark "${todo.task}" as done`}
                disabled={busy}
                onClick={() => onToggle(todo, !todo.done)}
              >
                {todo.done && <Icon name="check" />}
              </button>
              {editingId === todo.id ? (
                <form className="ml-todo-edit" onSubmit={saveEdit}>
                  <input
                    ref={editInputRef}
                    className="ml-input"
                    style={{ paddingLeft: 14 }}
                    type="text"
                    value={editingText}
                    maxLength={500}
                    onChange={(event) => setEditingText(event.target.value)}
                    aria-label="Edit task"
                  />
                </form>
              ) : (
                <span className="ml-todo-task">{todo.task}</span>
              )}
              <div className="ml-todo-actions">
                {editingId === todo.id ? (
                  <>
                    <button type="button" className="ml-icon-btn" aria-label="Save task" onClick={saveEdit}>
                      <Icon name="check" />
                    </button>
                    <button type="button" className="ml-icon-btn" aria-label="Cancel editing" onClick={() => setEditingId(null)}>
                      <Icon name="close" />
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="ml-icon-btn" aria-label={`Edit "${todo.task}"`} onClick={() => startEdit(todo)}>
                      <Icon name="edit" />
                    </button>
                    <button
                      type="button"
                      className="ml-icon-btn ml-icon-btn--danger"
                      aria-label={`Delete "${todo.task}"`}
                      onClick={() => onDelete(todo)}
                    >
                      <Icon name="delete" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Recent Activity
   ════════════════════════════════════════════════════════════════════════ */

function RecentActivity({ items }) {
  return (
    <section className="ml-section" aria-label="Recent activity">
      <div className="ml-section-head">
        <h2 className="ml-section-title">
          <Icon name="notifications_active" /> Recent Activity
        </h2>
      </div>
      {items.length === 0 ? (
        <div className="ml-todo-empty">Your recent actions will show up here.</div>
      ) : (
        <div className="ml-activity">
          {items.map((item, index) => {
            const meta = ACTIVITY_META[item.type] || { icon: "circle", tone: "" };
            return (
              <div className="ml-activity-item" key={`${item.type}-${index}`}>
                <span className={`ml-activity-icon ${meta.tone}`} aria-hidden="true">
                  <Icon name={meta.icon} />
                </span>
                <div className="ml-activity-main">
                  <p className="ml-activity-title">{item.title}</p>
                  <p className="ml-activity-detail">{item.detail}</p>
                </div>
                <span className="ml-activity-time">{formatRelative(item.timestamp)}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Learning Statistics
   ════════════════════════════════════════════════════════════════════════ */

function LearningStatistics({ stats }) {
  const cards = [
    { value: stats.sessionsCompleted, label: "Sessions Completed", icon: "task_alt" },
    { value: stats.learningHours, label: "Learning Hours", icon: "schedule" },
    { value: stats.certificatesEarned, label: "Certificates Earned", icon: "workspace_premium" },
    { value: stats.notesCreated, label: "Notes Created", icon: "sticky_note_2" },
    { value: stats.mentorsLearnedFrom, label: "Mentors Learned From", icon: "groups" },
    { value: `${stats.currentStreak}d`, label: "Current Learning Streak", icon: "local_fire_department" },
    { value: stats.upcomingSessions, label: "Upcoming Sessions", icon: "event" },
    { value: stats.monthlyHours, label: "Monthly Learning Hours", icon: "calendar_month" },
  ];
  return (
    <section className="ml-section" aria-label="Learning statistics">
      <div className="ml-section-head">
        <h2 className="ml-section-title">
          <Icon name="monitoring" /> Learning Statistics
        </h2>
      </div>
      <div className="ml-stats-grid">
        {cards.map((card) => (
          <div className="ml-stat-mini" key={card.label}>
            <b>{card.value}</b>
            <span>{card.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Notes modal
   ════════════════════════════════════════════════════════════════════════ */

function NotesModal({ session, content, onContentChange, onSave, onClose, busy, loading }) {
  return (
    <div
      className="ml-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="ml-modal" role="dialog" aria-modal="true" aria-label={`Notes for ${session.title}`}>
        <div className="ml-modal-head">
          <div style={{ minWidth: 0 }}>
            <h2>Session Notes</h2>
            <p>{session.title}</p>
          </div>
          <button type="button" className="ml-modal-close" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="ml-modal-body">
          <div className="ml-note-meta">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icon name="person" /> {session.mentorName}
            </span>
            <span>·</span>
            <span>Private to you</span>
          </div>
          {loading ? (
            <div className="ml-skeleton">
              <div className="ml-skeleton__block--sm" style={{ height: 140 }} />
            </div>
          ) : (
            <textarea
              className="ml-note-textarea"
              value={content}
              onChange={(event) => onContentChange(event.target.value)}
              placeholder="Write down key takeaways, doubts and next steps from this session..."
              aria-label="Note content"
            />
          )}
        </div>
        <div className="ml-modal-foot">
          <button type="button" className="ml-btn ml-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="ml-btn ml-btn--primary" disabled={busy || loading} onClick={onSave}>
            <Icon name="save" /> Save Note
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Calendar event detail modal
   ════════════════════════════════════════════════════════════════════════ */

function CalendarEventModal({ event, onClose }) {
  const tone = STATUS_TONE[(event.status || "").toLowerCase()] || "muted";
  return (
    <div className="ml-overlay" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ml-modal" role="dialog" aria-modal="true" aria-label={event.title}>
        <div className="ml-modal-head">
          <div style={{ minWidth: 0 }}>
            <h2>{event.title}</h2>
            <p>
              {formatDate(event.startTime)} · {formatTime(event.startTime)} · {formatDuration(event.durationMinutes)}
            </p>
          </div>
          <button type="button" className="ml-modal-close" aria-label="Close" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className="ml-modal-body">
          <div className="ml-note-meta">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icon name="person" /> {event.mentorName}
            </span>
            <span>·</span>
            <span className={`ml-status ml-status--${tone}`}>
              {BOOKING_STATUS_LABELS[event.status] || event.status}
            </span>
          </div>
          <div className="ml-note-meta">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icon name="schedule" /> {formatDate(event.startTime)} at {formatTime(event.startTime)}
            </span>
            <span>·</span>
            <span>{formatDuration(event.durationMinutes)}</span>
          </div>
        </div>
        <div className="ml-modal-foot">
          <button type="button" className="ml-btn ml-btn--ghost" onClick={onClose}>
            Close
          </button>
          {event.meetingLink && event.canJoin ? (
            <a
              className="ml-btn ml-btn--primary"
              href={event.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="videocam" /> Join Session
            </a>
          ) : (
            <Link to="/learner/sessions" className="ml-btn ml-btn--primary">
              <Icon name="visibility" /> View Session
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   Page
   ════════════════════════════════════════════════════════════════════════ */

export default function LearnerLearningPage() {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  // History table state.
  const [history, setHistory] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(0);

  // Notes modal state.
  const [noteSession, setNoteSession] = useState(null);
  const [noteContent, setNoteContent] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteBusy, setNoteBusy] = useState(false);

  // Calendar event modal state.
  const [selectedEvent, setSelectedEvent] = useState(null);

  const showToast = useCallback((type, text) => {
    setToast({ type, text });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  const loadDashboard = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    try {
      const res = await client.get("/api/v1/learning/dashboard");
      setState({ loading: false, error: null, data: unwrap(res) });
    } catch (error) {
      setState({ loading: false, error: getErrorMessage(error), data: null });
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard, refreshKey]);

  const loadHistory = useCallback(async () => {
    try {
      const params = { page, size: 8 };
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      const res = await client.get("/api/v1/learning/history", { params });
      setHistory(unwrap(res));
    } catch {
      setHistory(null);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // Debounce the search box.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  /* ── Todo actions ── */

  const addTodo = useCallback(
    async (task) => {
      setBusy(true);
      try {
        await client.post("/api/v1/learning/todos", { task });
        showToast("success", "Task added");
        refresh();
      } catch (error) {
        showToast("error", getErrorMessage(error));
      } finally {
        setBusy(false);
      }
    },
    [refresh, showToast],
  );

  const addSuggestion = useCallback(
    async (suggestion) => {
      setBusy(true);
      try {
        await client.post("/api/v1/learning/todos", { task: suggestion.text, done: true });
        showToast("success", "Task completed 🎉");
        refresh();
      } catch (error) {
        showToast("error", getErrorMessage(error));
      } finally {
        setBusy(false);
      }
    },
    [refresh, showToast],
  );

  const addReminder = useCallback(
    async (item) => {
      setBusy(true);
      try {
        const task = `Attend ${item.title} on ${formatDate(item.date)}`;
        await client.post("/api/v1/learning/todos", { task });
        showToast("success", "Reminder added to your todos");
        refresh();
      } catch (error) {
        showToast("error", getErrorMessage(error));
      } finally {
        setBusy(false);
      }
    },
    [refresh, showToast],
  );

  const toggleTodo = useCallback(
    async (todo, done) => {
      setBusy(true);
      try {
        await client.patch(`/api/v1/learning/todos/${todo.id}`, { done });
        showToast("success", done ? "Task completed 🎉" : "Task marked not done");
        refresh();
      } catch (error) {
        showToast("error", getErrorMessage(error));
      } finally {
        setBusy(false);
      }
    },
    [refresh, showToast],
  );

  const saveTodoEdit = useCallback(
    async (id, task) => {
      setBusy(true);
      try {
        await client.patch(`/api/v1/learning/todos/${id}`, { task });
        showToast("success", "Task updated");
        refresh();
      } catch (error) {
        showToast("error", getErrorMessage(error));
      } finally {
        setBusy(false);
      }
    },
    [refresh, showToast],
  );

  const deleteTodo = useCallback(
    async (todo) => {
      setBusy(true);
      try {
        await client.delete(`/api/v1/learning/todos/${todo.id}`);
        showToast("success", "Task deleted");
        refresh();
      } catch (error) {
        showToast("error", getErrorMessage(error));
      } finally {
        setBusy(false);
      }
    },
    [refresh, showToast],
  );

  /* ── Notes actions ── */

  const openNotes = useCallback(async (bookingId, title, mentorName) => {
    setNoteSession({ bookingId, title, mentorName });
    setNoteLoading(true);
    setNoteContent("");
    try {
      const res = await client.get(`/api/v1/learning/sessions/${bookingId}/notes`);
      setNoteContent(unwrap(res)?.content || "");
    } catch {
      setNoteContent("");
    } finally {
      setNoteLoading(false);
    }
  }, []);

  const openNotesForItem = useCallback(
    (item) => openNotes(item.bookingId, item.title, item.mentorName),
    [openNotes],
  );

  const saveNote = useCallback(async () => {
    if (!noteSession) return;
    setNoteBusy(true);
    try {
      await client.put(`/api/v1/learning/sessions/${noteSession.bookingId}/notes`, {
        content: noteContent,
      });
      showToast("success", "Notes saved");
      setNoteSession(null);
      refresh();
    } catch (error) {
      showToast("error", getErrorMessage(error));
    } finally {
      setNoteBusy(false);
    }
  }, [noteSession, noteContent, refresh, showToast]);

  /* ── Mentor & navigation actions ── */

  const openMentorProfile = useCallback(
    (mentor) => navigate(`/mentors/${mentor.mentorId}`),
    [navigate],
  );

  const bookFollowUp = useCallback(
    (item) => navigate(`/mentors/${item.mentorId}`),
    [navigate],
  );

  const messageMentor = useCallback(
    async (mentor) => {
      try {
        const res = await client.post(`/api/v1/chat/direct/${mentor.mentorId}`);
        const conversationId = res?.data?.data?.conversationId || res?.data?.conversationId;
        navigate(conversationId ? `/learner/messages/${conversationId}` : "/learner/messages");
      } catch {
        navigate("/learner/messages");
      }
    },
    [navigate],
  );

  const handleContinue = useCallback(() => {
    if (state.data?.continueLearning) {
      navigate("/learner/sessions");
    } else {
      navigate("/learner/mentors");
    }
  }, [state.data, navigate]);

  const continueResources = useCallback(() => navigate("/learner/resources"), [navigate]);

  const dash = state.data;

  if (state.loading) {
    return (
      <div className="ml-shell">
        <div className="ml-skeleton" aria-label="Loading learning dashboard...">
          <div className="ml-skeleton__block" />
          <div className="ml-skeleton__block--sm" />
          <div className="ml-skeleton__block--sm" />
          <div className="ml-skeleton__block--sm" />
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="ml-shell">
        <div className="ml-empty">
          <span className="ml-empty-icon">
            <Icon name="error" />
          </span>
          <h3>Dashboard could not be loaded</h3>
          <p>{state.error}</p>
          <button type="button" className="ml-btn ml-btn--primary" onClick={refresh}>
            <Icon name="refresh" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const overview = dash?.overview || { completedSessions: 0, upcomingSessions: 0, learningHours: 0, activeMentors: 0, certificates: 0, notes: 0 };

  return (
    <div className="ml-shell">
      <div className="ml-dash">
        <Hero learnerName={dash?.learnerName} overview={overview} onContinue={handleContinue} />

        <Overview overview={overview} />

        <ContinueLearning
          item={dash?.continueLearning}
          onViewNotes={openNotesForItem}
          onBookFollowUp={bookFollowUp}
          onAddReminder={addReminder}
          onContinueResources={continueResources}
        />

        <SessionTimeline items={dash?.timeline || EMPTY} />

        <HistoryTable
          history={history}
          searchInput={searchInput}
          onSearchInput={(value) => {
            setSearchInput(value);
            setPage(0);
          }}
          statusFilter={statusFilter}
          onStatusChange={(value) => {
            setStatusFilter(value);
            setPage(0);
          }}
          onPageChange={setPage}
          onOpenNotes={openNotesForItem}
        />

        <ActiveMentors
          mentors={dash?.activeMentors || EMPTY}
          onViewProfile={openMentorProfile}
          onBookAgain={openMentorProfile}
          onMessage={messageMentor}
        />

        <div className="ml-split">
          <LearningCalendar items={dash?.calendar || EMPTY} onSelectEvent={setSelectedEvent} />
          <TodoList
            todos={dash?.todos || EMPTY}
            suggestions={dash?.todoSuggestions || EMPTY}
            busy={busy}
            onAdd={addTodo}
            onToggle={toggleTodo}
            onSaveEdit={saveTodoEdit}
            onDelete={deleteTodo}
            onAddSuggestion={addSuggestion}
          />
        </div>

        <div className="ml-split">
          <RecentActivity items={dash?.recentActivity || EMPTY} />
          <LearningStatistics stats={dash?.statistics || {}} />
        </div>
      </div>

      {noteSession && (
        <NotesModal
          session={noteSession}
          content={noteContent}
          onContentChange={setNoteContent}
          onSave={saveNote}
          onClose={() => setNoteSession(null)}
          busy={noteBusy}
          loading={noteLoading}
        />
      )}

      {selectedEvent && <CalendarEventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />}

      {toast && (
        <div className={`ml-toast ml-toast--${toast.type}`} role="status">
          <Icon name={toast.type === "success" ? "check_circle" : "error"} />
          {toast.text}
        </div>
      )}
    </div>
  );
}
