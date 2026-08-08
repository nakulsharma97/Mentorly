import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import client from "../api/client";
import HeroSection from "../components/HeroSection";
import SsIcon from "../components/ui/SsIcon";
import "./LearnerDashboard.css";

/* ==========================================================================
   Helpers (self-contained)
   ========================================================================== */

const dayKey = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const monthKey = (d) => {
  const date = d ? new Date(d) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

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

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function computeStreak(daySet) {
  if (!daySet.size) return 0;
  const days = [...daySet].sort().reverse();
  let streak = 1;
  let prev = new Date(days[0]);
  for (let i = 1; i < days.length; i += 1) {
    const cur = new Date(days[i]);
    const diff = Math.round((prev - cur) / 86400000);
    if (diff === 1) { streak += 1; prev = cur; }
    else if (diff === 0) { /* ignore duplicate */ }
    else break;
  }
  return streak;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit" }).format(date);
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "\u2014";
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
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

/* ==========================================================================
   Progress Ring
   ========================================================================== */

function ProgressRing({ value, size = 80, stroke = 6 }) {
  const pct = Math.round(Math.min(100, Math.max(0, Number(value || 0))));
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <svg className="ld-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${pct}% complete`}>
      <defs>
        <linearGradient id="ldRingGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f766e" />
          <stop offset="100%" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      <circle className="ld-ring__track" cx={cx} cy={cx} r={r} strokeWidth={stroke} fill="none" />
      <circle
        className="ld-ring__val"
        cx={cx} cy={cx} r={r}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${cx} ${cx})`}
      />
      <text className="ld-ring__text" x={cx} y={cx} textAnchor="middle" dominantBaseline="central" fontSize={size * 0.18}>
        {pct}%
      </text>
    </svg>
  );
}

/* ==========================================================================
   Mini Bar Chart
   ========================================================================== */

function MiniChart({ data, height = 32, color = "#0f766e" }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value || 0), 1);
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${data.length * 20} ${height}`} style={{ display: "block" }}>
      {data.map((d, i) => {
        const barH = Math.max((d.value / max) * height, 2);
        return (
          <rect key={i} x={i * 20 + 2} y={height - barH} width={14} height={barH} rx={3} fill={color} opacity={0.6 + (d.value / max) * 0.4} />
        );
      })}
    </svg>
  );
}

/* ==========================================================================
   Stat Card with Mini Chart
   ========================================================================== */

function LearnerStatCard({ icon, iconBg, iconColor, value, label, desc, trend, trendLabel, chartData, chartColor }) {
  const trendClass = trend > 0 ? "ld-stat-card__trend--pos" : "";
  const trendIcon = trend > 0 ? "trending-up" : "minus";
  return (
    <div className="ld-stat-card">
      <div className="ld-stat-card__header">
        <div className="ld-stat-card__icon" style={{ background: iconBg || "rgba(15,157,138,0.1)", color: iconColor || "#0F9D8A" }}>
          <SsIcon name={icon} size={22} />
        </div>
        {trend !== undefined && (
          <span className={`ld-stat-card__trend ${trendClass}`}>
            <SsIcon name={trendIcon} size={12} />
            {trendLabel || `+${Math.abs(trend)}`}
          </span>
        )}
      </div>
      <p className="ld-stat-card__value">{value}</p>
      <p className="ld-stat-card__label">{label}</p>
      {desc && <p className="ld-stat-card__desc">{desc}</p>}
      {chartData && (
        <div className="ld-stat-card__chart">
          <MiniChart data={chartData} color={chartColor || iconColor || "#0F9D8A"} />
        </div>
      )}
    </div>
  );
}

/* ==========================================================================
   Main Component
   ========================================================================== */

export default function LearnerDashboard({ profile }) {
  const firstName =
    String(profile?.fullName || "Learner").trim().split(" ")[0] || "Learner";

  useEffect(() => {
    document.title = `${firstName} \u00b7 Learner Dashboard | SkillSwap`;
  }, [firstName]);

  const [loading, setLoading] = useState(true);
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [roadmaps, setRoadmaps] = useState([]);
  const [certifications, setCertifications] = useState([]);
  const [recommendedMentors, setRecommendedMentors] = useState([]);
  const [streak, setStreak] = useState(0);
  const [roadmapCompletion, setRoadmapCompletion] = useState(0);
  const [referral, setReferral] = useState(null);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef(null);
  const [series, setSeries] = useState({ weekly: [], monthly: [], hours: [] });
  const [stats, setStats] = useState({
    totalBookings: 0,
    completedSessions: 0,
    learningHours: 0,
    skillsLearning: 0,
  });

  useEffect(() => {
    loadLearnerData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadLearnerData = async () => {
    try {
      setLoading(true);
      await client.post("/api/v1/certifications/evaluate").catch(() => null);
      const [bookingsRes, roadmapsRes, watchlistRes, certificationsRes, mentorsRes, referralRes] =
        await Promise.all([
          client.get("/api/v1/bookings"),
          client.get("/api/v1/roadmaps"),
          client.get("/api/v1/watchlist/skills"),
          client.get("/api/v1/certifications/me").catch(() => ({ data: { data: [] } })),
          client.get("/api/v1/users/mentors").catch(() => ({ data: { data: [] } })),
          client.get("/api/v1/users/me/referral").catch(() => ({ data: { data: null } })),
        ]);

      const allBookings = bookingsRes.data.data || [];
      const allRoadmaps = roadmapsRes.data.data || [];
      const watchlist = watchlistRes.data.data || [];

      const sortedUpcoming = allBookings
        .filter((b) => {
          const start = b?.session?.startTime;
          return start && new Date(start) > new Date();
        })
        .sort(
          (a, b) =>
            new Date(a?.session?.startTime || 0).getTime() -
            new Date(b?.session?.startTime || 0).getTime(),
        );

      const completedBookings = allBookings.filter(
        (b) => (b.bookingStatus || b.status) === "COMPLETED",
      );

      const roadmapPct = allRoadmaps.length
        ? Math.round(
            allRoadmaps.reduce((s, r) => s + Number(r.progressPercent || 0), 0) /
              allRoadmaps.length,
          )
        : 0;

      const uniqueSkills = new Set(
        completedBookings.map((b) => b?.session?.skill?.name).filter(Boolean),
      );
      const activeDays = new Set(
        completedBookings.map((b) => dayKey(b?.session?.startTime)).filter(Boolean),
      );

      // Weekly progress
      const weekly = [];
      for (let k = 7; k >= 0; k -= 1) weekly.push({ label: k === 0 ? "Now" : `${k}w`, value: 0 });
      const now = new Date();
      completedBookings.forEach((b) => {
        const t = b?.session?.startTime ? new Date(b.session.startTime).getTime() : NaN;
        if (Number.isNaN(t)) return;
        const weeksAgo = Math.floor((now.getTime() - t) / (7 * 86400000));
        if (weeksAgo >= 0 && weeksAgo <= 7) weekly[7 - weeksAgo].value += 1;
      });

      const monthly = buildMonthBuckets();
      const hours = buildMonthBuckets();
      completedBookings.forEach((b) => {
        const key = monthKey(b?.session?.startTime);
        const mBucket = monthly.find((m) => m.key === key);
        if (mBucket) mBucket.value += 1;
        const hBucket = hours.find((m) => m.key === key);
        if (hBucket) hBucket.value += 1.5;
      });
      hours.forEach((m) => { m.value = Number(m.value.toFixed(1)); });

      // Referral data
      const referralData = referralRes?.data?.data || null;
      setReferral(referralData);

      // Recommended mentors
      const mentors = mentorsRes.data.data || [];
      const ranked = [...mentors]
        .sort((a, b) => Number(b.averageRating || b.rating || 0) - Number(a.averageRating || a.rating || 0))
        .slice(0, 6);

      setUpcomingSessions(sortedUpcoming);
      setRoadmaps(allRoadmaps);
      setCertifications(certificationsRes.data.data || []);
      setRecommendedMentors(ranked);
      setStreak(computeStreak(activeDays));
      setRoadmapCompletion(roadmapPct);
      setSeries({ weekly, monthly, hours });
      setStats({
        totalBookings: allBookings.length,
        completedSessions: completedBookings.length,
        learningHours: Math.round(allBookings.length * 1.5 * 10) / 10,
        skillsLearning: watchlist.length || uniqueSkills.size,
      });
    } catch (error) {
      // silently handle data load failures; UI shows empty sections
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="ss-page" role="status" aria-label="Loading dashboard...">
        <div className="ss-skeleton ss-skeleton--hero" />
        <div className="ss-stats-grid">
          {[1, 2, 3, 4, 5].map((k) => <div key={k} className="ss-skeleton ss-skeleton--card" />)}
        </div>
        <div className="ss-grid-2">
          <div className="ss-skeleton ss-skeleton--card" style={{ height: 280 }} />
          <div className="ss-skeleton ss-skeleton--card" style={{ height: 280 }} />
        </div>
      </div>
    );
  }

  const referralLink = referral
    ? `https://skillswap.app/signup?ref=${referral.referralCode}`
    : '';

  const handleCopyLink = async () => {
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    try {
      await navigator.clipboard.writeText(referralLink);
    } catch {
      // Fallback for environments without clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = referralLink;
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
    const url = encodeURIComponent(referralLink);

    if (platform === "email" || platform === "gmail") {
      const subject = encodeURIComponent(`${profileName} has invited you to join SkillSwap!`);
      const body = encodeURIComponent(
        `Hi there,\n\n` +
        `${profileName} has been learning on SkillSwap and wanted to share it with you!\n\n` +
        `SkillSwap connects learners with expert mentors for 1-on-1 sessions across 100+ skills like programming, design, data science, and more.\n\n` +
        `Join using ${profileName}'s personal referral link below and get started on your learning journey:\n` +
        `${referralLink}\n\n` +
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

  const nextSession = upcomingSessions[0] || null;
  const currentCourses = roadmaps.filter((r) => Number(r.progressPercent || 0) < 100).slice(0, 6);

  // Rewards tiers for referral progress (values in Indian Rupees)
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

  return (
    <div className="ss-page ld-page">

      {/* ═══════════════════ HERO SECTION — Unified Design System ═══════════════════ */}
      <HeroSection
        badge={
          <>
            <SsIcon name="sparkles" size={14} />
            Learner Dashboard
          </>
        }
        title={
          <>
            {getGreeting()}, {firstName}
          </>
        }
        subtitle={
          <>
            Track your progress, join upcoming sessions, and continue learning.
            {stats.completedSessions > 0 || streak > 0
              ? ` You have ${stats.completedSessions} completed session${stats.completedSessions !== 1 ? 's' : ''}${streak > 0 ? ` and a ${streak}-day streak` : ''}.`
              : ` Start by booking your first session with a mentor.`
            }
          </>
        }
        secondaryButton={
          <Link
            to="/learner/mentors"
            className="hero-section__btn hero-section__btn--secondary"
          >
            <SsIcon name="person_search" size={18} />
            Find Mentors
          </Link>
        }
        primaryButton={
          nextSession?.session?.meetingLink ? (
            <a
              href={nextSession.session.meetingLink}
              target="_blank"
              rel="noreferrer"
              className="hero-section__btn hero-section__btn--primary"
            >
              <SsIcon name="videocam" size={18} />
              Join Next Session
            </a>
          ) : undefined
        }
        floatingCards={
          <div className="ld-hero-glass-cards">
            <div className="ld-hero-glass">
              <p className="ld-hero-glass__label">
                <SsIcon name="trending_up" size={14} /> Roadmap Progress
              </p>
              <div className="ld-hero-glass__ring">
                <ProgressRing value={roadmapCompletion} size={80} stroke={7} />
              </div>
              <p className="ld-hero-glass__value" style={{ textAlign: "center" }}>{roadmapCompletion}%</p>
              <p className="ld-hero-glass__desc" style={{ textAlign: "center" }}>Overall learning completion</p>
            </div>
            {nextSession && (
              <div className="ld-hero-glass">
                <p className="ld-hero-glass__label">
                  <SsIcon name="event" size={14} /> Next Session
                </p>
                <p className="ld-hero-glass__value ld-hero-glass__value--sm">
                  {nextSession?.session?.title || "Session"}
                </p>
                <p className="ld-hero-glass__desc">
                  {formatDate(nextSession?.session?.startTime)} at {formatTime(nextSession?.session?.startTime)}
                </p>
                <p className="ld-hero-glass__desc" style={{ fontWeight: 600 }}>
                  with {nextSession?.session?.mentor?.fullName || "Mentor"}
                </p>
              </div>
            )}
          </div>
        }
      >
        <Link
          to="/learner/messages"
          className="hero-section__btn hero-section__btn--ghost"
        >
          <SsIcon name="chat" size={18} />
          Messages
        </Link>
        <button
          type="button"
          className="hero-section__btn hero-section__btn--ghost"
          onClick={loadLearnerData}
          title="Refresh data"
          aria-label="Refresh data"
        >
          <SsIcon name="refresh" size={20} />
        </button>

        {/* Quick stats strip inside hero */}
        <div className="hero-section__stats-strip">
          <div className="hero-section__stats-item">
            <span className="hero-section__stats-item__label">Streak</span>
            <span
              className="hero-section__stats-item__value"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <SsIcon name="local_fire_department" size={18} /> {streak}d
            </span>
          </div>
          <div className="hero-section__stats-divider" />
          <div className="hero-section__stats-item">
            <span className="hero-section__stats-item__label">Certificates</span>
            <span
              className="hero-section__stats-item__value"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <SsIcon name="workspace_premium" size={18} /> {certifications.length}
            </span>
          </div>
          <div className="hero-section__stats-divider" />
          <div className="hero-section__stats-item">
            <span className="hero-section__stats-item__label">Hours Learned</span>
            <span
              className="hero-section__stats-item__value"
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <SsIcon name="schedule" size={18} /> {stats.learningHours}h
            </span>
          </div>
        </div>
      </HeroSection>

      {/* ═══════════════════ REFERRAL SECTION ═══════════════════ */}
      {referral && (
        <div className="ld-referral-hero">
          <div className="ld-referral-hero__bg" />
          <div className="ld-referral-hero__content">
            <div className="ld-referral-hero__header">
              <div className="ld-referral-hero__title-group">
                <span className="ld-referral-hero__eyebrow">
                  <SsIcon name="share" size={14} /> Referral Rewards
                </span>
                <h2 className="ld-referral-hero__title">
                  Invite Friends, Earn ₹
                </h2>
                <p className="ld-referral-hero__subtitle">
                  Share your unique referral link and earn <strong>₹50</strong> for every friend who completes their first booking.
                </p>
              </div>
              <div className="ld-referral-hero__stats">
                <div className="ld-referral-hero__stat">
                  <span className="ld-referral-hero__stat-value">{totalReferrals}</span>
                  <span className="ld-referral-hero__stat-label">
                    <SsIcon name="group" size={14} /> Friends Referred
                  </span>
                </div>
                <div className="ld-referral-hero__stat ld-referral-hero__stat--highlight">
                  <span className="ld-referral-hero__stat-value">₹{Number(totalCredits || 0).toLocaleString("en-IN")}</span>
                  <span className="ld-referral-hero__stat-label">
                    <SsIcon name="payments" size={14} /> Earnings (₹)
                  </span>
                </div>
                <div className="ld-referral-hero__stat">
                  <span className="ld-referral-hero__stat-value">{currentTier?.label || "Beginner"}</span>
                  <span className="ld-referral-hero__stat-label">
                    <SsIcon name="emoji_events" size={14} /> Current Tier
                  </span>
                </div>
              </div>
            </div>

            {/* Rewards Progress */}
            <div className="ld-referral-progress">
              <div className="ld-referral-progress__header">
                <span className="ld-referral-progress__title">
                  <SsIcon name="trending_up" size={14} /> Rewards Progress
                </span>
                {nextTier ? (
                  <span className="ld-referral-progress__next">
                    {nextTierReferralsNeeded} more referral{nextTierReferralsNeeded !== 1 ? "s" : ""} to reach <strong>{nextTier.label}</strong>
                  </span>
                ) : (
                  <span className="ld-referral-progress__next ld-referral-progress__next--done">
                    <SsIcon name="check_circle" size={14} /> Maximum tier reached!
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
                        <SsIcon name={tier.icon} size={18} />
                      </div>
                      <div className="ld-referral-tier__info">
                        <span className="ld-referral-tier__name">{tier.label}</span>
                        <span className="ld-referral-tier__req">{tier.referrals} referrals</span>
                      </div>
                      <span className="ld-referral-tier__reward">₹{tier.credits}</span>
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
                    <SsIcon name={copied ? "check" : "content_copy"} size={16} />
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
                    <SsIcon name={copied ? "check" : "link"} size={16} />
                    <span>{copied ? "Copied" : "Copy Link"}</span>
                  </button>
                  <button
                    type="button"
                    className="ld-referral-share__btn ld-referral-share__btn--whatsapp"
                    onClick={() => handleShare("whatsapp")}
                    aria-label="Share on WhatsApp"
                  >
                    <SsIcon name="chat" size={16} />
                    <span>WhatsApp</span>
                  </button>
                  <button
                    type="button"
                    className="ld-referral-share__btn ld-referral-share__btn--twitter"
                    onClick={() => handleShare("twitter")}
                    aria-label="Share on Twitter"
                  >
                    <SsIcon name="alternate_email" size={16} />
                    <span>Twitter</span>
                  </button>
                  <button
                    type="button"
                    className="ld-referral-share__btn ld-referral-share__btn--gmail"
                    onClick={() => handleShare("gmail")}
                    aria-label="Compose in Gmail"
                  >
                    <SsIcon name="mail" size={16} />
                    <span>Gmail</span>
                  </button>
                  <button
                    type="button"
                    className="ld-referral-share__btn ld-referral-share__btn--email"
                    onClick={() => handleShare("email")}
                    aria-label="Share via Email"
                  >
                    <SsIcon name="alternate_email" size={16} />
                    <span>Email</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ STAT CARDS — Custom with Mini Charts ═══════════════════ */}
      <section>
        <div className="ss-stats-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          <LearnerStatCard
            icon="task_alt"
            iconBg="rgba(5,150,105,0.1)"
            iconColor="#059669"
            value={stats.completedSessions}
            label="Sessions Done"
            desc="Keep it going"
            trend={stats.completedSessions}
            trendLabel={`+${stats.completedSessions}`}
            chartData={series.monthly}
            chartColor="#059669"
          />
          <LearnerStatCard
            icon="school"
            iconBg="rgba(59,130,246,0.1)"
            iconColor="#3b82f6"
            value={stats.skillsLearning}
            label="Skills Learning"
            desc="On your watchlist"
            trend={stats.skillsLearning}
            trendLabel={`+${stats.skillsLearning}`}
            chartData={series.monthly}
            chartColor="#3b82f6"
          />
          <LearnerStatCard
            icon="workspace_premium"
            iconBg="rgba(124,58,237,0.1)"
            iconColor="#7c3aed"
            value={certifications.length}
            label="Certificates"
            desc="Earned so far"
            trend={certifications.length}
            trendLabel={`+${certifications.length}`}
            chartData={series.monthly}
            chartColor="#7c3aed"
          />
          <LearnerStatCard
            icon="local_fire_department"
            iconBg="rgba(245,158,11,0.1)"
            iconColor="#f59e0b"
            value={`${streak}d`}
            label="Learning Streak"
            desc="Consecutive days"
            trend={streak}
            trendLabel={`+${streak}d`}
            chartData={series.weekly}
            chartColor="#f59e0b"
          />
          <LearnerStatCard
            icon="schedule"
            iconBg="rgba(16,185,129,0.1)"
            iconColor="#10b981"
            value={`${stats.learningHours}h`}
            label="Hours Learned"
            desc="Total time invested"
            trend={stats.learningHours}
            trendLabel={`+${stats.learningHours}h`}
            chartData={series.hours}
            chartColor="#10b981"
          />
        </div>
      </section>

      {/* ═══════════════════ CONTINUE LEARNING ═══════════════════ */}
      {currentCourses.length > 0 && (
        <section>
          <div className="ss-card">
            <div className="ss-card__header">
              <h3 className="ss-card__title">
                <SsIcon name="play_circle" size={20} /> Continue Learning
              </h3>
              <Link to="/learner/learning" className="ss-btn ss-btn--ghost ss-btn--sm">
                View All <SsIcon name="arrow_forward" size={16} />
              </Link>
            </div>
            <div className="ld-courses-scroll">
              {currentCourses.map((course, idx) => {
                const pct = Math.round(Number(course.progressPercent || 0));
                return (
                  <article key={course.id || idx} className="ld-course-card">
                    <div className="ld-course-card__thumb" style={{ background: `linear-gradient(135deg,#0f766e,#14b8a6)` }}>
                      <SsIcon name={course.category === "Frontend" ? "web" : "code"} size={32} />
                      <span className="ld-course-card__pct">{pct}%</span>
                    </div>
                    <div className="ld-course-card__body">
                      <h4 className="ld-course-card__title">{course.title || "Learning roadmap"}</h4>
                      <p className="ld-course-card__mentor">
                        <SsIcon name="person" size={14} /> {course.mentorName || course.mentor?.fullName || "Self-paced"}
                      </p>
                      <div className="ld-course-card__track">
                        <div className="ld-course-card__fill" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="ld-course-card__foot">
                        <span className="ld-course-card__pct-label">{pct}% complete</span>
                        <Link to="/learner/learning" className="ss-btn ss-btn--primary ss-btn--sm">
                          <SsIcon name="play_arrow" size={16} /> Resume
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════ ROW 1: Upcoming Sessions + Learning Progress ═══════════════════ */}
      <div className="ss-grid-sidebar">
        {/* Upcoming Sessions */}
        <div className="ss-card">
          <div className="ss-card__header">
            <h3 className="ss-card__title">
              <SsIcon name="event" size={20} /> Upcoming Sessions
            </h3>
            <Link to="/learner/sessions" className="ss-btn ss-btn--ghost ss-btn--sm">
              View All <SsIcon name="arrow_forward" size={16} />
            </Link>
          </div>
          {upcomingSessions.length > 0 ? (
            <div className="ld-sessions-list">
              {upcomingSessions.slice(0, 5).map((booking) => {
                const session = booking?.session || {};
                const mentor = session?.mentor || {};
                return (
                  <div key={booking.id} className="ld-session-row">
                    <div className="ld-session-row__date">
                      <span className="ld-session-row__day">{new Date(session.startTime || 0).getDate()}</span>
                      <span className="ld-session-row__mon">
                        {new Date(session.startTime || 0).toLocaleString(undefined, { month: "short" })}
                      </span>
                    </div>
                    <div className="ld-session-row__main">
                      <p className="ld-session-row__title">{session.title || "Upcoming Session"}</p>
                      <p className="ld-session-row__meta">
                        <SsIcon name="person" size={14} /> {mentor.fullName || "Mentor"}
                        <SsIcon name="schedule" size={14} /> {formatTime(session.startTime)}
                        <SsIcon name="timelapse" size={14} /> {Math.max(0, Math.round((new Date(session.endTime || 0) - new Date(session.startTime || 0)) / 60000))} min
                      </p>
                    </div>
                    <div className="ld-session-row__actions">
                      {session.meetingLink && (
                        <a href={session.meetingLink} target="_blank" rel="noreferrer" className="ss-btn ss-btn--primary ss-btn--sm">
                          <SsIcon name="videocam" size={16} /> Join
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="ss-empty" style={{ padding: "32px 20px" }}>
              <div className="ss-empty__icon">
                <SsIcon name="event_busy" size={36} />
              </div>
              <h3 className="ss-empty__title">No upcoming sessions</h3>
              <p className="ss-empty__desc">Book a session with a mentor to get started.</p>
              <div className="ss-empty__actions">
                <Link to="/learner/mentors" className="ss-btn ss-btn--primary ss-btn--sm">
                  Find Mentors
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Learning Progress */}
        <div className="ss-card">
          <div className="ss-card__header">
            <h3 className="ss-card__title">
              <SsIcon name="insights" size={20} /> Learning Progress
            </h3>
          </div>
          <div className="ld-progress-chart">
            <div className="ld-chart-bars">
              {series.monthly.slice(-6).map((m) => {
                const maxVal = Math.max(...series.monthly.map((x) => x.value), 1);
                const h = Math.max((m.value / maxVal) * 120, m.value > 0 ? 8 : 0);
                return (
                  <div key={m.key} className="ld-chart-col">
                    <span className="ld-chart-val">{m.value}</span>
                    <div className="ld-chart-bar-wrap">
                      <div className="ld-chart-bar" style={{ height: `${h}px` }} />
                    </div>
                    <span className="ld-chart-label">{m.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="ld-progress-stats">
              <div className="ld-progress-stat">
                <span className="ld-progress-stat__val">{stats.completedSessions}</span>
                <span className="ld-progress-stat__lbl">Sessions</span>
              </div>
              <div className="ld-progress-stat">
                <span className="ld-progress-stat__val">{stats.learningHours}h</span>
                <span className="ld-progress-stat__lbl">Hours</span>
              </div>
              <div className="ld-progress-stat">
                <span className="ld-progress-stat__val">{roadmapCompletion}%</span>
                <span className="ld-progress-stat__lbl">Complete</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════ ROW 2: Top Mentors + Achievements ═══════════════════ */}
      <div className="ss-grid-sidebar">
        {/* Top Mentors */}
        <div className="ss-card">
          <div className="ss-card__header">
            <h3 className="ss-card__title">
              <SsIcon name="recommend" size={20} /> Top Mentors
            </h3>
            <Link to="/learner/mentors" className="ss-btn ss-btn--ghost ss-btn--sm">
              View All <SsIcon name="arrow_forward" size={16} />
            </Link>
          </div>
          {recommendedMentors.length > 0 ? (
            <div className="ld-mentors">
              {recommendedMentors.slice(0, 4).map((mentor) => (
                <div key={mentor.id} className="ld-mentor-row">
                  <div className="ld-mentor-row__avatar">
                    {mentor.profileImageUrl ? (
                      <img src={mentor.profileImageUrl} alt={mentor.fullName} />
                    ) : (
                      <span>{initials(mentor.fullName || "M")}</span>
                    )}
                  </div>
                  <div className="ld-mentor-row__info">
                    <p className="ld-mentor-row__name">{mentor.fullName || "Mentor"}</p>
                    <p className="ld-mentor-row__role">{mentor.headline || mentor.title || "Expert mentor"}</p>
                  </div>
                  <span className="ld-mentor-row__rating">
                    <SsIcon name="star_rate" size={14} /> {Number(mentor.averageRating || mentor.rating || 0).toFixed(1)}
                  </span>
                  <Link to={`/mentors/${mentor.id}`} className="ss-btn ss-btn--secondary ss-btn--sm">
                    View Profile
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="ss-empty" style={{ padding: "32px 20px" }}>
              <div className="ss-empty__icon">
                <SsIcon name="group" size={36} />
              </div>
              <h3 className="ss-empty__title">No mentor recommendations</h3>
              <p className="ss-empty__desc">Explore mentors to find the perfect match.</p>
              <div className="ss-empty__actions">
                <Link to="/learner/mentors" className="ss-btn ss-btn--primary ss-btn--sm">
                  Find Mentors
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Achievements */}
        <div className="ss-card">
          <div className="ss-card__header">
            <h3 className="ss-card__title">
              <SsIcon name="emoji_events" size={20} /> Achievements
            </h3>
          </div>
          <div className="ld-achievements">
            <div className="ld-achievement">
              <div className="ld-achievement__icon" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
                <SsIcon name="local_fire_department" size={22} />
              </div>
              <div className="ld-achievement__body">
                <span className="ld-achievement__label">Learning Streak</span>
                <span className="ld-achievement__desc">{streak} consecutive days</span>
              </div>
              <span className="ld-achievement__xp">+{streak * 10} XP</span>
            </div>
            <div className="ld-achievement">
              <div className="ld-achievement__icon" style={{ background: "rgba(5,150,105,0.1)", color: "#059669" }}>
                <SsIcon name="task_alt" size={22} />
              </div>
              <div className="ld-achievement__body">
                <span className="ld-achievement__label">Sessions Completed</span>
                <span className="ld-achievement__desc">{stats.completedSessions} total sessions</span>
              </div>
              <span className="ld-achievement__xp">+{stats.completedSessions * 5} XP</span>
            </div>
            <div className="ld-achievement">
              <div className="ld-achievement__icon" style={{ background: "rgba(124,58,237,0.1)", color: "#7c3aed" }}>
                <SsIcon name="workspace_premium" size={22} />
              </div>
              <div className="ld-achievement__body">
                <span className="ld-achievement__label">Certificates</span>
                <span className="ld-achievement__desc">{certifications.length} earned</span>
              </div>
              <span className="ld-achievement__xp">+{certifications.length * 50} XP</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════ ROW 3: Learning Roadmap + Recent Certificates ═══════════════════ */}
      <div className="ss-grid-sidebar">
        {/* Learning Roadmap */}
        <div className="ss-card">
          <div className="ss-card__header">
            <h3 className="ss-card__title">
              <SsIcon name="timeline" size={20} /> Learning Roadmap
            </h3>
            <Link to="/learner/learning" className="ss-btn ss-btn--ghost ss-btn--sm">
              Open Roadmap <SsIcon name="arrow_forward" size={16} />
            </Link>
          </div>
          {roadmaps.length > 0 ? (
            <div className="ld-timeline">
              {roadmaps.slice(0, 5).map((r, idx) => {
                const pct = Math.round(Number(r.progressPercent || 0));
                const done = pct >= 100;
                const current = !done && (idx === 0 || Number(roadmaps[idx - 1]?.progressPercent || 0) >= 100);
                return (
                  <div key={r.id || idx} className={`ld-timeline__item${done ? " is-done" : ""}${current ? " is-current" : ""}`}>
                    <span className="ld-timeline__dot">
                      {done ? <SsIcon name="check" size={16} /> : current ? <SsIcon name="radio_button_checked" size={16} /> : <SsIcon name="radio_button_unchecked" size={16} />}
                    </span>
                    <div className="ld-timeline__body">
                      <div className="ld-timeline__head">
                        <strong>{r.title || "Learning roadmap"}</strong>
                        <span className="ld-timeline__pct">{pct}%</span>
                      </div>
                      <div className="ld-timeline__bar">
                        <div className="ld-timeline__fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="ld-timeline__meta">
                        {done ? "Completed" : current ? "In progress" : "Upcoming"}
                        {r.mentorName ? ` \u00b7 ${r.mentorName}` : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="ss-empty" style={{ padding: "32px 20px" }}>
              <div className="ss-empty__icon">
                <SsIcon name="timeline" size={36} />
              </div>
              <h3 className="ss-empty__title">No roadmaps yet</h3>
              <p className="ss-empty__desc">Book a session to generate your learning roadmap.</p>
              <div className="ss-empty__actions">
                <Link to="/learner/mentors" className="ss-btn ss-btn--primary ss-btn--sm">
                  Find Mentors
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Recent Certificates */}
        <div className="ss-card">
          <div className="ss-card__header">
            <h3 className="ss-card__title">
              <SsIcon name="workspace_premium" size={20} /> Recent Certificates
            </h3>
            <Link to="/learner/certificates" className="ss-btn ss-btn--ghost ss-btn--sm">
              View All <SsIcon name="arrow_forward" size={16} />
            </Link>
          </div>
          {certifications.length > 0 ? (
            <div className="ld-certs">
              {certifications.slice(0, 4).map((cert) => (
                <div key={cert.id} className="ld-cert">
                  <div className="ld-cert__icon">
                    <SsIcon name="workspace_premium" size={22} />
                  </div>
                  <div className="ld-cert__body">
                    <span className="ld-cert__title">{cert.title || "Certificate"}</span>
                    <span className="ld-cert__meta">
                      {cert.mentorName || cert.issuedBy || "SkillSwap"} \u00b7 {formatDate(cert.issuedAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="ss-empty" style={{ padding: "32px 20px" }}>
              <div className="ss-empty__icon">
                <SsIcon name="workspace_premium" size={36} />
              </div>
              <h3 className="ss-empty__title">No certificates yet</h3>
              <p className="ss-empty__desc">Complete sessions to earn certificates.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
