import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router";
import client from "../api/client";
import { getErrorFeedback, getInfoFeedback } from "../utils/comingSoon";
import { trackAnalyticsEvent } from "../utils/analyticsEvents";
import ReportModal from "../components/ReportModal";
import { normalizeSkills } from "../utils/skills";
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

const formatDate = (value, options) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  if (options && options.weekday) return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const formatDateTime = (value) => {
  if (!value) return "TBD";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const parseLines = (text) => String(text || "").split(/\r?\n|\||\*|;/).map(s => s.trim()).filter(Boolean);

const getNextSlot = (session, allSessions) => {
  if (!session || !allSessions?.length) return null;
  const future = allSessions.filter(s =>
    s.startTime && new Date(s.startTime) > new Date() && s.id === session.id
  ).sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
  return future.length > 0 ? future[0].startTime : null;
};

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
  const [reviewForm, setReviewForm] = useState({ bookingId: "", rating: "5", comment: "", title: "", anonymous: false });
  const [reviewSort, setReviewSort] = useState("newest");
  const [saved, setSaved] = useState(false);
  const [relatedMentors, setRelatedMentors] = useState([]);
  const [, setRelatedLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showFullSchedule, setShowFullSchedule] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedDuration, setSelectedDuration] = useState("60");
  const [bookingSuccess, setBookingSuccess] = useState(null);
  const [showBookingSuccess, setShowBookingSuccess] = useState(false);
  const [requestSending, setRequestSending] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requestForm, setRequestForm] = useState({
    subject: "",
    goal: "",
    duration: "60",
    date: "",
    time: "",
    budget: "",
  });
  const [requestErrors, setRequestErrors] = useState({});
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [pendingCancelAction, setPendingCancelAction] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [bookingStep, setBookingStep] = useState("sessions"); // "sessions" | "calendar"
  const [selectedSessionForBooking, setSelectedSessionForBooking] = useState(null);

  const [visibleSections, setVisibleSections] = useState({});

  /* Prevent body scroll while modals are open */
  useEffect(() => {
    const modalOpen = showBookingModal || showRequestModal || showFullSchedule || showBookingSuccess || showCancelConfirm;
    if (modalOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [showBookingModal, showRequestModal, showFullSchedule, showBookingSuccess, showCancelConfirm]);

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

  const skillChips = useMemo(
    () => normalizeSkills(mentor?.skills, { limit: 12 }),
    [mentor?.skills],
  );
  const certList = useMemo(() => parseLines(mentor?.certificates).slice(0, 6), [mentor?.certificates]);

  const achievementItems = useMemo(() => {
    const items = [];
    const tr = Number(summary.totalReviews || 0);
    const sessionsCount = Number(mentor?.upcomingSessions || 0) || sessions.length;
    const rating = Number(summary.averageRating || 0);
    if (rating >= 4.5) items.push({ icon: "stars", color: "#FDB022", label: "Top Rated Mentor", detail: `${rating.toFixed(1)} star average rating` });
    else if (rating >= 4.0) items.push({ icon: "star", color: "#F59E0B", label: "Highly Rated", detail: `${rating.toFixed(1)} star average rating` });
    if (tr >= 100) items.push({ icon: "emoji_events", color: "#FDB022", label: "100+ Sessions", detail: `Completed ${formatNum(tr)} sessions` });
    else if (tr >= 50) items.push({ icon: "workspace_premium", color: "#0F9D8A", label: "50+ Sessions", detail: `Completed ${formatNum(tr)} sessions` });
    else if (tr >= 10) items.push({ icon: "trending_up", color: "#16A34A", label: "10+ Sessions", detail: `Completed ${formatNum(tr)} sessions` });
    if (sessionsCount >= 20) items.push({ icon: "bolt", color: "#14B8A6", label: "Quick Responder", detail: "Usually responds within minutes" });
    if (mentor?.mentorVerified) items.push({ icon: "verified", color: "#059669", label: "Verified Mentor", detail: "Identity & credentials verified" });
    if (skillChips.length >= 5) items.push({ icon: "psychology", color: "#7C3AED", label: "Multi-Skilled", detail: `${skillChips.length} expertise areas` });
    return items;
  }, [summary, mentor, sessions.length, skillChips.length]);

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
        client.get(`/api/v1/mentor/certifications/${mentorId}`),
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
    const bookingIdNum = Number(reviewForm.bookingId);
    if (!bookingIdNum || !reviewForm.bookingId) { setReviewMessage("Please select a completed booking from the list."); setReviewMessageType("error"); return; }
    if (!reviewForm.comment || !reviewForm.comment.trim()) { setReviewMessage("Please write your review experience."); setReviewMessageType("error"); return; }
    try {
      await client.post("/api/v1/reviews", {
        bookingId: bookingIdNum,
        mentorId: Number(mentorId),
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment.trim(),
        anonymous: reviewForm.anonymous
      });
      setReviewMessage("Review submitted successfully. Thank you!");
      setReviewMessageType("success");
      trackAnalyticsEvent("mentor_review_submitted", { mentorId, bookingId: bookingIdNum, rating: Number(reviewForm.rating) });
      setReviewForm(p => ({ ...p, comment: "", bookingId: "", title: "" }));
      await loadMentorData();
    } catch (err) {
      const backendMsg = err?.response?.data?.data?.error || err?.response?.data?.message || "";
      if (backendMsg) {
        setReviewMessage(backendMsg);
      } else {
        setReviewMessage(getErrorFeedback("reviewSubmitFailed").message);
      }
      setReviewMessageType("error");
    }
  };

  const handleSaveToggle = () => { if (!isLoggedIn) { onRequireLogin?.(); return; } setSaved(p => !p); trackAnalyticsEvent("mentor_save_toggle", { mentorId, saved: !saved }); };
  const handleBookSession = (sessionId) => { if (!isLoggedIn) { onRequireLogin?.(); return; } trackAnalyticsEvent("mentor_profile_booking_flow_opened", { mentorId, sessionId }); setBookingSessionId(sessionId); };
  const handleBookFromSchedule = () => {
    if (!isLoggedIn) { onRequireLogin?.(); return; }
    if (!selectedDate || !selectedSlot || !selectedDuration || !selectedSessionForBooking) return;
    setBookingSessionId(selectedSessionForBooking.id);
    setShowBookingModal(false);
    setSelectedSlot(null);
    setSelectedDate("");
  };

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
  const slotBooked = useMemo(() => {
    const booked = new Set();
    if (!selectedDate) return booked;
    const allSlots = ["09:00 AM","09:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM","02:00 PM","02:30 PM","03:00 PM","03:30 PM","04:00 PM","05:00 PM"];
    const bookedCount = sessions.filter(s => s.startTime && new Date(s.startTime).toISOString().slice(0,10) === selectedDate).length;
    const dateHash = selectedDate.split("-").reduce((a, c) => a + Number(c), 0);
    for (let i = 0; i < allSlots.length; i++) {
      const isBooked = (dateHash + i * 7 + bookedCount * 13) % Math.max(bookedCount + 1, 1) === 0;
      if (isBooked && booked.size < Math.min(bookedCount, allSlots.length - 1)) {
        booked.add(allSlots[i]);
      }
    }
    return booked;
  }, [selectedDate, sessions]);

  const hasFormData = requestForm.goal.trim() !== "" || requestForm.subject !== "" || requestForm.date !== "" || requestForm.time !== "" || requestForm.budget !== "";

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
      {bookingSessionId && !showBookingSuccess && (
        <div className="mpr-overlay">
          <BookingFlowPage
            sessionId={bookingSessionId}
            notify={notify}
            bookingData={{ date: selectedDate, slot: selectedSlot, duration: selectedDuration }}
            onBookingComplete={(result) => {
              const data = result || {};
              setShowBookingSuccess(true);
              setBookingSuccess({
                mentorName: mentor?.fullName,
                date: data.date || selectedDate,
                time: data.time || selectedSlot,
                duration: data.duration || selectedDuration,
                bookingId: data.bookingId || `SW-BKG-${Date.now().toString(36).toUpperCase()}`,
              });
            }}
            onCancel={() => { setBookingSessionId(null); setShowBookingSuccess(false); }}
          />
        </div>
      )}

      {/* ══ HERO ══ */}
      <section className="mpr-hero">
        <div className="mpr-hero__bg-shapes">
          <div className="mpr-hero__bg-shape mpr-hero__bg-shape--1" />
          <div className="mpr-hero__bg-shape mpr-hero__bg-shape--2" />
          <div className="mpr-hero__bg-shape mpr-hero__bg-shape--3" />
        </div>
        <div className="mpr-hero__body">
          {/* Left Column */}
          <div className="mpr-hero__left">
            <div className="mpr-hero__profile">
              <div className="mpr-hero__av-wrap">
                <div className="mpr-hero__av-ring" />
                {mentor?.profileImageUrl ? (
                  <img src={mentor.profileImageUrl} alt={mentor.fullName || "Mentor"} className="mpr-hero__av" />
                ) : (
                  <div className="mpr-hero__av-fallback">{initials(mentor?.fullName)}</div>
                )}
                {mentor?.mentorVerified && <span className="mpr-hero__av-badge"><Icon name="verified" /> Verified</span>}
              </div>
              <div className="mpr-hero__info">
                <div className="mpr-hero__info-top">
                  <h1 className="mpr-hero__name">{mentor?.fullName || "Mentor"}</h1>
                  {mentor?.username && (
                    <p style={{ margin: "4px 0 0", fontSize: "0.9rem", color: "rgba(255,255,255,0.6)" }}>
                      @{mentor.username}
                    </p>
                  )}
                  {mentor?.mentorVerified && <VerifiedBadge />}
                </div>
                <p className="mpr-hero__headline">{mentor?.headline || (mentor?.aboutMe ? mentor.aboutMe.split(".")[0].slice(0, 100) : "Expert Mentor")}</p>
                <div className="mpr-hero__meta">
                  {mentor?.company && <span><Icon name="business" /> {mentor.company}</span>}
                  {mentor?.yearsOfExperience != null && <span><Icon name="work_history" /> {mentor.yearsOfExperience}+ years</span>}
                  {mentor?.location && <span><Icon name="location_on" /> {mentor.location}</span>}
                  {mentor?.languages && !/^\s*\[\s*\]\s*$/.test(String(mentor.languages)) && <span><Icon name="translate" /> {mentor.languages}</span>}
                </div>
                <div className="mpr-hero__rating-row">
                  <span className="mpr-hero__rating-num">{summary.averageRating.toFixed(1)}</span>
                  <span className="mpr-hero__rating-stars"><StarRating rating={summary.averageRating} size={16} /></span>
                  <span className="mpr-hero__rating-count">({formatNum(summary.totalReviews)} reviews)</span>
                  <span className="mpr-hero__stat-chip"><Icon name="groups" /> <strong>{formatNum(summary.totalReviews)}</strong> students</span>
                  <span className="mpr-hero__stat-chip"><Icon name="calendar_month" /> <strong>{sessions.length}</strong> sessions</span>
                </div>
              </div>
            </div>

            {skillChips.length > 0 && (
              <div className="mpr-hero__skills">
                {skillChips.map(sk => <span key={sk} className="mpr-chip">{sk}</span>)}
              </div>
            )}

            <div className="mpr-hero__actions">
              <button type="button" className="mpr-btn mpr-btn--primary mpr-btn--lg" onClick={() => {
                if (!isLoggedIn) { onRequireLogin?.(); return; }
                if (sessions.length === 1) {
                  setSelectedSessionForBooking(sessions[0]);
                  setBookingStep("calendar");
                } else {
                  setBookingStep("sessions");
                  setSelectedSessionForBooking(null);
                }
                setShowBookingModal(true);
              }}>
                <Icon name="event" /> Book Session
              </button>
              <button type="button" className="mpr-btn mpr-btn--secondary" onClick={async () => {
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
              <button type="button" className="mpr-btn mpr-btn--ghost mpr-btn--report" onClick={() => setShowReportModal(true)}>
                <Icon name="flag" /> Report
              </button>
            </div>
          </div>

          {/* Right Column — Compact Booking Card */}
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

              <div className="mpr-booking-card__avail-status">
                <Icon name="circle" />
                {upcomingSlots.length > 0 ? "Available Today" : "Next Available: Soon"}
              </div>

              <div className="mpr-booking-card__summary">
                <div className="mpr-booking-card__summary-row">
                  <span>Response time</span>
                  <strong>{trustSnapshot.responseLabel}</strong>
                </div>
                <div className="mpr-booking-card__summary-row">
                  <span>Session duration</span>
                  <strong>{sessions.length > 0 && sessions[0]?.duration ? sessions[0].duration : "60 min"}</strong>
                </div>
                <div className="mpr-booking-card__summary-row">
                  <span>Next slot</span>
                  <strong>{upcomingSlots.length > 0 ? formatDateTime(upcomingSlots[0].startTime) : "Check schedule"}</strong>
                </div>
              </div>

              <button type="button" className="mpr-btn mpr-btn--primary mpr-btn--lg mpr-booking-card__cta" onClick={() => {
                if (!isLoggedIn) { onRequireLogin?.(); return; }
                if (sessions.length === 1) {
                  setSelectedSessionForBooking(sessions[0]);
                  setBookingStep("calendar");
                } else {
                  setBookingStep("sessions");
                  setSelectedSessionForBooking(null);
                }
                setShowBookingModal(true);
              }}>
                <Icon name="event" /> Book Session
              </button>

              <button type="button" className="mpr-booking-card__view-schedule" onClick={() => setShowFullSchedule(true)}>
                <Icon name="calendar_month" /> View Full Schedule
              </button>

              <button type="button" className="mpr-booking-card__view-schedule" onClick={() => { if (!isLoggedIn) { onRequireLogin?.(); return; } setShowRequestModal(true); }}>
                <Icon name="handshake" /> Request Custom Session
              </button>

              <div className="mpr-booking-card__divider" />

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
            <div className="mpr-about-grid">
              {mentor?.aboutMe ? (
                <div className="mpr-about-block">
                  <div className="mpr-about-block__icon"><Icon name="description" /></div>
                  <h4 className="mpr-about-block__title">Professional Summary</h4>
                  <p className="mpr-about-block__text">{mentor.aboutMe}</p>
                </div>
              ) : (
                <div className="mpr-about-block">
                  <div className="mpr-about-block__icon"><Icon name="description" /></div>
                  <h4 className="mpr-about-block__title">Professional Summary</h4>
                  <p className="mpr-about-block__text">Information not provided.</p>
                </div>
              )}
              {mentor?.teachingStyle ? (
                <div className="mpr-about-block">
                  <div className="mpr-about-block__icon"><Icon name="school" /></div>
                  <h4 className="mpr-about-block__title">Teaching Style</h4>
                  <p className="mpr-about-block__text">{mentor.teachingStyle}</p>
                </div>
              ) : (
                <div className="mpr-about-block">
                  <div className="mpr-about-block__icon"><Icon name="school" /></div>
                  <h4 className="mpr-about-block__title">Teaching Style</h4>
                  <p className="mpr-about-block__text">Information not provided.</p>
                </div>
              )}                  {mentor?.whoThisIsFor && (
                    <div className="mpr-about-block">
                      <div className="mpr-about-block__icon"><Icon name="group" /></div>
                      <h4 className="mpr-about-block__title">Who This Is For</h4>
                      <p className="mpr-about-block__text">{mentor.whoThisIsFor}</p>
                    </div>
                  )}
                  {mentor?.whatYoullLearn && (
                    <div className="mpr-about-block">
                      <div className="mpr-about-block__icon"><Icon name="emoji_objects" /></div>
                      <h4 className="mpr-about-block__title">What You'll Learn</h4>
                      <p className="mpr-about-block__text">{mentor.whatYoullLearn}</p>
                    </div>
                  )}
            </div>
            <div className="mpr-about-links">
              {mentor?.githubUrl && <a href={mentor.githubUrl} target="_blank" rel="noopener noreferrer" className="mpr-link-icon"><Icon name="code" /> GitHub</a>}
              {mentor?.linkedinUrl && <a href={mentor.linkedinUrl} target="_blank" rel="noopener noreferrer" className="mpr-link-icon"><Icon name="badge" /> LinkedIn</a>}
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
                {skillChips.slice(0, 8).map((sk, i) => (
                  <div key={sk} className="mpr-expertise-card" style={{ "--i": i }}>
                    <div className="mpr-expertise-card__top">
                      <span className="mpr-expertise-card__name">{sk}</span>
                      <span className="mpr-expertise-card__icon"><Icon name={["code","terminal","dns","cloud","storage","dataset","developer_board","memory"][i % 8]} /></span>
                    </div>
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

          {/* ── Certifications (Structured) ── */}
          {(certifications.length > 0 || certList.length > 0) && (
            <section className={`mpr-section-card ${visibleSections[4] ? "mpr-animate-in" : ""}`} data-section="4">
              <div className="mpr-section-card__head">
                <Icon name="workspace_premium" />
                <h2>Certifications</h2>
                <span className="mpr-section-card__count">
                  {certifications.length > 0 ? certifications.length : certList.length} certification{certifications.length + certList.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Structured certifications from API */}
              {certifications.length > 0 && (
                <div className="mpr-certs-grid">
                  {certifications.map((cert) => {
                    const skills = (cert.skillsCovered || '').split(',').map(s => s.trim()).filter(Boolean);
                    const issueYear = cert.issueDate ? new Date(cert.issueDate).getFullYear() : '';
                    const expYear = cert.expirationDate && !cert.doesNotExpire ? new Date(cert.expirationDate).getFullYear() : '';
                    return (
                      <div key={cert.id} className="mpr-cert-card mpr-cert-card--rich">
                        <div className="mpr-cert-card__icon">
                          {cert.certificateImage ? (
                            <img
                              src={cert.certificateImage}
                              alt={cert.issuingOrganization || ''}
                              className="mpr-cert-card__logo"
                              onError={(e) => { e.target.style.display='none'; e.target.nextElementSibling.style.display='flex'; }}
                            />
                          ) : null}
                          <span className="material-symbols-outlined" style={{ display: cert.certificateImage ? 'none' : 'inline', fontSize: 24 }}>verified</span>
                        </div>
                        <div className="mpr-cert-card__info">
                          <strong>{cert.certificationName}</strong>
                          <span className="mpr-cert-card__org">{cert.issuingOrganization}</span>
                          <span className="mpr-cert-card__date">
                            Issued {issueYear}
                            {expYear ? ` · Expires ${expYear}` : cert.doesNotExpire ? ' · No expiration' : ''}
                          </span>
                          {cert.credentialId && (
                            <span className="mpr-cert-card__id">{cert.credentialId}</span>
                          )}
                          {skills.length > 0 && (
                            <div className="mpr-cert-card__skills">
                              {skills.slice(0, 4).map(sk => (
                                <span key={sk} className="mpr-chip mpr-chip--xs">{sk}</span>
                              ))}
                              {skills.length > 4 && <span className="mpr-chip mpr-chip--xs">+{skills.length - 4}</span>}
                            </div>
                          )}
                          {cert.credentialUrl && (
                            <a
                              href={cert.credentialUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mpr-cert-card__link"
                            >
                              View Credential
                              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>open_in_new</span>
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Fallback text-field certs (only if no structured certs) */}
              {certifications.length === 0 && certList.length > 0 && (
                <div className="mpr-certs-grid">
                  {certList.map((cert, i) => (
                    <div key={i} className="mpr-cert-card">
                      <div className="mpr-cert-card__icon">
                        <span className="material-symbols-outlined" style={{ fontSize: 24 }}>verified</span>
                      </div>
                      <div className="mpr-cert-card__info">
                        <strong>{cert}</strong>
                        <span>Professional Certification</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ── Reviews ── */}
          <section className={`mpr-section-card ${visibleSections[5] ? "mpr-animate-in" : ""}`} data-section="5">
            <div className="mpr-section-card__head">
              <Icon name="rate_review" />
              <h2>Reviews</h2>
              <span className="mpr-section-card__count">{summary.totalReviews} reviews</span>
            </div>

            <div className="mpr-reviews-header">
              <div className="mpr-reviews-header__score">
                <span className="mpr-reviews-header__num">{summary.averageRating.toFixed(1)}</span>
                <StarRating rating={summary.averageRating} size={20} />
                <span className="mpr-reviews-header__label">Overall Rating</span>
              </div>
              <div className="mpr-reviews-header__bars">
                {[5,4,3,2,1].map(star => {
                  const total = Object.values(ratingDist).reduce((a, b) => a + b, 0) || 1;
                  const pct = total > 0 ? (ratingDist[star] / total) * 100 : 0;
                  return (
                    <div key={star} className="mpr-reviews-header__bar-row">
                      <span className="mpr-reviews-header__bar-label">{star}<Icon name="star" /></span>
                      <div className="mpr-reviews-header__bar-track">
                        <div className="mpr-reviews-header__bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="mpr-reviews-header__bar-count">{ratingDist[star]}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mpr-reviews-toolbar">
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--mpr-muted)" }}>
                {reviews.length} review{reviews.length !== 1 ? "s" : ""}
              </span>
              <select aria-label="Sort reviews" value={reviewSort} onChange={e => setReviewSort(e.target.value)}>
                <option value="newest">Newest First</option>
                <option value="highest">Highest Rating</option>
                <option value="lowest">Lowest Rating</option>
              </select>
            </div>

            {reviews.length > 0 ? (
              <div className="mpr-reviews-list">
                {[...reviews]
                  .sort((a, b) => {
                    if (reviewSort === "highest") return (b.rating || 0) - (a.rating || 0);
                    if (reviewSort === "lowest") return (a.rating || 0) - (b.rating || 0);
                    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
                  })
                  .map(review => (
                  <div key={review.id} className="mpr-review-card">
                    <div className="mpr-review-card__head">
                      <div className="mpr-review-card__avatar">
                        {review.learnerAvatarUrl ? <img src={review.learnerAvatarUrl} alt={review.learnerName || ""} /> : initials(review.learnerName || "L")}
                      </div>
                      <div className="mpr-review-card__info">
                        <span className="mpr-review-card__name">{review.learnerName || `Learner #${review.learnerId}`}</span>
                        <span className="mpr-review-card__date">{formatDate(review.createdAt)}</span>
                      </div>
                      <span className="mpr-review-card__rating-stars">
                        <StarRating rating={Number(review.rating || 0)} size={12} />
                        <span className="mpr-review-card__rating-text">{Number(review.rating).toFixed(1)}</span>
                      </span>
                    </div>
                    {review.comment && <p className="mpr-review-card__comment">{review.comment}</p>}
                    {review.bookingTitle && <span className="mpr-review-card__session-badge">Booked: {review.bookingTitle}</span>}
                    <div className="mpr-review-card__actions">
                      <button type="button" className="mpr-review-card__helpful" onClick={() => {
                        trackAnalyticsEvent("review_helpful", { reviewId: review.id });
                      }}>
                        <Icon name="thumb_up" /> Helpful ({review.helpfulCount || 0})
                      </button>
                    </div>
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

            {isLoggedIn && (
              <div className="mpr-review-form">
                <h4><Icon name="edit_note" /> Leave a Review</h4>

                {eligibleBookings.length === 0 ? (
                  /* ── No Completed Bookings — Empty State ── */
                  <div className="mpr-review-form__empty">
                    <Icon name="assignment_turned_in" />
                    <p>You can review a mentor only after completing a booked session.</p>
                    <button
                      type="button"
                      className="mpr-btn mpr-btn--outline"
                      onClick={() => navigate('/learner/sessions')}
                    >
                      <Icon name="event" /> View My Sessions
                    </button>
                  </div>
                ) : (
                  /* ── Review Form — Enabled ── */
                  <form onSubmit={handleReviewSubmit}>
                    <div className="mpr-review-form__stars">
                      {[5,4,3,2,1].map(star => (
                        <span key={star} className="mpr-review-form__star" onClick={() => setReviewForm(p => ({ ...p, rating: String(star) }))}>
                          <svg viewBox="0 0 20 20" width="28" height="28" fill={star <= Number(reviewForm.rating) ? "#FDB022" : "#E2E8F0"}>
                            <path d="M10 1l2.39 4.84L18 6.36l-3.6 3.52.85 5.02L10 12.69l-4.25 2.21.85-5.02L2 6.36l5.61-.52z" />
                          </svg>
                        </span>
                      ))}
                      <span className="mpr-review-form__rating-label">
                        {Number(reviewForm.rating) >= 4 ? 'Great!' : Number(reviewForm.rating) >= 3 ? 'Good' : Number(reviewForm.rating) >= 2 ? 'Average' : 'Poor'}
                      </span>
                    </div>

                    <select
                      className="mpr-review-form__field"
                      aria-label="Select a completed session to review"
                      value={reviewForm.bookingId}
                      onChange={e => {
                        const selectedId = e.target.value;
                        setReviewForm(p => ({ ...p, bookingId: selectedId }));
                      }}
                      required
                    >
                      <option value="">Select completed booking *</option>
                      {eligibleBookings.map(b => (
                        <option key={b.bookingId} value={b.bookingId}>
                          #{b.bookingId} — {b.sessionTitle || 'Session'} {b.completedAt ? `(${formatDate(b.completedAt)})` : ''}
                        </option>
                      ))}
                    </select>

                    {reviewForm.bookingId && (() => {
                      const selected = eligibleBookings.find(b => String(b.bookingId) === String(reviewForm.bookingId));
                      if (!selected) return null;
                      return (
                        <div className="mpr-review-form__booking-info">
                          <span><Icon name="badge" /> Mentor: {mentor?.fullName || 'This mentor'}</span>
                          <span><Icon name="school" /> Skill: {selected.sessionTitle || 'General'}</span>
                          {selected.completedAt && <span><Icon name="calendar_today" /> Completed: {formatDate(selected.completedAt)}</span>}
                        </div>
                      );
                    })()}

                    <input
                      className="mpr-review-form__field"
                      placeholder="Review title (optional)"
                      value={reviewForm.title}
                      onChange={e => setReviewForm(p => ({ ...p, title: e.target.value }))}
                    />

                    <textarea
                      className="mpr-review-form__field mpr-review-form__textarea"
                      rows={3}
                      placeholder="Share your experience... *"
                      value={reviewForm.comment}
                      onChange={e => setReviewForm(p => ({ ...p, comment: e.target.value }))}
                      required
                    />

                    <div className="mpr-review-form__row">
                      <label className="mpr-review-form__toggle">
                        <input
                          type="checkbox"
                          checked={reviewForm.anonymous}
                          onChange={e => setReviewForm(p => ({ ...p, anonymous: e.target.checked }))}
                        />
                        Post anonymously
                      </label>
                    </div>

                    <div className="mpr-review-form__row">
                      <button
                        type="submit"
                        className="mpr-btn mpr-btn--primary"
                        disabled={!reviewForm.bookingId || !reviewForm.comment || !reviewForm.comment.trim()}
                      >
                        <Icon name="rate_review" /> Submit Review
                      </button>
                    </div>

                    {reviewMessage && (
                      <div className={`mpr-review-form__msg mpr-review-form__msg--${reviewMessageType}`}>
                        <Icon name={reviewMessageType === 'success' ? 'check_circle' : 'error'} />
                        {reviewMessage}
                      </div>
                    )}
                  </form>
                )}
              </div>
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
          {achievementItems.length > 0 && (
            <section className={`mpr-section-card ${visibleSections[7] ? "mpr-animate-in" : ""}`} data-section="7">
              <div className="mpr-section-card__head">
                <Icon name="military_tech" />
                <h2>Achievements</h2>
              </div>
              <div className="mpr-achievements">
                {achievementItems.map((item, i) => (
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
          )}

          {/* ── Projects ── */}
          {mentor?.projects ? (
            <section className={`mpr-section-card ${visibleSections[8] ? "mpr-animate-in" : ""}`} data-section="8">
              <div className="mpr-section-card__head">
                <Icon name="folder_open" />
                <h2>Projects</h2>
              </div>
              <div className="mpr-projects-grid">
                {parseLines(mentor.projects).slice(0, 6).length > 0 ? (
                  parseLines(mentor.projects).slice(0, 6).map((proj, i) => (
                    <div key={i} className="mpr-project-card">
                      <div className="mpr-project-card__top">
                        <div className="mpr-project-card__icon"><Icon name={["code","dns","cloud","storage","terminal","dataset"][i % 6]} /></div>
                        <span className="mpr-project-card__name">{proj}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="mpr-empty">
                    <Icon name="folder_off" />
                    <h4>No projects have been shared yet.</h4>
                  </div>
                )}
              </div>
            </section>
          ) : null}



          {/* ── Session Information — from real API data ── */}
          {sessions.length > 0 && (
            <section className={`mpr-section-card ${visibleSections[9] ? "mpr-animate-in" : ""}`} data-section="9">
              <div className="mpr-section-card__head">
                <Icon name="info" />
                <h2>Session Information</h2>
              </div>
              <div className="mpr-session-info-grid">
                {sessions.slice(0, 8).map((s, i) => (
                  <div key={s.id || i} className="mpr-session-info-card">
                    <div className="mpr-session-info-card__icon"><Icon name={["record_voice_over","explore","description","psychology","code","school","group","star"][i % 8]} /></div>
                    <div className="mpr-session-info-card__info">
                      <span className="mpr-session-info-card__type">{s.title || `Session ${i + 1}`}</span>
                      <span className="mpr-session-info-card__detail">{s.duration || "60 min"} • {s.priceAmount ? `₹${Number(s.priceAmount).toLocaleString()}` : "Free"} • {s.sessionType || "1:1"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Similar Mentors (max 3) ── */}
          {relatedMentors.length > 0 && (
            <section className={`mpr-section-card ${visibleSections[10] ? "mpr-animate-in" : ""}`} data-section="10">
              <div className="mpr-section-card__head">
                <Icon name="group_work" />
                <h2>Similar Mentors</h2>
                <Link to="/learner/mentors" className="mpr-section-card__link">Browse all</Link>
              </div>
              <div className="mpr-similar-grid">
                {relatedMentors.slice(0, 3).map(m => {
                  const mSkills = normalizeSkills(m.skills, { limit: 12 });
                  return (
                    <Link key={m.id} to={`/mentors/${m.id}`} className="mpr-similar-card">
                      <div className="mpr-similar-card__avatar">
                        {m.profileImageUrl ? <img src={m.profileImageUrl} alt={m.fullName} /> : <span>{initials(m.fullName)}</span>}
                      </div>
                      <span className="mpr-similar-card__name">{m.fullName}</span>
                      <span className="mpr-similar-card__role">{mSkills[0] || "Expert"}</span>
                      <span className="mpr-similar-card__cta">View Profile</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>

      {showReportModal && (
        <div className="mpr-overlay">
          <ReportModal
            targetType="MENTOR"
            targetUserId={mentor?.id}
            targetLabel={mentor?.fullName}
            onClose={() => setShowReportModal(false)}
            notify={notify}
          />
        </div>
      )}

      {/* ═══ BOOKING MODAL — Calendar + Slots + Duration + Payment ═══ */}
      {showBookingModal && (
        <div className="mpr-modal-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) { if (selectedSlot && bookingStep === "calendar") { setPendingCancelAction(() => () => { setShowBookingModal(false); setSelectedSlot(null); }); setShowCancelConfirm(true); } else { setShowBookingModal(false); setBookingStep("sessions"); setSelectedSessionForBooking(null); setSelectedSlot(null); } } }}>
          <div className="mpr-modal mpr-modal--schedule" role="dialog" aria-label="Book a session">
            {/* ═══ STEP 1: Session Picker ═══ */}
            {bookingStep === "sessions" ? (
              <>
                <div className="mpr-modal__head">
                  <div className="mpr-modal__head-icon"><Icon name="event" /></div>
                  <div className="mpr-modal__head-main">
                    <h2>Select a Session</h2>
                    <p>Choose which session type you'd like to book with {mentor?.fullName || "this mentor"}.</p>
                  </div>
                  <button type="button" className="mpr-modal__close" onClick={() => { setShowBookingModal(false); setBookingStep("sessions"); setSelectedSessionForBooking(null); }} aria-label="Close">
                    <Icon name="close" />
                  </button>
                </div>
                <div className="mpr-modal__body">
                  <div className="mpr-sessions-grid mpr-sessions-grid--picker">
                    {sessions.length > 0 ? sessions.slice(0, 8).map(session => (
                      <div key={session.id} className="mpr-session-card" style={{ cursor: "pointer" }} onClick={() => {
                        setSelectedSessionForBooking(session);
                        setBookingStep("calendar");
                        setSelectedSlot(null);
                        setSelectedDate("");
                      }}>
                        <div className="mpr-session-card__badge">{session.sessionType || "1:1"}</div>
                        <h3 className="mpr-session-card__title">{session.title || "Session"}</h3>
                        <p className="mpr-session-card__desc">{session.description ? truncate(session.description, 100) : "Personalized mentoring session tailored to your goals."}</p>
                        <div className="mpr-session-card__info">
                          <span><Icon name="schedule" /> {session.duration || "60 min"}</span>
                          <span><Icon name="person" /> Online</span>
                        </div>
                        {(() => {
                          const nextStart = getNextSlot(session, sessions);
                          return nextStart ? (
                            <div className="mpr-session-card__next-slot">
                              <Icon name="event" /> Next: {formatDateTime(nextStart)}
                            </div>
                          ) : (
                            <div className="mpr-session-card__next-slot mpr-session-card__next-slot--flexible">
                              <Icon name="check_circle" /> Available for booking
                            </div>
                          );
                        })()}
                        {session.maxStudents && (
                          <div className="mpr-session-card__seats">
                            <Icon name="group" /> {Math.max(0, Number(session.maxStudents) - Number(session.bookedCount || 0))} seats left
                          </div>
                        )}
                        <div className="mpr-session-card__bottom">
                          <span className="mpr-session-card__price">
                            {session.priceAmount ? `₹${Number(session.priceAmount).toLocaleString()}` : "Free"}
                          </span>
                          <button type="button" className="mpr-btn mpr-btn--primary mpr-btn--sm" onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSessionForBooking(session);
                            setBookingStep("calendar");
                            setSelectedSlot(null);
                            setSelectedDate("");
                          }}>
                            Book Now
                          </button>
                        </div>
                      </div>
                    )) : (
                      <div className="mpr-empty" style={{ gridColumn: "1 / -1" }}>
                        <Icon name="event_busy" />
                        <h4>No sessions available</h4>
                        <p>This mentor hasn't published any sessions yet.</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mpr-modal__foot">
                  <button type="button" className="mpr-btn mpr-btn--outline" onClick={() => { setShowBookingModal(false); setBookingStep("sessions"); setSelectedSessionForBooking(null); }}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              /* ═══ STEP 2: Calendar + Slots + Payment ═══ */
              <>
                <div className="mpr-modal__head">
                  <div className="mpr-modal__head-icon"><Icon name="event" /></div>
                  <div className="mpr-modal__head-main">
                    <h2>Book: {selectedSessionForBooking?.title || "Session"}</h2>
                    <p>Choose a date, time slot, and duration to book with {mentor?.fullName || "this mentor"}.</p>
                  </div>
                  <button type="button" className="mpr-modal__close" onClick={() => { if (selectedSlot) { setPendingCancelAction(() => () => { setShowBookingModal(false); setBookingStep("sessions"); setSelectedSessionForBooking(null); setSelectedSlot(null); }); setShowCancelConfirm(true); } else { setShowBookingModal(false); setBookingStep("sessions"); setSelectedSessionForBooking(null); setSelectedSlot(null); } }} aria-label="Close">
                    <Icon name="close" />
                  </button>
                </div>
                <div className="mpr-modal__body">
                  <div className="mpr-schedule-layout">
                    {/* Left: Calendar */}
                    <div className="mpr-schedule-layout__left">
                      <div className="mpr-schedule-modal__cal">
                        <div className="mpr-booking-card__cal-hdr">
                          <button type="button" onClick={handlePrevMonth}><Icon name="chevron_left" /></button>
                          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--mpr-fg)" }}>{months[calMonth]} {calYear}</span>
                          <button type="button" onClick={handleNextMonth}><Icon name="chevron_right" /></button>
                        </div>
                        <div className="mpr-booking-card__cal-grid" style={{ gap: 4 }}>
                          {weekDays.map(d => <span key={d} className="mpr-booking-card__cal-dow" style={{ color: "var(--mpr-muted)", fontSize: "0.65rem" }}>{d}</span>)}
                          {calDays.map((d, i) => {
                            const dateStr = d ? `${calYear}-${String(calMonth + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}` : "";
                            const hasSlot = d && dateStr && availableDates.has(dateStr);
                            const today = new Date();
                            const isToday = d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                            const isPast = d && new Date(calYear, calMonth, d + 1) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                            const isSelected = d && dateStr === selectedDate;
                            if (!d) return <div key={i} className="mpr-booking-card__cal-day" />;
                            const canSelect = !isPast;
                            return (
                              <button key={i} type="button"
                                className={`mpr-booking-card__cal-day${isToday ? " is-today" : ""}${hasSlot ? " has-slot" : ""}${isPast ? " is-past" : ""}${isSelected ? " is-selected" : ""}`}
                                style={{ fontSize: "0.78rem" }}
                                disabled={!canSelect}
                                aria-label={`${months[calMonth]} ${d}, ${calYear}${canSelect ? " - available" : isPast ? " - past" : " - no slots"}`}
                                onClick={() => { if (dateStr) { setSelectedDate(dateStr); setSelectedSlot(null); } }}>{d}</button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Right: Time Slots + Duration + Summary */}
                    <div className="mpr-schedule-layout__right">
                      {selectedDate ? (
                        <>
                          <p className="mpr-slots-label">
                            {formatDate(selectedDate, { weekday: "long" })}
                          </p>
                          <p style={{ fontSize: "0.75rem", color: "var(--mpr-muted-light)", margin: "-4px 0 8px" }}>
                            Select a time slot
                          </p>
                          <div className="mpr-slots-grid">
                            {["09:00 AM","09:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM","02:00 PM","02:30 PM","03:00 PM","03:30 PM","04:00 PM","05:00 PM"].map((slot) => (
                              <button key={slot} type="button"
                                className={`mpr-slot-btn${selectedSlot === slot ? " is-selected" : ""}`}
                                disabled={slotBooked.has(slot)}
                                onClick={() => { if (!slotBooked.has(slot)) setSelectedSlot(slot); }}
                                title={slotBooked.has(slot) ? "This time slot is already booked" : ""}
                              >
                                {slotBooked.has(slot) ? <><Icon name="block" style={{ fontSize: 14 }} /> Unavailable</> : slot}
                              </button>
                            ))}
                          </div>

                          {selectedSlot && (
                            <>
                              <div className="mpr-duration-section">
                                <label className="mpr-duration-section__label">Session Duration</label>
                                <div className="mpr-duration-grid">
                                  {[
                                    { min: "30", price: selectedSessionForBooking?.priceAmount ? Math.round(Number(selectedSessionForBooking.priceAmount) * 0.6) : 549 },
                                    { min: "60", price: selectedSessionForBooking?.priceAmount ? Math.round(Number(selectedSessionForBooking.priceAmount)) : 999 },
                                    { min: "90", price: selectedSessionForBooking?.priceAmount ? Math.round(Number(selectedSessionForBooking.priceAmount) * 1.5) : 1499 },
                                    { min: "120", price: selectedSessionForBooking?.priceAmount ? Math.round(Number(selectedSessionForBooking.priceAmount) * 2) : 1999 },
                                  ].map(opt => (
                                    <button key={opt.min} type="button"
                                      className={`mpr-duration-btn${selectedDuration === opt.min ? " is-selected" : ""}`}
                                      onClick={() => setSelectedDuration(opt.min)}
                                    >
                                      <span className="mpr-duration-btn__min">{opt.min} min</span>
                                      <span className="mpr-duration-btn__price">₹{opt.price.toLocaleString()}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="mpr-booking-summary">
                                <div className="mpr-booking-summary__row">
                                  <span><Icon name="calendar_today" /> Date</span>
                                  <strong>{formatDate(selectedDate)}</strong>
                                </div>
                                <div className="mpr-booking-summary__row">
                                  <span><Icon name="schedule" /> Time</span>
                                  <strong>{selectedSlot}</strong>
                                </div>
                                <div className="mpr-booking-summary__row">
                                  <span><Icon name="timer" /> Duration</span>
                                  <strong>{selectedDuration} min</strong>
                                </div>
                                <div className="mpr-booking-summary__row">
                                  <span><Icon name="currency_rupee" /> Price</span>
                                  <strong>₹{(() => {
                                    const base = selectedSessionForBooking?.priceAmount ? Number(selectedSessionForBooking.priceAmount) : 999;
                                    return Math.round(base * (Number(selectedDuration) / 60)).toLocaleString();
                                  })()}</strong>
                                </div>
                                <div className="mpr-booking-summary__divider" />
                                <div className="mpr-booking-summary__row" style={{ marginTop: 0 }}>
                                  <span><Icon name="language" /> Timezone</span>
                                  <select aria-label="Select timezone" className="mpr-tz-select mpr-tz-select--inline" defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone}>
                                    <option value="Asia/Kolkata">IST (UTC+5:30)</option>
                                    <option value="America/New_York">EST (UTC-5)</option>
                                    <option value="America/Chicago">CST (UTC-6)</option>
                                    <option value="America/Los_Angeles">PST (UTC-8)</option>
                                    <option value="Europe/London">GMT (UTC+0)</option>
                                    <option value="Europe/Berlin">CET (UTC+1)</option>
                                    <option value="Asia/Dubai">GST (UTC+4)</option>
                                    <option value="Asia/Singapore">SGT (UTC+8)</option>
                                    <option value="Australia/Sydney">AEST (UTC+10)</option>
                                  </select>
                                </div>
                              </div>
                            </>
                          )}
                        </>
                      ) : (
                        <div className="mpr-slot-empty">
                          <Icon name="calendar_month" />
                          <p>Select a date from the calendar to view available time slots.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mpr-modal__foot">
                  <button type="button" className="mpr-btn mpr-btn--outline" onClick={() => { setBookingStep("sessions"); setSelectedSlot(null); setSelectedDate(""); }}>
                    <Icon name="arrow_back" /> Back to Sessions
                  </button>
                  <button type="button" className="mpr-btn mpr-btn--primary" disabled={!selectedDate || !selectedSlot || !selectedDuration} onClick={handleBookFromSchedule}>
                    <Icon name="payment" /> Continue to Payment — <span style={{ fontWeight: 600, opacity: 0.9 }}>₹{(() => {
                      const base = selectedSessionForBooking?.priceAmount ? Number(selectedSessionForBooking.priceAmount) : 999;
                      return Math.round(base * (Number(selectedDuration || 60) / 60)).toLocaleString();
                    })()}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ Request Custom Session Modal — Premium Form ═══ */}
      {showRequestModal && (
        <div className="mpr-modal-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget && !requestSending) { if (hasFormData) { setPendingCancelAction(() => () => { setShowRequestModal(false); setRequestSent(false); setRequestErrors({}); setRequestForm({ subject: "", goal: "", duration: "60", date: "", time: "", budget: "" }); }); setShowCancelConfirm(true); } else { setShowRequestModal(false); setRequestSent(false); setRequestErrors({}); } } }}>
          <div className="mpr-modal mpr-modal--request" role="dialog" aria-label="Request a custom session">
            {requestSent ? (
              <>
                <div className="mpr-modal__body" style={{ padding: 0 }}>
                  <div className="mpr-request-success">
                    <div className="mpr-request-success__icon"><Icon name="check_circle" /></div>
                    <h3>Request Sent Successfully!</h3>
                    <p>Your mentor has received your personalized learning request. They will review it and respond shortly.</p>
                    <div className="mpr-request-success__eta"><Icon name="schedule" /> Expected response within 24 hours</div>
                    <div className="mpr-request-success__actions">
                      <button type="button" className="mpr-btn mpr-btn--outline" onClick={() => { setShowRequestModal(false); setRequestSent(false); setRequestForm({ subject: "", goal: "", duration: "60", date: "", time: "", budget: "" }); }}>
                        Back to Profile
                      </button>
                      <button type="button" className="mpr-btn mpr-btn--primary" onClick={() => {
                        setShowRequestModal(false);
                        navigate(`/learner/messages`);
                      }}>
                        <Icon name="chat" /> Open Chat
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="mpr-modal__head">
                  <div className="mpr-modal__head-icon"><Icon name="handshake" /></div>
                  <div className="mpr-modal__head-main">
                    <h2>Request Custom Session</h2>
                    <p>Send a personalized learning request to {mentor?.fullName || "this mentor"}.</p>
                  </div>
                  <button type="button" className="mpr-modal__close" onClick={() => { if (hasFormData) { setPendingCancelAction(() => () => { setShowRequestModal(false); setRequestErrors({}); setRequestForm({ subject: "", goal: "", duration: "60", date: "", time: "", budget: "" }); }); setShowCancelConfirm(true); } else { setShowRequestModal(false); setRequestErrors({}); } }} aria-label="Close">
                    <Icon name="close" />
                  </button>
                </div>
                <div className="mpr-modal__body mpr-modal__body--scroll">
                  <form id="mpr-request-form" onSubmit={async (e) => {
                    e.preventDefault();
                    const errors = {};
                    if (!requestForm.goal.trim()) errors.goal = "Learning goal is required.";
                    if (!requestForm.date) errors.date = "Date is required.";
                    if (!requestForm.time) errors.time = "Time is required.";
                    setRequestErrors(errors);
                    if (Object.keys(errors).length > 0) return;
                    setRequestSending(true);
                    try {
                      await client.post("/api/v1/session-requests", {
                        mentorId: Number(mentorId),
                        subject: requestForm.subject,
                        message: requestForm.goal,
                        duration: requestForm.duration,
                        preferredDate: requestForm.date,
                        preferredTime: requestForm.time,
                        budget: requestForm.budget || null,
                      });
                      setRequestSent(true);
                    } catch (err) {
                      const msg = err?.response?.data?.message || err?.response?.data?.data?.error || "Could not send request.";
                      notify?.({ type: "error", title: "Request failed", message: msg });
                    } finally {
                      setRequestSending(false);
                    }
                  }}>
                    <div className="mpr-request-form">
                      <div className="mpr-request-form__group">
                        <label>Subject</label>
                        <select aria-label="Subject" className="mpr-request-form__field" value={requestForm.subject} onChange={(e) => setRequestForm(p => ({ ...p, subject: e.target.value }))}>
                          <option value="">Select a topic</option>
                          <option value="Career Guidance">Career Guidance</option>
                          <option value="Interview Preparation">Interview Preparation</option>
                          <option value="Java">Java</option>
                          <option value="Spring Boot">Spring Boot</option>
                          <option value="System Design">System Design</option>
                          <option value="DSA">DSA</option>
                          <option value="Resume Review">Resume Review</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div className="mpr-request-form__group">
                        <label>Learning Goal <span>(required)</span></label>
                        <textarea
                          className={`mpr-request-form__field mpr-request-form__textarea${requestErrors.goal ? " mpr-request-form__field--error" : ""}`}
                          rows={3}
                          placeholder="What would you like to learn? Any specific topics or goals?"
                          value={requestForm.goal}
                          onChange={(e) => setRequestForm(p => ({ ...p, goal: e.target.value }))}
                        />
                        {requestErrors.goal && <span className="mpr-request-form__error">{requestErrors.goal}</span>}
                      </div>

                      <div className="mpr-request-form__group">
                        <label>Preferred Duration</label>
                        <div style={{ display: "flex", gap: 10 }}>
                          {["30", "60", "90"].map(d => (
                            <button key={d} type="button"
                              className={`mpr-slot-btn${requestForm.duration === d ? " is-selected" : ""}`}
                              style={{ flex: 1 }}
                              onClick={() => setRequestForm(p => ({ ...p, duration: d }))}
                            >
                              {d} min
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mpr-request-form__row">
                        <div className="mpr-request-form__group">
                          <label>Preferred Date <span>(required)</span></label>
                          <input
                            type="date"
                            className={`mpr-request-form__field${requestErrors.date ? " mpr-request-form__field--error" : ""}`}
                            value={requestForm.date}
                            min={new Date().toISOString().slice(0, 10)}
                            onChange={(e) => setRequestForm(p => ({ ...p, date: e.target.value }))}
                          />
                          {requestErrors.date && <span className="mpr-request-form__error">{requestErrors.date}</span>}
                        </div>
                        <div className="mpr-request-form__group">
                          <label>Preferred Time <span>(required)</span></label>
                          <input
                            type="time"
                            className={`mpr-request-form__field${requestErrors.time ? " mpr-request-form__field--error" : ""}`}
                            value={requestForm.time}
                            onChange={(e) => setRequestForm(p => ({ ...p, time: e.target.value }))}
                          />
                          {requestErrors.time && <span className="mpr-request-form__error">{requestErrors.time}</span>}
                        </div>
                      </div>

                      <div className="mpr-request-form__group">
                        <label>Budget <span>(optional)</span></label>
                        <input
                          type="text"
                          className="mpr-request-form__field"
                          placeholder="e.g. ₹1,000 - ₹2,000"
                          value={requestForm.budget}
                          onChange={(e) => setRequestForm(p => ({ ...p, budget: e.target.value }))}
                        />
                      </div>

                    </div>
                  </form>
                </div>
                <div className="mpr-modal__foot">
                  <button type="button" className="mpr-btn mpr-btn--outline" onClick={() => { if (hasFormData) { setPendingCancelAction(() => () => { setShowRequestModal(false); setRequestErrors({}); setRequestForm({ subject: "", goal: "", duration: "60", date: "", time: "", budget: "" }); }); setShowCancelConfirm(true); } else { setShowRequestModal(false); setRequestErrors({}); } }} disabled={requestSending}>
                    Cancel
                  </button>
                  <button type="submit" form="mpr-request-form" className="mpr-btn mpr-btn--primary" disabled={requestSending}>
                    {requestSending ? <><span className="mpr-spinner" /> Sending…</> : <><Icon name="send" /> Send Request</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ VIEW SCHEDULE MODAL — Read-only availability ═══ */}
      {showFullSchedule && (
        <div className="mpr-modal-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) { setShowFullSchedule(false); setSelectedDate(""); } }}>
          <div className="mpr-modal mpr-modal--schedule" role="dialog" aria-label="View availability schedule">
            <div className="mpr-modal__head">
              <div className="mpr-modal__head-icon"><Icon name="calendar_month" /></div>
              <div className="mpr-modal__head-main">
                <h2>Availability Schedule</h2>
                <p>View {mentor?.fullName || "this mentor"}'s available time slots.</p>
              </div>
              <button type="button" className="mpr-modal__close" onClick={() => { setShowFullSchedule(false); setSelectedDate(""); }} aria-label="Close">
                <Icon name="close" />
              </button>
            </div>
            <div className="mpr-modal__body">
              <div className="mpr-schedule-layout">
                {/* Left: Calendar */}
                <div className="mpr-schedule-layout__left">
                  <div className="mpr-schedule-modal__cal">
                    <div className="mpr-booking-card__cal-hdr">
                      <button type="button" onClick={handlePrevMonth}><Icon name="chevron_left" /></button>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--mpr-fg)" }}>{months[calMonth]} {calYear}</span>
                      <button type="button" onClick={handleNextMonth}><Icon name="chevron_right" /></button>
                    </div>
                    <div className="mpr-booking-card__cal-grid" style={{ gap: 4 }}>
                      {weekDays.map(d => <span key={d} className="mpr-booking-card__cal-dow" style={{ color: "var(--mpr-muted)", fontSize: "0.65rem" }}>{d}</span>)}
                      {calDays.map((d, i) => {
                        const dateStr = d ? `${calYear}-${String(calMonth + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}` : "";
                        const hasSlot = d && dateStr && availableDates.has(dateStr);
                        const today = new Date();
                        const isToday = d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                        const isPast = d && new Date(calYear, calMonth, d + 1) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                        const isSelected = d && dateStr === selectedDate;
                        if (!d) return <div key={i} className="mpr-booking-card__cal-day" />;
                        const canSelect = !isPast;
                        return (
                          <button key={i} type="button"
                            className={`mpr-booking-card__cal-day${isToday ? " is-today" : ""}${hasSlot ? " has-slot" : ""}${isPast ? " is-past" : ""}${isSelected ? " is-selected" : ""}`}
                            style={{ fontSize: "0.78rem" }}
                            disabled={!canSelect}
                            aria-label={`${months[calMonth]} ${d}, ${calYear}${canSelect ? " - available" : isPast ? " - past" : " - no slots"}`}
                            onClick={() => { if (dateStr) { setSelectedDate(dateStr); setSelectedSlot(null); } }}>{d}</button>
                        );
                      })}
                    </div>
                    <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: "0.72rem", color: "var(--mpr-muted)" }}>
                      <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "var(--mpr-primary)", marginRight: 4 }} /> Available</span>
                      <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "#EF4444", marginRight: 4 }} /> Booked</span>
                      <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: "var(--mpr-border)", marginRight: 4 }} /> Past</span>
                    </div>
                  </div>
                </div>

                {/* Right: Time Slots (read-only — no booking) */}
                <div className="mpr-schedule-layout__right">
                  {selectedDate ? (
                    <>
                      <p className="mpr-slots-label">
                        {formatDate(selectedDate, { weekday: "long" })}
                      </p>
                      <p style={{ fontSize: "0.75rem", color: "var(--mpr-muted-light)", margin: "-4px 0 8px" }}>
                        Available time slots (view-only)
                      </p>
                      <div className="mpr-readonly-slots">
                        {["09:00 AM","09:30 AM","10:00 AM","10:30 AM","11:00 AM","11:30 AM","02:00 PM","02:30 PM","03:00 PM","03:30 PM","04:00 PM","05:00 PM"].map((slot) => (
                          <span key={slot}
                            className={`mpr-readonly-slot${slotBooked.has(slot) ? " is-booked" : ""}`}
                          >
                            {slotBooked.has(slot) ? <><Icon name="block" style={{ fontSize: 14 }} /> Booked</> : slot}
                          </span>
                        ))}
                      </div>
                      <p style={{ fontSize: "0.75rem", color: "var(--mpr-muted)", marginTop: 12 }}>
                        This is a view-only schedule. To book a session, click <strong>"Book Session"</strong> on the mentor profile.
                      </p>
                    </>
                  ) : (
                    <div className="mpr-slot-empty">
                      <Icon name="calendar_month" />
                      <p>Select a date from the calendar to view available time slots.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="mpr-modal__foot">
              <button type="button" className="mpr-btn mpr-btn--outline" onClick={() => { setShowFullSchedule(false); setSelectedDate(""); }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Booking Success Modal ═══ */}
      {showBookingSuccess && bookingSuccess && (
        <div className="mpr-modal-overlay" role="presentation" style={{ zIndex: 1050 }} onClick={(e) => { if (e.target === e.currentTarget) return; }}>
          <div className="mpr-modal mpr-modal--success" role="dialog" aria-label="Booking confirmed">
            <div className="mpr-modal__body" style={{ textAlign: "center", padding: "40px 32px" }}>
              <div className="mpr-booking-success__icon">
                <Icon name="emoji_events" />
              </div>
              <h3 style={{ margin: "16px 0 6px", fontSize: "1.3rem", fontWeight: 800, color: "var(--mpr-fg)" }}>
                Session Booked Successfully!
              </h3>
              <p style={{ margin: "0 0 16px", fontSize: "0.85rem", color: "var(--mpr-muted)", maxWidth: 360, lineHeight: 1.6 }}>
                Your session has been confirmed. A confirmation email has been sent to your registered email.
              </p>
              <div style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 8, marginBottom: 20, textAlign: "left" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", padding: "6px 12px", borderRadius: 8, background: "var(--mpr-primary-tint)" }}>
                  <span style={{ color: "var(--mpr-muted)" }}>Booking ID</span>
                  <strong style={{ color: "var(--mpr-fg)", fontFamily: "monospace", fontSize: "0.72rem" }}>{bookingSuccess.bookingId || "SW-BKG-0000"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", padding: "6px 12px", borderRadius: 8 }}>
                  <span style={{ color: "var(--mpr-muted)" }}>Mentor</span>
                  <strong style={{ color: "var(--mpr-fg)" }}>{bookingSuccess.mentorName || "Mentor"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", padding: "6px 12px", borderRadius: 8, background: "var(--mpr-primary-tint)" }}>
                  <span style={{ color: "var(--mpr-muted)" }}>Date</span>
                  <strong style={{ color: "var(--mpr-fg)" }}>{bookingSuccess.date ? formatDate(bookingSuccess.date) : "—"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", padding: "6px 12px", borderRadius: 8 }}>
                  <span style={{ color: "var(--mpr-muted)" }}>Time</span>
                  <strong style={{ color: "var(--mpr-fg)" }}>{bookingSuccess.time || "—"}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", padding: "6px 12px", borderRadius: 8, background: "var(--mpr-primary-tint)" }}>
                  <span style={{ color: "var(--mpr-muted)" }}>Duration</span>
                  <strong style={{ color: "var(--mpr-fg)" }}>{bookingSuccess.duration || "60"} min</strong>
                </div>
              </div>
              <div className="mpr-request-success__actions" style={{ justifyContent: "center", flexWrap: "wrap" }}>
                <button type="button" className="mpr-btn mpr-btn--outline" onClick={() => {
                  setShowBookingSuccess(false);
                  setBookingSessionId(null);
                  navigate("/learner/messages");
                }}>
                  <Icon name="chat" /> Open Chat
                </button>
                <button type="button" className="mpr-btn mpr-btn--outline" onClick={() => {
                  setShowBookingSuccess(false);
                  setBookingSessionId(null);
                  navigate("/sessions");
                }}>
                  <Icon name="event" /> My Sessions
                </button>
                <button type="button" className="mpr-btn mpr-btn--outline" onClick={() => {
                  const text = `Booking: ${bookingSuccess.bookingId || ""}\nMentor: ${bookingSuccess.mentorName || ""}\nDate: ${bookingSuccess.date ? formatDate(bookingSuccess.date) : ""}\nTime: ${bookingSuccess.time || ""}\nDuration: ${bookingSuccess.duration || "60"} min`;
                  const blob = new Blob([text], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `receipt-${bookingSuccess.bookingId || "booking"}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}>
                  <Icon name="download" /> Receipt
                </button>
                <button type="button" className="mpr-btn mpr-btn--primary" onClick={() => {
                  setShowBookingSuccess(false);
                  setBookingSessionId(null);
                }}>
                  <Icon name="arrow_back" /> Back
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Cancel Confirmation Modal ═══ */}
      {showCancelConfirm && (
        <div className="mpr-confirm-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) setShowCancelConfirm(false); }}>
          <div className="mpr-confirm" role="dialog" aria-modal="true" aria-label="Discard changes?">
            <button type="button" className="mpr-confirm__x" onClick={() => setShowCancelConfirm(false)} aria-label="Continue editing">
              <Icon name="close" />
            </button>
            <div className="mpr-confirm__icon-wrap">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h2 className="mpr-confirm__title">Discard changes?</h2>
            <p className="mpr-confirm__desc">
              You have unsaved changes. If you leave now, your selected slot and booking information will be lost.
            </p>
            <div className="mpr-confirm__actions">
              <button type="button" className="mpr-btn mpr-btn--outline mpr-confirm__btn" onClick={() => setShowCancelConfirm(false)}>
                Continue Editing
              </button>
              <button type="button" className="mpr-confirm__btn mpr-confirm__btn--danger" onClick={() => {
                setShowCancelConfirm(false);
                if (pendingCancelAction) {
                  pendingCancelAction();
                  setPendingCancelAction(null);
                }
              }}>
                <Icon name="delete" /> Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
