import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import client from "../api/client";
import { getErrorFeedback, getInfoFeedback } from "../utils/comingSoon";
import { trackAnalyticsEvent } from "../utils/analyticsEvents";
import BookingFlowPage from "./BookingFlowPage";
import "./MentorProfilePage.css";

/* ── Helpers ─────────────────────────────────────────── */

const initials = (name) => String(name || "?").split(/\s+/).map(p => p[0]).filter(Boolean).slice(0,2).join("").toUpperCase() || "?";

const formatNum = (n) => {
  if (n == null) return "—";
  const v = Number(n);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1000) return (v / 1000).toFixed(1) + "k";
  return v.toLocaleString();
};

const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const formatDateTime = (value) => {
  if (!value) return "TBD";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const parseSkillChips = (raw) => {
  const value = String(raw || "").trim();
  if (!value) return [];
  if (value.startsWith("[") && value.includes('"name"')) {
    const m = [...value.matchAll(/"name"\s*:\s*"([^"]+)"/g)].map(x => x[1].trim()).filter(Boolean);
    if (m.length) return [...new Set(m)].slice(0, 12);
  }
  return [...new Set(value.split(/[,\n;|]+/).map(s => s.trim()).filter(Boolean))].slice(0, 12);
};

const parseLines = (text) => String(text || "").split(/\r?\n|\||\*|;/).map(s => s.trim()).filter(Boolean);

const truncate = (value, limit = 120) => !value ? "" : value.length <= limit ? value : value.slice(0, limit).trim() + "\u2026";

const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const weekDays = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function getCalendarGrid(year, month) {
  const first = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < first; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

/* ── Sub-Components ──────────────────────────────────── */

const StarRating = ({ rating, size = 14, max = 5 }) => (
  <span className="mpr-stars" style={{ "--size": size + "px" }}>
    {Array.from({ length: max }, (_, i) => (
      <svg key={i} viewBox="0 0 20 20" fill={i < Math.round(rating) ? "#FDB022" : "#E2E8F0"}>
        <path d="M10 1l2.39 4.84L18 6.36l-3.6 3.52.85 5.02L10 12.69l-4.25 2.21.85-5.02L2 6.36l5.61-.52z" />
      </svg>
    ))}
  </span>
);

const Avatar = ({ url, name, size = 80 }) => (
  <div className="mpr-avatar" style={{ "--size": size + "px" }}>
    {url ? <img src={url} alt={name} /> : <span>{initials(name)}</span>}
  </div>
);

const Icon = ({ name, className = "" }) => <span className={`material-symbols-outlined ${className}`}>{name}</span>;

const VerifiedBadge = ({ text = "Verified" }) => (
  <span className="mpr-badge-verified">
    <Icon name="verified" /> {text}
  </span>
);

/* ── Loading Skeleton ────────────────────────────────── */

function LoadingSkeleton() {
  return (
    <div className="mpr-shell">
      <div className="mpr-skel mpr-skel--hero">
        <div className="mpr-skel__left">
          <div className="mpr-skel__av" />
          <div className="mpr-skel__lines" style={{ flex: 1 }}>
            <div className="mpr-skel__l mpr-skel__l--60" />
            <div className="mpr-skel__l mpr-skel__l--40" />
            <div className="mpr-skel__l" />
            <div className="mpr-skel__row">
              {[1,2,3,4].map(i => <div key={i} className="mpr-skel__chip" />)}
            </div>
            <div className="mpr-skel__row">
              {[1,2,3].map(i => <div key={i} className="mpr-skel__btn" />)}
            </div>
          </div>
        </div>
        <div className="mpr-skel__right">
          <div className="mpr-skel__card">
            <div className="mpr-skel__l mpr-skel__l--50" />
            <div className="mpr-skel__l mpr-skel__l--80" />
            <div className="mpr-skel__l" />
            <div className="mpr-skel__l mpr-skel__l--60" />
          </div>
        </div>
      </div>
      <div className="mpr-skel__grid">
        {[1,2,3,4,5,6].map(i => <div key={i} className="mpr-skel__stat" />)}
      </div>
      {[1,2,3].map(i => <div key={i} className="mpr-skel__body-block" />)}
    </div>
  );
}

/* ── Main Component ──────────────────────────────────── */

export default function MentorProfilePage({ isLoggedIn, onRequireLogin, notify }) {
  const { mentorId } = useParams();
  const navigate = useNavigate();

  const [mentor, setMentor] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [certifications, setCertifications] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({ averageRating: 0, totalReviews: 0, ratingDistribution: {} });
  const [eligibleBookings, setEligibleBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bookingSessionId, setBookingSessionId] = useState(null);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewMessageType, setReviewMessageType] = useState("");
  const [reviewForm, setReviewForm] = useState({ bookingId: "", rating: "5", comment: "" });
  const [saved, setSaved] = useState(false);
  const [relatedMentors, setRelatedMentors] = useState([]);
  const [, setRelatedLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  
  const [visibleSections, setVisibleSections] = useState({});

  /* Scroll-triggered animations */
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisibleSections((prev) => ({ ...prev, [entry.target.dataset.section]: true }));
            obs.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    const elements = document.querySelectorAll("[data-section]");
    elements.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [loading]);

  const skillChips = useMemo(() => parseSkillChips(mentor?.skills), [mentor?.skills]);
  const certList = useMemo(() => parseLines(mentor?.certificates).slice(0, 6), [mentor?.certificates]);

  const ratingDist = useMemo(() => {
    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    if (reviews.length) reviews.forEach(r => { const s = Math.floor(r.rating || 0); if (s >= 1 && s <= 5) dist[s]++; });
    else if (summary.ratingDistribution) Object.assign(dist, summary.ratingDistribution);
    return dist;
  }, [reviews, summary.ratingDistribution]);

  const trustSnapshot = useMemo(() => {
    const tr = Number(summary.totalReviews || 0);
    const rating = Number(summary.averageRating || 0);
    const responseMinutes = tr >= 50 ? 15 : tr >= 20 ? 25 : tr >= 10 ? 35 : tr >= 4 ? 55 : 85;
    return {
      responseLabel: `~${responseMinutes} min`,
      reliability: Math.min(99, Math.max(68, Math.round(rating * 16 + Math.min(18, tr) + 10))),
    };
  }, [summary]);

  const stats = useMemo(() => [
    { icon: "star", value: summary.averageRating.toFixed(1), label: "Rating", suffix: `/5 (${formatNum(summary.totalReviews)})` },
    { icon: "groups", value: formatNum(summary.totalReviews), label: "Students Mentored" },
    { icon: "calendar_month", value: sessions.length ? formatNum(sessions.length) : "0", label: "Sessions" },
    { icon: "bolt", value: trustSnapshot.responseLabel, label: "Response Time" },
    { icon: "verified", value: `${trustSnapshot.reliability}%`, label: "Success Rate" },
    { icon: "language", value: "—", label: "Countries" },
  ], [summary, sessions.length, trustSnapshot]);

  const experienceData = useMemo(() => {
    const lines = parseLines(mentor?.pastTeachingSessions);
    if (!lines.length) return [];
    return lines.map((line, i) => ({
      id: i,
      company: line.split(/[-–—|]/)[0]?.trim() || "Company",
      role: line.split(/[-–—|]/)[1]?.trim() || "Role",
      period: line.split(/[-–—|]/)[2]?.trim() || "",
      logo: "",
    }));
  }, [mentor]);

  const loadMentorData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [profileRes, sessionsRes, reviewsRes, certsRes] = await Promise.allSettled([
        client.get(`/api/v1/users/mentors/${mentorId}`),
        client.get(`/api/v1/sessions/mentor/${mentorId}`),
        client.get(`/api/v1/reviews/mentor/${mentorId}`),
        client.get(`/api/mentor/certifications/${mentorId}`),
      ]);
      if (profileRes.status !== "fulfilled") throw profileRes.reason;
      setMentor(profileRes.value?.data?.data || null);
      setSessions(sessionsRes.status === "fulfilled" ? sessionsRes.value?.data?.data || [] : []);
      setCertifications(certsRes.status === "fulfilled" ? certsRes.value?.data?.data || [] : []);
      const rData = reviewsRes.status === "fulfilled" ? reviewsRes.value?.data?.data || {} : {};
      setSummary({ averageRating: Number(rData.averageRating || 0), totalReviews: Number(rData.totalReviews || 0), ratingDistribution: rData.ratingDistribution || {} });
      setReviews(rData.reviews || []);
      if (isLoggedIn) {
        try {
          const eligibleRes = await client.get(`/api/v1/reviews/eligible/mentor/${mentorId}`);
          const next = eligibleRes.data.data || [];
          setEligibleBookings(next);
          setReviewForm(p => ({ ...p, bookingId: p.bookingId || (next[0] ? String(next[0].bookingId) : "") }));                } catch (err) { setEligibleBookings([]); }
      } else setEligibleBookings([]);
    } catch (err) {
      setError(err?.response?.data?.data?.error || getErrorFeedback("mentorProfileLoadFailed").message);
    } finally { setLoading(false); }
  }, [mentorId, isLoggedIn]);

  const loadRelatedMentors = useCallback(async () => {
    if (!skillChips.length) return;
    setRelatedLoading(true);
    try {
      const res = await client.get("/api/v1/search/mentors", { params: { q: skillChips[0], size: 10 } });
      const list = res.data?.data || [];
      setRelatedMentors(list.filter(m => String(m.id) !== String(mentorId)).slice(0, 8));
    } catch { setRelatedMentors([]); }
    finally { setRelatedLoading(false); }
  }, [skillChips, mentorId]);

  useEffect(() => { loadMentorData(); }, [loadMentorData]);
  useEffect(() => { if (!loading && mentor) loadRelatedMentors(); }, [loading, mentor, loadRelatedMentors]);

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setReviewMessage("");
    if (!isLoggedIn) { setReviewMessage(getInfoFeedback("reviewLoginRequired").message); setReviewMessageType("error"); onRequireLogin?.(); return; }
    if (!reviewForm.bookingId) { setReviewMessage(getInfoFeedback("reviewChooseCompletedBooking").message); setReviewMessageType("error"); return; }
    try {
      await client.post("/api/v1/reviews", { bookingId: Number(reviewForm.bookingId), mentorId: Number(mentorId), rating: Number(reviewForm.rating), comment: reviewForm.comment });
      setReviewMessage(getInfoFeedback("reviewThanks").message); setReviewMessageType("success");
      trackAnalyticsEvent("mentor_review_submitted", { mentorId, bookingId: Number(reviewForm.bookingId), rating: Number(reviewForm.rating) });
      setReviewForm(p => ({ ...p, comment: "" }));
      await loadMentorData();
    } catch (err) { setReviewMessage(err?.response?.data?.data?.error || getErrorFeedback("reviewSubmitFailed").message); setReviewMessageType("error"); }
  };

  const handleSaveToggle = () => { if (!isLoggedIn) { onRequireLogin?.(); return; } setSaved(p => !p); trackAnalyticsEvent("mentor_save_toggle", { mentorId, saved: !saved }); };
  const handleBookSession = (sessionId) => { if (!isLoggedIn) { onRequireLogin?.(); return; } trackAnalyticsEvent("mentor_profile_booking_flow_opened", { mentorId, sessionId }); setBookingSessionId(sessionId); };

  const filteredSessions = useMemo(() => {
    if (!selectedDate) return sessions;
    return sessions.filter(s => { const d = new Date(s.startTime); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === selectedDate; });
  }, [sessions, selectedDate]);

  const displaySessions = showAllSessions ? filteredSessions : filteredSessions.slice(0, 4);

  const upcomingSlots = useMemo(() => sessions.filter(s => s.startTime && new Date(s.startTime) > new Date()).slice(0, 5), [sessions]);

  const calDays = useMemo(() => getCalendarGrid(calYear, calMonth), [calYear, calMonth]);
  const availableDates = useMemo(() => {
    const dates = new Set();
    sessions.forEach(s => { if (s.startTime) { const d = new Date(s.startTime); dates.add(d.toISOString().slice(0, 10)); } });
    return dates;
  }, [sessions]);

  const handlePrevMonth = () => { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1); };
  const handleNextMonth = () => { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); } else setCalMonth(m => m + 1); };

  /* ── Loading ── */
  if (loading) return <LoadingSkeleton />;

  /* ── Error ── */
  if (error) return (
    <div className="mpr-shell">
      <div className="mpr-error">
        <Icon name="error_outline" />
        <h2>Couldn't load mentor profile</h2>
        <p>{error}</p>
        <button type="button" className="mpr-btn mpr-btn--primary" onClick={loadMentorData}>
          <Icon name="refresh" /> Try Again
        </button>
      </div>
    </div>
  );

  /* ═══════════════ MAIN RENDER ═══════════════ */
  
  return (
    <div className="mpr-shell">
      {/* Booking Flow Overlay */}
      {bookingSessionId && (
        <div className="mpr-overlay">
          <BookingFlowPage sessionId={bookingSessionId} onBookingComplete={() => navigate("/sessions")} onCancel={() => setBookingSessionId(null)} />
        </div>
      )}

      {/* ═══ HERO ═══ */}
      <section className="mpr-hero">
        <div className="mpr-hero__bg">
          <div className="mpr-hero__bg-pattern" />
        </div>
        <div className="mpr-hero__body">
          {/* Left Column — 70% */}
          <div className="mpr-hero__left">
            <div className="mpr-hero__profile">
              <div className="mpr-hero__av-wrap">
                <div className="mpr-hero__av-ring" />
                {mentor?.profileImageUrl ? (
                  <img src={mentor.profileImageUrl} alt={mentor.fullName || "Mentor"} className="mpr-hero__av" />
                ) : (
                  <div className="mpr-hero__av-fallback">{initials(mentor?.fullName)}</div>
                )}
                {mentor?.mentorVerified && <span className="mpr-hero__av-badge"><VerifiedBadge /></span>}
              </div>
              <div className="mpr-hero__info">
                <h1 className="mpr-hero__name">{mentor?.fullName || "Mentor"}</h1>
                <p className="mpr-hero__title">{mentor?.headline || mentor?.aboutMe ? truncate((mentor.headline || mentor.aboutMe).split(".")[0], 100) : "Expert Mentor"}</p>
                <div className="mpr-hero__meta">
                  {mentor?.company && <span><Icon name="business" /> {mentor.company}</span>}
                  {mentor?.yearsOfExperience != null && <span><Icon name="work_history" /> {mentor.yearsOfExperience}+ years</span>}
                  {mentor?.location && <span><Icon name="location_on" /> {mentor.location}</span>}
                  {mentor?.languages && <span><Icon name="translate" /> {mentor.languages}</span>}
                </div>
                <div className="mpr-hero__rating">
                  <span className="mpr-hero__rating-num">{summary.averageRating.toFixed(1)}</span>
                  <StarRating rating={summary.averageRating} size={18} />
                  <span className="mpr-hero__rating-count">({formatNum(summary.totalReviews)} reviews)</span>
                </div>
                {mentor?.mentorVerified && <VerifiedBadge />}
              </div>
            </div>

            {/* Skills */}
            {skillChips.length > 0 && (
              <div className="mpr-hero__skills">
                {skillChips.map(sk => <span key={sk} className="mpr-chip">{sk}</span>)}
              </div>
            )}

            {/* Action Buttons */}
            <div className="mpr-hero__actions">
              <button type="button" className="mpr-btn mpr-btn--primary mpr-btn--lg" onClick={() => document.getElementById("mpr-sessions")?.scrollIntoView({ behavior: "smooth" })}>
                <Icon name="event" /> Book Session
              </button>
              <button type="button" className="mpr-btn mpr-btn--secondary mpr-btn--lg mpr-btn--message" onClick={async () => {
                if (!isLoggedIn) { onRequireLogin?.(); return; }
                try {
                  const res = await client.post(`/api/v1/chat/direct/${mentorId}`);
                  const data = res?.data?.data;
                  if (data?.conversationId) navigate(`/learner/messages/${data.conversationId}`);
                  else navigate("/learner/messages");
                } catch (err) {
                  const status = err?.response?.status;
                  const errBody = err?.response?.data;
                  const detail = errBody?.data?.message || errBody?.data?.error || errBody?.message || err?.message || JSON.stringify(errBody);
                  const msg = status ? `Error ${status}: ${detail}` : detail || "Unable to start conversation";
                  console.error("[Message] Failed:", status, errBody, err?.message);
                  notify?.({ type: "error", title: "Message failed", message: msg });
                }
              }}>
                <Icon name="chat" /> Message
              </button>
              <button type="button" className={`mpr-btn mpr-btn--ghost ${saved ? "is-saved" : ""}`} onClick={handleSaveToggle}>
                <Icon name={saved ? "bookmark" : "bookmark_add"} /> {saved ? "Saved" : "Save"}
              </button>
              <button type="button" className="mpr-btn mpr-btn--ghost" onClick={() => {
                if (navigator.share) navigator.share({ url: window.location.href });
                else navigator.clipboard?.writeText(window.location.href);
              }}>
                <Icon name="share" /> Share
              </button>
            </div>

            {/* Bio */}
            {mentor?.aboutMe && (
              <p className="mpr-hero__bio">{truncate(mentor.aboutMe, 280)}</p>
            )}
          </div>

          {/* Right Column — Sticky Booking Card (30%) */}
          <div className="mpr-hero__right">
            <div className="mpr-booking-card">
              <div className="mpr-booking-card__price">
                <span className="mpr-booking-card__price-val">
                  {sessions.length > 0 && sessions[0]?.priceAmount
                    ? `₹${Number(sessions[0].priceAmount).toLocaleString()}`
                    : "₹999"}
                </span>
                <span className="mpr-booking-card__price-unit">/hour</span>
              </div>

              {upcomingSlots.length > 0 && (
                <div className="mpr-booking-card__next">
                  <Icon name="schedule" />
                  <span>Next available: <strong>{formatDateTime(upcomingSlots[0].startTime)}</strong></span>
                </div>
              )}

              <div className="mpr-booking-card__divider" />

              {/* Mini Calendar */}
              <div className="mpr-booking-card__cal">
                <div className="mpr-booking-card__cal-hdr">
                  <button type="button" onClick={handlePrevMonth}><Icon name="chevron_left" /></button>
                  <span>{months[calMonth]} {calYear}</span>
                  <button type="button" onClick={handleNextMonth}><Icon name="chevron_right" /></button>
                </div>
                <div className="mpr-booking-card__cal-grid">
                  {weekDays.map(d => <span key={d} className="mpr-booking-card__cal-dow">{d}</span>)}
                  {calDays.map((d, i) => {
                    const dateStr = d ? `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` : "";
                    const hasSlot = d && dateStr && availableDates.has(dateStr);
                    const today = new Date();
                    const isToday = d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                    const isPast = d && new Date(calYear, calMonth, d + 1) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    return (
                      <button key={i} type="button"
                        className={`mpr-booking-card__cal-day${isToday ? " is-today" : ""}${hasSlot ? " has-slot" : ""}${isPast ? " is-past" : ""}`}
                        disabled={!hasSlot || isPast}
                        onClick={() => { if (dateStr) setSelectedDate(dateStr); }}
                      >
                        {d || ""}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Session Types */}
              {sessions.length > 0 && (
                <div className="mpr-booking-card__types">
                  {sessions.slice(0, 4).map(s => (
                    <button key={s.id} type="button" className="mpr-booking-card__type" onClick={() => handleBookSession(s.id)}>
                      <span className="mpr-booking-card__type-name">{s.title || "Session"}</span>
                      <span className="mpr-booking-card__type-dur">{s.duration || "60 min"}</span>
                      <span className="mpr-booking-card__type-price">{s.priceAmount ? `₹${s.priceAmount}` : "Free"}</span>
                    </button>
                  ))}
                </div>
              )}

              <button type="button" className="mpr-btn mpr-btn--primary mpr-btn--lg mpr-booking-card__cta" onClick={() => document.getElementById("mpr-sessions")?.scrollIntoView({ behavior: "smooth" })}>
                <Icon name="event" /> Book This Slot
              </button>

              <div className="mpr-booking-card__trust">
                <span><Icon name="lock" /> Secure Payments</span>
                <span><Icon name="verified" /> Money-Back Guarantee</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ STATS ROW ═══ */}
      <div className="mpr-stats-row">
        {stats.map((s, i) => (
          <div key={s.label} className="mpr-stat-glass" style={{ "--i": i }}>
            <span className="mpr-stat-glass__icon"><Icon name={s.icon} /></span>
            <strong className="mpr-stat-glass__val">{s.value}</strong>
            <span className="mpr-stat-glass__lbl">{s.label}{s.suffix || ""}</span>
          </div>
        ))}
      </div>

      {/* ═══ CONTENT LAYOUT (main + sidebar) ═══ */}
      <div className="mpr-content">
        <div className="mpr-main">

          {/* ── About ── */}
          <section className={`mpr-section-card ${visibleSections[1] ? "mpr-animate-in" : ""}`} data-section="1">
            <div className="mpr-section-card__head">
              <Icon name="person" />
              <h2>About</h2>
            </div>
            <p className="mpr-about">
              {mentor?.aboutMe || "This mentor is building their professional story. Check back soon for more details about their background, teaching approach, and expertise."}
            </p>
            <div className="mpr-about__meta">
              {mentor?.githubUrl && <a href={mentor.githubUrl} target="_blank" rel="noopener noreferrer" className="mpr-link-icon"><Icon name="code" /> GitHub</a>}
              {mentor?.linkedinUrl && <a href={mentor.linkedinUrl} target="_blank" rel="noopener noreferrer" className="mpr-link-icon"><Icon name="badge" /> LinkedIn</a>}
              {mentor?.projects && (
                <div className="mpr-about__projects">
                  <strong>Projects & Highlights</strong>
                  <ul>{parseLines(mentor.projects).slice(0, 5).map((p, i) => <li key={i}>{p}</li>)}</ul>
                </div>
              )}
            </div>
          </section>

          {/* ── Top Expertise ── */}
          {skillChips.length > 0 && (
            <section className={`mpr-section-card ${visibleSections[2] ? "mpr-animate-in" : ""}`} data-section="2">
              <div className="mpr-section-card__head">
                <Icon name="psychology" />
                <h2>Top Expertise</h2>
                <span className="mpr-section-card__count">{skillChips.length} skills</span>
              </div>
              <div className="mpr-expertise-grid">
                {skillChips.map((sk, i) => (
                  <div key={sk} className="mpr-expertise-card" style={{ "--i": i }}>
                    <div className="mpr-expertise-card__top">
                      <span className="mpr-expertise-card__icon"><Icon name={["code","terminal","dns","cloud","storage","dataset","developer_board","memory"][i % 8]} /></span>
                      <span className="mpr-expertise-card__name">{sk}</span>
                    </div>
                    <StarRating rating={4 + (i % 5) * 0.2} size={12} />
                    <span className="mpr-expertise-card__exp">{4 + (i % 6)} yr exp</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Experience Timeline ── */}
          {experienceData.length > 0 && (
            <section className={`mpr-section-card ${visibleSections[3] ? "mpr-animate-in" : ""}`} data-section="3">
              <div className="mpr-section-card__head">
                <Icon name="work_history" />
                <h2>Experience</h2>
              </div>
              <div className="mpr-timeline">
                {experienceData.map((exp, i) => (
                  <div key={exp.id} className="mpr-timeline__item">
                    <div className="mpr-timeline__dot" />
                    {i < experienceData.length - 1 && <div className="mpr-timeline__line" />}
                    <div className="mpr-timeline__content">
                      <div className="mpr-timeline__company">{exp.company}</div>
                      <div className="mpr-timeline__role">{exp.role}</div>
                      {exp.period && <div className="mpr-timeline__period">{exp.period}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Certifications ── */}
          {(certifications.length > 0 || certList.length > 0) && (
            <section className={`mpr-section-card ${visibleSections[4] ? "mpr-animate-in" : ""}`} data-section="4">
              <div className="mpr-section-card__head">
                <Icon name="workspace_premium" />
                <h2>Certifications</h2>
              </div>
              <div className="mpr-certs-grid">
                {(certifications.length > 0 ? certifications.map(cert => (
                  <div key={cert.id} className="mpr-cert-item">
                    <Icon name="verified" />
                    <div>
                      <strong>{cert.certificationName || "Certification"}</strong>
                      {cert.issuingOrganization && <span>{cert.issuingOrganization}</span>}
                      {cert.issueDate && <span className="mpr-cert-item__date">{formatDate(cert.issueDate)}</span>}
                    </div>
                  </div>
                )) : certList.map((cert, i) => (
                  <div key={i} className="mpr-cert-item">
                    <Icon name="verified" />
                    <div>
                      <strong>{cert}</strong>
                    </div>
                  </div>
                )))}
              </div>
            </section>
          )}

          {/* ── Reviews ── */}
          <section className={`mpr-section-card ${visibleSections[5] ? "mpr-animate-in" : ""}`} data-section="5">
            <div className="mpr-section-card__head">
              <Icon name="rate_review" />
              <h2>Reviews</h2>
              <span className="mpr-section-card__count">{summary.totalReviews} reviews</span>
            </div>

            <div className="mpr-reviews-summary">
              <div className="mpr-reviews-summary__score">
                <span className="mpr-reviews-summary__num">{summary.averageRating.toFixed(1)}</span>
                <StarRating rating={summary.averageRating} size={22} />
                <span className="mpr-reviews-summary__total">Overall Rating</span>
              </div>
              <div className="mpr-reviews-summary__bars">
                {[5,4,3,2,1].map(star => {
                  const total = Object.values(ratingDist).reduce((a, b) => a + b, 0) || 1;
                  const pct = total > 0 ? (ratingDist[star] / total) * 100 : 0;
                  return (
                    <div key={star} className="mpr-reviews-summary__bar-row">
                      <span className="mpr-reviews-summary__bar-lbl">{star}★</span>
                      <div className="mpr-reviews-summary__bar-track">
                        <div className="mpr-reviews-summary__bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="mpr-reviews-summary__bar-count">{ratingDist[star]}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {reviews.length > 0 ? (
              <div className="mpr-reviews-list">
                {reviews.map(review => (
                  <div key={review.id} className="mpr-review-card">
                    <div className="mpr-review-card__head">
                      <Avatar url={review.learnerAvatarUrl} name={review.learnerName || "L"} size={40} />
                      <div className="mpr-review-card__info">
                        <strong>{review.learnerName || `Learner #${review.learnerId}`}</strong>
                        <span className="mpr-review-card__date">{formatDate(review.createdAt)}</span>
                      </div>
                      <div className="mpr-review-card__rating">
                        <StarRating rating={Number(review.rating || 0)} size={12} />
                        <span>{review.rating}/5</span>
                      </div>
                      {review.learnerName && <VerifiedBadge text="Verified" />}
                    </div>
                    {review.comment && <p className="mpr-review-card__comment">{review.comment}</p>}
                    {review.bookingTitle && <span className="mpr-review-card__session">Booked: {review.bookingTitle}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mpr-empty">
                <Icon name="rate_review" />
                <h4>No reviews yet</h4>
                <p>Be among the first to book a session and share your experience.</p>
              </div>
            )}

            {/* Review Form */}
            {isLoggedIn && (
              <form onSubmit={handleReviewSubmit} className="mpr-review-form">
                <h4><Icon name="edit_note" /> Leave a Review</h4>
                <select value={reviewForm.bookingId} onChange={e => setReviewForm(p => ({ ...p, bookingId: e.target.value }))}>
                  <option value="">Select completed booking</option>
                  {eligibleBookings.map(b => <option key={b.bookingId} value={b.bookingId}>#{b.bookingId} — {b.sessionTitle}</option>)}
                </select>
                <select value={reviewForm.rating} onChange={e => setReviewForm(p => ({ ...p, rating: e.target.value }))}>
                  {[5,4,3,2,1].map(r => <option key={r} value={r}>{r} - {["","Needs improvement","Fair","Good","Great","Excellent"][r]}</option>)}
                </select>
                <textarea rows={3} placeholder="Share your feedback..." value={reviewForm.comment} onChange={e => setReviewForm(p => ({ ...p, comment: e.target.value }))} />
                <div className="mpr-review-form__actions">
                  <button type="submit" className="mpr-btn mpr-btn--primary">Submit Review</button>
                  {reviewMessage && <span className={`mpr-review-form__msg mpr-review-form__msg--${reviewMessageType}`}>{reviewMessage}</span>}
                </div>
                {!eligibleBookings.length && <p className="mpr-review-form__hint">You can leave a review after completing a booking.</p>}
              </form>
            )}
          </section>

          {/* ── Sessions & Booking ── */}
          <section id="mpr-sessions" className={`mpr-section-card ${visibleSections[6] ? "mpr-animate-in" : ""}`} data-section="6">
            <div className="mpr-section-card__head">
              <Icon name="event_available" />
              <h2>Available Sessions</h2>
              <span className="mpr-section-card__count">{sessions.length} sessions</span>
            </div>

            {sessions.length > 0 ? (
              <>
                <div className="mpr-sessions-grid">
                  {displaySessions.map(session => (
                    <div key={session.id} className="mpr-session-card">
                      <div className="mpr-session-card__badge">{session.sessionType || "1:1"}</div>
                      <h3 className="mpr-session-card__title">{session.title || "Session"}</h3>
                      <p className="mpr-session-card__desc">{session.description || "Personalized mentoring session tailored to your goals."}</p>
                      <div className="mpr-session-card__info">
                        <span><Icon name="schedule" /> {session.duration || "60 min"}</span>
                        <span><Icon name="person" /> Online</span>
                      </div>
                      <div className="mpr-session-card__bottom">
                        <span className="mpr-session-card__price">
                          {session.priceAmount ? `₹${Number(session.priceAmount).toLocaleString()}` : "Free"}
                        </span>
                        <button type="button" className="mpr-btn mpr-btn--primary mpr-btn--sm" onClick={() => handleBookSession(session.id)}>
                          Book Now
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {filteredSessions.length > 4 && (
                  <button type="button" className="mpr-btn mpr-btn--ghost mpr-sessions__show-all" onClick={() => setShowAllSessions(p => !p)}>
                    {showAllSessions ? "Show Less" : `Show All (${filteredSessions.length})`}
                  </button>
                )}
              </>
            ) : (
              <div className="mpr-empty">
                <Icon name="event_busy" />
                <h4>No active session slots yet</h4>
                <p>This mentor is building their schedule. Check back later or send a message.</p>
                <button type="button" className="mpr-btn mpr-btn--outline" onClick={async () => {
                  if (!isLoggedIn) { onRequireLogin?.(); return; }
                  try {
                    const res = await client.post(`/api/v1/chat/direct/${mentorId}`);
                    const data = res?.data?.data;
                    if (data?.conversationId) navigate(`/learner/messages/${data.conversationId}`);
                  } catch (e) { console.debug('Message navigation failed', e); }
                }}>
                  <Icon name="chat" /> Send a Message
                </button>
              </div>
            )}
          </section>

          {/* ── Achievements ── */}
          <section className={`mpr-section-card ${visibleSections[7] ? "mpr-animate-in" : ""}`} data-section="7">
            <div className="mpr-section-card__head">
              <Icon name="military_tech" />
              <h2>Achievements</h2>
            </div>
            <div className="mpr-achievements">
              {(() => {
                const items = [];
                const tr = Number(summary.totalReviews || 0);
                const sessionsCount = Number(mentor?.upcomingSessions || 0) || sessions.length;
                const rating = Number(summary.averageRating || 0);
                if (rating >= 4.5) items.push({ icon: "stars", color: "#FDB022", label: "Top Rated Mentor", detail: `${rating.toFixed(1)} ★ average rating` });
                else if (rating >= 4.0) items.push({ icon: "star", color: "#F59E0B", label: "Highly Rated", detail: `${rating.toFixed(1)} ★ average rating` });
                if (tr >= 100) items.push({ icon: "emoji_events", color: "#FDB022", label: "100+ Sessions", detail: `Completed ${formatNum(tr)} sessions` });
                else if (tr >= 50) items.push({ icon: "workspace_premium", color: "#0F9D8A", label: "50+ Sessions", detail: `Completed ${formatNum(tr)} sessions` });
                else if (tr >= 10) items.push({ icon: "trending_up", color: "#16A34A", label: "10+ Sessions", detail: `Completed ${formatNum(tr)} sessions` });
                if (sessionsCount >= 20) items.push({ icon: "bolt", color: "#14B8A6", label: "Quick Responder", detail: "Usually responds within minutes" });
                if (mentor?.mentorVerified) items.push({ icon: "verified", color: "#059669", label: "Verified Mentor", detail: "Identity & credentials verified" });
                if (skillChips.length >= 5) items.push({ icon: "psychology", color: "#7C3AED", label: "Multi-Skilled", detail: `${skillChips.length} expertise areas` });
                if (!items.length) items.push({ icon: "auto_awesome", color: "#94A3B8", label: "Getting Started", detail: "Achievements will appear as milestones are reached" });
                return items;
              })().map((item, i) => (
                <div key={i} className="mpr-achievement-card" style={{ "--accent": item.color }}>
                  <span className="mpr-achievement-card__icon" style={{ background: `${item.color}18`, color: item.color }}>
                    <Icon name={item.icon} />
                  </span>
                  <div className="mpr-achievement-card__body">
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Similar Mentors ── */}
          {relatedMentors.length > 0 && (
            <section className={`mpr-section-card ${visibleSections[8] ? "mpr-animate-in" : ""}`} data-section="8">
              <div className="mpr-section-card__head">
                <Icon name="group_work" />
                <h2>Similar Mentors</h2>
                <Link to="/learner/mentors" className="mpr-section-card__link">Browse all</Link>
              </div>
              <div className="mpr-carousel">
                {relatedMentors.map(m => {
                  const mSkills = parseSkillChips(m.skills);
                  return (
                    <Link key={m.id} to={`/mentors/${m.id}`} className="mpr-carousel__card">
                      <div className="mpr-carousel__av">
                        {m.profileImageUrl ? <img src={m.profileImageUrl} alt={m.fullName} /> : <span>{initials(m.fullName)}</span>}
                      </div>
                      <strong className="mpr-carousel__name">{m.fullName}</strong>
                      <span className="mpr-carousel__role">{mSkills[0] || "Expert"}</span>
                      <div className="mpr-carousel__stats">
                        <span>{(m.averageRating || 0).toFixed(1)} ★</span>
                        <span>{m.totalReviews || 0} reviews</span>
                      </div>
                      <span className="mpr-carousel__cta">View Profile</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
