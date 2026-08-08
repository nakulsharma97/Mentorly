import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Link, useNavigate } from "react-router";
import client from "../api/client";
import HeroSection from "../components/HeroSection";
import ProfileGateModal from "../components/ProfileGateModal";
import SsIcon from "../components/ui/SsIcon";
import { SsStatCard, SsBadge } from "../components/ui/SsCard";
import useMentorGate from "../modules/common/useMentorGate";
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

function getTodayString() {
  return new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function isToday(dateLike) {
  if (!dateLike) return false;
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

/* ──────────────────── SVG sub-components ─────────────────── */

/* StatusChip removed — use <SsBadge status={...} /> directly in JSX */

/* ─────────────────── main component ─────────────────────── */

export default function MentorDashboard({ profile }) {
  const navigate = useNavigate();
  const firstName =
    String(profile?.fullName || "Mentor")
      .trim()
      .split(" ")[0] || "Mentor";

  useEffect(() => {
    document.title = `${firstName} · Mentor Dashboard | SkillSwap`;
  }, [firstName]);

  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [recentStudents, setRecentStudents] = useState([]);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [referral, setReferral] = useState(null);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef(null);
  const [analytics, setAnalytics] = useState({
    acceptanceRate: 0,
    completionRate: 0,
    monthGrowth: 0,
  });
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

  const loadMentorData = useCallback(async () => {
    try {
      setLoading(true);
      await client.post("/api/v1/certifications/evaluate").catch(() => null);
      const [sessionsRes, bookingsRes, reviewsRes, verificationRes, referralRes] =
        await Promise.all([
          client.get("/api/v1/sessions"),
          client.get("/api/v1/bookings"),
          client.get("/api/v1/reviews/mentor"),
          client
            .get("/api/v1/verification/mentor/status")
            .catch(() => ({ data: { data: null } })),
          client
            .get("/api/v1/users/me/referral")
            .catch(() => ({ data: { data: null } })),
        ]);

      const allSessions = sessionsRes?.data?.data || EMPTY_ARRAY;
      const allBookings = bookingsRes?.data?.data || EMPTY_ARRAY;
      const allReviews = reviewsRes?.data?.data || EMPTY_ARRAY;

      const sortedUpcoming = allSessions
        .filter((s) => new Date(s?.startTime || 0) > new Date())
        .sort(
          (a, b) =>
            new Date(a?.startTime || 0).getTime() -
            new Date(b?.startTime || 0).getTime(),
        );

      const statusOf = (b) => b?.bookingStatus || b?.status;
      const pending = allBookings.filter((b) => statusOf(b) === "PENDING");
      const completedBookings = allBookings.filter(
        (b) => statusOf(b) === "COMPLETED",
      );
      const PLATFORM_FEE_PCT = 0.10; // 10% platform fee
      const totalEarningsGross = completedBookings.reduce(
        (sum, b) => sum + Number(b?.payment?.amount || 0),
        0,
      );
      const totalEarnings = Math.round(totalEarningsGross * (1 - PLATFORM_FEE_PCT) * 100) / 100;
      // monthlyEarnings calculated after currentMonth is defined below
      const averageRating =
        allReviews.length > 0
          ? Number(
              (
                allReviews.reduce((sum, r) => sum + Number(r?.rating || 0), 0) /
                allReviews.length
              ).toFixed(1),
            )
          : 0;

      const nonPending = allBookings.filter(
        (b) => statusOf(b) !== "PENDING",
      ).length;
      const accepted = allBookings.filter((b) =>
        ["ACCEPTED", "CONFIRMED", "COMPLETED"].includes(statusOf(b)),
      ).length;
      const acceptanceRate =
        nonPending > 0 ? Math.round((accepted / nonPending) * 100) : 0;
      const completionRate =
        allBookings.length > 0
          ? Math.round((completedBookings.length / allBookings.length) * 100)
          : 0;

      // ── Derive per-learner student roster ──
      const learnerMap = new Map();
      allBookings.forEach((b) => {
        const l = b?.learner;
        if (!l?.id) return;
        const entry = learnerMap.get(l.id) || {
          id: l.id,
          name: l.fullName || "Learner",
          email: l.email || "",
          skill: b?.session?.skill?.name || b?.session?.title || "",
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
        if (!entry.skill && b?.session?.skill?.name)
          entry.skill = b.session.skill.name;
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

      // student-growth: cumulative distinct learners by first booking month
      const firstSeen = new Map();
      allBookings.forEach((b) => {
        const lid = b?.learner?.id;
        const key = monthKey(b?.session?.startTime || b?.createdAt);
        if (!lid || !key) return;
        if (!firstSeen.has(lid) || key < firstSeen.get(lid))
          firstSeen.set(lid, key);
      });
      const studentBuckets = buildMonthBuckets();
      let cumulative = 0;
      studentBuckets.forEach((m) => {
        const newThisMonth = Array.from(firstSeen.values()).filter(
          (k) => k === m.key,
        ).length;
        cumulative += newThisMonth;
        m.value = cumulative;
      });

      const prevMonth = revenueBuckets[revenueBuckets.length - 2]?.value || 0;
      const currentMonth =
        revenueBuckets[revenueBuckets.length - 1]?.value || 0;
      const monthlyEarningsGross = Number(currentMonth.toFixed(2));
      const monthlyEarnings = Math.round(monthlyEarningsGross * (1 - PLATFORM_FEE_PCT) * 100) / 100;
      const monthGrowth =
        prevMonth > 0
          ? Math.round(((currentMonth - prevMonth) / prevMonth) * 100)
          : currentMonth > 0
            ? 100
            : 0;

      setSessions(allSessions);
      setBookings(allBookings);
      setUpcomingSessions(sortedUpcoming);
      setPendingBookings(pending);
      setReviews(allReviews);
      setRecentStudents(students);
      setVerificationStatus(verificationRes?.data?.data || null);
      setReferral(referralRes?.data?.data || null);
      setAnalytics({ acceptanceRate, completionRate, monthGrowth });
      setSeries({
        revenue: revenueBuckets,
        students: studentBuckets,
        sessions: sessionBuckets,
        rating: ratingSeries,
      });
      setStats({
        totalStudents: learnerMap.size,
        totalSessions: allSessions.length,
        monthlyEarnings: monthlyEarnings,
        totalEarnings: totalEarnings,
        averageRating,
        totalReviews: allReviews.length,
        completedSessions: completedBookings.length,
      });
    } catch (error) {
      // silently handle data load failures; UI shows empty sections
    } finally {
      setLoading(false);
    }
  }, []);

  // Keep ref updated + initial load
  loadMentorDataRef.current = loadMentorData;

  useEffect(() => {
    loadMentorDataRef.current?.();
  }, []);

  const bookingReferralLink = referral
    ? `https://skillswap.app/signup?ref=${referral.referralCode}`
    : '';

  const handleCopyLink = async () => {
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    try {
      await navigator.clipboard.writeText(bookingReferralLink);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = bookingReferralLink;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = (platform) => {
    const profileName = profile?.fullName || "A friend";
    const referralCode = referral?.referralCode || "";
    const url = encodeURIComponent(bookingReferralLink);

    if (platform === "email" || platform === "gmail") {
      const subject = encodeURIComponent(`${profileName} has invited you to join SkillSwap!`);
      const body = encodeURIComponent(
        `Hi there,\n\n` +
        `${profileName} has been mentoring on SkillSwap and wanted to invite you!\n\n` +
        `SkillSwap connects learners with expert mentors for 1-on-1 sessions across 100+ skills like programming, design, data science, and more.\n\n` +
        `Join using ${profileName}'s personal referral link below and get started on your learning journey:\n` +
        `${bookingReferralLink}\n\n` +
        `Referral code: ${referralCode}\n\n` +
        `Happy learning!\n` +
        `The SkillSwap Team`
      );
      if (platform === "gmail") {
        window.open(
          `https://mail.google.com/mail/?view=cm&fs=1&su=${subject}&body=${body}`,
          '_blank',
          'noopener,noreferrer'
        );
      } else {
        window.open(
          `mailto:?subject=${subject}&body=${body}`,
          '_blank',
          'noopener,noreferrer'
        );
      }
      return;
    }

    const text = encodeURIComponent(
      `Join SkillSwap and start learning! Use my referral code ${referralCode} to get started.`
    );
    const links = {
      whatsapp: `https://wa.me/?text=${text}%20${url}`,
      twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
    };
    window.open(links[platform], '_blank', 'noopener,noreferrer');
  };

  const handleBookingStatus = async (bookingId, status) => {
    try {
      await client.patch(`/api/v1/bookings/${bookingId}/status`, { status });
      await loadMentorData();
    } catch (error) {
      // silently handle booking status update failures
    }
  };

  // Rewards tiers for referral progress
  const REWARD_TIERS = [
    { referrals: 1, label: "Beginner", credits: 50, icon: "star" },
    { referrals: 3, label: "Bronze", credits: 200, icon: "military_tech" },
    { referrals: 5, label: "Silver", credits: 500, icon: "workspace_premium" },
    { referrals: 10, label: "Gold", credits: 1200, icon: "verified" },
    { referrals: 25, label: "Platinum", credits: 5000, icon: "diamond" },
  ];

  const totalReferrals = referral?.totalReferrals || 0;
  const totalCredits = referral?.totalCreditsEarned || 0;
  let currentTierIndex = 0;
  for (let i = REWARD_TIERS.length - 1; i >= 0; i--) {
    if (totalReferrals >= REWARD_TIERS[i].referrals) {
      currentTierIndex = i;
      break;
    }
  }
  const currentTier = REWARD_TIERS[currentTierIndex >= 0 ? currentTierIndex : 0];
  const nextTier = REWARD_TIERS.find((t) => totalReferrals < t.referrals);
  const progressToNext = nextTier
    ? Math.min(100, (totalReferrals / nextTier.referrals) * 100)
    : 100;
  const nextTierReferralsNeeded = nextTier ? nextTier.referrals - totalReferrals : 0;

  // ── Find the booking for a given session ID (for Cancel action) ──
  const findBookingForSession = useCallback((sessionId) => {
    return bookings.find((b) => b?.session?.id === sessionId || b?.sessionId === sessionId);
  }, [bookings]);

  // ── Profile-incomplete warning banner (dismissible) ──
  const [incompleteBannerDismissed, setIncompleteBannerDismissed] = useState(false);
  const profileIncomplete = profile?.role === "MENTOR" && profile?.profileCompleted === false;
  // Marketplace gate: incomplete / unverified mentors get the modal.
  const gate = useMentorGate(profile, verificationStatus);
  const goTeach = useCallback(() => navigate("/mentor/teach"), [navigate]);
  const goCalendar = useCallback(() => navigate("/mentor/calendar"), [navigate]);

  // ── Today's sessions for timeline ──
  const todaySessions = useMemo(() => {
    return upcomingSessions.filter((s) => isToday(s?.startTime));
  }, [upcomingSessions]);

  // ── Mini calendar data ──
  const miniCalendarDays = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) {
      days.push({ day: null, muted: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const hasEvent = upcomingSessions.some(
        (s) => new Date(s?.startTime || 0).toDateString() === date.toDateString()
      );
      days.push({ day: d, isToday: d === now.getDate(), hasEvent, muted: false });
    }
    return days;
  }, [upcomingSessions]);

  // ── Next 3 upcoming events for calendar section ──
  const nextEvents = useMemo(() => {
    return upcomingSessions.slice(0, 3);
  }, [upcomingSessions]);

  // ── Recent activity feed ──
  const recentActivity = useMemo(() => {
    const activities = [];
    pendingBookings.slice(0, 2).forEach((b) => {
      activities.push({
        id: `req-${b.id || b.bookingId}`,
        type: "booking",
        icon: "calendar_add_on",
        iconBg: "rgba(245,158,11,0.12)",
        iconColor: "#F59E0B",
        text: `New booking request from ${b?.learner?.fullName || "a learner"}`,
        time: formatDate(b?.createdAt),
      });
    });
    const completed = bookings.filter((b) => (b?.bookingStatus || b?.status) === "COMPLETED");
    completed.slice(0, 2).forEach((b) => {
      if (!activities.some((a) => a.id === `comp-${b.id || b.bookingId}`)) {
        activities.push({
          id: `comp-${b.id || b.bookingId}`,
          type: "completed",
          icon: "check_circle",
          iconBg: "rgba(22,163,74,0.12)",
          iconColor: "#16A34A",
          text: `Session completed with ${b?.learner?.fullName || "a learner"}`,
          time: formatDate(b?.session?.startTime || b?.createdAt),
        });
      }
    });
    reviews.slice(0, 2).forEach((r) => {
      activities.push({
        id: `rev-${r.id}`,
        type: "review",
        icon: "star",
        iconBg: "rgba(139,92,246,0.12)",
        iconColor: "#8B5CF6",
        text: `New ${r.rating}-star review from ${r?.learner?.fullName || "a learner"}`,
        time: formatDate(r.createdAt),
      });
    });
    if (stats.monthlyEarnings > 0) {
      activities.push({
        id: "payment",
        type: "payment",
        icon: "payments",
        iconBg: "rgba(15,157,138,0.12)",
        iconColor: "#0F9D8A",
        text: `Payment of ${formatMoney(stats.monthlyEarnings)} received`,
        time: "This month",
      });
    }
    activities.sort((a, b) => {
      if (!a.time && !b.time) return 0;
      if (!a.time) return 1;
      if (!b.time) return -1;
      return -1;
    });
    return activities.slice(0, 5);
  }, [pendingBookings, bookings, reviews, stats.monthlyEarnings]);

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

  /* ──── empty state ──── */
  if (!loading && sessions.length === 0 && bookings.length === 0 && reviews.length === 0) {
    return (
      <div className="ss-page">
        <div className="ss-empty">
          <div className="ss-empty__icon">
            <SsIcon name="sparkles" size={36} />
          </div>
          <h3 className="ss-empty__title">Welcome to Your Mentor Dashboard</h3>
          <p className="ss-empty__desc">
            Start by creating your first session. Once learners start booking, you'll see your
            analytics, reviews, and student activity here.
          </p>
          <div className="ss-empty__actions">
            <Link to="/mentor/teach" className="ss-btn ss-btn--primary">
              <SsIcon name="plus" size={18} />
              Create Session
            </Link>
            <Link to="/mentor/professional-profile" className="ss-btn ss-btn--secondary">
              <SsIcon name="user" size={18} />
              Complete Profile
            </Link>
          </div>
        </div>
      </div>
    );
  }



  return (
    <div className="ss-page">

      {/* ═══════════════════ HERO SECTION — Unified Design System ═══════════════════ */}
      <HeroSection
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
            Welcome back to your mentoring workspace. Here's your overview for today.
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
            title={gate.mode ? "Your account is awaiting Admin verification." : undefined}
          >
            <SsIcon name="calendar" size={18} />
            Manage Calendar
          </button>
        }
        primaryButton={
          <button
            type="button"
            className="hero-section__btn hero-section__btn--primary"
            onClick={() => gate.requestAction(goTeach)}
            title={gate.mode ? "Your account is awaiting Admin verification." : undefined}
          >
            <SsIcon name="plus" size={18} />
            Create Session
          </button>
        }
        floatingCards={
          <div className="hero-section__quick-grid" aria-hidden="true">
            <div className="hero-section__quick-item">
              <span className="hero-section__quick-item__label">Today's Sessions</span>
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
        <Link
          to="/mentor/analytics"
          className="hero-section__btn hero-section__btn--ghost"
        >
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

      {/* ═══════════════════ PROFILE INCOMPLETE WARNING BANNER ═══════════════════ */}
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
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
              to={verificationStatus?.profileCompleted ? "/become-mentor" : "/complete-profile"}
              className="ss-btn ss-btn--primary ss-btn--sm"
            >
              <SsIcon name={verificationStatus?.profileCompleted ? "workspace_premium" : "edit"} size={16} />
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

      {/* ═══════════════════ STAT CARDS — Design System ═══════════════════ */}
      <section>
        <div className="ss-stats-grid">
          <SsStatCard
            icon="users"
            value={stats.totalStudents}
            label="Active Students"
            trend={analytics.monthGrowth}
            desc="Total enrolled learners"
          />
          <SsStatCard
            icon="calendar"
            value={upcomingSessions.length}
            label="Upcoming Sessions"
            desc="Scheduled mentoring sessions"
          />
          <SsStatCard
            icon="currency_rupee"
            value={formatMoney(stats.monthlyEarnings)}
            label="Monthly Earnings"
            trend={analytics.monthGrowth}
            desc="Revenue this month"
          />
          <SsStatCard
            icon="star"
            value={stats.averageRating || "—"}
            label="Average Rating"
            desc={`${stats.totalReviews} reviews`}
          />
        </div>
      </section>

      {/* ═══════════════════ SECTION 3 + 4 – SCHEDULE + REQUESTS SIDE BY SIDE ═══════════════════ */}
      <div className="mdash2-main-grid">
        {/* TODAY'S SCHEDULE */}
        <div className="mdash2-today">
          <div className="mdash2-today__header">
            <h3 className="mdash2-today__title">
              <span className="mdash2-today__dot" />
              Today's Schedule
            </h3>
            <span className="mdash2-today__date">{getTodayString()}</span>
          </div>
          <div className="mdash2-today__body">
            {todaySessions.length > 0 ? (
              <div className="mdash2-timeline">
    {todaySessions.map((s) => (
      <div key={s.id} className="mdash2-timeline-item">
                    <div className="mdash2-timeline-item__time">{formatTime(s.startTime)}</div>
                    <div className="mdash2-timeline-item__card">
                      <h4 className="mdash2-timeline-item__title">
                        {s?.skill?.name || s?.title || "Mentoring Session"}
                      </h4>
                      <p className="mdash2-timeline-item__student">
                        <SsIcon name="user" size={16} style={{ marginRight: 4 }} />
                        {s?.learner?.fullName || "Learner"}
                        {s?.learner?.username && <span style={{ marginLeft: 6, opacity: 0.6, fontSize: "0.75rem" }}>(@{s.learner.username})</span>}
                        {s?.duration && <span style={{ marginLeft: 8, opacity: 0.7 }}>· {s.duration} min</span>}
                        <span style={{ marginLeft: 8, opacity: 0.7 }}>· {formatTime(s.startTime)} – {formatTime(s.endTime)}</span>
                      </p>
                      <div className="mdash2-timeline-item__actions">
                        <SsBadge status={s?.bookingStatus || s?.status || "CONFIRMED"} />
                        <a
                          href={s?.meetingLink || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ss-btn ss-btn--primary ss-btn--sm"
                          onClick={(e) => !s?.meetingLink && e.preventDefault()}
                        >
                          <SsIcon name="video" size={14} />
                          Join
                        </a>
                        <Link
                          to="/mentor/calendar"
                          className="ss-btn ss-btn--secondary ss-btn--sm"
                          style={{ fontSize: "0.72rem", padding: "4px 10px" }}
                        >
                          Reschedule
                        </Link>
                        <button
                          className="ss-btn ss-btn--danger ss-btn--sm"
                          style={{ fontSize: "0.72rem", padding: "4px 10px" }}
                          onClick={() => {
                            const booking = findBookingForSession(s.id);
                            if (booking) {
                              handleBookingStatus(booking.id || booking.bookingId, "CANCELLED");
                            } else {
                              console.warn("No booking found for session", s.id);
                            }
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mdash2-empty-inline">
                <SsIcon name="calendar-off" size={18} />
                <p>No sessions scheduled for today</p>
                <Link to="/mentor/teach" className="ss-btn ss-btn--primary ss-btn--sm">
                  + Create a Session
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* SESSION REQUESTS */}
        <div className="mdash2-requests">
          <div className="mdash2-requests__header">
            <h3 className="mdash2-requests__title">
              <SsIcon name="clock" size={18} />
              Session Requests
              {pendingBookings.length > 0 && (
                <span className="mdash2-requests__badge">{pendingBookings.length}</span>
              )}
            </h3>
          </div>
          <div className="mdash2-requests__body">
            {pendingBookings.length > 0 ? (
              pendingBookings.slice(0, 4).map((b) => (
                <div key={b.id || b.bookingId} className="mdash2-request-card">
                  <div className="mdash2-request-card__avatar">
                    {initials(b?.learner?.fullName || "?")}
                  </div>
                  <div className="mdash2-request-card__info">
                    <p className="mdash2-request-card__name">
                      {b?.learner?.fullName || "Unknown Learner"}
                      {b?.learner?.username && <span style={{ marginLeft: 6, fontWeight: 400, fontSize: "0.75rem", color: "var(--ss-text-muted)" }}>(@{b.learner.username})</span>}
                    </p>
                    <p className="mdash2-request-card__skill">
                      {b?.session?.skill?.name || b?.session?.title || "Session"}
                    </p>
                    <div className="mdash2-request-card__meta">
                      <span>
                        <SsIcon name="calendar" size={14} style={{ marginRight: 2 }} />
                        {formatDate(b?.session?.startTime || b?.createdAt)}
                      </span>
                      <span>
                        <SsIcon name="clock" size={14} style={{ marginRight: 2 }} />
                        {formatTime(b?.session?.startTime || b?.createdAt)}
                      </span>
                      {b?.payment?.amount > 0 && (
                        <span>
                          <SsIcon name="wallet" size={14} style={{ marginRight: 2 }} />
                          {formatMoney(b.payment.amount)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mdash2-request-card__actions">
                    <button
                      className="ss-btn ss-btn--primary ss-btn--sm"
                      onClick={() =>
                        gate.requestAction(() =>
                          handleBookingStatus(b.id || b.bookingId, "ACCEPTED"),
                        )
                      }
                      title={gate.mode ? "Your account is awaiting Admin verification." : undefined}
                    >
                      Accept
                    </button>
                    <button
                      className="ss-btn ss-btn--danger ss-btn--sm"
                      onClick={() =>
                        gate.requestAction(() =>
                          handleBookingStatus(b.id || b.bookingId, "CANCELLED"),
                        )
                      }
                      title={gate.mode ? "Your account is awaiting Admin verification." : undefined}
                    >
                      Decline
                    </button>
                    <Link
                      to={`/mentor/students`}
                      className="ss-btn ss-btn--secondary ss-btn--sm"
                      style={{ fontSize: "0.72rem", padding: "4px 10px",                    color: "var(--ss-text-secondary)", borderColor: "var(--ss-border)" }}
                    >
                      View Profile
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="mdash2-empty-inline">
                <SsIcon name="check-square" size={18} />
                <p>No pending booking requests</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════ SECTION 5 + 8 – STUDENTS + CALENDAR SIDE BY SIDE ═══════════════════ */}
      <div className="mdash2-row">
        {/* RECENT STUDENTS */}
        <div className="mdash2-students">
          <div className="mdash2-students__header">
            <h3 className="mdash2-students__title">
              <SsIcon name="users" size={18} />
              Recent Students
            </h3>
            {recentStudents.length > 0 && (
              <Link to="/mentor/students" className="mdash2-students__link">
                View All →
              </Link>
            )}
          </div>
          <div className="mdash2-students__body">
            {recentStudents.length > 0 ? (
              recentStudents.slice(0, 5).map((s) => (
                <div key={s.id} className="mdash2-student-card">
                  <div className="mdash2-student-card__avatar">
                    {initials(s.name)}
                  </div>
                  <div className="mdash2-student-card__info">
                    <p className="mdash2-student-card__name">
                      {s.name}
                      {s.username && <span style={{ marginLeft: 6, fontWeight: 400, fontSize: "0.75rem", color: "var(--ss-text-muted)" }}>(@{s.username})</span>}
                    </p>
                    {s.skill && (
                      <p className="mdash2-student-card__skill">{s.skill}</p>
                    )}
                  </div>
                  <div className="mdash2-student-card__progress">
                    <div className="mdash2-progress-bar">
                      <div
                        className="mdash2-progress-bar__fill"
                        style={{ width: `${s.progress}%` }}
                      />
                    </div>
                    <span className="mdash2-student-card__pct">{s.progress}%</span>
                  </div>
                  <div className="mdash2-student-card__actions">
                    <Link
                      to="/mentor/messages"
                      className="mdash2-icon-btn"
                      title="Message"
                    >
                      <SsIcon name="message-square" size={16} />
                    </Link>
                    <Link
                      to="/mentor/students"
                      className="mdash2-icon-btn"
                      title="View Progress"
                    >
                      <SsIcon name="trending-up" size={16} />
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="mdash2-empty-inline">
                <SsIcon name="user-x" size={18} />
                <p>No students yet. Start mentoring to build your roster.</p>
              </div>
            )}
          </div>
        </div>

        {/* UPCOMING CALENDAR */}
        <div className="mdash2-calendar">
          <div className="mdash2-calendar__header">
            <h3 className="mdash2-calendar__title">
              <SsIcon name="calendar" size={18} />
              Upcoming Calendar
            </h3>
            <Link to="/mentor/calendar" className="mdash2-students__link">
              Full View →
            </Link>
          </div>
          <div className="mdash2-calendar__body">
            {/* Mini Calendar Grid */}
            <div className="mdash2-mini-calendar">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <div key={i} className="mdash2-mini-calendar__dow">{d}</div>
              ))}
              {miniCalendarDays.map((d, i) => (
                <div
                  key={i}
                  className={`mdash2-mini-calendar__day${
                    d.muted ? " mdash2-mini-calendar__day--muted" : ""
                  }${d.isToday ? " mdash2-mini-calendar__day--today" : ""}${
                    d.hasEvent ? " mdash2-mini-calendar__day--has-event" : ""
                  }`}
                >
                  {d.day || ""}
                </div>
              ))}
            </div>

            {/* Upcoming Events */}
            {nextEvents.length > 0 && (
              <div className="mdash2-calendar__upcoming">
                <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--ss-text-secondary)", margin: "4px 0" }}>
                  Upcoming Sessions
                </p>
                {nextEvents.map((s) => (
                  <div key={s.id} className="mdash2-calendar__event">
                    <div
                      className="mdash2-calendar__event-dot"
                      style={{ background: isToday(s.startTime) ? "var(--ss-primary)" : "var(--ss-text-muted)" }}
                    />
                    <div className="mdash2-calendar__event-info">
                      <p className="mdash2-calendar__event-title">
                        {s?.skill?.name || s?.title || "Session"}
                      </p>
                      <p className="mdash2-calendar__event-time">
                        {formatDate(s.startTime)} · {formatTime(s.startTime)}
                      </p>
                    </div>
                    <span
                      className="mdash2-calendar__event-status"
                      style={{
                        background: isToday(s.startTime) ? "var(--ss-success-bg)" : "var(--ss-primary-light)",
                        color: isToday(s.startTime) ? "var(--ss-success)" : "var(--ss-primary)",
                      }}
                    >
                      {isToday(s.startTime) ? "Today" : "Upcoming"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════ SECTION 6 – MONTHLY EARNINGS ═══════════════════ */}
      <div className="mdash2-earnings">
        <div className="mdash2-earnings__header">
          <h3 className="mdash2-earnings__title">
            <SsIcon name="wallet" size={18} />
            Monthly Earnings
          </h3>
          <Link to="/mentor/wallet" className="mdash2-students__link">
            View Wallet →
          </Link>
        </div>
        <div className="mdash2-earnings__body">
          <div className="mdash2-earnings__summary">
            <div className="mdash2-earnings__balance">
              <p className="mdash2-earnings__amount">{formatMoney(stats.totalEarnings)}</p>
              <p className="mdash2-earnings__period">Total earnings all time</p>
            </div>
            <div className="mdash2-earnings__stats">
              <div className="mdash2-earnings__stat">
                <p className="mdash2-earnings__stat-label">This Month</p>
                <p className="mdash2-earnings__stat-value">{formatMoney(stats.monthlyEarnings)}</p>
              </div>
              <div className="mdash2-earnings__stat">
                <p className="mdash2-earnings__stat-label">Pending Payout</p>
                <p className="mdash2-earnings__stat-value">{formatMoney(0)}</p>
              </div>
              <div className="mdash2-earnings__stat">
                <p className="mdash2-earnings__stat-label">Completed Payments</p>
                <p className="mdash2-earnings__stat-value">{stats.completedSessions}</p>
              </div>
              <div className="mdash2-earnings__stat">
                <p className="mdash2-earnings__stat-label">Avg. Per Session</p>
                <p className="mdash2-earnings__stat-value">
                  {stats.completedSessions > 0
                    ? formatMoney(stats.totalEarnings / stats.completedSessions)
                    : "₹0"}
                </p>
              </div>
            </div>
          </div>
          <div className="mdash2-earnings__chart">
            <p className="mdash2-earnings__chart-title">Revenue (Last 6 Months)</p>
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
      </div>

      {/* ═══════════════════ PERFORMANCE ANALYTICS GRID ═══════════════════ */}
      <section>
        <div className="ss-stats-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
          <SsStatCard icon="star" value={stats.averageRating || "—"} label="Average Rating" desc="Overall rating" />
          <SsStatCard icon="star" value={stats.totalReviews} label="Total Reviews" desc="All feedback received" />
          <SsStatCard icon="check-circle" value={stats.completedSessions} label="Completed" desc="Sessions finished" />
          <SsStatCard icon="target" value={`${analytics.completionRate}%`} label="Completion Rate" desc="% of bookings completed" />
          <SsStatCard icon="trending-up" value={`${analytics.acceptanceRate}%`} label="Acceptance Rate" desc="% of requests accepted" />
          <SsStatCard icon="award" value={stats.totalStudents > 0 ? `${Math.round((stats.totalReviews / stats.totalStudents) * 100)}%` : "—"} label="Satisfaction" desc="Student satisfaction rate" />
        </div>
      </section>

      {/* ═══════════════════ SECTION 9 – NOTIFICATIONS / ACTIVITY FEED (with Quick Actions) ═══════════════════ */}
      <div className="mdash2-row">
        {/* Activity Feed */}
        <div className="mdash2-notifications">
          <div className="mdash2-notifications__header">
            <h3 className="mdash2-notifications__title">
              <SsIcon name="bell" size={18} />
              Recent Activity
            </h3>
          </div>
          <div className="mdash2-notifications__body">
            {recentActivity.length > 0 ? (
              recentActivity.map((a) => (
                <div key={a.id} className="mdash2-notification-item">
                  <div
                    className="mdash2-notification-item__icon"
                    style={{ background: a.iconBg, color: a.iconColor }}
                  >
                    <SsIcon name={a.icon} size={18} />
                  </div>
                  <div className="mdash2-notification-item__info">
                    <p className="mdash2-notification-item__text">{a.text}</p>
                    <p className="mdash2-notification-item__time">{a.time}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="mdash2-empty-inline">
                <SsIcon name="bell-off" size={18} />
                <p>No recent activity</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <div className="mdash2-actions-grid">
            <button
              type="button"
              className="mdash2-action-card"
              onClick={() => gate.requestAction(goTeach)}
              title={gate.mode ? "Your account is awaiting Admin verification." : undefined}
            >
              <div className="mdash2-action-card__icon" style={{ background: "rgba(15,157,138,0.10)", color: "#0F9D8A" }}>
                <SsIcon name="video" size={22} />
              </div>
              <p className="mdash2-action-card__title">Create Session</p>
              <p className="mdash2-action-card__desc">Schedule a session</p>
            </button>
            <button
              type="button"
              className="mdash2-action-card"
              onClick={() => gate.requestAction(goCalendar)}
              title={gate.mode ? "Your account is awaiting Admin verification." : undefined}
            >
              <div className="mdash2-action-card__icon" style={{ background: "rgba(59,130,246,0.10)", color: "#3B82F6" }}>
                <SsIcon name="calendar" size={22} />
              </div>
              <p className="mdash2-action-card__title">Availability</p>
              <p className="mdash2-action-card__desc">Set your hours</p>
            </button>
            <Link to="/mentor/students" className="mdash2-action-card">
              <div className="mdash2-action-card__icon" style={{ background: "rgba(139,92,246,0.10)", color: "#8B5CF6" }}>
                <SsIcon name="users" size={22} />
              </div>
              <p className="mdash2-action-card__title">Students</p>
              <p className="mdash2-action-card__desc">View your roster</p>
            </Link>
            <Link to="/mentor/messages" className="mdash2-action-card">
              <div className="mdash2-action-card__icon" style={{ background: "rgba(22,163,74,0.10)", color: "#16A34A" }}>
                <SsIcon name="message-square" size={22} />
              </div>
              <p className="mdash2-action-card__title">Messages</p>
              <p className="mdash2-action-card__desc">Inbox & replies</p>
            </Link>
            <Link to="/mentor/analytics" className="mdash2-action-card">
              <div className="mdash2-action-card__icon" style={{ background: "rgba(245,158,11,0.10)", color: "#F59E0B" }}>
                <SsIcon name="analytics" size={22} />
              </div>
              <p className="mdash2-action-card__title">Analytics</p>
              <p className="mdash2-action-card__desc">Deep dive metrics</p>
            </Link>
            <Link to="/mentor/wallet" className="mdash2-action-card">
              <div className="mdash2-action-card__icon" style={{ background: "rgba(236,72,153,0.10)", color: "#EC4899" }}>
                <SsIcon name="wallet" size={22} />
              </div>
              <p className="mdash2-action-card__title">Payments</p>
              <p className="mdash2-action-card__desc">Earnings & payouts</p>
            </Link>
            <Link to="/mentor/teach" className="mdash2-action-card">
              <div className="mdash2-action-card__icon" style={{ background: "rgba(249,115,22,0.10)", color: "#F97316" }}>
                <SsIcon name="book-open" size={22} />
              </div>
              <p className="mdash2-action-card__title">Resources</p>
              <p className="mdash2-action-card__desc">Teaching materials</p>
            </Link>
            <Link to="/mentor/reviews" className="mdash2-action-card">
              <div className="mdash2-action-card__icon" style={{ background: "rgba(15,157,138,0.10)", color: "#0F9D8A" }}>
                <SsIcon name="star" size={22} />
              </div>
              <p className="mdash2-action-card__title">Reviews</p>
              <p className="mdash2-action-card__desc">See feedback</p>
            </Link>
          </div>
        </div>
      </div>

      {/* ═══════════════════ SECTION 11 – MENTOR PROGRESS ═══════════════════ */}
      <div className="mdash2-progress">
        <div className="mdash2-progress__header">
          <h3 className="mdash2-progress__title">
            <SsIcon name="trending-up" size={18} />
            Mentor Progress
          </h3>
          <Link to="/complete-profile" className="mdash2-students__link">
            Complete Profile →
          </Link>
        </div>
        <div className="mdash2-progress__body">
          <div className="mdash2-progress__stats">
            <div className="mdash2-progress__stat">
              <p className="mdash2-progress__stat-value">{verificationStatus?.mentorVerified ? "100%" : "60%"}</p>
              <p className="mdash2-progress__stat-label">Profile</p>
            </div>
            <div className="mdash2-progress__stat">
              <p className="mdash2-progress__stat-value">
                {verificationStatus?.mentorVerified ? (
                  <span style={{ color: "var(--ss-success)" }}>Verified</span>
                ) : (
                  "Pending"
                )}
              </p>
              <p className="mdash2-progress__stat-label">Verification</p>
            </div>
            <div className="mdash2-progress__stat">
              <p className="mdash2-progress__stat-value">{profile?.skills?.length || 0}</p>
              <p className="mdash2-progress__stat-label">Skills Added</p>
            </div>
            <div className="mdash2-progress__stat">
              <p className="mdash2-progress__stat-value">{profile?.certifications?.length || 0}</p>
              <p className="mdash2-progress__stat-label">Certificates</p>
            </div>
            <div className="mdash2-progress__stat">
              <p className="mdash2-progress__stat-value">{stats.totalSessions}</p>
              <p className="mdash2-progress__stat-label">Sessions</p>
            </div>
          </div>
          <div className="mdash2-progress__main-bar">
            <div className="mdash2-progress__main-bar-header">
              <p className="mdash2-progress__main-bar-label">Profile Completion</p>
              <p className="mdash2-progress__main-bar-pct">
                {verificationStatus?.mentorVerified ? "100%" : "60%"}
              </p>
            </div>
            <div className="mdash2-progress__main-bar-track">
              <div
                className="mdash2-progress__main-bar-fill"
                style={{ width: `${verificationStatus?.mentorVerified ? 100 : 60}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════ REFERRAL SECTION ═══════════════════ */}
      {referral && (
        <div className="mdash2-referral">
          <div className="mdash2-referral__header">
            <h3 className="mdash2-referral__title">
              <SsIcon name="share-2" size={18} />
              Referral Rewards
            </h3>
          </div>
          <div className="mdash2-referral__body">
            <div className="mdash2-referral__stats">
              <div className="mdash2-referral__stat">
                <span className="mdash2-referral__stat-value">{totalReferrals}</span>
                <span className="mdash2-referral__stat-label">Friends Referred</span>
              </div>
              <div className="mdash2-referral__stat">
                <span className="mdash2-referral__stat-value">₹{Number(totalCredits || 0).toLocaleString("en-IN")}</span>
                <span className="mdash2-referral__stat-label">Earnings (₹)</span>
              </div>
              <div className="mdash2-referral__stat">
                <span className="mdash2-referral__stat-value">{currentTier?.label || "Beginner"}</span>
                <span className="mdash2-referral__stat-label">Current Tier</span>
              </div>
              {nextTier && (
                <div className="mdash2-referral__stat">
                  <span className="mdash2-referral__stat-value">{nextTierReferralsNeeded}</span>
                  <span className="mdash2-referral__stat-label">To Next Tier</span>
                </div>
              )}
            </div>
            {/* Progress bar */}
            <div className="mdash2-progress__main-bar">
              <div className="mdash2-progress__main-bar-header">
                <p className="mdash2-progress__main-bar-label">Progress to {nextTier?.label || "Max"}</p>
                <p className="mdash2-progress__main-bar-pct">{Math.round(progressToNext)}%</p>
              </div>
              <div className="mdash2-progress__main-bar-track">
                <div
                  className="mdash2-progress__main-bar-fill"
                  style={{ width: `${Math.min(100, progressToNext)}%` }}
                />
              </div>
            </div>
            <div className="mdash2-referral__share">
              <div className="mdash2-referral__code">
                <SsIcon name="link" size={18} />
                {referral.referralCode}
              </div>
              <button
                type="button"
                className={`mdash2-referral__copy-btn ${copied ? "mdash2-referral__copy-btn--copied" : ""}`}
                onClick={handleCopyLink}
              >
                <SsIcon name={copied ? "check" : "copy"} size={16} />
                {copied ? "Copied!" : "Copy Code"}
              </button>
              <button
                type="button"
                className="ss-btn ss-btn--secondary ss-btn--sm"
                onClick={() => handleShare("whatsapp")}
              >
                <SsIcon name="message-square" size={16} />
                Share
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Marketplace gate modal — blocks create/publish/availability/accept
          until the mentor's profile is complete AND admin-verified. */}
      <ProfileGateModal {...gate.gate} />

    </div>
  );
}

/* ──────────────── Sub-Components (Legacy) ──────────────── */
/* StatCard2, AnalyticCard2, QuickAction2 have been replaced by SsStatCard from design system */
