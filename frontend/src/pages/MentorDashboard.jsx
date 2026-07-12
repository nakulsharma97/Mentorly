import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import "./LearnerPages.css";
import "../modules/common/dashboard/dashboard.css";

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
  if (!name) return "M";
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

/* ──────────────────── SVG sub-components ─────────────────── */

function ProgressRing({ pct, size = 72, stroke = 8 }) {
  const cx = size / 2;
  const r = cx - stroke / 2;
  const circ = 2 * Math.PI * r;
  const off = circ - (Math.min(pct, 100) / 100) * circ;
  return (
    <svg
      className="mdash-ring"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${pct}% complete`}
    >
      <defs>
        <linearGradient id="mdashRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <circle className="mdash-ring__track" cx={cx} cy={cx} r={r} strokeWidth={stroke} fill="none" />
      <circle
        className="mdash-ring__val"
        cx={cx}
        cy={cx}
        r={r}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={circ}
        strokeDashoffset={off}
        transform={`rotate(-90 ${cx} ${cx})`}
      />
      <text className="mdash-ring__text" x={cx} y={cx} textAnchor="middle" dominantBaseline="central" fontSize={size * 0.22}>
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

function MiniChart({ data = [], color = "var(--brand)", height = 28 }) {
  if (data.length < 2) return <div style={{ height }} />;
  const values = data.map((d) => d.value ?? 0);
  const max = Math.max(...values, 1);
  const w = 100 / data.length;
  return (
    <svg className="mdash-mini-chart" width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
      {values.map((v, i) => {
        const barH = (v / max) * height;
        return (
          <rect
            key={i}
            x={i * w + w * 0.15}
            y={height - barH}
            width={w * 0.7}
            height={Math.max(barH, 1)}
            rx={2}
            fill={color}
            opacity={0.6}
          />
        );
      })}
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={values
          .map((v, i) => `${i * w + w / 2},${height - (v / max) * height}`)
          .join(" ")}
        opacity={0.9}
      />
    </svg>
  );
}

function StarRating({ rating }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    const isOn = i <= Math.round(rating || 0);
    stars.push(
      <span key={i} className={`mdash-star ${isOn ? "is-on" : ""}`}>
        {isOn ? "★" : "☆"}
      </span>,
    );
  }
  return <span className="mdash-stars">{stars}</span>;
}

/* ─────────────────── main component ─────────────────────── */

export default function MentorDashboard({ profile, onLogout }) {
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

  /* ──── loading state ──── */
  if (loading) {
    return (
      <div className="mdash-shell">
        <div className="mdash-skel-hero">
          <div className="mdash-skel-block mdash-skel-block--lg" />
          <div className="mdash-skel-row">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="mdash-skel-block" />
            ))}
          </div>
        </div>
        <div className="mdash-skel-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="mdash-skel-card">
              <div className="mdash-skel-block" />
              <div className="mdash-skel-line" />
              <div className="mdash-skel-line mdash-skel-line--60" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const nextUpcomingSession = upcomingSessions[0] || null;

  /* ──── empty state ──── */
  if (!loading && sessions.length === 0 && bookings.length === 0 && reviews.length === 0) {
    return (
      <div className="mdash-shell">
        <div className="mdash-empty">
          <div className="mdash-empty__icon">
            <span className="md__icon">school</span>
          </div>
          <h2 className="mdash-empty__title">Welcome to Your Mentor Dashboard</h2>
          <p className="mdash-empty__desc">
            Start by creating your first session. Once learners start booking, you'll see your
            analytics, reviews, and student activity here.
          </p>
          <div className="mdash-empty__actions">
            <Link to="/mentor/teach" className="mdash-btn mdash-btn--primary">
              <span className="md__icon">add</span>
              Create Session
            </Link>
            <Link to="/mentor/professional-profile" className="mdash-btn mdash-btn--outline">
              <span className="md__icon">person</span>
              Complete Profile
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mdash-shell">
      {/* ──────── HERO ──────── */}
      <section className="mdash-hero">
        <div className="mdash-hero__body">
          <div className="mdash-hero__left">
            <span className="mdash-hero__eyebrow">
              <span className="mdash-hero__eyebrow-dot" />
              MENTOR DASHBOARD
            </span>
            <h1 className="mdash-hero__title">
              Welcome back, <span className="mdash-hero__title-highlight">{firstName}</span>
            </h1>
            <p className="mdash-hero__sub">
              {stats.totalStudents > 0
                ? `${stats.totalStudents} students · ${stats.totalSessions} sessions · ${formatMoney(stats.totalEarnings)} earned`
                : "Set up your sessions and start mentoring learners"}
            </p>
            <div className="mdash-hero__actions">
              <Link to="/mentor/calendar" className="mdash-btn mdash-btn--primary">
                <span className="md__icon">calendar_month</span>
                View Schedule
              </Link>
              <Link to="/mentor/teach" className="mdash-btn mdash-btn--ghost">
                <span className="md__icon">video_camera_front</span>
                Manage Sessions
              </Link>
              <Link to="/mentor/messages" className="mdash-btn mdash-btn--ghost">
                <span className="md__icon">chat</span>
                Messages
              </Link>
              <button
                className="mdash-btn mdash-btn--ghost mdash-btn--icon-only"
                onClick={loadMentorData}
                title="Refresh data"
              >
                <span className="md__icon">refresh</span>
              </button>
              <button
                className="mdash-btn mdash-btn--ghost"
                onClick={onLogout}
                title="Logout"
              >
                <span className="md__icon">logout</span>
                Logout
              </button>
            </div>
            <div className="mdash-hero__badges">
              {stats.averageRating > 0 && (
                <span className="mdash-hero__badge">
                  <span className="md__icon">star</span>
                  {stats.averageRating}
                </span>
              )}
              {stats.completedSessions > 0 && (
                <span className="mdash-hero__badge">
                  <span className="md__icon">check_circle</span>
                  {stats.completedSessions} completed
                </span>
              )}
              {stats.totalEarnings > 0 && (
                <span className="mdash-hero__badge">
                  <span className="md__icon">payments</span>
                  {formatMoney(stats.totalEarnings)}
                </span>
              )}
            </div>
          </div>
          <div className="mdash-hero__aside">
            <div className="mdash-hero-glass">
              <span className="mdash-hero-glass__label">Completion Rate</span>
              <div className="mdash-hero-glass__ring">
                <ProgressRing pct={analytics.completionRate} size={72} />
              </div>
              <span className="mdash-hero-glass__value">{analytics.completionRate}%</span>
              <span className="mdash-hero-glass__desc">of sessions completed</span>
            </div>
            <div className="mdash-hero-glass">
              <span className="mdash-hero-glass__label">Next Session</span>
              {nextUpcomingSession ? (
                <>
                  <div className="mdash-hero-glass__mentor">
                    <div className="mdash-hero-glass__mentor-avatar">
                      {initials(nextUpcomingSession?.learner?.fullName || "?")}
                    </div>
                    <div>
                      <div className="mdash-hero-glass__mentor-name">
                        {nextUpcomingSession?.learner?.fullName || "Learner"}
                      </div>
                      <div className="mdash-hero-glass__mentor-title">
                        {nextUpcomingSession?.skill?.name || nextUpcomingSession?.title || "Session"}
                      </div>
                    </div>
                  </div>
                  <div className="mdash-hero-glass__meta">
                    <span>
                      <span className="md__icon">calendar_today</span>
                      {formatDate(nextUpcomingSession.startTime)}
                    </span>
                    <span>
                      <span className="md__icon">schedule</span>
                      {formatTime(nextUpcomingSession.startTime)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="mdash-hero-glass__empty">
                  <span className="md__icon">event_busy</span>
                  <span>No upcoming sessions</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ──────── VERIFICATION BANNER ──────── */}
      {!verificationStatus?.mentorVerified && (
        <div className="mdash-verify">
          <div className="mdash-verify__icon">
            <span className="md__icon">verified_user</span>
          </div>
          <div className="mdash-verify__text">
            <strong>Verification pending</strong>
            <span>Complete mentor verification to increase trust and booking conversions.</span>
          </div>
          <Link to="/profile-setup" className="mdash-btn mdash-btn--primary mdash-btn--sm">
            Finish Profile
          </Link>
        </div>
      )}

      {/* ──────── STAT CARDS ──────── */}
      <div className="mdash-stats">
        <StatCard
          icon="groups"
          color="#3b82f6"
          value={stats.totalStudents}
          label="Total Students"
          desc="Unique learners"
          delta={analytics.monthGrowth}
          series={series.students}
        />
        <StatCard
          icon="video_camera_front"
          color="#059669"
          value={stats.totalSessions}
          label="Total Sessions"
          desc="Published sessions"
          series={series.sessions}
        />
        <StatCard
          icon="payments"
          color="#f59e0b"
          value={formatMoney(stats.monthlyEarnings)}
          label="Monthly Earnings"
          desc="vs. last month"
          delta={analytics.monthGrowth}
        />
        <StatCard
          icon="star"
          color="#8b5cf6"
          value={stats.averageRating}
          label="Average Rating"
          desc={`${stats.totalReviews} reviews`}
          series={series.rating}
        />
        <StatCard
          icon="task_alt"
          color="#0ea5e9"
          value={`${analytics.acceptanceRate}%`}
          label="Acceptance Rate"
          desc="Requests accepted"
        />
        <StatCard
          icon="check_circle"
          color="#10b981"
          value={`${analytics.completionRate}%`}
          label="Completion Rate"
          desc="Sessions completed"
        />
      </div>

      {/* ──────── PENDING REQUESTS ──────── */}
      {pendingBookings.length > 0 && (
        <section>
          <div className="mdash-section__head">
            <h2 className="mdash-section__title">
              <span className="md__icon">pending_actions</span>
              Pending Requests
              <span className="mdash-badge-pill">{pendingBookings.length}</span>
            </h2>
          </div>
          <div className="mdash-pending-grid">
            {pendingBookings.slice(0, 5).map((b) => (
              <div key={b.id || b.bookingId} className="mdash-pending-card">
                <div className="mdash-pending-card__top">
                  <div className="mdash-pending-card__avatar">
                    {initials(b?.learner?.fullName || "?")}
                  </div>
                  <div className="mdash-pending-card__info">
                    <strong>{b?.learner?.fullName || "Unknown Learner"}</strong>
                    <span>{b?.session?.skill?.name || b?.session?.title || "Session"}</span>
                  </div>
                </div>
                <div className="mdash-pending-card__meta">
                  <span>
                    <span className="md__icon">calendar_today</span>
                    {formatDate(b?.session?.startTime || b?.createdAt)}
                  </span>
                  <span>
                    <span className="md__icon">schedule</span>
                    {formatTime(b?.session?.startTime || b?.createdAt)}
                  </span>
                  {b?.payment?.amount > 0 && (
                    <span>
                      <span className="md__icon">payments</span>
                      {formatMoney(b.payment.amount)}
                    </span>
                  )}
                </div>
                <div className="mdash-pending-card__actions">
                  <button
                    className="mdash-btn mdash-btn--primary mdash-btn--sm"
                    onClick={() => handleBookingStatus(b.id || b.bookingId, "ACCEPTED")}
                  >
                    Accept
                  </button>
                  <button
                    className="mdash-btn mdash-btn--outline mdash-btn--sm"
                    onClick={() => handleBookingStatus(b.id || b.bookingId, "CANCELLED")}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ──────── SESSIONS + PERFORMANCE ──────── */}
      <div className="mdash-row">
        <div className="mdash-col-7">
          <section className="mdash-card">
            <div className="mdash-section__head">
              <h2 className="mdash-section__title">
                <span className="md__icon">upcoming</span>
                Upcoming Sessions
              </h2>
              {upcomingSessions.length > 0 && (
                <Link to="/mentor/calendar" className="mdash-section__link">
                  View All
                </Link>
              )}
            </div>
            {upcomingSessions.length > 0 ? (
              <div className="mdash-sessions-list">
                {upcomingSessions.slice(0, 4).map((s) => (
                  <div key={s.id} className="mdash-session-row">
                    <div className="mdash-session-row__avatar">
                      {initials(s?.learner?.fullName || "?")}
                    </div>
                    <div className="mdash-session-row__body">
                      <div className="mdash-session-row__top">
                        <strong>{s?.learner?.fullName || "Learner"}</strong>
                        <span className="mdash-session-row__topic">
                          {s?.skill?.name || s?.title || "Session"}
                        </span>
                      </div>
                      <div className="mdash-session-row__meta">
                        <span>
                          <span className="md__icon">calendar_today</span>
                          {formatDate(s.startTime)}
                        </span>
                        <span>
                          <span className="md__icon">schedule</span>
                          {formatTime(s.startTime)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mdash-empty--inline">
                <span className="md__icon">event_busy</span>
                <p>No upcoming sessions</p>
                <Link to="/mentor/teach" className="mdash-btn mdash-btn--primary mdash-btn--sm">
                  Create Session
                </Link>
              </div>
            )}
          </section>
        </div>
        <div className="mdash-col-5">
          <section className="mdash-card mdash-card--center">
            <div className="mdash-section__head">
              <h2 className="mdash-section__title">
                <span className="md__icon">analytics</span>
                Performance
              </h2>
            </div>
            <div className="mdash-performance">
              <ProgressRing pct={analytics.completionRate} size={96} stroke={10} />
              <div className="mdash-performance__stats">
                <div>
                  <span className="mdash-performance__val">{sessions.length}</span>
                  <span className="mdash-performance__lbl">Sessions</span>
                </div>
                <div>
                  <span className="mdash-performance__val">{bookings.length}</span>
                  <span className="mdash-performance__lbl">Bookings</span>
                </div>
                <div>
                  <span className="mdash-performance__val">{analytics.acceptanceRate}%</span>
                  <span className="mdash-performance__lbl">Acceptance</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* ──────── ANALYTICS PANEL ──────── */}
      <section className="mdash-card">
        <div className="mdash-section__head">
          <h2 className="mdash-section__title">
            <span className="md__icon">insights</span>
            Analytics Overview
          </h2>
        </div>
        <div className="mdash-analytics-grid">
          <AnalyticsChart
            title="Revenue"
            series={series.revenue}
            format={(v) => formatMoney(v)}
            color="#059669"
          />
          <AnalyticsChart
            title="Students"
            series={series.students}
            format={(v) => String(v)}
            color="#3b82f6"
          />
          <AnalyticsChart
            title="Sessions"
            series={series.sessions}
            format={(v) => String(v)}
            color="#f59e0b"
          />
          <AnalyticsChart
            title="Rating"
            series={series.rating}
            format={(v) => String(v.toFixed(1))}
            color="#8b5cf6"
          />
        </div>
      </section>

      {/* ──────── STUDENTS + REVIEWS ──────── */}
      <div className="mdash-row">
        <div className="mdash-col-6">
          <section className="mdash-card">
            <div className="mdash-section__head">
              <h2 className="mdash-section__title">
                <span className="md__icon">groups</span>
                Recent Students
              </h2>
              {recentStudents.length > 0 && (
                <Link to="/mentor/students" className="mdash-section__link">
                  View All
                </Link>
              )}
            </div>
            {recentStudents.length > 0 ? (
              <div className="mdash-students-list">
                {recentStudents.slice(0, 4).map((s) => (
                  <div key={s.id} className="mdash-student-row">
                    <div className="mdash-student-row__avatar">
                      {initials(s.name)}
                    </div>
                    <div className="mdash-student-row__body">
                      <strong>{s.name}</strong>
                      {s.skill && <span className="mdash-student-row__skill">{s.skill}</span>}
                    </div>
                    <div className="mdash-student-row__progress">
                      <div className="mdash-progress-bar">
                        <div
                          className="mdash-progress-bar__fill"
                          style={{ width: `${s.progress}%` }}
                        />
                      </div>
                      <span className="mdash-student-row__pct">{s.progress}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mdash-empty--inline">
                <span className="md__icon">group_off</span>
                <p>No students yet</p>
              </div>
            )}
          </section>
        </div>
        <div className="mdash-col-6">
          <section className="mdash-card">
            <div className="mdash-section__head">
              <h2 className="mdash-section__title">
                <span className="md__icon">star_rate</span>
                Recent Reviews
              </h2>
              {reviews.length > 0 && (
                <Link to="/mentor/reviews" className="mdash-section__link">
                  View All
                </Link>
              )}
            </div>
            {reviews.length > 0 ? (
              <div className="mdash-reviews-list">
                {reviews.slice(0, 3).map((r) => (
                  <div key={r.id} className="mdash-review-row">
                    <div className="mdash-review-row__head">
                      <div className="mdash-review-row__avatar">
                        {initials(r?.learner?.fullName || "?")}
                      </div>
                      <div className="mdash-review-row__info">
                        <strong>{r?.learner?.fullName || "Anonymous"}</strong>
                        <span className="mdash-review-row__date">{formatDate(r.createdAt)}</span>
                      </div>
                      <div className="mdash-review-row__rating">
                        <StarRating rating={r.rating} />
                        <span>{r.rating}</span>
                      </div>
                    </div>
                    {r?.comment && <p className="mdash-review-row__comment">{r.comment}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mdash-empty--inline">
                <span className="md__icon">rate_review</span>
                <p>No reviews yet</p>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ──────── QUICK ACTIONS ──────── */}
      <section>
        <div className="mdash-section__head">
          <h2 className="mdash-section__title">
            <span className="md__icon">bolt</span>
            Quick Actions
          </h2>
        </div>
        <div className="mdash-actions-grid">
          <QuickActionCard
            icon="video_camera_front"
            color="#059669"
            title="Create Session"
            desc="Schedule a new mentoring session"
            to="/mentor/teach"
          />
          <QuickActionCard
            icon="groups"
            color="#3b82f6"
            title="View Students"
            desc="Browse your learner roster"
            to="/mentor/students"
          />
          <QuickActionCard
            icon="calendar_month"
            color="#8b5cf6"
            title="Manage Calendar"
            desc="Set your availability"
            to="/mentor/calendar"
          />
          <QuickActionCard
            icon="insights"
            color="#f59e0b"
            title="View Analytics"
            desc="Deep dive into your metrics"
            to="/mentor/analytics"
          />
          <QuickActionCard
            icon="payments"
            color="#10b981"
            title="Earnings"
            desc="Check your payouts"
            to="/mentor/wallet"
          />
          <QuickActionCard
            icon="star_rate"
            color="#ec4899"
            title="Reviews"
            desc="See what learners say"
            to="/mentor/reviews"
          />
        </div>
      </section>

      {/* ──────── PREMIUM REFERRAL SECTION ──────── */}
      {referral && (
        <section>
          <div className="ld-referral-hero">
            <div className="ld-referral-hero__bg" />
            <div className="ld-referral-hero__content">
              <div className="ld-referral-hero__header">
                <div className="ld-referral-hero__title-group">
                  <span className="ld-referral-hero__eyebrow">
                    <Icon name="share" /> Referral Rewards
                  </span>
                  <h2 className="ld-referral-hero__title">
                    Invite Learners, Earn Credits
                  </h2>
                  <p className="ld-referral-hero__subtitle">
                    Share your unique referral link and earn <strong>50 credits</strong> for every friend who signs up and completes their first booking.
                  </p>
                </div>
                <div className="ld-referral-hero__stats">
                  <div className="ld-referral-hero__stat">
                    <span className="ld-referral-hero__stat-value">{totalReferrals}</span>
                    <span className="ld-referral-hero__stat-label">
                      <Icon name="group" /> Friends Referred
                    </span>
                  </div>
                  <div className="ld-referral-hero__stat ld-referral-hero__stat--highlight">
                    <span className="ld-referral-hero__stat-value">{totalCredits}</span>
                    <span className="ld-referral-hero__stat-label">
                      <Icon name="payments" /> Credits Earned
                    </span>
                  </div>
                  <div className="ld-referral-hero__stat">
                    <span className="ld-referral-hero__stat-value">{currentTier?.label || "Beginner"}</span>
                    <span className="ld-referral-hero__stat-label">
                      <Icon name="emoji_events" /> Current Tier
                    </span>
                  </div>
                </div>
              </div>

              {/* Rewards Progress */}
              <div className="ld-referral-progress">
                <div className="ld-referral-progress__header">
                  <span className="ld-referral-progress__title">
                    <Icon name="trending_up" /> Rewards Progress
                  </span>
                  {nextTier ? (
                    <span className="ld-referral-progress__next">
                      {nextTierReferralsNeeded} more referral{nextTierReferralsNeeded !== 1 ? "s" : ""} to reach <strong>{nextTier.label}</strong>
                    </span>
                  ) : (
                    <span className="ld-referral-progress__next ld-referral-progress__next--done">
                      <Icon name="check_circle" /> Maximum tier reached!
                    </span>
                  )}
                </div>
                <div className="ld-referral-progress__tiers">
                  {REWARD_TIERS.map((tier, idx) => {
                    const isUnlocked = totalReferrals >= tier.referrals;
                    const isCurrent = !isUnlocked && idx > 0 && totalReferrals < tier.referrals &&
                      (idx === 0 || totalReferrals >= REWARD_TIERS[idx - 1].referrals);
                    return (
                      <div
                        key={tier.referrals}
                        className={`ld-referral-tier${isUnlocked ? " is-unlocked" : ""}${isCurrent ? " is-current" : ""}`}
                      >
                        <div className="ld-referral-tier__icon">
                          <Icon name={tier.icon} />
                        </div>
                        <div className="ld-referral-tier__info">
                          <span className="ld-referral-tier__name">{tier.label}</span>
                          <span className="ld-referral-tier__req">{tier.referrals} referrals</span>
                        </div>
                        <span className="ld-referral-tier__reward">{tier.credits} cr</span>
                      </div>
                    );
                  })}
                </div>
                <div className="ld-referral-progress__bar">
                  <div className="ld-referral-progress__track">
                    <div
                      className="ld-referral-progress__fill"
                      style={{ width: `${Math.min(100, progressToNext)}%` }}
                    />
                  </div>
                  <span className="ld-referral-progress__pct">
                    {totalReferrals} / {nextTier?.referrals || totalReferrals} referrals
                  </span>
                </div>
              </div>

              {/* Referral Code & Share */}
              <div className="ld-referral-share">
                <div className="ld-referral-share__code-section">
                  <span className="ld-referral-share__label">Your Referral Code</span>
                  <div className="ld-referral-share__code-box">
                    <span className="ld-referral-share__code">{referral.referralCode}</span>
                    <button
                      type="button"
                      className={"ld-referral-share__copy-btn" + (copied ? " is-copied" : "")}
                      onClick={handleCopyLink}
                      aria-label={copied ? "Copied" : "Copy referral code"}
                    >
                      <Icon name={copied ? "check" : "content_copy"} />
                      <span>{copied ? "Copied!" : "Copy Code"}</span>
                    </button>
                  </div>
                </div>
                <div className="ld-referral-share__actions">
                  <span className="ld-referral-share__label">Share Via</span>
                  <div className="ld-referral-share__buttons">
                    <button
                      type="button"
                      className="ld-referral-share__btn ld-referral-share__btn--copy"
                      onClick={handleCopyLink}
                      aria-label="Copy referral link"
                    >
                      <Icon name={copied ? "check" : "link"} />
                      <span>{copied ? "Copied" : "Copy Link"}</span>
                    </button>
                    <button
                      type="button"
                      className="ld-referral-share__btn ld-referral-share__btn--whatsapp"
                      onClick={() => handleShare("whatsapp")}
                      aria-label="Share on WhatsApp"
                    >
                      <Icon name="chat" />
                      <span>WhatsApp</span>
                    </button>
                    <button
                      type="button"
                      className="ld-referral-share__btn ld-referral-share__btn--twitter"
                      onClick={() => handleShare("twitter")}
                      aria-label="Share on Twitter"
                    >
                      <Icon name="alternate_email" />
                      <span>Twitter</span>
                    </button>
                    <button
                      type="button"
                      className="ld-referral-share__btn ld-referral-share__btn--gmail"
                      onClick={() => handleShare("gmail")}
                      aria-label="Compose in Gmail"
                    >
                      <Icon name="mail" />
                      <span>Gmail</span>
                    </button>
                    <button
                      type="button"
                      className="ld-referral-share__btn ld-referral-share__btn--email"
                      onClick={() => handleShare("email")}
                      aria-label="Share via Email"
                    >
                      <Icon name="alternate_email" />
                      <span>Email</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

/* ──────────────── sub-components ──────────────── */

function StatCard({ icon, color, value, label, desc, delta, series }) {
  return (
    <div className="mdash-stat-card">
      <div className="mdash-stat-card__top">
        <div className="mdash-stat-card__icon" style={{ background: `${color}18`, color }}>
          <span className="md__icon">{icon}</span>
        </div>
        {delta !== undefined && (
          <span className={`mdash-stat-card__delta ${delta >= 0 ? "mdash-stat-card__delta--pos" : "mdash-stat-card__delta--neg"}`}>
            {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}%
          </span>
        )}
      </div>
      {series && series.length > 0 && (
        <MiniChart data={series} color={color} height={24} />
      )}
      <span className="mdash-stat-card__value">{value}</span>
      <span className="mdash-stat-card__label">{label}</span>
      <span className="mdash-stat-card__desc">{desc}</span>
    </div>
  );
}

function AnalyticsChart({ title, series = [], format, color }) {
  if (series.length === 0) return <div className="mdash-analytics-chart"><h4>{title}</h4><p className="mdash-analytics-chart__empty">No data</p></div>;
  const values = series.map((m) => m.value ?? 0);
  const max = Math.max(...values, 1);
  return (
    <div className="mdash-analytics-chart">
      <h4>{title}</h4>
      <div className="mdash-analytics-chart__value">{format(Math.max(...values))}</div>
      <div className="mdash-analytics-chart__bars">
        {series.map((m, i) => {
          const h = (m.value / max) * 100;
          return (
            <div key={m.key} className="mdash-analytics-chart__col" title={`${m.label}: ${format(m.value)}`}>
              <div className="mdash-analytics-chart__bar-wrap">
                <div
                  className="mdash-analytics-chart__bar"
                  style={{ height: `${Math.max(h, 4)}%`, background: color }}
                />
              </div>
              <span className="mdash-analytics-chart__label">{m.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuickActionCard({ icon, color, title, desc, to }) {
  return (
    <Link to={to} className="mdash-action-card">
      <div className="mdash-action-card__icon" style={{ background: `${color}15`, color }}>
        <span className="md__icon">{icon}</span>
      </div>
      <div className="mdash-action-card__body">
        <strong>{title}</strong>
        <span>{desc}</span>
      </div>
      <span className="mdash-action-card__arrow">
        <span className="md__icon">chevron_right</span>
      </span>
    </Link>
  );
}
