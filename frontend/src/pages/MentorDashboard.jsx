import { useEffect, useState, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import "./MentorDashboard.css";

/* ───────────────────────── helpers ───────────────────────── */

function formatMoney(amt) {
  if (amt == null || Number.isNaN(Number(amt))) return "$0";
  const n = Number(amt);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
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

function MiniChart({ data = [], color = "var(--md-primary)", height = 28 }) {
  if (data.length < 2) return <div style={{ height }} />;
  const values = data.map((d) => d.value ?? 0);
  const max = Math.max(...values, 1);
  const w = 100 / data.length;
  return (
    <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={values
          .map((v, i) => `${i * w + w / 2},${height - (v / max) * height}`)
          .join(" ")}
      />
      {values.map((v, i) => (
        <circle
          key={i}
          cx={i * w + w / 2}
          cy={height - (v / max) * height}
          r={2.5}
          fill="var(--md-card)"
          stroke={color}
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
}

/* ───────────────────── Status chips ───────────────────── */

function StatusChip({ status }) {
  const s = (status || "").toUpperCase();
  let label = s;
  let cls = "";
  if (s === "CONFIRMED" || s === "ACCEPTED") { label = "Confirmed"; cls = "mdash2-status--confirmed"; }
  else if (s === "PENDING") { label = "Pending"; cls = "mdash2-status--pending"; }
  else if (s === "COMPLETED") { label = "Completed"; cls = "mdash2-status--completed"; }
  else if (s === "CANCELLED" || s === "CANCELED" || s === "REJECTED") { label = "Cancelled"; cls = "mdash2-status--cancelled"; }
  else cls = "mdash2-status--pending";

  return <span className={`mdash2-timeline-item__status ${cls}`}>{label}</span>;
}

/* ─────────────────── main component ─────────────────────── */

export default function MentorDashboard({ profile }) {
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

  useEffect(() => {
    loadMentorData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMentorData = async () => {
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

      const allSessions = sessionsRes?.data?.data || [];
      const allBookings = bookingsRes?.data?.data || [];
      const allReviews = reviewsRes?.data?.data || [];

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
      const totalEarnings = completedBookings.reduce(
        (sum, b) => sum + Number(b?.payment?.amount || 0),
        0,
      );
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
        monthlyEarnings: Number(currentMonth.toFixed(2)),
        totalEarnings: Number(totalEarnings.toFixed(2)),
        averageRating,
        totalReviews: allReviews.length,
        completedSessions: completedBookings.length,
      });
    } catch (error) {
      console.error("Error loading mentor data:", error);
    } finally {
      setLoading(false);
    }
  };

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
      console.error("Error updating booking status:", error);
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
      <div className="mdash2-shell">
        <div className="mdash2-skeleton__hero" />
        <div className="mdash2-skeleton__grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="mdash2-skeleton__card" />
          ))}
        </div>
        <div className="mdash2-skeleton__row">
          <div className="mdash2-skeleton__section" />
          <div className="mdash2-skeleton__section" />
        </div>
      </div>
    );
  }

  /* ──── empty state ──── */
  if (!loading && sessions.length === 0 && bookings.length === 0 && reviews.length === 0) {
    return (
      <div className="mdash2-shell">
        <div className="mdash2-empty">
          <div className="mdash2-empty__icon">
            <span className="md__icon">school</span>
          </div>
          <h2 className="mdash2-empty__title">Welcome to Your Mentor Dashboard</h2>
          <p className="mdash2-empty__desc">
            Start by creating your first session. Once learners start booking, you'll see your
            analytics, reviews, and student activity here.
          </p>
          <div className="mdash2-empty__actions">
            <Link to="/mentor/teach" className="mdash2-btn mdash2-btn--primary">
              <span className="md__icon">add</span>
              Create Session
            </Link>
            <Link to="/mentor/professional-profile" className="mdash2-btn mdash2-btn--outline">
              <span className="md__icon">person</span>
              Complete Profile
            </Link>
          </div>
        </div>
      </div>
    );
  }



  return (
    <div className="mdash2-shell">

      {/* ═══════════════════ SECTION 1 – PREMIUM WELCOME HERO ═══════════════════ */}
      <section className="mdash2-hero">
        <div className="mdash2-hero__pattern">
          <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="mdashGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
              </pattern>
            </defs>
            <rect width="400" height="400" fill="url(#mdashGrid)" />
          </svg>
        </div>
        <div className="mdash2-hero__content">
          <div className="mdash2-hero__left">
            <h1 className="mdash2-hero__greeting">
              Good Morning, {firstName} <span role="img" aria-label="wave">👋</span>
            </h1>
            <p className="mdash2-hero__subtitle">
              Welcome back to your mentoring workspace. Here's your overview for today.
            </p>

            <div className="mdash2-hero__quick-stats">
              <div className="mdash2-hero__qs-item">
                <p className="mdash2-hero__qs-label">Today's Sessions</p>
                <p className="mdash2-hero__qs-value">{todaySessions.length}</p>
              </div>
              <div className="mdash2-hero__qs-item">
                <p className="mdash2-hero__qs-label">Pending Requests</p>
                <p className="mdash2-hero__qs-value">{pendingBookings.length}</p>
              </div>
              <div className="mdash2-hero__qs-item">
                <p className="mdash2-hero__qs-label">Active Students</p>
                <p className="mdash2-hero__qs-value">{stats.totalStudents}</p>
              </div>
              <div className="mdash2-hero__qs-item">
                <p className="mdash2-hero__qs-label">Monthly Earnings</p>
                <p className="mdash2-hero__qs-value">{formatMoney(stats.monthlyEarnings)}</p>
              </div>
            </div>

            <div className="mdash2-hero__actions">
              <Link to="/mentor/teach" className="mdash2-btn mdash2-btn--primary">
                <span className="md__icon">add</span>
                Create Session
              </Link>
              <Link to="/mentor/calendar" className="mdash2-btn mdash2-btn--secondary">
                <span className="md__icon">calendar_month</span>
                Manage Calendar
              </Link>
              <Link to="/mentor/analytics" className="mdash2-btn mdash2-btn--outline">
                <span className="md__icon">insights</span>
                View Analytics
              </Link>
              <button
                className="mdash2-btn mdash2-btn--ghost"
                onClick={loadMentorData}
                title="Refresh data"
              >
                <span className="md__icon">refresh</span>
              </button>
            </div>
          </div>

          <div className="mdash2-hero__right">
            <div className="mdash2-hero__illustration">
              <div className="mdash2-hero__floating-stat">
                <div className="mdash2-hero__fs-icon">
                  <span className="md__icon">today</span>
                </div>
                <div className="mdash2-hero__fs-info">
                  <p className="mdash2-hero__fs-label">Today's Bookings</p>
                  <p className="mdash2-hero__fs-value">{todaySessions.length} session{todaySessions.length !== 1 ? "s" : ""}</p>
                </div>
                <span className="mdash2-hero__fs-trend mdash2-hero__fs-trend--up">↑ {analytics.monthGrowth}%</span>
              </div>
              <div className="mdash2-hero__floating-stat">
                <div className="mdash2-hero__fs-icon">
                  <span className="md__icon">trending_up</span>
                </div>
                <div className="mdash2-hero__fs-info">
                  <p className="mdash2-hero__fs-label">Weekly Growth</p>
                  <p className="mdash2-hero__fs-value">{analytics.monthGrowth >= 0 ? "+" : ""}{analytics.monthGrowth}%</p>
                </div>
                <span className="mdash2-hero__fs-trend mdash2-hero__fs-trend--up">↑ {analytics.monthGrowth}%</span>
              </div>
              <div className="mdash2-hero__floating-stat">
                <div className="mdash2-hero__fs-icon">
                  <span className="md__icon">quick_reply</span>
                </div>
                <div className="mdash2-hero__fs-info">
                  <p className="mdash2-hero__fs-label">Response Rate</p>
                  <p className="mdash2-hero__fs-value">{analytics.acceptanceRate}%</p>
                </div>
                <span className="mdash2-hero__fs-trend mdash2-hero__fs-trend--up">↑ {analytics.acceptanceRate}%</span>
              </div>
              <div className="mdash2-hero__floating-stat">
                <div className="mdash2-hero__fs-icon">
                  <span className="md__icon">star</span>
                </div>
                <div className="mdash2-hero__fs-info">
                  <p className="mdash2-hero__fs-label">Average Rating</p>
                  <p className="mdash2-hero__fs-value">{stats.averageRating || "—"} / 5</p>
                </div>
                <span className="mdash2-hero__fs-trend mdash2-hero__fs-trend--up">{stats.averageRating > 0 ? `${stats.averageRating}` : "—"}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ VERIFICATION BANNER ═══════════════════ */}
      {!verificationStatus?.mentorVerified && (
        <div className="mdash2-verify">
          <div className="mdash2-verify__icon">
            <span className="md__icon">verified_user</span>
          </div>
          <div className="mdash2-verify__text">
            <strong>Verification pending</strong>
            <span>Complete mentor verification to increase trust and booking conversions.</span>
          </div>
          <Link to="/profile-setup" className="mdash2-btn mdash2-btn--primary mdash2-btn--sm">
            Finish Profile
          </Link>
        </div>
      )}

      {/* ═══════════════════ SECTION 2 – QUICK STATISTICS ═══════════════════ */}
      <section>
        <div className="mdash2-stats-grid">
          <StatCard2
            icon="groups"
            color="#3B82F6"
            bg="rgba(59,130,246,0.10)"
            value={stats.totalStudents}
            label="Active Students"
            delta={analytics.monthGrowth}
          />
          <StatCard2
            icon="calendar_month"
            color="#0F9D8A"
            bg="rgba(15,157,138,0.10)"
            value={upcomingSessions.length}
            label="Upcoming Sessions"
            delta={upcomingSessions.length > 0 ? "upcoming" : null}
          />
          <StatCard2
            icon="payments"
            color="#F59E0B"
            bg="rgba(245,158,11,0.10)"
            value={formatMoney(stats.monthlyEarnings)}
            label="Monthly Earnings"
            delta={analytics.monthGrowth}
            series={series.revenue}
          />
          <StatCard2
            icon="star"
            color="#8B5CF6"
            bg="rgba(139,92,246,0.10)"
            value={stats.averageRating || "—"}
            label="Average Rating"
            desc={`${stats.totalReviews} reviews`}
            series={series.rating}
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
                        <span className="md__icon" style={{ fontSize: "0.85rem" }}>person</span>
                        {s?.learner?.fullName || "Learner"}
                        {s?.duration && <span style={{ marginLeft: 8, opacity: 0.7 }}>· {s.duration} min</span>}
                        <span style={{ marginLeft: 8, opacity: 0.7 }}>· {formatTime(s.startTime)} – {formatTime(s.endTime)}</span>
                      </p>
                      <div className="mdash2-timeline-item__actions">
                        <StatusChip status={s?.bookingStatus || s?.status || "CONFIRMED"} />
                        <a
                          href={s?.meetingLink || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mdash2-btn mdash2-btn--primary mdash2-btn--xs"
                          onClick={(e) => !s?.meetingLink && e.preventDefault()}
                        >
                          <span className="md__icon" style={{ fontSize: "0.8rem" }}>video_call</span>
                          Join
                        </a>
                        <Link
                          to="/mentor/calendar"
                          className="mdash2-btn mdash2-btn--sm mdash2-btn--secondary"
                          style={{ fontSize: "0.72rem", padding: "4px 10px" }}
                        >
                          Reschedule
                        </Link>
                        <button
                          className="mdash2-btn mdash2-btn--sm mdash2-btn--danger"
                          style={{ fontSize: "0.72rem", padding: "4px 10px" }}
                          onClick={() => handleBookingStatus(s?.id || s?.bookingId, "CANCELLED")}
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
                <span className="md__icon">event_busy</span>
                <p>No sessions scheduled for today</p>
                <Link to="/mentor/teach" className="mdash2-btn mdash2-btn--primary mdash2-btn--sm">
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
              <span className="md__icon">pending_actions</span>
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
                    </p>
                    <p className="mdash2-request-card__skill">
                      {b?.session?.skill?.name || b?.session?.title || "Session"}
                    </p>
                    <div className="mdash2-request-card__meta">
                      <span>
                        <span className="md__icon" style={{ fontSize: "0.75rem" }}>calendar_today</span>
                        {formatDate(b?.session?.startTime || b?.createdAt)}
                      </span>
                      <span>
                        <span className="md__icon" style={{ fontSize: "0.75rem" }}>schedule</span>
                        {formatTime(b?.session?.startTime || b?.createdAt)}
                      </span>
                      {b?.payment?.amount > 0 && (
                        <span>
                          <span className="md__icon" style={{ fontSize: "0.75rem" }}>payments</span>
                          {formatMoney(b.payment.amount)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mdash2-request-card__actions">
                    <button
                      className="mdash2-btn mdash2-btn--success mdash2-btn--xs"
                      onClick={() => handleBookingStatus(b.id || b.bookingId, "ACCEPTED")}
                    >
                      Accept
                    </button>
                    <button
                      className="mdash2-btn mdash2-btn--danger mdash2-btn--xs"
                      onClick={() => handleBookingStatus(b.id || b.bookingId, "CANCELLED")}
                    >
                      Decline
                    </button>
                    <Link
                      to={`/mentor/students`}
                      className="mdash2-btn mdash2-btn--sm mdash2-btn--outline"
                      style={{ fontSize: "0.72rem", padding: "4px 10px", color: "var(--md-text-secondary)", borderColor: "var(--md-card-border)" }}
                    >
                      View Profile
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="mdash2-empty-inline">
                <span className="md__icon">checklist</span>
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
              <span className="md__icon">groups</span>
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
                    <p className="mdash2-student-card__name">{s.name}</p>
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
                      <span className="md__icon">chat</span>
                    </Link>
                    <Link
                      to="/mentor/students"
                      className="mdash2-icon-btn"
                      title="View Progress"
                    >
                      <span className="md__icon">trending_up</span>
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="mdash2-empty-inline">
                <span className="md__icon">group_off</span>
                <p>No students yet. Start mentoring to build your roster.</p>
              </div>
            )}
          </div>
        </div>

        {/* UPCOMING CALENDAR */}
        <div className="mdash2-calendar">
          <div className="mdash2-calendar__header">
            <h3 className="mdash2-calendar__title">
              <span className="md__icon">calendar_month</span>
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
                <p style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--md-text-secondary)", margin: "4px 0" }}>
                  Upcoming Sessions
                </p>
                {nextEvents.map((s) => (
                  <div key={s.id} className="mdash2-calendar__event">
                    <div
                      className="mdash2-calendar__event-dot"
                      style={{ background: isToday(s.startTime) ? "var(--md-primary)" : "var(--md-text-muted)" }}
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
                        background: isToday(s.startTime) ? "var(--md-success-light)" : "var(--md-primary-lighter)",
                        color: isToday(s.startTime) ? "var(--md-success)" : "var(--md-primary)",
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
            <span className="md__icon">payments</span>
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
                    : "$0"}
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

      {/* ═══════════════════ SECTION 7 – PERFORMANCE ANALYTICS ═══════════════════ */}
      <section>
        <div className="mdash2-analytics-grid">
          <AnalyticCard2
            icon="star"
            color="#F59E0B"
            bg="rgba(245,158,11,0.10)"
            value={stats.averageRating || "—"}
            label="Average Rating"
          />
          <AnalyticCard2
            icon="rate_review"
            color="#8B5CF6"
            bg="rgba(139,92,246,0.10)"
            value={stats.totalReviews}
            label="Total Reviews"
          />
          <AnalyticCard2
            icon="check_circle"
            color="#16A34A"
            bg="rgba(22,163,74,0.10)"
            value={stats.completedSessions}
            label="Sessions Completed"
          />
          <AnalyticCard2
            icon="task_alt"
            color="#0F9D8A"
            bg="rgba(15,157,138,0.10)"
            value={`${analytics.completionRate}%`}
            label="Completion Rate"
          />
          <AnalyticCard2
            icon="quick_reply"
            color="#3B82F6"
            bg="rgba(59,130,246,0.10)"
            value={`${analytics.acceptanceRate}%`}
            label="Response Time"
          />
          <AnalyticCard2
            icon="sentiment_satisfied"
            color="#EC4899"
            bg="rgba(236,72,153,0.10)"
            value={stats.totalStudents > 0 ? `${Math.round((stats.totalReviews / stats.totalStudents) * 100)}%` : "—"}
            label="Student Satisfaction"
          />
        </div>
      </section>

      {/* ═══════════════════ SECTION 9 – NOTIFICATIONS / ACTIVITY FEED (with Quick Actions) ═══════════════════ */}
      <div className="mdash2-row">
        {/* Activity Feed */}
        <div className="mdash2-notifications">
          <div className="mdash2-notifications__header">
            <h3 className="mdash2-notifications__title">
              <span className="md__icon">notifications</span>
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
                    <span className="md__icon">{a.icon}</span>
                  </div>
                  <div className="mdash2-notification-item__info">
                    <p className="mdash2-notification-item__text">{a.text}</p>
                    <p className="mdash2-notification-item__time">{a.time}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="mdash2-empty-inline">
                <span className="md__icon">notifications_off</span>
                <p>No recent activity</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div>
          <div className="mdash2-actions-grid">
            <QuickAction2
              icon="video_camera_front"
              color="#0F9D8A"
              bg="rgba(15,157,138,0.10)"
              title="Create Session"
              desc="Schedule a session"
              to="/mentor/teach"
            />
            <QuickAction2
              icon="calendar_month"
              color="#3B82F6"
              bg="rgba(59,130,246,0.10)"
              title="Availability"
              desc="Set your hours"
              to="/mentor/calendar"
            />
            <QuickAction2
              icon="groups"
              color="#8B5CF6"
              bg="rgba(139,92,246,0.10)"
              title="Students"
              desc="View your roster"
              to="/mentor/students"
            />
            <QuickAction2
              icon="chat"
              color="#16A34A"
              bg="rgba(22,163,74,0.10)"
              title="Messages"
              desc="Inbox & replies"
              to="/mentor/messages"
            />
            <QuickAction2
              icon="insights"
              color="#F59E0B"
              bg="rgba(245,158,11,0.10)"
              title="Analytics"
              desc="Deep dive metrics"
              to="/mentor/analytics"
            />
            <QuickAction2
              icon="payments"
              color="#EC4899"
              bg="rgba(236,72,153,0.10)"
              title="Payments"
              desc="Earnings & payouts"
              to="/mentor/wallet"
            />
            <QuickAction2
              icon="folder"
              color="#F97316"
              bg="rgba(249,115,22,0.10)"
              title="Resources"
              desc="Shared materials"
              to="/mentor/teach"
            />
            <QuickAction2
              icon="star_rate"
              color="#0F9D8A"
              bg="rgba(15,157,138,0.10)"
              title="Reviews"
              desc="See feedback"
              to="/mentor/reviews"
            />
          </div>
        </div>
      </div>

      {/* ═══════════════════ SECTION 11 – MENTOR PROGRESS ═══════════════════ */}
      <div className="mdash2-progress">
        <div className="mdash2-progress__header">
          <h3 className="mdash2-progress__title">
            <span className="md__icon">trending_up</span>
            Mentor Progress
          </h3>
          <Link to="/profile-setup" className="mdash2-students__link">
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
                  <span style={{ color: "var(--md-success)" }}>Verified</span>
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
              <span className="md__icon">share</span>
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
                <span className="mdash2-referral__stat-value">{totalCredits}</span>
                <span className="mdash2-referral__stat-label">Credits Earned</span>
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
                <span className="md__icon" style={{ fontSize: "1rem" }}>link</span>
                {referral.referralCode}
              </div>
              <button
                type="button"
                className={`mdash2-referral__copy-btn ${copied ? "mdash2-referral__copy-btn--copied" : ""}`}
                onClick={handleCopyLink}
              >
                <span className="md__icon" style={{ fontSize: "0.9rem" }}>
                  {copied ? "check" : "content_copy"}
                </span>
                {copied ? "Copied!" : "Copy Code"}
              </button>
              <button
                type="button"
                className="mdash2-btn mdash2-btn--primary mdash2-btn--sm"
                style={{ background: "rgba(15,157,138,0.10)", color: "var(--md-primary)", border: "1px solid rgba(15,157,138,0.20)" }}
                onClick={() => handleShare("whatsapp")}
              >
                <span className="md__icon" style={{ fontSize: "0.9rem" }}>chat</span>
                Share
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* ──────────────── Sub-Components ──────────────── */

function StatCard2({ icon, color, bg, value, label, desc, delta, series }) {
  const trendUp = delta > 0;
  const trendDown = delta < 0;

  return (
    <div className="mdash2-stat-card">
      <div className="mdash2-stat-card__top">
        <div className="mdash2-stat-card__icon" style={{ background: bg, color }}>
          <span className="md__icon">{icon}</span>
        </div>
        {delta != null && typeof delta === "number" && (
          <span
            className={`mdash2-stat-card__trend ${
              trendUp ? "mdash2-stat-card__trend--up" : trendDown ? "mdash2-stat-card__trend--down" : "mdash2-stat-card__trend--flat"
            }`}
          >
            {trendUp ? "↑" : trendDown ? "↓" : "→"} {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="mdash2-stat-card__value">{value}</p>
      <p className="mdash2-stat-card__label">{desc || label}</p>
      {series && series.length > 0 && (
        <div className="mdash2-stat-card__chart">
          <MiniChart data={series} color={color} height={24} />
        </div>
      )}
    </div>
  );
}

function AnalyticCard2({ icon, color, bg, value, label }) {
  return (
    <div className="mdash2-analytic-card">
      <div className="mdash2-analytic-card__icon" style={{ background: bg, color }}>
        <span className="md__icon">{icon}</span>
      </div>
      <p className="mdash2-analytic-card__value">{value}</p>
      <p className="mdash2-analytic-card__label">{label}</p>
    </div>
  );
}

function QuickAction2({ icon, color, bg, title, desc, to }) {
  return (
    <Link to={to} className="mdash2-action-card">
      <div className="mdash2-action-card__icon" style={{ background: bg, color }}>
        <span className="md__icon">{icon}</span>
      </div>
      <p className="mdash2-action-card__title">{title}</p>
      <p className="mdash2-action-card__desc">{desc}</p>
    </Link>
  );
}
