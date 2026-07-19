import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import "../modules/common/dashboard/dashboard.css";

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
   Main Component
   ========================================================================== */

export default function LearnerDashboard({ profile, onLogout }) {
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
      console.error("Error loading learner data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="ld-shell" role="status" aria-label="Loading dashboard...">
        <div className="ld-skel-hero" />
        <div className="ld-stats">
          {[1, 2, 3, 4, 5].map((k) => <div key={k} className="ld-skel-stat" />)}
        </div>
        <div className="ld-row">
          <div className="ld-skel-block" style={{ flex: 2 }} />
          <div className="ld-skel-block" style={{ flex: 1 }} />
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

  return (
    <div className="ld-shell">
      {/* ── Premium Hero ── */}
      <div className="ld-hero">
        <div className="ld-hero__body">
          <span className="ld-hero__eyebrow">
            <span className="ld-hero__eyebrow-dot" />
            Learner Dashboard
          </span>
          <h1 className="ld-hero__title">
            {getGreeting()}, {firstName}
          </h1>
          <p className="ld-hero__sub">
            Track your progress, join upcoming sessions, and continue learning.
            {stats.completedSessions > 0 || streak > 0
              ? ` You have ${stats.completedSessions} completed session${stats.completedSessions !== 1 ? 's' : ''}${streak > 0 ? ` and a ${streak}-day streak` : ''}.`
              : ` Start by booking your first session with a mentor.`
            }
          </p>
          <div className="ld-hero__actions">
            {nextSession?.session?.meetingLink && (
              <a href={nextSession.session.meetingLink} target="_blank" rel="noreferrer" className="ld-btn ld-btn--primary">
                <Icon name="videocam" /> Join Next Session
              </a>
            )}
            <Link to="/learner/mentors" className="ld-btn ld-btn--ghost">
              <Icon name="person_search" /> Find Mentors
            </Link>
            <Link to="/learner/messages" className="ld-btn ld-btn--ghost">
              <Icon name="chat" /> Messages
            </Link>
            <button type="button" className="ld-btn ld-btn--ghost" onClick={loadLearnerData}>
              <Icon name="refresh" /> Refresh
            </button>
            <button type="button" className="ld-btn ld-btn--ghost" onClick={onLogout}>
              <Icon name="logout" /> Logout
            </button>
          </div>
          <div className="ld-hero__badges">
            <span className="ld-hero__badge">
              <Icon name="local_fire_department" /> {streak}d streak
            </span>
            <span className="ld-hero__badge">
              <Icon name="workspace_premium" /> {certifications.length} certs
            </span>
            <span className="ld-hero__badge">
              <Icon name="schedule" /> {stats.learningHours}h learned
            </span>
          </div>
        </div>
        <div className="ld-hero__aside">
          <div className="ld-hero-glass">
            <p className="ld-hero-glass__label">
              <Icon name="trending_up" /> Roadmap Progress
            </p>
            <div className="ld-hero-glass__ring">
              <ProgressRing value={roadmapCompletion} size={80} stroke={7} />
            </div>
            <p className="ld-hero-glass__value">{roadmapCompletion}%</p>
            <p className="ld-hero-glass__desc">Overall learning completion</p>
          </div>
          {nextSession && (
            <div className="ld-hero-glass">
              <p className="ld-hero-glass__label">
                <Icon name="event" /> Next Session
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
      </div>

      {/* ── Premium Referral Section ── */}
      {referral && (
        <div className="ld-referral-hero">
          <div className="ld-referral-hero__bg" />
          <div className="ld-referral-hero__content">
            <div className="ld-referral-hero__header">
              <div className="ld-referral-hero__title-group">
                <span className="ld-referral-hero__eyebrow">
                  <Icon name="share" /> Referral Rewards
                </span>
                <h2 className="ld-referral-hero__title">
                  Invite Friends, Earn Credits
                </h2>
                <p className="ld-referral-hero__subtitle">
                  Share your unique referral link and earn <strong>50 credits</strong> for every friend who completes their first booking.
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
      )}

      {/* ── Statistics (5 cards) ── */}
      <div className="ld-stats">
        <div className="ld-stat">
          <div className="ld-stat__top">
            <div className="ld-stat__icon" style={{ background: "rgba(5,150,105,0.1)", color: "#059669" }}>
              <Icon name="task_alt" />
            </div>
            <span className="ld-stat__delta ld-stat__delta--pos">+{stats.completedSessions}</span>
          </div>
          <span className="ld-stat__value">{stats.completedSessions}</span>
          <span className="ld-stat__label">Sessions Done</span>
          <span className="ld-stat__desc">Keep it going</span>
          <MiniChart data={series.monthly} color="#059669" />
        </div>
        <div className="ld-stat">
          <div className="ld-stat__top">
            <div className="ld-stat__icon" style={{ background: "rgba(59,130,246,0.1)", color: "#3b82f6" }}>
              <Icon name="school" />
            </div>
            <span className="ld-stat__delta ld-stat__delta--pos">+{stats.skillsLearning}</span>
          </div>
          <span className="ld-stat__value">{stats.skillsLearning}</span>
          <span className="ld-stat__label">Skills Learning</span>
          <span className="ld-stat__desc">On your watchlist</span>
          <MiniChart data={series.monthly} color="#3b82f6" />
        </div>
        <div className="ld-stat">
          <div className="ld-stat__top">
            <div className="ld-stat__icon" style={{ background: "rgba(124,58,237,0.1)", color: "#7c3aed" }}>
              <Icon name="workspace_premium" />
            </div>
            <span className="ld-stat__delta ld-stat__delta--pos">+{certifications.length}</span>
          </div>
          <span className="ld-stat__value">{certifications.length}</span>
          <span className="ld-stat__label">Certificates</span>
          <span className="ld-stat__desc">Earned so far</span>
          <MiniChart data={series.monthly} color="#7c3aed" />
        </div>
        <div className="ld-stat">
          <div className="ld-stat__top">
            <div className="ld-stat__icon" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
              <Icon name="local_fire_department" />
            </div>
            <span className="ld-stat__delta ld-stat__delta--pos">+{streak}d</span>
          </div>
          <span className="ld-stat__value">{streak}d</span>
          <span className="ld-stat__label">Learning Streak</span>
          <span className="ld-stat__desc">Consecutive days</span>
          <MiniChart data={series.weekly} color="#f59e0b" />
        </div>
        <div className="ld-stat">
          <div className="ld-stat__top">
            <div className="ld-stat__icon" style={{ background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
              <Icon name="schedule" />
            </div>
            <span className="ld-stat__delta ld-stat__delta--pos">+{stats.learningHours}h</span>
          </div>
          <span className="ld-stat__value">{stats.learningHours}h</span>
          <span className="ld-stat__label">Hours Learned</span>
          <span className="ld-stat__desc">Total time invested</span>
          <MiniChart data={series.hours} color="#10b981" />
        </div>
      </div>

      {/* ── Continue Learning ── */}
      {currentCourses.length > 0 && (
        <div className="ld-card">
          <div className="ld-section__head">
            <h2 className="ld-section__title">
              <Icon name="play_circle" /> Continue Learning
            </h2>
            <Link to="/learner/learning" className="ld-section__link">
              View All <Icon name="arrow_forward" />
            </Link>
          </div>
          <div className="ld-courses-scroll">
            {currentCourses.map((course, idx) => {
              const pct = Math.round(Number(course.progressPercent || 0));
              return (
                <article key={course.id || idx} className="ld-course-card">
                  <div className="ld-course-card__thumb" style={{ background: `linear-gradient(135deg,#0f766e,#14b8a6)` }}>
                    <Icon name={course.category === "Frontend" ? "web" : "code"} />
                    <span className="ld-course-card__pct">{pct}%</span>
                  </div>
                  <div className="ld-course-card__body">
                    <h4 className="ld-course-card__title">{course.title || "Learning roadmap"}</h4>
                    <p className="ld-course-card__mentor">
                      <Icon name="person" /> {course.mentorName || course.mentor?.fullName || "Self-paced"}
                    </p>
                    <div className="ld-course-card__track">
                      <div className="ld-course-card__fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="ld-course-card__foot">
                      <span className="ld-course-card__pct-label">{pct}% complete</span>
                      <Link to="/learner/learning" className="ld-btn ld-btn--brand ld-btn--sm">
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

      {/* ── Row: Upcoming Sessions (7) + Learning Progress (5) ── */}
      <div className="ld-row">
        <div className="ld-col-7">
          <div className="ld-card">
            <div className="ld-section__head">
              <h2 className="ld-section__title">
                <Icon name="event" /> Upcoming Sessions
              </h2>
              <Link to="/learner/sessions" className="ld-section__link">
                View All <Icon name="arrow_forward" />
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
                          <Icon name="person" /> {mentor.fullName || "Mentor"}
                          <Icon name="schedule" /> {formatTime(session.startTime)}
                          <Icon name="timelapse" /> {Math.max(0, Math.round((new Date(session.endTime || 0) - new Date(session.startTime || 0)) / 60000))} min
                        </p>
                      </div>
                      <div className="ld-session-row__actions">
                        {session.meetingLink && (
                          <a href={session.meetingLink} target="_blank" rel="noreferrer" className="ld-btn ld-btn--brand ld-btn--sm">
                            <Icon name="videocam" /> Join
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="ld-empty">
                <div className="ld-empty__icon"><Icon name="event_busy" /></div>
                <p className="ld-empty__title">No upcoming sessions</p>
                <p className="ld-empty__desc">Book a session with a mentor to get started.</p>
                <Link to="/learner/mentors" className="ld-btn ld-btn--brand ld-btn--sm">
                  Find Mentors
                </Link>
              </div>
            )}
          </div>
        </div>
        <div className="ld-col-5">
          <div className="ld-card">
            <div className="ld-section__head">
              <h2 className="ld-section__title">
                <Icon name="insights" /> Learning Progress
              </h2>
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
      </div>

      {/* ── Row: Recommended Mentors (7) + Achievements (5) ── */}
      <div className="ld-row">
        <div className="ld-col-7">
          <div className="ld-card">
            <div className="ld-section__head">
              <h2 className="ld-section__title">
                <Icon name="recommend" /> Top Mentors
              </h2>
              <Link to="/learner/mentors" className="ld-section__link">
                View All <Icon name="arrow_forward" />
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
                      \u2605 {Number(mentor.averageRating || mentor.rating || 0).toFixed(1)}
                    </span>
                    <Link to={`/mentors/${mentor.id}`} className="ld-btn ld-btn--outline ld-btn--sm">
                      View Profile
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ld-empty">
                <div className="ld-empty__icon"><Icon name="group" /></div>
                <p className="ld-empty__title">No mentor recommendations</p>
                <p className="ld-empty__desc">Explore mentors to find the perfect match.</p>
                <Link to="/learner/mentors" className="ld-btn ld-btn--brand ld-btn--sm">
                  Find Mentors
                </Link>
              </div>
            )}
          </div>
        </div>
        <div className="ld-col-5">
          <div className="ld-card">
            <div className="ld-section__head">
              <h2 className="ld-section__title">
                <Icon name="emoji_events" /> Achievements
              </h2>
            </div>
            <div className="ld-achievements">
              <div className="ld-achievement">
                <div className="ld-achievement__icon" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
                  <Icon name="local_fire_department" />
                </div>
                <div className="ld-achievement__body">
                  <span className="ld-achievement__label">Learning Streak</span>
                  <span className="ld-achievement__desc">{streak} consecutive days</span>
                </div>
                <span className="ld-achievement__xp">+{streak * 10} XP</span>
              </div>
              <div className="ld-achievement">
                <div className="ld-achievement__icon" style={{ background: "rgba(5,150,105,0.1)", color: "#059669" }}>
                  <Icon name="task_alt" />
                </div>
                <div className="ld-achievement__body">
                  <span className="ld-achievement__label">Sessions Completed</span>
                  <span className="ld-achievement__desc">{stats.completedSessions} total sessions</span>
                </div>
                <span className="ld-achievement__xp">+{stats.completedSessions * 5} XP</span>
              </div>
              <div className="ld-achievement">
                <div className="ld-achievement__icon" style={{ background: "rgba(124,58,237,0.1)", color: "#7c3aed" }}>
                  <Icon name="workspace_premium" />
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
      </div>

      {/* ── Row: Learning Roadmap (7) + Certificates (5) ── */}
      <div className="ld-row">
        <div className="ld-col-7">
          <div className="ld-card">
            <div className="ld-section__head">
              <h2 className="ld-section__title">
                <Icon name="timeline" /> Learning Roadmap
              </h2>
              <Link to="/learner/learning" className="ld-section__link">
                Open Roadmap <Icon name="arrow_forward" />
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
                        {done ? <Icon name="check" /> : current ? <Icon name="radio_button_checked" /> : <Icon name="radio_button_unchecked" />}
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
              <div className="ld-empty">
                <div className="ld-empty__icon"><Icon name="timeline" /></div>
                <p className="ld-empty__title">No roadmaps yet</p>
                <p className="ld-empty__desc">Book a session to generate your learning roadmap.</p>
                <Link to="/learner/mentors" className="ld-btn ld-btn--brand ld-btn--sm">
                  Find Mentors
                </Link>
              </div>
            )}
          </div>
        </div>
        <div className="ld-col-5">
          <div className="ld-card">
            <div className="ld-section__head">
              <h2 className="ld-section__title">
                <Icon name="workspace_premium" /> Recent Certificates
              </h2>
              <Link to="/learner/certificates" className="ld-section__link">
                View All <Icon name="arrow_forward" />
              </Link>
            </div>
            {certifications.length > 0 ? (
              <div className="ld-certs">
                {certifications.slice(0, 4).map((cert) => (
                  <div key={cert.id} className="ld-cert">
                    <div className="ld-cert__icon">
                      <Icon name="workspace_premium" />
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
              <div className="ld-empty">
                <div className="ld-empty__icon"><Icon name="workspace_premium" /></div>
                <p className="ld-empty__title">No certificates yet</p>
                <p className="ld-empty__desc">Complete sessions to earn certificates.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
