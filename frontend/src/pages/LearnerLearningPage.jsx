import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import "./LearnerPages.css";

/* ==========================================================================
   Inline helpers (mirrored from LearnerPages.jsx)
   ========================================================================== */

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
    return () => { active = false; };
  }, deps);
  return state;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return new Intl.DateTimeFormat(undefined, {
    month: "short", day: "2-digit", year: "numeric",
  }).format(date);
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit", minute: "2-digit",
  }).format(date);
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return new Intl.DateTimeFormat(undefined, {
    month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit",
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

function splitSkills(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => splitSkills(item))
      .map((part) => part.trim())
      .filter(Boolean);
  }
  const text = String(value).trim();
  if (!text) return [];
  if (text.startsWith("[") && text.endsWith("]")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed
          .flatMap((item) => splitSkills(item?.name ?? item))
          .map((part) => part.trim())
          .filter(Boolean);
      }
    } catch { /* fall through */ }
  }
  return text.split(/[\n,;|]+/).map((part) => part.trim()).filter(Boolean);
}

function parseMilestones(value) {
  return splitSkills(value).map((entry, index) => ({
    id: `${index}-${entry}`,
    title: entry,
  }));
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
  const totalHours = completed.reduce((sum, b) => {
    const s = new Date(b?.session?.startTime || 0).getTime();
    const e = new Date(b?.session?.endTime || 0).getTime();
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return sum;
    return sum + (e - s) / 3600000;
  }, 0);
  return { upcoming, completed, totalHours: Math.round(totalHours * 10) / 10 };
}

function computeStreak(bookings) {
  const daySet = new Set(
    bookings
      .filter((b) => String(b?.bookingStatus || "").toUpperCase() === "COMPLETED")
      .map((b) => dayKey(b?.session?.startTime))
      .filter(Boolean),
  );
  if (!daySet.size) return 0;
  const days = [...daySet].sort().reverse();
  let streak = 1;
  let prev = new Date(days[0]);
  for (let i = 1; i < days.length; i += 1) {
    const cur = new Date(days[i]);
    const diff = Math.round((prev - cur) / 86400000);
    if (diff === 1) { streak += 1; prev = cur; }
    else if (diff !== 0) break;
  }
  return streak;
}

function useLearnerLearningData(refreshKey = 0) {
  return useResource(async () => {
    const [roadmaps, bookings, certifications, savedSkills, profile] = await Promise.all([
      apiGet("/api/v1/roadmaps").catch(() => []),
      apiGet("/api/v1/bookings").catch(() => []),
      apiGet("/api/v1/certifications/me").catch(() => []),
      apiGet("/api/v1/watchlist/skills").catch(() => []),
      apiGet("/api/v1/users/me").catch(() => null),
    ]);
    return { roadmaps: roadmaps || [], bookings: bookings || [], certifications: certifications || [], savedSkills: savedSkills || [], profile };
  }, [refreshKey]);
}

const SKILL_GRADIENTS = [
  "linear-gradient(135deg,#0f766e,#14b8a6)",
  "linear-gradient(135deg,#1d4ed8,#3b82f6)",
  "linear-gradient(135deg,#7c3aed,#a78bfa)",
  "linear-gradient(135deg,#b45309,#f59e0b)",
  "linear-gradient(135deg,#be123c,#f43f5e)",
  "linear-gradient(135deg,#0369a1,#38bdf8)",
  "linear-gradient(135deg,#065f46,#34d399)",
  "linear-gradient(135deg,#6b21a8,#d946ef)",
];

function skillGradient(name) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return SKILL_GRADIENTS[h % SKILL_GRADIENTS.length];
}

/* ==========================================================================
   Progress Ring
   ========================================================================== */

function ProgressRing({ value, size = 80, stroke = 6 }) {
  const pct = clamp(Math.round(Number(value || 0)), 0, 100);
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <svg className="ll-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${pct}% complete`}>
      <defs>
        <linearGradient id="llRingGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f766e" />
          <stop offset="100%" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      <circle className="ll-ring__track" cx={cx} cy={cy} r={r} strokeWidth={stroke} fill="none" />
      <circle
        className="ll-ring__val"
        cx={cx} cy={cy} r={r}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text className="ll-ring__text" x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={size * 0.18}>
        {pct}%
      </text>
    </svg>
  );
}

/* ==========================================================================
   Mini Stat Cards
   ========================================================================== */

const STAT_ICONS = {
  "Learning Paths": "route",
  "Courses Enrolled": "menu_book",
  "Hours Completed": "schedule",
  "Current Streak": "local_fire_department",
  Certificates: "workspace_premium",
  "Completed Sessions": "task_alt",
  Bookmarks: "bookmark",
};

const STAT_COLORS = {
  "Learning Paths": { bg: "rgba(15,118,110,0.1)", icon: "#0f766e" },
  "Courses Enrolled": { bg: "rgba(59,130,246,0.1)", icon: "#3b82f6" },
  "Hours Completed": { bg: "rgba(5,150,105,0.1)", icon: "#059669" },
  "Current Streak": { bg: "rgba(245,158,11,0.1)", icon: "#f59e0b" },
  Certificates: { bg: "rgba(124,58,237,0.1)", icon: "#7c3aed" },
  "Completed Sessions": { bg: "rgba(16,185,129,0.1)", icon: "#10b981" },
  Bookmarks: { bg: "rgba(239,68,68,0.1)", icon: "#ef4444" },
};

/* ==========================================================================
   Main Component
   ========================================================================== */

export default function LearnerLearningPage() {
  useDocumentTitle("My Learning");
  const [refreshKey, setRefreshKey] = useState(0);
  const { loading, data, error } = useLearnerLearningData(refreshKey);

  const roadmaps = data?.roadmaps || [];
  const bookings = data?.bookings || [];
  const certifications = data?.certifications || [];
  const savedSkills = data?.savedSkills || [];

  const { upcoming, completed, totalHours } = useMemo(() => buildBookingStats(bookings), [bookings]);
  const streak = useMemo(() => computeStreak(bookings), [bookings]);

  const currentCourses = useMemo(
    () => roadmaps.filter((r) => Number(r.progressPercent || 0) < 100).slice(0, 6),
    [roadmaps],
  );
  const completedRoadmaps = useMemo(
    () => roadmaps.filter((r) => Number(r.progressPercent || 0) >= 100),
    [roadmaps],
  );
  const overallProgress = useMemo(
    () => (roadmaps.length ? Math.round(roadmaps.reduce((s, r) => s + Number(r.progressPercent || 0), 0) / roadmaps.length) : 0),
    [roadmaps],
  );
  const activeRoadmap = useMemo(() => currentCourses[0] || roadmaps[0] || null, [currentCourses, roadmaps]);
  const milestones = useMemo(() => (activeRoadmap ? parseMilestones(activeRoadmap.milestones || "") : []), [activeRoadmap]);

  const achievements = useMemo(() => {
    const items = [];
    if (streak >= 3) items.push({ icon: "local_fire_department", label: `${streak}-Day Streak`, date: "Active", xp: streak * 10, color: "#f59e0b", bg: "rgba(245,158,11,0.1)" });
    if (completedRoadmaps.length) items.push({ icon: "workspace_premium", label: `${completedRoadmaps.length} Roadmap${completedRoadmaps.length > 1 ? "s" : ""} Completed`, date: "Earned", xp: 100, color: "#7c3aed", bg: "rgba(124,58,237,0.1)" });
    if (certifications.length) items.push({ icon: "verified", label: `${certifications.length} Certificate${certifications.length > 1 ? "s" : ""} Earned`, date: formatDate(certifications[0].issuedAt), xp: 50, color: "#0f766e", bg: "rgba(15,118,110,0.1)" });
    if (totalHours >= 10) items.push({ icon: "timelapse", label: `${Math.round(totalHours)}+ Learning Hours`, date: "Achieved", xp: 25, color: "#059669", bg: "rgba(5,150,105,0.1)" });
    if (completed.length >= 5) items.push({ icon: "task_alt", label: `${completed.length} Sessions Completed`, date: "Milestone", xp: 30, color: "#3b82f6", bg: "rgba(59,130,246,0.1)" });
    return items.slice(0, 5);
  }, [streak, completedRoadmaps, certifications, totalHours, completed]);

  // Build weekly activity data from bookings
  const weeklyActivity = useMemo(() => {
    const today = new Date();
    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const dayBookings = bookings.filter((b) => dayKey(b?.session?.startTime) === key);
      const totalMin = dayBookings.reduce((sum, b) => {
        const s = new Date(b?.session?.startTime || 0).getTime();
        const e = new Date(b?.session?.endTime || 0).getTime();
        if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return sum;
        return sum + (e - s) / 60000;
      }, 0);
      days.push({
        label: d.toLocaleDateString(undefined, { weekday: "short" }),
        date: key,
        hours: Math.round((totalMin / 60) * 10) / 10,
        sessions: dayBookings.length,
        isToday: i === 0,
      });
    }
    return days;
  }, [bookings]);

  const maxHours = useMemo(() => Math.max(...weeklyActivity.map((d) => d.hours), 1), [weeklyActivity]);

  // Loading state
  if (loading) {
    return (
      <div className="ll-shell">
        <div className="ll-hero">
          <div className="ll-hero__layout">
            <div className="ll-hero__left">
              <div className="ll-skel-line" style={{ width: "30%", height: 14 }} />
              <div className="ll-skel-line" style={{ width: "60%", height: 24, marginTop: 8 }} />
              <div className="ll-skel-line" style={{ width: "45%", height: 14, marginTop: 6 }} />
            </div>
            <div className="ll-hero__right">
              <div className="ll-skel-line" style={{ width: 80, height: 80, borderRadius: "50%", margin: "0 auto" }} />
            </div>
          </div>
        </div>
        <div className="ll-stats">
          {[1,2,3,4,5,6,7].map((k) => (
            <div key={k} className="ll-skel-stat" />
          ))}
        </div>
        <div className="ll-section__header">
          <div className="ll-skel-line" style={{ width: "20%", height: 18 }} />
        </div>
        <div className="ll-grid">
          {[1,2,3].map((k) => (
            <div key={k} className="ll-skel-card" style={{ height: 120 }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ll-shell">
        <div className="ll-error">
          <div className="ll-error__icon">
            <Icon name="error" />
          </div>
          <h3 className="ll-error__title">Learning data could not be loaded</h3>
          <p className="ll-error__desc">{error}</p>
          <button type="button" className="ll-btn ll-btn--primary" onClick={() => setRefreshKey((v) => v + 1)}>
            <Icon name="refresh" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const isEmpty = roadmaps.length === 0 && bookings.length === 0 && savedSkills.length === 0;

  if (isEmpty) {
    return (
      <div className="ll-shell">
        <div className="ll-empty-state">
          <div className="ll-empty-state__icon">🎓</div>
          <h2 className="ll-empty-state__title">Start Your Learning Journey</h2>
          <p className="ll-empty-state__desc">
            Book your first mentor session and begin tracking your progress. Explore skills, find mentors, and build your learning roadmap.
          </p>
          <div className="ll-empty-state__actions">
            <Link to="/learner/skills" className="ll-btn ll-btn--primary">
              <Icon name="auto_stories" /> Explore Skills
            </Link>
            <Link to="/learner/mentors" className="ll-btn ll-btn--outline">
              <Icon name="person_search" /> Find Mentor
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ll-shell">
      {/* ── Compact Hero ── */}
      <div className="ll-hero">
        <div className="ll-hero__layout">
          <div className="ll-hero__left">
            <span className="ll-hero__badge">
              <Icon name="school" /> Learning Hub
            </span>
            <h1 className="ll-hero__title">
              Continue Your <span className="ll-hero__title-highlight">Learning</span> Journey
            </h1>
            <p className="ll-hero__sub">
              Track your progress, complete courses, earn certificates, and stay consistent with your learning goals.
            </p>
            <div className="ll-hero__actions">
              {currentCourses.length > 0 && (
                <Link to="/learner/path" className="ll-btn ll-btn--primary">
                  <Icon name="play_arrow" /> Continue Learning
                </Link>
              )}
              <Link to="/learner/skills" className="ll-btn ll-btn--outline">
                <Icon name="auto_stories" /> Explore Skills
              </Link>
              {activeRoadmap && (
                <Link to="/learner/path" className="ll-btn ll-btn--outline">
                  <Icon name="route" /> View Roadmap
                </Link>
              )}
            </div>
          </div>
          <div className="ll-hero__right">
            <div className="ll-hero__ring-card">
              <ProgressRing value={overallProgress} size={96} stroke={8} />
              <div className="ll-hero__ring-meta">
                <span className="ll-hero__ring-label">Learning Completion</span>
                <div className="ll-hero__ring-stats">
                  <div className="ll-hero__ring-stat">
                    <Icon name="local_fire_department" />
                    <span><strong>{streak}d</strong> streak</span>
                  </div>
                  <div className="ll-hero__ring-stat">
                    <Icon name="schedule" />
                    <span><strong>{totalHours}h</strong> hours</span>
                  </div>
                  <div className="ll-hero__ring-stat">
                    <Icon name="workspace_premium" />
                    <span><strong>{certifications.length}</strong> certs</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Stats ── */}
      <div className="ll-stats">
        <div className="ll-stat-card">
          <div className="ll-stat-card__header">
            <div className="ll-stat-card__icon" style={{ background: "rgba(15,118,110,0.1)", color: "#0f766e" }}>
              <Icon name="route" />
            </div>
            <span className="ll-stat-card__trend">{roadmaps.length > 0 ? "+" + roadmaps.length : "—"}</span>
          </div>
          <span className="ll-stat-card__value">{roadmaps.length}</span>
          <span className="ll-stat-card__label">Learning Paths</span>
          <span className="ll-stat-card__desc">{completedRoadmaps.length} completed</span>
        </div>
        <div className="ll-stat-card">
          <div className="ll-stat-card__header">
            <div className="ll-stat-card__icon" style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6" }}>
              <Icon name="menu_book" />
            </div>
            <span className="ll-stat-card__trend">{currentCourses.length > 0 ? currentCourses.length : "—"}</span>
          </div>
          <span className="ll-stat-card__value">{currentCourses.length}</span>
          <span className="ll-stat-card__label">Courses Enrolled</span>
          <span className="ll-stat-card__desc">{completedRoadmaps.length} finished</span>
        </div>
        <div className="ll-stat-card">
          <div className="ll-stat-card__header">
            <div className="ll-stat-card__icon" style={{ background: "rgba(5,150,105,0.1)", color: "#059669" }}>
              <Icon name="schedule" />
            </div>
            <span className="ll-stat-card__trend">{totalHours}h</span>
          </div>
          <span className="ll-stat-card__value">{totalHours}h</span>
          <span className="ll-stat-card__label">Hours Completed</span>
          <span className="ll-stat-card__desc">Total learning time</span>
        </div>
        <div className="ll-stat-card">
          <div className="ll-stat-card__header">
            <div className="ll-stat-card__icon" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
              <Icon name="local_fire_department" />
            </div>
            <span className="ll-stat-card__trend">{streak > 0 ? "+" + streak : "—"}</span>
          </div>
          <span className="ll-stat-card__value">{streak}d</span>
          <span className="ll-stat-card__label">Current Streak</span>
          <span className="ll-stat-card__desc">Consecutive days</span>
        </div>
        <div className="ll-stat-card">
          <div className="ll-stat-card__header">
            <div className="ll-stat-card__icon" style={{ background: "rgba(124,58,237,0.1)", color: "#7c3aed" }}>
              <Icon name="workspace_premium" />
            </div>
            <span className="ll-stat-card__trend">+{certifications.length}</span>
          </div>
          <span className="ll-stat-card__value">{certifications.length}</span>
          <span className="ll-stat-card__label">Certificates</span>
          <span className="ll-stat-card__desc">Earned so far</span>
        </div>
        <div className="ll-stat-card">
          <div className="ll-stat-card__header">
            <div className="ll-stat-card__icon" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
              <Icon name="task_alt" />
            </div>
            <span className="ll-stat-card__trend">+{completed.length}</span>
          </div>
          <span className="ll-stat-card__value">{completed.length}</span>
          <span className="ll-stat-card__label">Sessions Done</span>
          <span className="ll-stat-card__desc">{upcoming.length} upcoming</span>
        </div>
        <div className="ll-stat-card">
          <div className="ll-stat-card__header">
            <div className="ll-stat-card__icon" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
              <Icon name="bookmark" />
            </div>
            <span className="ll-stat-card__trend">+{savedSkills.length}</span>
          </div>
          <span className="ll-stat-card__value">{savedSkills.length}</span>
          <span className="ll-stat-card__label">Bookmarks</span>
          <span className="ll-stat-card__desc">Saved skills</span>
        </div>
      </div>

      {/* ── Weekly Activity ── */}
      <div className="ll-section">
        <div className="ll-section__header">
          <h2 className="ll-section__title">
            <Icon name="insights" /> Weekly Activity
          </h2>
          <span className="ll-results-count" style={{ fontSize: "0.84rem" }}>
            {weeklyActivity.reduce((s, d) => s + d.sessions, 0)} sessions this week
          </span>
        </div>
        <div className="ll-activity">
          <div className="ll-activity__bars">
            {weeklyActivity.map((day) => (
              <div key={day.date} className="ll-activity__col">
                <span className="ll-activity__hours">{day.hours > 0 ? `${day.hours}h` : ""}</span>
                <div className="ll-activity__bar-wrap">
                  <div
                    className={`ll-activity__bar${day.isToday ? " is-today" : ""}`}
                    style={{ height: `${Math.max((day.hours / maxHours) * 100, day.hours > 0 ? 6 : 0)}%` }}
                  >
                    {day.sessions > 0 && <span className="ll-activity__dot" />}
                  </div>
                </div>
                <span className={`ll-activity__label${day.isToday ? " is-today" : ""}`}>{day.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Continue Learning ── */}
      {currentCourses.length > 0 && (
        <div className="ll-section">
          <div className="ll-section__header">
            <h2 className="ll-section__title">
              <Icon name="play_circle" /> Continue Learning
            </h2>
            <Link to="/learner/path" className="ll-section__link">
              View All <Icon name="arrow_forward" />
            </Link>
          </div>
          <div className="ll-courses-scroll">
            {currentCourses.map((course, idx) => {
              const pct = clamp(Number(course.progressPercent || 0), 0, 100);
              return (
                <article key={course.id || idx} className="ll-course-card">
                  <div className="ll-course-card__thumb" style={{ background: skillGradient(course.title || "Course") }}>
                    <Icon name={course.category === "Frontend" ? "web" : course.category === "Backend" ? "dns" : course.category === "AI" ? "psychology" : "code"} />
                    <span className="ll-course-card__pct-badge">{pct}%</span>
                  </div>
                  <div className="ll-course-card__body">
                    <h3 className="ll-course-card__title">{course.title || "Learning roadmap"}</h3>
                    <p className="ll-course-card__mentor">
                      <Icon name="person" /> {course.mentorName || course.mentor?.fullName || "Self-paced"}
                    </p>
                    <div className="ll-course-card__bar">
                      <div className="ll-course-card__track">
                        <div className="ll-course-card__fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="ll-course-card__foot">
                      <span className="ll-course-card__pct-label">{pct}% complete</span>
                      <Link to="/learner/path" className="ll-btn ll-btn--primary ll-btn--sm">
                        <Icon name="play_arrow" /> Resume
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Two-column layout for Roadmap + Upcoming Sessions ── */}
      <div className="ll-cols">
        {/* Active Learning Path */}
        {activeRoadmap && milestones.length > 0 && (
          <div className="ll-col">
            <div className="ll-roadmap-card">
              <div className="ll-roadmap-card__header">
                <div className="ll-roadmap-card__header-left">
                  <Icon name="timeline" />
                  <div>
                    <h3 className="ll-roadmap-card__title">{activeRoadmap.title || "Learning Roadmap"}</h3>
                    <p className="ll-roadmap-card__sub">{milestones.length} milestones · {overallProgress}% complete</p>
                  </div>
                </div>
                <Link to="/learner/path" className="ll-btn ll-btn--primary ll-btn--sm">
                  <Icon name="route" /> Open Roadmap
                </Link>
              </div>
              <div className="ll-roadmap-card__timeline">
                {milestones.slice(0, 6).map((step, index) => {
                  const done = index / milestones.length < Number(activeRoadmap.progressPercent || 0) / 100;
                  const current = !done && (index === 0 || (index - 1) / milestones.length < Number(activeRoadmap.progressPercent || 0) / 100);
                  return (
                    <div key={step.id} className={`ll-timeline__item${done ? " is-done" : ""}${current ? " is-current" : ""}`}>
                      <span className="ll-timeline__dot">
                        {done ? <Icon name="check" /> : current ? <Icon name="radio_button_checked" /> : <Icon name="radio_button_unchecked" />}
                      </span>
                      <div className="ll-timeline__body">
                        <span className="ll-timeline__label">{step.title}</span>
                        <span className="ll-timeline__status">
                          {done ? "Completed" : current ? "In Progress" : "Upcoming"}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {milestones.length > 6 && (
                  <div className="ll-timeline__more">
                    <span>+{milestones.length - 6} more milestones</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Upcoming Sessions */}
        {upcoming.length > 0 && (
          <div className="ll-col">
            <div className="ll-section__header">
              <h2 className="ll-section__title">
                <Icon name="event" /> Upcoming Sessions
              </h2>
              <Link to="/learner/sessions" className="ll-section__link">
                View All <Icon name="arrow_forward" />
              </Link>
            </div>
            <div className="ll-sessions-list">
              {upcoming.slice(0, 4).map((booking) => {
                const session = booking?.session || {};
                const mentor = session?.mentor || {};
                return (
                  <article key={booking.id} className="ll-session-card">
                    <div className="ll-session-card__avatar">
                      {mentor.profileImageUrl ? (
                        <img src={mentor.profileImageUrl} alt={mentor.fullName} />
                      ) : (
                        <span className="ll-session-card__initials">{initials(mentor.fullName || "M")}</span>
                      )}
                    </div>
                    <div className="ll-session-card__body">
                      <div className="ll-session-card__top">
                        <div>
                          <h4 className="ll-session-card__title">{session.title || "Upcoming Session"}</h4>
                          <p className="ll-session-card__mentor-name">{mentor.fullName || "Mentor"}</p>
                        </div>
                        <span className="ll-session-card__status ll-session-card__status--upcoming">Upcoming</span>
                      </div>
                      <div className="ll-session-card__meta">
                        <span><Icon name="calendar_today" /> {formatDate(session.startTime)}</span>
                        <span><Icon name="schedule" /> {formatTime(session.startTime)}</span>
                        <span><Icon name="timelapse" /> {formatDuration(session.startTime, session.endTime)}</span>
                      </div>
                      <div className="ll-session-card__actions">
                        {session.meetingLink && (
                          <a href={session.meetingLink} target="_blank" rel="noreferrer" className="ll-btn ll-btn--primary ll-btn--sm">
                            <Icon name="videocam" /> Join
                          </a>
                        )}
                        <Link to="/learner/sessions" className="ll-btn ll-btn--outline ll-btn--sm">
                          <Icon name="event_repeat" /> Reschedule
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* If no upcoming sessions but we have other data, show achievements */}
        {upcoming.length === 0 && achievements.length > 0 && (
          <div className="ll-col">
            <div className="ll-section__header">
              <h2 className="ll-section__title">
                <Icon name="emoji_events" /> Recent Achievements
              </h2>
            </div>
            <div className="ll-achievements-list">
              {achievements.map((ach, idx) => (
                <div key={idx} className="ll-achievement-card">
                  <div className="ll-achievement-card__icon" style={{ background: ach.bg, color: ach.color }}>
                    <Icon name={ach.icon} />
                  </div>
                  <div className="ll-achievement-card__body">
                    <span className="ll-achievement-card__label">{ach.label}</span>
                    <span className="ll-achievement-card__date">{ach.date}</span>
                  </div>
                  <span className="ll-achievement-card__xp">+{ach.xp} XP</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Recommendations (from saved skills or skill-based CTAs) ── */}
      <div className="ll-section">
        <div className="ll-section__header">
          <h2 className="ll-section__title">
            <Icon name="recommend" /> Recommended For You
          </h2>
          <Link to="/learner/skills" className="ll-section__link">
            Browse All <Icon name="arrow_forward" />
          </Link>
        </div>
        <div className="ll-empty-state" style={{ padding: "28px 20px", gap: 10 }}>
          <div className="ll-empty-state__icon" style={{ width: 48, height: 48, fontSize: "1.4rem", borderRadius: 16 }}>
            <Icon name="auto_awesome" />
          </div>
          <h3 className="ll-empty-state__title" style={{ fontSize: "1rem" }}>
            Personalized recommendations based on your interests
          </h3>
          <p className="ll-empty-state__desc">
            As you explore skills, save bookmarks, and complete sessions, we'll recommend the
            best skills and mentors tailored to your learning goals.
          </p>
          <div className="ll-empty-state__actions" style={{ gap: 8 }}>
            <Link to="/learner/skills" className="ll-btn ll-btn--primary ll-btn--sm">
              <Icon name="auto_stories" /> Explore Skills
            </Link>
            <Link to="/learner/mentors" className="ll-btn ll-btn--outline ll-btn--sm">
              <Icon name="person_search" /> Find Mentors
            </Link>
          </div>
        </div>
      </div>

      {/* ── Certificates ── */}
      {certifications.length > 0 && (
        <div className="ll-section">
          <div className="ll-section__header">
            <h2 className="ll-section__title">
              <Icon name="workspace_premium" /> Recent Certificates
            </h2>
            <Link to="/learner/certificates" className="ll-section__link">
              View All <Icon name="arrow_forward" />
            </Link>
          </div>
          <div className="ll-cert-scroll">
            {certifications.slice(0, 4).map((cert) => (
              <article key={cert.id} className="ll-cert-card">
                <div className="ll-cert-card__header" style={{ background: "linear-gradient(135deg,#0f766e,#14b8a6)" }}>
                  <Icon name="workspace_premium" />
                  <span className="ll-cert-card__seal">
                    <Icon name="verified" />
                  </span>
                </div>
                <div className="ll-cert-card__body">
                  <h3 className="ll-cert-card__title">{cert.title || "Certificate"}</h3>
                  <p className="ll-cert-card__meta">Completed {formatDate(cert.issuedAt)}</p>
                  <p className="ll-cert-card__meta">{cert.mentorName || cert.issuedBy || "SkillSwap"}</p>
                  <div className="ll-cert-card__actions">
                    <Link to="/learner/certificates" className="ll-btn ll-btn--outline ll-btn--sm">
                      <Icon name="download" /> Download
                    </Link>
                    <Link to="/learner/certificates" className="ll-btn ll-btn--outline ll-btn--sm">
                      <Icon name="share" /> Share
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
