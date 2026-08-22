import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Link, useNavigate } from "react-router";
import client from "../api/client";
import HeroSection from "../components/HeroSection";
import ProfileGateModal from "../components/ProfileGateModal";
import ShareModal from "../components/ShareModal";
import SsIcon from "../components/ui/SsIcon";
import { SsStatCard, SsBadge } from "../components/ui/SsCard";
import useMentorGate from "../modules/common/useMentorGate";
import { getApiErrorMessage } from "../utils/apiErrors";
import "./MentorDashboard.css";

/* Stable empty array reference to avoid creating a new [] on every render */
const EMPTY_ARRAY = [];

/* ───────────────────────── helpers ───────────────────────── */

function formatMoney(amt) {
  if (amt == null || Number.isNaN(Number(amt))) return "₹0";
  const n = Number(amt);
  if (n >= 100_000) return `₹${(n / 100_000).toLocaleString("en-IN", { maximumFractionDigits: 1 })}L`;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function buildMonthBuckets() {
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleString(undefined, { month: "short" }),
      value: 0,
    });
  }
  return months;
}

function monthKey(dateLike) {
  const d = dateLike ? new Date(dateLike) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function initials(name) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function formatDate(dateLike) {
  if (!dateLike) return "";
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatFullDate(dateLike) {
  if (!dateLike) return "";
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(dateLike) {
  if (!dateLike) return "";
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function isToday(dateLike) {
  if (!dateLike) return false;
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return false;
  return d.toDateString() === new Date().toDateString();
}

function statusOf(b) {
  return b?.bookingStatus || b?.status || "";
}

function sessionTopic(session) {
  const skills = Array.isArray(session?.sessionSkills) ? session.sessionSkills : [];
  return skills[0] || session?.title || "Mentoring Session";
}

/* ──────────────── SVG donut chart (pure, no deps) ──────────────── */

function DonutChart({ data, total, label }) {
  const segments = (data || []).filter((d) => Number(d.count) > 0);
  if (total <= 0) {
    return (
      <div className="md3-donut__empty">
        <SsIcon name="analytics" size={28} />
        <p>No session data yet.</p>
      </div>
    );
  }
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="md3-donut">
      <svg viewBox="0 0 140 140" role="img" aria-label={label || "Session overview"}>
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="var(--ss-border)"
          strokeWidth="16"
        />
        {segments.map((d, i) => {
          const frac = (Number(d.count) || 0) / total;
          const dash = frac * circumference;
          const el = (
            <circle
              key={`${d.name}-${i}`}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={d.color}
              strokeWidth="16"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return el;
        })}
        <text x="70" y="64" textAnchor="middle" className="md3-donut__total">
          {total}
        </text>
        <text x="70" y="82" textAnchor="middle" className="md3-donut__label">
          {label || "Total"}
        </text>
      </svg>
      <ul className="md3-donut__legend">
        {(data || []).map((d) => (
          <li key={d.name}>
            <span className="md3-donut__dot" style={{ background: d.color }} />
            <span className="md3-donut__name">{d.name}</span>
            <span className="md3-donut__count">{d.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────────────── main component ─────────────────────── */

export default function MentorDashboard({ profile, notify }) {
  const navigate = useNavigate();
  const firstName =
    String(profile?.fullName || "Mentor")
      .trim()
      .split(" ")[0] || "Mentor";

  useEffect(() => {
    document.title = `${firstName} · Mentor Dashboard | Mentorly`;
  }, [firstName]);

  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [recentStudents, setRecentStudents] = useState([]);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [series, setSeries] = useState({
    revenue: [],
    students: [],
    sessions: [],
    rating: [],
  });
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalSessions: 0,
    monthlyEarnings: 0,
    totalEarnings: 0,
    averageRating: 0,
    totalReviews: 0,
    completedSessions: 0,
  });

  const loadMentorDataRef = useRef(null);

  const loadMentorData = useCallback(async ({ silent = false } = {}) => {
    try {
      // silent: true resyncs without the full-page skeleton flash (used after
      // stale request handling so the dashboard updates in place).
      if (!silent) setLoading(true);
      await client.post("/api/v1/certifications/evaluate").catch(() => null);
      const [sessionsRes, bookingsRes, reviewsRes, verificationRes] =
        await Promise.all([
          client.get("/api/v1/sessions"),
          client.get("/api/v1/bookings"),
          client.get("/api/v1/reviews/mentor"),
          client
            .get("/api/v1/verification/mentor/status")
            .catch(() => ({ data: { data: null } })),
        ]);

      // Paginated responses — unwrap .content from the Page objects.
      const allSessions = sessionsRes?.data?.data?.content || EMPTY_ARRAY;
      const allBookings = bookingsRes?.data?.data?.content || EMPTY_ARRAY;

      // GET /api/v1/reviews/mentor returns a summary object, NOT an array:
      //   { averageRating, totalReviews, reviews: [...] }
      const reviewSummary = reviewsRes?.data?.data || {};
      const allReviews = Array.isArray(reviewSummary?.reviews)
        ? reviewSummary.reviews
        : EMPTY_ARRAY;
      const averageRating = Number(reviewSummary?.averageRating || 0);
      const totalReviews = Number(
        reviewSummary?.totalReviews ?? allReviews.length,
      );

      const pending = allBookings.filter((b) => statusOf(b) === "PENDING");
      const completedBookings = allBookings.filter(
        (b) => statusOf(b) === "COMPLETED",
      );
      const PLATFORM_FEE_PCT = 0.1; // 10% platform fee
      const totalEarningsGross = completedBookings.reduce(
        (sum, b) => sum + Number(b?.payment?.amount || 0),
        0,
      );
      const totalEarnings =
        Math.round(totalEarningsGross * (1 - PLATFORM_FEE_PCT) * 100) / 100;

      // ── Derive per-learner student roster from bookings ──
      const learnerMap = new Map();
      allBookings.forEach((b) => {
        const l = b?.learner;
        if (!l?.id) return;
        const entry = learnerMap.get(l.id) || {
          id: l.id,
          name: l.fullName || "Learner",
          username: l.displayUsername || l.username || "",
          skill: sessionTopic(b?.session),
          total: 0,
          completed: 0,
          last: 0,
        };
        entry.total += 1;
        if (statusOf(b) === "COMPLETED") entry.completed += 1;
        const t = new Date(
          b?.session?.startTime || b?.createdAt || 0,
        ).getTime();
        if (t > entry.last) entry.last = t;
        if (!entry.skill) entry.skill = sessionTopic(b?.session);
        learnerMap.set(l.id, entry);
      });
      const students = Array.from(learnerMap.values())
        .map((s) => ({
          ...s,
          progress: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
        }))
        .sort((a, b) => b.last - a.last);

      // ── Trend series (last 6 months) ──
      const revenueBuckets = buildMonthBuckets();
      const sessionBuckets = buildMonthBuckets();
      const ratingBuckets = buildMonthBuckets().map((m) => ({
        ...m,
        sum: 0,
        count: 0,
      }));

      completedBookings.forEach((b) => {
        const key = monthKey(b?.session?.startTime || b?.createdAt);
        const bucket = revenueBuckets.find((m) => m.key === key);
        if (bucket) bucket.value += Number(b?.payment?.amount || 0);
      });
      allSessions.forEach((s) => {
        const key = monthKey(s?.startTime || s?.createdAt);
        const bucket = sessionBuckets.find((m) => m.key === key);
        if (bucket) bucket.value += 1;
      });
      allReviews.forEach((r) => {
        const key = monthKey(r?.createdAt);
        const bucket = ratingBuckets.find((m) => m.key === key);
        if (bucket) {
          bucket.sum += Number(r?.rating || 0);
          bucket.count += 1;
        }
      });
      const ratingSeries = ratingBuckets.map((m) => ({
        key: m.key,
        label: m.label,
        value: m.count > 0 ? Number((m.sum / m.count).toFixed(1)) : 0,
      }));

      const currentMonth =
        revenueBuckets[revenueBuckets.length - 1]?.value || 0;
      const monthlyEarningsGross = Number(currentMonth.toFixed(2));
      const monthlyEarnings =
        Math.round(monthlyEarningsGross * (1 - PLATFORM_FEE_PCT) * 100) / 100;

      setSessions(allSessions);
      setBookings(allBookings);
      setPendingBookings(pending);
      setReviews(allReviews);
      setRecentStudents(students);
      setVerificationStatus(verificationRes?.data?.data || null);
      setSeries({
        revenue: revenueBuckets,
        sessions: sessionBuckets,
        rating: ratingSeries,
      });
      setStats({
        totalStudents: learnerMap.size,
        totalSessions: allSessions.length,
        monthlyEarnings,
        totalEarnings,
        averageRating,
        totalReviews,
        completedSessions: completedBookings.length,
      });
    } catch (error) {
      // Data load failures surface as empty sections; never blank the page.
      // eslint-disable-next-line no-console
      console.error("Mentor dashboard data load failed", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Keep ref updated + initial load
  loadMentorDataRef.current = loadMentorData;

  useEffect(() => {
    loadMentorDataRef.current?.();
  }, []);

  // ── Accept / Decline pending booking requests ──
  // Calls the booking lifecycle endpoint (PATCH status → ACCEPTED / CANCELLED)
  // then updates the dashboard state IN PLACE — no page reload and no loading
  // flash. Derived memos (upcoming sessions, overview donut, request count)
  // recompute automatically from the updated bookings array.
  const [responding, setResponding] = useState(null);

  const respondToRequest = async (booking, action) => {
    const id = booking?.id || booking?.bookingId;
    if (!id || responding) return;
    const isAccept = action === "accept";
    const nextStatus = isAccept ? "ACCEPTED" : "CANCELLED";
    // Snapshot for rollback — shallow copy of the bookings feed (same
    // pattern as the Reviews page reply optimistic update).
    const previousBookings = [...bookings];

    setResponding({ id, action });
    // ── Optimistic update: apply instantly, reconcile with the backend. ──
    // Remove from the pending list and flip the status in the bookings feed
    // so the request count, upcoming list and donut update immediately — no
    // waiting on the network.
    setPendingBookings((prev) =>
      prev.filter((b) => (b.id || b.bookingId) !== id),
    );
    setBookings((prev) =>
      prev.map((b) =>
        (b.id || b.bookingId) === id ? { ...b, bookingStatus: nextStatus } : b,
      ),
    );

    try {
      await client.patch(`/api/v1/bookings/${id}/status`, { status: nextStatus });
      notify?.({
        type: "success",
        title: isAccept ? "Session request accepted" : "Session request declined",
        message: isAccept
          ? "Session request accepted."
          : "Session request declined.",
      });
    } catch (error) {
      // ── Roll back so the UI stays consistent with the backend. ──
      // Surgical: restore ONLY the affected booking (revert its status and
      // re-insert it into pending if absent) so a concurrent refresh or the
      // silent resync below is never clobbered by the pre-click snapshot.
      const restored = previousBookings.find(
        (b) => (b.id || b.bookingId) === id,
      );
      if (restored) {
        setBookings((prev) =>
          prev.map((b) => ((b.id || b.bookingId) === id ? restored : b)),
        );
      }
      setPendingBookings((prev) =>
        restored && !prev.some((b) => (b.id || b.bookingId) === id)
          ? [...prev, restored]
          : prev,
      );
      const statusCode = error?.response?.status;
      // Shared ApiResponse extractor — prefers the nested detail map
      // (data.data.message, e.g. "Insufficient wallet balance to accept this
      // booking") over the generic "Request failed" wrapper title, and handles
      // validation error maps.
      const backendMsg = getApiErrorMessage(error, "Please try again.");
      const alreadyProcessed =
        statusCode === 401 ||
        statusCode === 403 ||
        statusCode === 404 ||
        statusCode === 409 ||
        statusCode === 410 ||
        /already|only pending|not found|no longer|processed/i.test(backendMsg);
      if (alreadyProcessed) {
        notify?.({
          type: "info",
          title: "Request unavailable",
          message:
            "This request can no longer be acted on (it may have been processed elsewhere). Refreshing your request list.",
        });
        // Quiet resync — no full-page loading flash.
        loadMentorDataRef.current?.({ silent: true }).catch(() => null);
      } else {
        notify?.({
          type: "error",
          title: isAccept
            ? "Unable to accept this session request"
            : "Unable to decline this session request",
          message: `${backendMsg || "Please try again."}${
            statusCode ? ` (HTTP ${statusCode})` : ""
          }`,
        });
      }
    } finally {
      setResponding(null);
    }
  };

  // ── Profile-incomplete warning banner (dismissible) ──
  const [incompleteBannerDismissed, setIncompleteBannerDismissed] = useState(false);
  const profileIncomplete =
    profile?.role === "MENTOR" && profile?.profileCompleted === false;
  const gate = useMentorGate(profile, verificationStatus);
  const goTeach = useCallback(() => navigate("/mentor/teach"), [navigate]);
  const goCalendar = useCallback(() => navigate("/mentor/calendar"), [navigate]);

  // ── Today's sessions for hero quick-grid ──
  const todaySessions = useMemo(
    () => sessions.filter((s) => isToday(s?.startTime)),
    [sessions],
  );

  // ── Upcoming sessions built from BOOKINGS (learner + session joined) ──
  // Confirmed/accepted future bookings only — pending requests live in the
  // Session Requests card, cancelled/completed ones are not upcoming.
  const upcomingBookings = useMemo(() => {
    return bookings
      .filter((b) => {
        const st = new Date(b?.session?.startTime || 0).getTime();
        return (
          st > Date.now() &&
          ![
            "PENDING",
            "CANCELLED",
            "CANCELED",
            "REJECTED",
            "COMPLETED",
          ].includes(statusOf(b))
        );
      })
      .sort(
        (a, b) =>
          new Date(a?.session?.startTime || 0).getTime() -
          new Date(b?.session?.startTime || 0).getTime(),
      );
  }, [bookings]);

  // ── Session Overview donut (real status distribution) ──
  const sessionOverview = useMemo(() => {
    const completed = bookings.filter((b) => statusOf(b) === "COMPLETED").length;
    const cancelled = bookings.filter((b) =>
      ["CANCELLED", "CANCELED", "REJECTED"].includes(statusOf(b)),
    ).length;
    const pending = bookings.filter((b) => statusOf(b) === "PENDING").length;
    const upcoming = Math.max(0, bookings.length - completed - cancelled - pending);
    return [
      { name: "Completed", count: completed, color: "#0d9488" },
      { name: "Upcoming", count: upcoming, color: "#2563eb" },
      { name: "Pending", count: pending, color: "#f59e0b" },
      { name: "Cancelled", count: cancelled, color: "#94a3b8" },
    ];
  }, [bookings]);

  const sessionOverviewTotal = useMemo(
    () => sessionOverview.reduce((sum, d) => sum + (Number(d.count) || 0), 0),
    [sessionOverview],
  );

  /* ──── loading state ──── */
  if (loading) {
    return (
      <div className="ss-page">
        <div className="ss-skeleton ss-skeleton--hero" />
        <div className="ss-stats-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="ss-skeleton ss-skeleton--card" />
          ))}
        </div>
        <div className="ss-grid-2">
          <div className="ss-skeleton ss-skeleton--card" style={{ height: 280 }} />
          <div className="ss-skeleton ss-skeleton--card" style={{ height: 280 }} />
        </div>
      </div>
    );
  }

  /* ──── compact onboarding state — genuinely new mentor only ──── */
  if (
    !loading &&
    sessions.length === 0 &&
    bookings.length === 0 &&
    reviews.length === 0
  ) {
    return (
      <div className="ss-page">
        <div className="ss-empty">
          <div className="ss-empty__icon">
            <SsIcon name="sparkles" size={36} />
          </div>
          <h3 className="ss-empty__title">Welcome to Your Mentor Dashboard</h3>
          <p className="ss-empty__desc">
            Create your first session to start mentoring. Once learners start
            booking, your analytics, reviews and student activity will appear
            here.
          </p>
          <div className="ss-empty__actions">
            <Link to="/mentor/teach" className="ss-btn ss-btn--primary">
              <SsIcon name="plus" size={18} />
              Create Session
            </Link>
            <Link
              to="/mentor/professional-profile"
              className="ss-btn ss-btn--secondary"
            >
              <SsIcon name="user" size={18} />
              Complete Profile
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ss-page mdash3-page">
      {/* ═══════════════════ HERO — compact welcome card ═══════════════════ */}
      <HeroSection
        className="hero-section--compact"
        badge={
          <>
            <SsIcon name="sparkles" size={14} />
            Mentor Dashboard
          </>
        }
        title={
          <>
            {getGreeting()}, {firstName}{" "}
            <span role="img" aria-label="wave">👋</span>
          </>
        }
        subtitle={
          <>
            Here&apos;s what&apos;s happening with your mentorship journey today.
            {profile?.username && (
              <span
                style={{
                  display: "block",
                  fontSize: "0.9rem",
                  color: "rgba(255,255,255,0.6)",
                  marginTop: 4,
                }}
              >
                @{profile.username}
              </span>
            )}
          </>
        }
        secondaryButton={
          <button
            type="button"
            className="hero-section__btn hero-section__btn--secondary"
            onClick={() => gate.requestAction(goCalendar)}
            title={
              gate.mode
                ? "Your account is awaiting Admin verification."
                : undefined
            }
          >
            <SsIcon name="calendar" size={18} />
            View Calendar
          </button>
        }
        primaryButton={
          <button
            type="button"
            className="hero-section__btn hero-section__btn--primary"
            onClick={() => gate.requestAction(goTeach)}
            title={
              gate.mode
                ? "Your account is awaiting Admin verification."
                : undefined
            }
          >
            <SsIcon name="plus" size={18} />
            Create Session
          </button>
        }
        floatingCards={
          <div className="hero-section__quick-grid" aria-hidden="true">
            <div className="hero-section__quick-item">
              <span className="hero-section__quick-item__label">Today&apos;s Sessions</span>
              <span className="hero-section__quick-item__value">{todaySessions.length}</span>
            </div>
            <div className="hero-section__quick-item">
              <span className="hero-section__quick-item__label">Pending Requests</span>
              <span className="hero-section__quick-item__value">{pendingBookings.length}</span>
            </div>
            <div className="hero-section__quick-item">
              <span className="hero-section__quick-item__label">Active Students</span>
              <span className="hero-section__quick-item__value">{stats.totalStudents}</span>
            </div>
            <div className="hero-section__quick-item">
              <span className="hero-section__quick-item__label">Monthly Earnings</span>
              <span className="hero-section__quick-item__value">{formatMoney(stats.monthlyEarnings)}</span>
            </div>
          </div>
        }
      >
        <Link to="/mentor/analytics" className="hero-section__btn hero-section__btn--ghost">
          <SsIcon name="analytics" size={18} />
          View Analytics
        </Link>
        <button
          className="hero-section__btn hero-section__btn--ghost"
          onClick={loadMentorData}
          title="Refresh data"
          aria-label="Refresh data"
        >
          <SsIcon name="refresh" size={20} />
        </button>
      </HeroSection>

      {/* ═══════════════════ PROFILE INCOMPLETE WARNING ═══════════════════ */}
      {profileIncomplete && !incompleteBannerDismissed && (
        <div className="mdash2-incomplete-banner" role="alert">
          <div className="mdash2-incomplete-banner__icon">
            <SsIcon name="alert-triangle" size={22} />
          </div>
          <div className="mdash2-incomplete-banner__text">
            <strong>⚠️ Your profile is incomplete.</strong>
            <span>
              Complete your profile to create mentoring sessions and submit your
              account for verification.
            </span>
          </div>
          <button
            type="button"
            className="ss-btn ss-btn--primary ss-btn--sm"
            onClick={() => navigate("/complete-profile")}
          >
            <SsIcon name="edit" size={16} />
            Complete Profile
          </button>
          <button
            type="button"
            className="mdash2-incomplete-banner__dismiss"
            onClick={() => setIncompleteBannerDismissed(true)}
            aria-label="Dismiss warning"
            title="Dismiss"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* ═══════════════════ VERIFICATION BANNER ═══════════════════ */}
      {!verificationStatus?.mentorVerified && (
        <div
          className={`mdash2-verify mdash2-verify--${String(
            verificationStatus?.verificationStatus || "pending",
          ).toLowerCase()}`}
        >
          <div className="mdash2-verify__icon">
            <SsIcon
              name={
                verificationStatus?.verificationStatus === "REJECTED"
                  ? "cancel"
                  : verificationStatus?.verificationStatus === "SUSPENDED"
                    ? "block"
                    : verificationStatus?.verificationStatus === "MORE_INFORMATION_REQUIRED"
                      ? "edit_note"
                      : verificationStatus?.verificationStatus === "UNDER_REVIEW"
                        ? "manage_search"
                        : "shield"
              }
              size={24}
            />
          </div>
          <div className="mdash2-verify__text">
            <strong>
              {verificationStatus?.verificationStatus === "REJECTED"
                ? "Verification rejected"
                : verificationStatus?.verificationStatus === "SUSPENDED"
                  ? "Mentor account suspended"
                  : verificationStatus?.verificationStatus === "MORE_INFORMATION_REQUIRED"
                    ? "Additional information required"
                    : verificationStatus?.verificationStatus === "UNDER_REVIEW"
                      ? "Verification under review"
                      : verificationStatus?.verificationStatus === "NOT_SUBMITTED"
                        ? "Submit for verification"
                        : "Verification pending"}
            </strong>
            <span>
              {verificationStatus?.verificationStatus === "REJECTED"
                ? `Your verification was not approved${
                    verificationStatus.rejectionReason
                      ? ` — ${verificationStatus.rejectionReason}`
                      : ""
                  } Update your profile and submit again.`
                : verificationStatus?.verificationStatus === "SUSPENDED"
                  ? `Your mentor account is suspended${
                      verificationStatus.rejectionReason
                        ? ` — ${verificationStatus.rejectionReason}`
                        : ""
                    } Marketplace features are disabled until an admin reviews your account.`
                  : verificationStatus?.verificationStatus === "MORE_INFORMATION_REQUIRED"
                    ? `The Admin has requested additional information before approving your profile.${
                        verificationStatus.rejectionReason
                          ? ` Required changes: ${verificationStatus.rejectionReason}`
                          : ""
                      } Update your profile and submit again.`
                    : verificationStatus?.verificationStatus === "UNDER_REVIEW"
                      ? "Our team is reviewing your application. You cannot create sessions or appear in search until you are approved."
                      : verificationStatus?.verificationStatus === "PENDING"
                        ? verificationStatus?.requestId
                          ? "Your profile has been submitted and is awaiting admin review — estimated review time 24–48 hours. Only admin-approved mentors appear in search and can create sessions."
                          : "Only admin-approved mentors appear in search and can create sessions. Submit your application to get verified — estimated review time 24–48 hours."
                        : "Only admin-approved mentors appear in search and can create sessions. Submit your application to get verified — estimated review time 24–48 hours."}
            </span>
          </div>
          {verificationStatus?.verificationStatus === "REJECTED" ||
          verificationStatus?.verificationStatus === "MORE_INFORMATION_REQUIRED" ||
          verificationStatus?.verificationStatus === "NOT_SUBMITTED" ||
          (verificationStatus?.verificationStatus === "PENDING" &&
            !verificationStatus?.requestId) ||
          !verificationStatus?.verificationStatus ? (
            <Link
              to={
                verificationStatus?.profileCompleted
                  ? "/become-mentor"
                  : "/complete-profile"
              }
              className="ss-btn ss-btn--primary ss-btn--sm"
            >
              <SsIcon
                name={
                  verificationStatus?.profileCompleted
                    ? "workspace_premium"
                    : "edit"
                }
                size={16}
              />
              {verificationStatus?.verificationStatus === "REJECTED" ||
              verificationStatus?.verificationStatus === "MORE_INFORMATION_REQUIRED"
                ? "Update Profile & Submit Again"
                : verificationStatus?.profileCompleted
                  ? "Submit for Verification"
                  : "Finish Profile"}
            </Link>
          ) : (
            <Link to="/complete-profile" className="ss-btn ss-btn--primary ss-btn--sm">
              <SsIcon name="edit" size={16} />
              Edit Profile
            </Link>
          )}
        </div>
      )}

      {/* ═══════════════════ KPI STAT CARDS ═══════════════════ */}
      <section className="mdash3-kpis" aria-label="Dashboard statistics">
        <SsStatCard
          icon="sessions"
          value={stats.totalSessions}
          label="Total Sessions"
          desc="Sessions created"
        />
        <SsStatCard
          icon="users"
          value={stats.totalStudents}
          label="Total Students"
          desc="Unique learners mentored"
        />
        <SsStatCard
          icon="star"
          value={stats.averageRating || "—"}
          label="Rating"
          desc={`${stats.totalReviews} review${stats.totalReviews === 1 ? "" : "s"}`}
        />
        <SsStatCard
          icon="currency_rupee"
          value={formatMoney(stats.totalEarnings)}
          label="Earnings"
          desc="All-time earnings (INR)"
        />
      </section>

      {/* ═══════════════ UPCOMING SESSIONS + SESSION REQUESTS ═══════════════ */}
      <div className="mdash3-grid mdash3-grid--main">
        {/* UPCOMING SESSIONS */}
        <section className="md3-card md3-card--upcoming" aria-label="Upcoming sessions">
          <div className="md3-card__header">
            <h3 className="md3-card__title">
              <SsIcon name="calendar" size={18} />
              Upcoming Sessions
            </h3>
            <Link to="/mentor/calendar" className="md3-card__link">
              View All
              <SsIcon name="arrow-forward" size={14} />
            </Link>
          </div>
          <div className="md3-card__body">
            {upcomingBookings.length > 0 ? (
              <div className="md3-upcoming">
                {upcomingBookings.slice(0, 5).map((b) => {
                  const session = b?.session || {};
                  const start = new Date(session?.startTime || 0);
                  return (
                    <div key={b.id || b.bookingId} className="md3-upcoming__row">
                      <div className="md3-datebox" aria-hidden="true">
                        <span className="md3-datebox__month">
                          {Number.isNaN(start.getTime())
                            ? ""
                            : start
                                .toLocaleDateString(undefined, { month: "short" })
                                .toUpperCase()}
                        </span>
                        <span className="md3-datebox__day">
                          {Number.isNaN(start.getTime()) ? "" : start.getDate()}
                        </span>
                      </div>
                      <div className="md3-upcoming__info">
                        <p className="md3-upcoming__title">{sessionTopic(session)}</p>
                        <p className="md3-upcoming__meta">
                          <SsIcon name="user" size={14} />
                          {b?.learner?.fullName || "Learner"}
                          <span className="md3-upcoming__sep">·</span>
                          {formatTime(session?.startTime)} –{" "}
                          {formatTime(session?.endTime)}
                        </p>
                      </div>
                      <div className="md3-upcoming__status">
                        <SsBadge status={statusOf(b)} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="md3-empty">
                <SsIcon name="calendar-off" size={20} />
                <p>No upcoming sessions.</p>
                <button
                  type="button"
                  className="ss-btn ss-btn--primary ss-btn--sm"
                  onClick={() => gate.requestAction(goTeach)}
                  title={
                    gate.mode
                      ? "Your account is awaiting Admin verification."
                      : undefined
                  }
                >
                  <SsIcon name="plus" size={14} />
                  Create Session
                </button>
              </div>
            )}
          </div>
        </section>

        {/* SESSION REQUESTS */}
        <section className="md3-card" aria-label="Session requests">
          <div className="md3-card__header">
            <h3 className="md3-card__title">
              <SsIcon name="clock" size={18} />
              Session Requests
              {pendingBookings.length > 0 && (
                <span className="md3-card__count">{pendingBookings.length}</span>
              )}
            </h3>
          </div>
          <div className="md3-card__body">
            {pendingBookings.length > 0 ? (
              <div className="md3-requests">
                {pendingBookings.slice(0, 4).map((b) => {
                  const requestId = b.id || b.bookingId;
                  const isResponding = responding?.id === requestId;
                  return (
                    <div key={requestId} className="md3-request">
                      <div className="md3-avatar">{initials(b?.learner?.fullName || "?")}</div>
                      <div className="md3-request__info">
                        <p className="md3-request__name">
                          {b?.learner?.fullName || "Unknown Learner"}
                        </p>
                        <p className="md3-request__skill">{sessionTopic(b?.session)}</p>
                        <p className="md3-request__meta">
                          {formatDate(b?.session?.startTime || b?.createdAt)}
                          {b?.payment?.amount > 0 &&
                            ` · ${formatMoney(b.payment.amount)}`}
                        </p>
                      </div>
                      <div className="md3-request__actions">
                        <button
                          type="button"
                          className="ss-btn ss-btn--primary ss-btn--sm"
                          disabled={Boolean(responding)}
                          onClick={() =>
                            gate.requestAction(() => respondToRequest(b, "accept"))
                          }
                          title={
                            gate.mode
                              ? "Your account is awaiting Admin verification."
                              : undefined
                          }
                        >
                          {isResponding && responding?.action === "accept"
                            ? "Accepting…"
                            : "Accept"}
                        </button>
                        <button
                          type="button"
                          className="ss-btn ss-btn--danger ss-btn--sm"
                          disabled={Boolean(responding)}
                          onClick={() =>
                            gate.requestAction(() => respondToRequest(b, "decline"))
                          }
                          title={
                            gate.mode
                              ? "Your account is awaiting Admin verification."
                              : undefined
                          }
                        >
                          {isResponding && responding?.action === "decline"
                            ? "Declining…"
                            : "Decline"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="md3-empty">
                <SsIcon name="check-square" size={20} />
                <p>No pending booking requests.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ═══════════ SESSION OVERVIEW + RECENT STUDENTS ═══════════ */}
      <div className="mdash3-grid mdash3-grid--half">
        {/* SESSION OVERVIEW */}
        <section className="md3-card" aria-label="Session overview">
          <div className="md3-card__header">
            <h3 className="md3-card__title">
              <SsIcon name="analytics" size={18} />
              Session Overview
            </h3>
            <span className="md3-card__chip">All bookings</span>
          </div>
          <div className="md3-card__body">
            <DonutChart
              data={sessionOverview}
              total={sessionOverviewTotal}
              label="Total"
            />
          </div>
        </section>

        {/* RECENT STUDENTS */}
        <section className="md3-card" aria-label="Recent students">
          <div className="md3-card__header">
            <h3 className="md3-card__title">
              <SsIcon name="users" size={18} />
              Recent Students
            </h3>
            {recentStudents.length > 0 && (
              <Link to="/mentor/students" className="md3-card__link">
                View All
                <SsIcon name="arrow-forward" size={14} />
              </Link>
            )}
          </div>
          <div className="md3-card__body">
            {recentStudents.length > 0 ? (
              <div className="md3-students">
                {recentStudents.slice(0, 5).map((s) => (
                  <div key={s.id} className="md3-student">
                    <div className="md3-avatar">{initials(s.name)}</div>
                    <div className="md3-student__info">
                      <p className="md3-student__name">{s.name}</p>
                      {s.skill && <p className="md3-student__skill">{s.skill}</p>}
                    </div>
                    <span className="md3-student__date">
                      {s.last ? formatDate(s.last) : ""}
                    </span>
                    <Link
                      to="/mentor/messages"
                      className="md3-icon-btn"
                      title={`Message ${s.name}`}
                      aria-label={`Message ${s.name}`}
                    >
                      <SsIcon name="message-square" size={16} />
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="md3-empty">
                <SsIcon name="user-x" size={20} />
                <p>
                  No students yet. Your students will appear here after they
                  book a session.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ═══════════════════ RECENT REVIEWS ═══════════════════ */}
      <section className="md3-card md3-card--reviews" aria-label="Recent reviews">
        <div className="md3-card__header">
          <h3 className="md3-card__title">
            <SsIcon name="star" size={18} />
            Recent Reviews
          </h3>
          {reviews.length > 0 && (
            <Link to="/mentor/reviews" className="md3-card__link">
              View all reviews
              <SsIcon name="arrow-forward" size={14} />
            </Link>
          )}
        </div>
        <div className="md3-card__body">
          {reviews.length > 0 ? (
            <div className="md3-reviews">
              {reviews.slice(0, 4).map((r) => {
                const rating = Number(r?.rating || 0);
                return (
                  <article key={r.id} className="md3-review">
                    <div className="md3-review__head">
                      <div className="md3-avatar">
                        {initials(r?.learnerName || "?")}
                      </div>
                      <div className="md3-review__meta">
                        <p className="md3-review__name">
                          {r?.learnerName || "Anonymous learner"}
                        </p>
                        <div className="md3-review__stars">
                          {Array.from({ length: 5 }, (_, i) => (
                            <SsIcon
                              key={i}
                              name="star"
                              size={14}
                              className={
                                i < Math.round(rating)
                                  ? "md3-review__star--filled"
                                  : ""
                              }
                            />
                          ))}
                          <span className="md3-review__value">
                            {rating.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <time className="md3-review__date">
                        {formatFullDate(r?.createdAt)}
                      </time>
                    </div>
                    <p className="md3-review__text">
                      {r?.comment || "No comment provided."}
                    </p>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="md3-empty">
              <SsIcon name="reviews" size={20} />
              <p>
                No reviews yet. Complete sessions to start receiving learner
                feedback.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════ MONTHLY EARNINGS ═══════════════════ */}
      <section className="md3-card" aria-label="Monthly earnings">
        <div className="md3-card__header">
          <h3 className="md3-card__title">
            <SsIcon name="wallet" size={18} />
            Monthly Earnings
          </h3>
          <Link to="/mentor/wallet" className="md3-card__link">
            View Wallet
            <SsIcon name="arrow-forward" size={14} />
          </Link>
        </div>
        <div className="md3-card__body md3-earnings">
          <div className="md3-earnings__summary">
            <div className="md3-earnings__balance">
              <p className="md3-earnings__amount">
                {formatMoney(stats.totalEarnings)}
              </p>
              <p className="md3-earnings__period">Total earnings all time</p>
            </div>
            <div className="md3-earnings__stats">
              <div className="md3-earnings__stat">
                <p className="md3-earnings__stat-label">This Month</p>
                <p className="md3-earnings__stat-value">
                  {formatMoney(stats.monthlyEarnings)}
                </p>
              </div>
              <div className="md3-earnings__stat">
                <p className="md3-earnings__stat-label">Completed Payments</p>
                <p className="md3-earnings__stat-value">
                  {stats.completedSessions}
                </p>
              </div>
              <div className="md3-earnings__stat">
                <p className="md3-earnings__stat-label">Avg. Per Session</p>
                <p className="md3-earnings__stat-value">
                  {stats.completedSessions > 0
                    ? formatMoney(stats.totalEarnings / stats.completedSessions)
                    : "₹0"}
                </p>
              </div>
            </div>
          </div>
          <div className="md3-earnings__chart">
            <p className="md3-earnings__chart-title">Revenue (Last 6 Months)</p>
            <div className="mdash2-bar-chart">
              {series.revenue.map((m) => {
                const values = series.revenue.map((r) => r.value ?? 0);
                const max = Math.max(...values, 1);
                const h = (m.value / max) * 100;
                return (
                  <div key={m.key} className="mdash2-bar-chart__col">
                    <div
                      className="mdash2-bar-chart__bar"
                      style={{ height: `${Math.max(h, 4)}%` }}
                      data-tooltip={formatMoney(m.value)}
                    />
                    <span className="mdash2-bar-chart__label">{m.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ INVITE FRIENDS — non-monetary sharing ═══════════════ */}
      <div className="mdash2-invite">
        <div className="mdash2-invite__content">
          <h3 className="mdash2-invite__title">
            <SsIcon name="person_add" size={18} />
            Invite Friends
          </h3>
          <p className="mdash2-invite__subtitle">
            Know someone who wants to learn from experienced mentors? Share
            Mentorly with them.
          </p>
        </div>
        <button
          type="button"
          className="ss-btn ss-btn--secondary ss-btn--sm"
          onClick={() => setShowInviteModal(true)}
        >
          <SsIcon name="share" size={16} />
          Invite Friends
        </button>
      </div>

      {/* Marketplace gate modal — blocks create/publish/availability/accept
          until the mentor's profile is complete AND admin-verified. */}
      <ProfileGateModal {...gate.gate} />

      {/* ═══════════ INVITE FRIENDS MODAL — non-monetary sharing ═══════════ */}
      {showInviteModal && (
        <ShareModal
          title="Invite Friends"
          subtitle="Know someone who wants to learn from experienced mentors? Share Mentorly with them."
          url={window.location.origin + "/signup"}
          text="Join me on Mentorly and learn from experienced mentors."
          copyLabel="Copy Invite Link"
          copyDoneLabel="Invite link copied!"
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </div>
  );
}
