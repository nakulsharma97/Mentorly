import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import "./LearnerPages.css";
import "../modules/mentor/mentor-pages.css";

/* Stable empty array reference to avoid creating a new [] on every render */
const EMPTY_ARRAY = [];

/* ══════════════════════════════════════════════════════════════════════════
   Inline helpers (mirrored from LearnerPages.jsx so we stay self-contained)
   ══════════════════════════════════════════════════════════════════════════ */

function useDocumentTitle(title) {
  useEffect(() => {
    document.title = `${title} | SkillSwap`;
  }, [title]);
}

function unwrapResponse(payload) {
  if (
    payload &&
    typeof payload === "object" &&
    Object.prototype.hasOwnProperty.call(payload, "data") &&
    Object.prototype.hasOwnProperty.call(payload, "message")
  ) {
    return payload.data;
  }
  return payload;
}

async function apiGet(path, config) {
  const response = await client.get(path, config);
  return unwrapResponse(response.data);
}

async function apiPut(path, body, config) {
  const response = await client.put(path, body, config);
  return unwrapResponse(response.data);
}

async function apiPost(path, body, config) {
  const response = await client.post(path, body, config);
  return unwrapResponse(response.data);
}

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "Unable to load data"
  );
}

function useResource(loader, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    Promise.resolve()
      .then(loader)
      .then((data) => {
        if (!active) return;
        setState({ loading: false, data, error: null });
      })
      .catch((error) => {
        if (!active) return;
        setState({ loading: false, data: null, error: getErrorMessage(error) });
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}

function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);
  return debounced;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "\u2014";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDuration(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "TBD";
  const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  if (minutes >= 60) {
    const hours = Math.round((minutes / 60) * 10) / 10;
    return `${hours}h`;
  }
  return `${minutes} min`;
}

function initials(value) {
  return String(value || "?")
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

const dayKey = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

function buildBookingStats(bookings) {
  const now = Date.now();
  const upcoming = bookings.filter((b) => {
    const t = new Date(b?.session?.startTime || 0).getTime();
    return Number.isFinite(t) && t >= now;
  });
  const completed = bookings.filter(
    (b) => String(b?.bookingStatus || "").toUpperCase() === "COMPLETED",
  );
  const cancelled = bookings.filter(
    (b) => String(b?.bookingStatus || "").toUpperCase() === "CANCELLED",
  );
  const totalHours = completed.reduce((sum, b) => {
    const s = new Date(b?.session?.startTime || 0).getTime();
    const e = new Date(b?.session?.endTime || 0).getTime();
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return sum;
    return sum + (e - s) / 3600000;
  }, 0);
  return { upcoming, completed, cancelled, totalHours: Math.round(totalHours * 10) / 10 };
}

/* ══════════════════════════════════════════════════════════════════════════
   Skeleton loader for sessions
   ══════════════════════════════════════════════════════════════════════════ */

function SessionSkeletonCard() {
  return (
    <div className="ls-skel-card">
      <div className="ls-skel-row">
        <div className="ls-skel-avatar" />
        <div className="ls-skel-lines">
          <div className="ls-skel-line ls-skel-line--60" />
          <div className="ls-skel-line ls-skel-line--90" />
        </div>
      </div>
      <div className="ls-skel-pills">
        <div className="ls-skel-pill" />
        <div className="ls-skel-pill" />
        <div className="ls-skel-pill" />
      </div>
      <div className="ls-skel-actions">
        <div className="ls-skel-btn" />
        <div className="ls-skel-btn" />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Mini Calendar Widget
   ══════════════════════════════════════════════════════════════════════════ */

function MiniCalendar({ sessions }) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const sessionDates = useMemo(() => {
    const set = new Set();      (sessions || EMPTY_ARRAY).forEach((b) => {
      const d = dayKey(b?.session?.startTime);
      if (d) set.add(d);
    });
    return set;
  }, [sessions]);

  const todayStr = today.toISOString().slice(0, 10);
  const weekDays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  return (
    <div className="ls-mini-cal">
      <div className="ls-mini-cal__header">
        <span className="ls-mini-cal__month">{monthNames[month]} {year}</span>
        <span className="ls-mini-cal__today-badge">Today</span>
      </div>
      <div className="ls-mini-cal__grid">
        {weekDays.map((d) => (
          <span key={d} className="ls-mini-cal__dow">{d}</span>
        ))}
        {Array.from({ length: firstDay }, (_, i) => (
          <span key={`empty-${i}`} className="ls-mini-cal__empty" />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isToday = dateStr === todayStr;
          const hasSession = sessionDates.has(dateStr);
          return (
            <span
              key={day}
              className={`ls-mini-cal__day${isToday ? " is-today" : ""}${hasSession ? " has-session" : ""}`}
            >
              {day}
              {hasSession && <span className="ls-mini-cal__dot" />}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Premium Session Card
   ══════════════════════════════════════════════════════════════════════════ */

function PremiumSessionCard({ booking, onCancel }) {
  const session = booking?.session || {};
  const mentor = session?.mentor || {};
  const rawStatus = String(booking?.bookingStatus || "PENDING").toUpperCase();
  const statusKey =
    rawStatus === "CONFIRMED" || rawStatus === "ACCEPTED" ? "UPCOMING" : rawStatus;

  const statusMeta = {
    UPCOMING: { label: "Upcoming", class: "ls-badge--upcoming", icon: "event" },
    COMPLETED: { label: "Completed", class: "ls-badge--completed", icon: "task_alt" },
    CANCELLED: { label: "Cancelled", class: "ls-badge--cancelled", icon: "cancel" },
    PENDING: { label: "Pending Payment", class: "ls-badge--pending", icon: "payments" },
  }[statusKey] || { label: rawStatus, class: "ls-badge--pending", icon: "schedule" };

  const hasLink = Boolean(session.meetingLink);
  const isUpcoming = statusKey === "UPCOMING" || statusKey === "PENDING";
  const isCompleted = statusKey === "COMPLETED";
  const mentorName = mentor.fullName || "Mentor";
  const sessionTitle = session.title || "Untitled session";
  const sessionSkills = mentor.skills || EMPTY_ARRAY;

  return (
    <article className="ls-session-card md-animate">
      <div className="ls-session-card__inner">
        <div className="ls-session-card__left">
          <div className="ls-session-card__avatar-wrap">
            {mentor.profileImageUrl ? (
              <img className="ls-session-card__avatar" src={mentor.profileImageUrl} alt={mentorName} />
            ) : (
              <div className="ls-session-card__avatar ls-session-card__avatar--fallback">
                {initials(mentorName)}
              </div>
            )}
            <span className={`ls-session-card__presence${mentor.liveNow ? " is-online" : ""}`} />
          </div>
        </div>

        <div className="ls-session-card__body">
          <div className="ls-session-card__top">
            <div className="ls-session-card__info">
              <div className="ls-session-card__name-row">
                <h3 className="ls-session-card__mentor">{mentorName}</h3>
                {mentor.mentorVerified && (
                  <span className="ls-session-card__verified">
                    <Icon name="verified" /> Verified
                  </span>
                )}
              </div>
              <p className="ls-session-card__title">{sessionTitle}</p>
            </div>
            <span className={`ls-session-card__badge ${statusMeta.class}`}>
              <Icon name={statusMeta.icon} />
              {statusMeta.label}
            </span>
          </div>

          <div className="ls-session-card__meta">
            <span className="ls-session-card__meta-item">
              <Icon name="calendar_today" />
              <span>{formatDate(session.startTime)}</span>
            </span>
            <span className="ls-session-card__meta-item">
              <Icon name="schedule" />
              <span>{formatTime(session.startTime)}</span>
            </span>
            <span className="ls-session-card__meta-item">
              <Icon name="timelapse" />
              <span>{formatDuration(session.startTime, session.endTime)}</span>
            </span>
            {session.meetingPlatform && (
              <span className="ls-session-card__meta-item">
                <Icon name="videocam" />
                <span>{session.meetingPlatform}</span>
              </span>
            )}
            {hasLink && (
              <a
                href={session.meetingLink}
                target="_blank"
                rel="noreferrer"
                className="ls-session-card__meta-item ls-session-card__meta-link"
              >
                <Icon name="link" />
                <span>Meeting link</span>
              </a>
            )}
          </div>

          {sessionSkills.length > 0 && (
            <div className="ls-session-card__skills">
              {sessionSkills.slice(0, 4).map((skill, i) => (
                <span key={i} className="ls-session-card__skill-chip">{skill}</span>
              ))}
              {sessionSkills.length > 4 && (
                <span className="ls-session-card__skill-more">+{sessionSkills.length - 4}</span>
              )}
            </div>
          )}

          <div className="ls-session-card__actions">
            {isUpcoming && hasLink && (
              <a
                href={session.meetingLink}
                target="_blank"
                rel="noreferrer"
                className="ls-btn ls-btn--primary"
              >
                <Icon name="videocam" /> Join Session
              </a>
            )}
            {isUpcoming && !hasLink && (
              <Link to={`/mentors/${mentor.id}`} className="ls-btn ls-btn--primary">
                <Icon name="person" /> View Mentor
              </Link>
            )}
            {isUpcoming && (
              <>
                <Link to="/learner/messages" className="ls-btn ls-btn--outline">
                  <Icon name="event_repeat" /> Reschedule
                </Link>
                <button type="button" className="ls-btn ls-btn--ghost" onClick={() => onCancel?.(booking)}>
                  <Icon name="cancel" /> Cancel
                </button>
              </>
            )}
            {isCompleted && (
              <>
                <Link to={`/mentors/${mentor.id}`} className="ls-btn ls-btn--primary">
                  <Icon name="star" /> Rate Mentor
                </Link>
                <Link to="/learner/mentors" className="ls-btn ls-btn--outline">
                  <Icon name="person_search" /> Book Again
                </Link>
              </>
            )}
            {!isUpcoming && !isCompleted && (
              <Link to="/learner/mentors" className="ls-btn ls-btn--primary">
                <Icon name="person_search" /> Book Again
              </Link>
            )}
            <button type="button" className="ls-btn ls-btn--icon" title="More options" aria-label="More options">
              <Icon name="more_vert" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Premium Empty State
   ══════════════════════════════════════════════════════════════════════════ */

function SessionsEmptyState({ activeTab, query }) {
  const iconMap = {
    upcoming: "event_busy",
    completed: "task_alt",
    cancelled: "cancel",
  };
  const descMap = {
    upcoming:
      "You haven't booked any mentoring sessions yet. Explore mentors and schedule your first learning session.",
    completed:
      "Completed sessions will appear here once you finish them with your mentors.",
    cancelled:
      "Cancelled sessions will appear here if any bookings are cancelled.",
  };

  return (
    <div className="ls-empty-state md-animate">
      <div className="ls-empty-state__icon-wrap">
        <Icon name={iconMap[activeTab] || "event_busy"} />
      </div>
      <div className="ls-empty-state__content">
        <h3 className="ls-empty-state__title">
          {query ? `No "${query}" results` : activeTab === "upcoming" ? "No Sessions Yet" : "Nothing here yet"}
        </h3>
        <p className="ls-empty-state__desc">
          {query ? `No ${activeTab} sessions match "${query}". Try a different search term.` : descMap[activeTab]}
        </p>
        <div className="ls-empty-state__actions">
          {activeTab === "upcoming" && !query && (
            <>
              <Link to="/learner/mentors" className="ls-btn ls-btn--primary">
                <Icon name="person_search" /> Find Mentors
              </Link>
              <Link to="/learner/skills" className="ls-btn ls-btn--outline">
                <Icon name="auto_stories" /> Explore Skills
              </Link>
            </>
          )}
          {query && (
            <Link to="/learner/mentors" className="ls-btn ls-btn--primary">
              <Icon name="search" /> Browse All Sessions
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Right Sidebar
   ══════════════════════════════════════════════════════════════════════════ */

function ProgressRing({ value }) {
  const pct = clamp(Math.round(Number(value || 0)), 0, 100);
  const r = 34;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <svg className="ls-ring" viewBox="0 0 100 100" role="img" aria-label={`${pct}% complete`}>
      <defs>
        <linearGradient id="lsRingGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f766e" />
          <stop offset="100%" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      <circle className="ls-ring__track" cx="50" cy="50" r={r} />
      <circle
        className="ls-ring__val"
        cx="50"
        cy="50"
        r={r}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 50 50)"
      />
      <text className="ls-ring__text" x="50" y="50" textAnchor="middle" dominantBaseline="central">
        {pct}%
      </text>
    </svg>
  );
}

function RightSidebar({ stats, allBookings }) {
  const weeklyGoal = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    const weekSessions = allBookings.filter((b) => {
      const t = new Date(b?.session?.startTime || 0).getTime();
      const status = String(b?.bookingStatus || "").toUpperCase();
      return t >= weekAgo && status === "COMPLETED";
    });
    const target = 5;
    return Math.min(100, Math.round((weekSessions.length / target) * 100));
  }, [allBookings]);

  const motivation = useMemo(() => {
    if (weeklyGoal >= 100) return "Amazing! You crushed your weekly goal! \uD83C\uDF1F";
    if (weeklyGoal >= 60) return "Great progress! Keep it up! \uD83D\uDCAA";
    if (weeklyGoal >= 30) return "Good start! Stay consistent. \uD83D\uDCA1";
    return "Book a session to start learning! \uD83D\uDE80";
  }, [weeklyGoal]);

  return (
    <aside className="ls-sidebar md-animate">
      {/* Learning Summary */}
      <div className="ls-sidebar__card">
        <div className="ls-sidebar__card-header">
          <Icon name="insights" />
          <h3>Learning Summary</h3>
        </div>
        <div className="ls-sidebar__ring-section">
          <ProgressRing value={weeklyGoal} />
          <div className="ls-sidebar__ring-text">
            <span className="ls-sidebar__ring-label">Weekly Goal</span>
            <span className="ls-sidebar__ring-sub">{stats.totalHours}h completed this week</span>
          </div>
        </div>
        <p className="ls-sidebar__motivation">{motivation}</p>
      </div>

      {/* Quick Actions */}
      <div className="ls-sidebar__card">
        <div className="ls-sidebar__card-header">
          <Icon name="bolt" />
          <h3>Quick Actions</h3>
        </div>
        <div className="ls-sidebar__actions">
          <Link to="/learner/mentors" className="ls-sidebar__action">
            <span className="ls-sidebar__action-icon" style={{ background: "linear-gradient(135deg, #0f766e, #14b8a6)" }}>
              <Icon name="person_search" />
            </span>
            <div>
              <strong>Find Mentors</strong>
              <span>Discover expert mentors</span>
            </div>
            <Icon name="chevron_right" className="ls-sidebar__action-arrow" />
          </Link>
          <Link to="/learner/skills" className="ls-sidebar__action">
            <span className="ls-sidebar__action-icon" style={{ background: "linear-gradient(135deg, #1d4ed8, #3b82f6)" }}>
              <Icon name="auto_stories" />
            </span>
            <div>
              <strong>Explore Skills</strong>
              <span>Browse learning paths</span>
            </div>
            <Icon name="chevron_right" className="ls-sidebar__action-arrow" />
          </Link>
          <Link to="/learner/learning" className="ls-sidebar__action">
            <span className="ls-sidebar__action-icon" style={{ background: "linear-gradient(135deg, #7c3aed, #a78bfa)" }}>
              <Icon name="school" />
            </span>
            <div>
              <strong>Continue Learning</strong>
              <span>View your courses</span>
            </div>
            <Icon name="chevron_right" className="ls-sidebar__action-arrow" />
          </Link>
        </div>
      </div>
    </aside>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN PAGE — LearnerSessionsPage (redesigned)
   ══════════════════════════════════════════════════════════════════════════ */

export default function LearnerSessionsPage() {
  useDocumentTitle("Booked Sessions");
  const [activeTab, setActiveTab] = useState("upcoming");
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("date_desc");
  const [mentorFilter, setMentorFilter] = useState("");
  const [statusFilter, ] = useState("");
  const [viewMode, setViewMode] = useState("list"); // "list" | "grid"
  const [refreshKey, setRefreshKey] = useState(0);

  const { loading, data, error } = useResource(() => apiGet("/api/v1/bookings"), [refreshKey]);
  const allBookings = data || EMPTY_ARRAY;

  const grouped = useMemo(() => {
    const upcoming = [];
    const completed = [];
    const cancelled = [];
    const pendingPayment = [];
    allBookings.forEach((booking) => {
      const status = String(booking?.bookingStatus || "").toUpperCase();
      if (status === "CANCELLED") cancelled.push(booking);
      else if (status === "COMPLETED") completed.push(booking);
      else if (status === "PENDING") pendingPayment.push(booking);
      else upcoming.push(booking);
    });
    return { upcoming, completed, cancelled, pendingPayment };
  }, [allBookings]);

  const mentorOptions = useMemo(() => {
    const set = new Set();
    allBookings.forEach((b) => {
      const name = b?.session?.mentor?.fullName;
      if (name) set.add(name);
    });
    return [...set].sort();
  }, [allBookings]);

  const debouncedQ = useDebouncedValue(query, 300);

  // Sessions grouped by tab
  const tabSessions = useMemo(() => {
    switch (activeTab) {
      case "upcoming": return grouped.upcoming;
      case "completed": return grouped.completed;
      case "cancelled": return grouped.cancelled;
      case "pending": return grouped.pendingPayment;
      default: return allBookings;
    }
  }, [activeTab, grouped, allBookings]);

  // Filtered sessions
  const filtered = useMemo(() => {
    return tabSessions.filter((b) => {
      const mentor = b?.session?.mentor?.fullName || "";
      const title = b?.session?.title || "";
      const date = formatDate(b?.session?.startTime);
      const status = b?.bookingStatus || "";

      if (debouncedQ) {
        const q = debouncedQ.toLowerCase();
        if (!`${mentor} ${title} ${date} ${status}`.toLowerCase().includes(q)) return false;
      }
      if (mentorFilter && mentor !== mentorFilter) return false;
      if (statusFilter && statusFilter !== "all" && status !== statusFilter) return false;
      return true;
    });
  }, [tabSessions, debouncedQ, mentorFilter, statusFilter]);

  // Sorted sessions
  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const aTime = new Date(a?.session?.startTime || 0).getTime();
      const bTime = new Date(b?.session?.startTime || 0).getTime();
      if (sortBy === "date_asc") return aTime - bTime;
      if (sortBy === "date_desc") return bTime - aTime;
      if (sortBy === "mentor") {
        const aName = (a?.session?.mentor?.fullName || "").toLowerCase();
        const bName = (b?.session?.mentor?.fullName || "").toLowerCase();
        return aName.localeCompare(bName);
      }
      return bTime - aTime;
    });
    return list;
  }, [filtered, sortBy]);

  const stats = useMemo(() => {
    const s = buildBookingStats(allBookings);
    return {
      ...s,
      cancelled: grouped.cancelled.length,
      pendingPayment: grouped.pendingPayment.length,
    };
  }, [allBookings, grouped]);

  // Imminent session (within 24h)
  const imminent = useMemo(
    () =>
      grouped.upcoming.find((b) => {
        const start = new Date(b?.session?.startTime || 0).getTime();
        const diff = start - Date.now();
        return diff > 0 && diff < 24 * 3600 * 1000;
      }),
    [grouped.upcoming],
  );

  // Next upcoming session (for hero card)
  const nextUpcoming = useMemo(
    () =>
      [...grouped.upcoming]
        .filter((b) => {
          const start = new Date(b?.session?.startTime || 0).getTime();
          return start > Date.now();
        })
        .sort((a, b) => {
          return new Date(a?.session?.startTime || 0).getTime() - new Date(b?.session?.startTime || 0).getTime();
        })[0] || null,
    [grouped.upcoming],
  );

  async function cancelBooking(booking) {
    if (!booking?.id) return;
    if (!window.confirm("Cancel this session? This cannot be undone.")) return;
    try {
      await apiPut(`/api/v1/bookings/${booking.id}/cancel`).catch(() =>
        apiPost(`/api/v1/bookings/${booking.id}/cancel`),
      );
      setRefreshKey((v) => v + 1);
    } catch (e) {
      window.console.error(e);
    }
  }

  const tabCounts = useMemo(
    () => ({
      all: allBookings.length,
      upcoming: grouped.upcoming.length,
      completed: grouped.completed.length,
      cancelled: grouped.cancelled.length,
      pending: grouped.pendingPayment.length,
    }),
    [allBookings, grouped],
  );

  const tabs = [
    { key: "all", label: "All Sessions", icon: "calendar_month" },
    { key: "upcoming", label: "Upcoming", icon: "event" },
    { key: "completed", label: "Completed", icon: "task_alt" },
    { key: "cancelled", label: "Cancelled", icon: "cancel" },
    { key: "pending", label: "Pending Payment", icon: "payments" },
  ];

  /* ── Render ── */

  return (
    <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 48px" }}>
      {/* ===== Premium Hero ===== */}
      <section className="mp-hero">
        <div className="mp-hero__watermark">
          <span className="material-symbols-outlined" style={{ fontSize: 78 }}>calendar_month</span>
        </div>
        <div className="mp-hero__content">
          <div className="mp-hero__eyebrow">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>event</span>
            SESSIONS
          </div>
          <h1>Your Booked Sessions</h1>
          <p className="mp-hero__sub">
            Manage upcoming, completed and cancelled sessions in one place. Join, reschedule, cancel or review any session.
          </p>
          <div className="mp-hero__actions" style={{ flexWrap: "wrap", gap: 10 }}>
            <div className="ls-hero__search-wrap" style={{ flex: 1, minWidth: 220, background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.15)" }}>
              <Icon name="search" className="ls-hero__search-icon" style={{ color: "rgba(255,255,255,0.60)" }} />
              <input
                className="ls-hero__search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by mentor, title, date, or status…"
                aria-label="Search sessions"
                style={{ color: "#fff" }}
              />
              {query && (
                <button
                  type="button"
                  className="ls-hero__search-clear"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  style={{ color: "rgba(255,255,255,0.60)" }}
                >
                  <Icon name="close" />
                </button>
              )}
            </div>
            <div className="ls-view-toggle" style={{ background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: 3 }}>
              <button
                type="button"
                className={`ls-view-btn${viewMode === "list" ? " is-active" : ""}`}
                onClick={() => setViewMode("list")}
                aria-label="List view"
                style={viewMode === "list" ? { background: "rgba(255,255,255,0.18)", color: "#fff" } : { color: "rgba(255,255,255,0.60)" }}
              >
                <Icon name="view_list" />
              </button>
              <button
                type="button"
                className={`ls-view-btn${viewMode === "grid" ? " is-active" : ""}`}
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                style={viewMode === "grid" ? { background: "rgba(255,255,255,0.18)", color: "#fff" } : { color: "rgba(255,255,255,0.60)" }}
              >
                <Icon name="grid_view" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Next Upcoming Session Card */}
      {nextUpcoming && (
        <div className="mp-card" style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 16, padding: 16 }}>
          <div style={{
            width: 44, height: 44, borderRadius: "var(--mp-radius)",
            overflow: "hidden", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "var(--mp-primary-light)", color: "var(--mp-primary)"
          }}>
            {nextUpcoming?.session?.mentor?.profileImageUrl ? (
              <img src={nextUpcoming.session.mentor.profileImageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>person</span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 700, color: "var(--mp-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Next Session</p>
            <p style={{ margin: "2px 0 0", fontSize: "0.92rem", fontWeight: 700, color: "var(--mp-text)" }}>
              {nextUpcoming?.session?.title || "Session"} with {nextUpcoming?.session?.mentor?.fullName || "your mentor"}
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: "0.78rem", color: "var(--mp-text-secondary)" }}>
              <span><span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 3 }}>calendar_today</span>{formatDate(nextUpcoming?.session?.startTime)}</span>
              <span><span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 3 }}>schedule</span>{formatTime(nextUpcoming?.session?.startTime)}</span>
              <span><span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: "middle", marginRight: 3 }}>timelapse</span>{formatDuration(nextUpcoming?.session?.startTime, nextUpcoming?.session?.endTime)}</span>
            </div>
          </div>
          {nextUpcoming?.session?.meetingLink && (
            <a href={nextUpcoming.session.meetingLink} target="_blank" rel="noreferrer" className="mp-btn mp-btn--primary mp-btn--sm" style={{ flexShrink: 0 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>videocam</span>
              Join
            </a>
          )}
        </div>
      )}

      {/* No upcoming empty state */}
      {!nextUpcoming && grouped.upcoming.length === 0 && (
        <div className="mp-card" style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12, padding: "14px 16px" }}>
          <div style={{
            width: 40, height: 40, borderRadius: "var(--mp-radius)",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "var(--mp-primary-light)", color: "var(--mp-primary)",
            fontSize: "1.2rem", flexShrink: 0
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>event_busy</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: 700, color: "var(--mp-text)" }}>No upcoming sessions</p>
            <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--mp-text-secondary)" }}>Book a session with a mentor to get started.</p>
          </div>
          <Link to="/learner/mentors" className="mp-btn mp-btn--primary mp-btn--sm" style={{ flexShrink: 0 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_search</span>
            Find Mentors
          </Link>
        </div>
      )}

      {/* Mini Calendar */}
      <div className="mp-card" style={{ marginTop: 16, padding: 16 }}>
        <MiniCalendar sessions={allBookings} />
      </div>

      {/* Stats Cards */}
      <div className="mp-stats" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginTop: 16 }}>
        <div className="mp-stat">
          <div className="mp-stat__top">
            <div className="mp-stat__icon">
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>event</span>
            </div>
          </div>
          <p className="mp-stat__value">{grouped.upcoming.length}</p>
          <p className="mp-stat__label">Upcoming Sessions</p>
          <p className="mp-stat__desc">Future mentoring sessions</p>
        </div>
        <div className="mp-stat">
          <div className="mp-stat__top">
            <div className="mp-stat__icon">
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>task_alt</span>
            </div>
          </div>
          <p className="mp-stat__value">{grouped.completed.length}</p>
          <p className="mp-stat__label">Completed Sessions</p>
          <p className="mp-stat__desc">Finished learning sessions</p>
        </div>
        <div className="mp-stat">
          <div className="mp-stat__top">
            <div className="mp-stat__icon">
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>cancel</span>
            </div>
          </div>
          <p className="mp-stat__value">{grouped.cancelled.length}</p>
          <p className="mp-stat__label">Cancelled Sessions</p>
          <p className="mp-stat__desc">Cancelled bookings</p>
        </div>
        <div className="mp-stat">
          <div className="mp-stat__top">
            <div className="mp-stat__icon">
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>schedule</span>
            </div>
          </div>
          <p className="mp-stat__value">{stats.totalHours}h</p>
          <p className="mp-stat__label">Total Learning Hours</p>
          <p className="mp-stat__desc">Across all completed sessions</p>
        </div>
      </div>

      {/* Main Content + Sidebar */}
      <div className="ls-content-wrap">
        <div className="ls-main">
          {/* Pill Navigation */}
          <div className="ls-pills md-animate">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`ls-pill${activeTab === tab.key ? " is-active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <Icon name={tab.icon} />
                {tab.label}
                <span className="ls-pill__count">{tabCounts[tab.key]}</span>
              </button>
            ))}
          </div>

          {/* Toolbar: Sort, Mentor filter, View toggle */}
          <div className="ls-toolbar md-animate">
            <div className="ls-toolbar__left">
              <span className="ls-toolbar__results">
                {sorted.length} session{sorted.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="ls-toolbar__right">
              <label className="ls-toolbar__select">
                <Icon name="sort" />
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="date_desc">Newest First</option>
                  <option value="date_asc">Oldest First</option>
                  <option value="mentor">Mentor (A\u2013Z)</option>
                </select>
              </label>
              <label className="ls-toolbar__select">
                <Icon name="person" />
                <select value={mentorFilter} onChange={(e) => setMentorFilter(e.target.value)}>
                  <option value="">All Mentors</option>
                  {mentorOptions.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </label>
              {(mentorFilter || query) && (
                <button
                  type="button"
                  className="ls-btn ls-btn--ghost ls-btn--sm"
                  onClick={() => {
                    setMentorFilter("");
                    setQuery("");
                  }}
                >
                  <Icon name="restart_alt" /> Clear
                </button>
              )}
              <div className="ls-view-toggle">
                <button
                  type="button"
                  className={`ls-view-btn${viewMode === "list" ? " is-active" : ""}`}
                  onClick={() => setViewMode("list")}
                  aria-label="List view"
                >
                  <Icon name="view_list" />
                </button>
                <button
                  type="button"
                  className={`ls-view-btn${viewMode === "grid" ? " is-active" : ""}`}
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid view"
                >
                  <Icon name="grid_view" />
                </button>
              </div>
            </div>
          </div>

          {/* Imminent Notification */}
          {imminent && (
            <div className="ls-reminder md-animate">
              <div className="ls-reminder__icon">
                <Icon name="notifications_active" />
              </div>
              <div className="ls-reminder__text">
                <p className="ls-reminder__title">Session starting soon!</p>
                <p className="ls-reminder__sub">
                  <strong>{imminent?.session?.title || "Your session"}</strong> with{" "}
                  <strong>{imminent?.session?.mentor?.fullName || "your mentor"}</strong> begins at{" "}
                  {formatDateTime(imminent?.session?.startTime)}.
                </p>
              </div>
              {imminent?.session?.meetingLink && (
                <a
                  href={imminent.session.meetingLink}
                  target="_blank"
                  rel="noreferrer"
                  className="ls-btn ls-btn--primary ls-btn--sm"
                >
                  <Icon name="videocam" /> Join Now
                </a>
              )}
            </div>
          )}

          {/* Session List */}
          {loading ? (
            <div className={viewMode === "grid" ? "ls-grid" : "ls-list"}>
              {[1, 2, 3].map((k) => (
                <SessionSkeletonCard key={k} />
              ))}
            </div>
          ) : error ? (
            <div className="md-empty" style={{ padding: "32px 24px", border: "none", boxShadow: "none", marginTop: 16 }}>
              <div className="md-empty__icon">
                <span className="material-symbols-outlined">error_outline</span>
              </div>
              <h3 className="md-empty__title">Sessions could not be loaded</h3>
              <p className="md-empty__desc">{error}</p>
              <button type="button" className="mp-btn mp-btn--primary" onClick={() => setRefreshKey((v) => v + 1)}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>
                Retry
              </button>
            </div>
          ) : sorted.length > 0 ? (
            <div className={viewMode === "grid" ? "ls-grid" : "ls-list"}>
              {sorted.map((b) => (
                <PremiumSessionCard key={b.id} booking={b} onCancel={cancelBooking} />
              ))}
            </div>
          ) : (
            <SessionsEmptyState activeTab={activeTab} query={debouncedQ} />
          )}
        </div>

        {/* Right Sidebar (desktop only) */}
        <RightSidebar stats={stats} allBookings={allBookings} />
      </div>
    </div>
  );
}
