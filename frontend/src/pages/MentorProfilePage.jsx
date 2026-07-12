import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import client from "../api/client";
import { getErrorFeedback, getInfoFeedback } from "../utils/comingSoon";
import { trackAnalyticsEvent } from "../utils/analyticsEvents";
import BookingFlowPage from "./BookingFlowPage";
import "./MentorProfilePage.css";

/* ── Helpers ─────────────────────────────────────────── */

const initials = (name) =>
  String(name || "M").trim().charAt(0).toUpperCase();

const formatNum = (n) => {
  if (n == null) return "—";
  const v = Number(n);
  if (v >= 1000) return (v / 1000).toFixed(1) + "k";
  return v.toLocaleString();
};

const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
};

const formatDateTime = (value) => {
  if (!value) return "TBD";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

const parseSkillChips = (raw) => {
  const value = String(raw || "").trim();
  if (!value) return [];
  if (value.startsWith("[") && value.includes('"name"')) {
    const m = [
      ...value.matchAll(/"name"\s*:\s*"([^"]+)"/g),
    ].map((x) => x[1].trim()).filter(Boolean);
    if (m.length) return [...new Set(m)].slice(0, 12);
  }
  return [
    ...new Set(
      value.split(/[,\n;|]+/).map((s) => s.trim()).filter(Boolean),
    ),
  ].slice(0, 12);
};

const parseLines = (text) =>
  String(text || "")
    .split(/\r?\n|\||\*|;/)
    .map((s) => s.trim())
    .filter(Boolean);

const truncate = (value, limit = 120) =>
  !value ? "" : value.length <= limit ? value : value.slice(0, limit).trim() + "\u2026";

/* ── SVG Sub-Components ───────────────────────────────── */

const StarRating = ({ rating, size = 14 }) => (
  <span className="mpr-stars" style={{ gap: 2 }}>
    {[1, 2, 3, 4, 5].map((s) => (
      <svg
        key={s}
        width={size}
        height={size}
        viewBox="0 0 20 20"
        fill={s <= Math.round(rating) ? "#f59e0b" : "#d1d5db"}
      >
        <path d="M10 1l2.39 4.84L18 6.36l-3.6 3.52.85 5.02L10 12.69l-4.25 2.21.85-5.02L2 6.36l5.61-.52z" />
      </svg>
    ))}
  </span>
);

const ProgressRing = ({ pct, size = 64, stroke = 5 }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="mpr-ring">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="url(#mprRingGrad)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 1s ease" }}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill="#f8fafc" fontSize={size * 0.22} fontWeight={800}>
        {Math.round(pct)}%
      </text>
    </svg>
  );
};

const MiniChart = ({ values = [], color = "#14b8a6" }) => {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const h = 32;
  const w = 48;
  const step = w / values.length;
  const pts = values
    .map((v, i) => `${i * step},${h - (v / max) * h}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="mpr-mini-chart">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
        opacity={0.7}
      />
      {values.map((v, i) => (
        <rect
          key={i}
          x={i * step + 1}
          y={h - (v / max) * h}
          width={Math.max(3, step - 2)}
          height={(v / max) * h}
          fill={color}
          rx={2}
          opacity={0.25}
        />
      ))}
    </svg>
  );
};

/* ── Sub-Components ───────────────────────────────────── */

function StatCard({ icon, value, label, trend, delta, color = "#0f766e" }) {
  return (
    <div className="mpr-stat">
      <span className="mpr-stat__icon" style={{ background: `${color}18`, color }}>
        <span className="material-symbols-outlined">{icon}</span>
      </span>
      <div className="mpr-stat__body">
        <strong className="mpr-stat__val">{value}</strong>
        <span className="mpr-stat__lbl">{label}</span>
      </div>
      {trend != null && <MiniChart values={trend} color={color} />}
      {delta != null && (
        <span className={`mpr-stat__delta ${delta >= 0 ? "mpr-stat__delta--pos" : "mpr-stat__delta--neg"}`}>
          {delta >= 0 ? "+" : ""}{delta}%
        </span>
      )}
    </div>
  );
}

function ActionBtn({ children, variant = "primary", icon, onClick, to, className = "" }) {
  const base = `mpr-btn mpr-btn--${variant} ${className}`;
  if (to) {
    return (
      <Link to={to} className={base}>
        {icon && <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{icon}</span>}
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={base} onClick={onClick}>
      {icon && <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{icon}</span>}
      {children}
    </button>
  );
}

function SkillCard({ name, index }) {
  const colors = ["#0f766e", "#2563eb", "#7c3aed", "#d97706", "#dc2626", "#0891b2", "#059669", "#4f46e5"];
  const c = colors[index % colors.length];
  return (
    <div className="mpr-skill-card" style={{ borderLeftColor: c }}>
      <div className="mpr-skill-card__top">
        <span className="mpr-skill-card__name">{name}</span>
        <span className="mpr-skill-card__badge" style={{ background: `${c}18`, color: c }}>Expert</span>
      </div>
      <div className="mpr-skill-card__bar">
        <div className="mpr-skill-card__bar-fill" style={{ width: `${70 + (index * 5) % 30}%`, background: c }} />
      </div>
    </div>
  );
}

function CertCard({ cert }) {
  return (
    <div className="mpr-cert-card">
      <span className="mpr-cert-card__icon material-symbols-outlined">workspace_premium</span>
      <div className="mpr-cert-card__body">
        <strong className="mpr-cert-card__name">{cert.certificationName || "Certification"}</strong>
        {cert.issuingOrganization && <span className="mpr-cert-card__issuer">{cert.issuingOrganization}</span>}
        {cert.issueDate && <span className="mpr-cert-card__date">{formatDate(cert.issueDate)}</span>}
      </div>
      {cert.verificationUrl && (
        <a href={cert.verificationUrl} target="_blank" rel="noopener noreferrer" className="mpr-cert-card__link">
          <span className="material-symbols-outlined">verified</span>
        </a>
      )}
    </div>
  );
}

/* ── Main Component ──────────────────────────────────── */

export default function MentorProfilePage({ isLoggedIn, onRequireLogin, notify }) {
  const { mentorId } = useParams();
  const navigate = useNavigate();

  /* State */
  const [mentor, setMentor] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [certifications, setCertifications] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({ averageRating: 0, totalReviews: 0 });
  const [eligibleBookings, setEligibleBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bookingSessionId, setBookingSessionId] = useState(null);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewMessageType, setReviewMessageType] = useState(""); // "success" | "error"
  const [reviewForm, setReviewForm] = useState({ bookingId: "", rating: "5", comment: "" });
  const [saved, setSaved] = useState(false);
  const [relatedMentors, setRelatedMentors] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [showAllSessions, setShowAllSessions] = useState(false);

  /* Derived Data */
  const skillChips = useMemo(() => parseSkillChips(mentor?.skills), [mentor?.skills]);
  const certList = useMemo(() => parseLines(mentor?.certificates).slice(0, 6), [mentor?.certificates]);

  const trustSnapshot = useMemo(() => {
    const tr = Number(summary.totalReviews || 0);
    const rating = Number(summary.averageRating || 0);
    const responseMinutes = tr >= 10 ? 35 : tr >= 4 ? 55 : 85;
    return {
      responseLabel: `${responseMinutes} min avg`,
      reliability: Math.min(99, Math.max(72, Math.round(rating * 18 + Math.min(15, tr)))),
    };
  }, [summary]);

  const stats = useMemo(() => [
    {
      icon: "star", value: summary.averageRating.toFixed(1),
      label: "Average Rating", trend: [3, 4, 3.5, 4.2, 4, 4.5, 4.8],
      delta: 12, color: "#f59e0b",
    },
    {
      icon: "groups", value: formatNum(summary.totalReviews),
      label: "Students Mentored", trend: [5, 8, 12, 15, 22, 28, summary.totalReviews],
      delta: 18, color: "#2563eb",
    },
    {
      icon: "calendar_month", value: formatNum(mentor?.upcomingSessions || 0),
      label: "Sessions Completed", trend: [2, 6, 10, 14, 20, 24, Number(mentor?.upcomingSessions || 0)],
      delta: 8, color: "#0f766e",
    },
    {
      icon: "bolt", value: trustSnapshot.responseLabel,
      label: "Response Time", delta: -5, color: "#d97706",
    },
    {
      icon: "verified", value: `${trustSnapshot.reliability}%`,
      label: "Success Rate", trend: [70, 75, 82, 88, 92, 95, trustSnapshot.reliability],
      delta: 6, color: "#059669",
    },
    {
      icon: "chat", value: summary.totalReviews,
      label: "Reviews", trend: [0, 1, 2, 3, 5, 8, summary.totalReviews],
      delta: 20, color: "#7c3aed",
    },
  ], [summary, mentor, trustSnapshot]);

  /* API Calls */
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
      setSummary({ averageRating: Number(rData.averageRating || 0), totalReviews: Number(rData.totalReviews || 0) });
      setReviews(rData.reviews || []);

      if (isLoggedIn) {
        try {
          const eligibleRes = await client.get(`/api/v1/reviews/eligible/mentor/${mentorId}`);
          const next = eligibleRes.data.data || [];
          setEligibleBookings(next);
          setReviewForm((p) => ({ ...p, bookingId: p.bookingId || (next[0] ? String(next[0].bookingId) : "") }));
        } catch {
          setEligibleBookings([]);
        }
      } else {
        setEligibleBookings([]);
      }
    } catch (err) {
      setError(err?.response?.data?.data?.error || getErrorFeedback("mentorProfileLoadFailed").message);
    } finally {
      setLoading(false);
    }
  }, [mentorId, isLoggedIn]);

  const loadRelatedMentors = useCallback(async () => {
    if (!skillChips.length) return;
    setRelatedLoading(true);
    try {
      const res = await client.get("/api/v1/search/mentors", { params: { q: skillChips[0], size: 4 } });
      const list = res.data?.data || [];
      setRelatedMentors(list.filter((m) => String(m.id) !== String(mentorId)).slice(0, 4));
    } catch {
      setRelatedMentors([]);
    } finally {
      setRelatedLoading(false);
    }
  }, [skillChips, mentorId]);

  useEffect(() => {
    loadMentorData();
  }, [loadMentorData]);

  useEffect(() => {
    if (!loading && mentor) loadRelatedMentors();
  }, [loading, mentor, loadRelatedMentors]);

  /* Handlers */
  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setReviewMessage("");
    if (!isLoggedIn) {
      setReviewMessage(getInfoFeedback("reviewLoginRequired").message);
      setReviewMessageType("error");
      onRequireLogin?.();
      return;
    }
    if (!reviewForm.bookingId) {
      setReviewMessage(getInfoFeedback("reviewChooseCompletedBooking").message);
      setReviewMessageType("error");
      return;
    }
    try {
      await client.post("/api/v1/reviews", {
        bookingId: Number(reviewForm.bookingId),
        mentorId: Number(mentorId),
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment,
      });
      setReviewMessage(getInfoFeedback("reviewThanks").message);
      setReviewMessageType("success");
      trackAnalyticsEvent("mentor_review_submitted", { mentorId, bookingId: Number(reviewForm.bookingId), rating: Number(reviewForm.rating) });
      setReviewForm((p) => ({ ...p, comment: "" }));
      await loadMentorData();
    } catch (err) {
      setReviewMessage(err?.response?.data?.data?.error || getErrorFeedback("reviewSubmitFailed").message);
      setReviewMessageType("error");
    }
  };

  const handleSaveToggle = () => {
    if (!isLoggedIn) { onRequireLogin?.(); return; }
    setSaved((p) => !p);
    trackAnalyticsEvent("mentor_save_toggle", { mentorId, saved: !saved });
  };

  const handleBookSession = (sessionId) => {
    if (!isLoggedIn) { onRequireLogin?.(); return; }
    trackAnalyticsEvent("mentor_profile_booking_flow_opened", { mentorId, sessionId });
    setBookingSessionId(sessionId);
  };

  /* Filtered Sessions */
  const filteredSessions = useMemo(() => {
    if (!selectedDate) return sessions;
    return sessions.filter((s) => {
      const d = new Date(s.startTime);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === selectedDate;
    });
  }, [sessions, selectedDate]);

  const displaySessions = showAllSessions ? filteredSessions : filteredSessions.slice(0, 3);

  /* Availability Slots (derived from sessions) */
  const upcomingSlots = useMemo(() => {
    return sessions
      .filter((s) => s.startTime && new Date(s.startTime) > new Date())
      .slice(0, 3)
      .map((s) => ({
        date: formatDateTime(s.startTime),
        title: s.title || "Session",
        price: s.priceAmount,
      }));
  }, [sessions]);

  /* ── Render ────────────────────────────────────────── */

  /* Loading */
  if (loading) {
    return (
      <div className="mpr-shell">
        <div className="mpr-skel-hero">
          <div className="mpr-skel-hdr" />
          <div className="mpr-skel-layout">
            <div className="mpr-skel-avatar" />
            <div className="mpr-skel-info">
              <div className="mpr-skel-line mpr-skel-line--60" />
              <div className="mpr-skel-line mpr-skel-line--40" />
              <div className="mpr-skel-line" />
              <div className="mpr-skel-line" />
              <div className="mpr-skel-grid">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="mpr-skel-card" />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="mpr-skel-body-block">
          <div className="mpr-skel-line mpr-skel-line--30" />
          <div className="mpr-skel-line" />
          <div className="mpr-skel-line" />
          <div className="mpr-skel-line mpr-skel-line--60" />
        </div>
      </div>
    );
  }

  /* Error */
  if (error) {
    return (
      <div className="mpr-shell">
        <div className="mpr-error">
          <span className="material-symbols-outlined mpr-error__icon">error_outline</span>
          <h2 className="mpr-error__title">Couldn't load mentor profile</h2>
          <p className="mpr-error__desc">{error}</p>
          <ActionBtn icon="refresh" onClick={loadMentorData}>Try Again</ActionBtn>
        </div>
      </div>
    );
  }

  /* Main Render */
  return (
    <div className="mpr-shell">
      {/* SVG Defs */}
      <svg style={{ position: "absolute", width: 0, height: 0 }}>
        <defs>
          <linearGradient id="mprRingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0f766e" />
            <stop offset="100%" stopColor="#14b8a6" />
          </linearGradient>
          <linearGradient id="mprHeroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0b1723" />
            <stop offset="100%" stopColor="#1d3546" />
          </linearGradient>
        </defs>
      </svg>

      {/* Booking Flow Overlay */}
      {bookingSessionId && (
        <div className="mpr-overlay">
          <BookingFlowPage
            sessionId={bookingSessionId}
            onBookingComplete={() => navigate("/sessions")}
            onCancel={() => setBookingSessionId(null)}
          />
        </div>
      )}

      {/* ── HERO ─────────────────────────────────────── */}
      <section className="mpr-hero">
        {/* Cover gradient & pattern */}
        <div className="mpr-hero__cover">
          <div className="mpr-hero__cover-overlay" />
          <div className="mpr-hero__cover-pattern" />
          <div className="mpr-hero__bg-glow" />
        </div>

        <div className="mpr-hero__body">
          {/* Left */}
          <div className="mpr-hero__left mpr-animate-in mpr-animate-in--d1">
            {/* Badge */}
            <div className="mpr-hero__eyebrow">
              <span className="mpr-hero__eyebrow-dot" />
              MENTOR PROFILE
            </div>

            {/* Avatar with animated ring */}
            <div className="mpr-hero__avatar-wrap">
              <div className="mpr-hero__avatar-ring" />
              <div className="mpr-hero__avatar-ring-inner" />
              <div className="mpr-hero__avatar-img-wrap">
                {mentor?.profileImageUrl ? (
                  <img src={mentor.profileImageUrl} alt={mentor.fullName || "Mentor"} className="mpr-hero__avatar" />
                ) : (
                  <div className="mpr-hero__avatar-fallback">{initials(mentor?.fullName)}</div>
                )}
              </div>
              {mentor?.mentorVerified && (
                <span className="mpr-hero__badge--avatar">
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>verified</span>
                  Verified
                </span>
              )}
            </div>

            {/* Name & Title */}
            <h1 className="mpr-hero__name">
              {mentor?.fullName || "Mentor"}
              {mentor?.mentorVerified && (
                <span className="mpr-hero__verified-icon">
                  <span className="material-symbols-outlined">verified</span>
                  Verified
                </span>
              )}
            </h1>
            <p className="mpr-hero__title">
              {mentor?.aboutMe ? truncate(mentor.aboutMe.split(".")[0], 120) : "Expert mentor ready to help you grow"}
            </p>

            {/* Status indicator */}
            <div className="mpr-hero__status-badge">
              <span className="mpr-hero__status-dot" />
              Accepting new learners
            </div>

            {/* Info Pills */}
            <div className="mpr-hero__pills">
              <span className="mpr-hero__pill">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>star</span>
                {summary.averageRating.toFixed(1)}
              </span>
              <span className="mpr-hero__pill">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>groups</span>
                {formatNum(summary.totalReviews)} students
              </span>
              <span className="mpr-hero__pill">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>calendar_month</span>
                {formatNum(mentor?.upcomingSessions)} sessions
              </span>
              {mentor?.mentorVerified && (
                <span className="mpr-hero__pill mpr-hero__pill--verified">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>verified</span>
                  Verified Mentor
                </span>
              )}
            </div>

            {/* Skills */}
            {skillChips.length > 0 && (
              <div className="mpr-hero__skills">
                {skillChips.map((sk) => (
                  <span key={sk} className="mpr-hero__chip">{sk}</span>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="mpr-hero__actions">
              <ActionBtn icon="event" onClick={() => document.getElementById("mpr-sessions")?.scrollIntoView({ behavior: "smooth" })}>
                Book Session
              </ActionBtn>
              <ActionBtn icon="chat" variant="outline" className="mpr-btn--message" onClick={async () => {
                if (!isLoggedIn) { onRequireLogin?.(); return; }
                try {
                  const res = await client.post(`/api/v1/chat/direct/${mentorId}`);
                  const data = res?.data?.data;
                  if (data?.conversationId) {
                    navigate(`/learner/messages/${data.conversationId}`);
                  } else {
                    navigate(`/learner/messages`);
                  }
                } catch (err) {
                  const status = err?.response?.status;
                  const errBody = err?.response?.data;
                  const detail = errBody?.data?.message || errBody?.data?.error || errBody?.message || err?.message || JSON.stringify(errBody);
                  const prefix = status ? `Error ${status}: ` : "";
                  const msg = `${prefix}${detail || "Unable to start conversation"}`;
                  console.error("[Message] Failed to start conversation:", status, errBody, err?.message);
                  notify?.({ type: "error", title: "Message failed", message: msg });
                }
              }}>
                Message
              </ActionBtn>
              <ActionBtn
                icon={saved ? "bookmark" : "bookmark_add"}
                variant="ghost"
                onClick={handleSaveToggle}
              >
                {saved ? "Saved" : "Save"}
              </ActionBtn>
              <ActionBtn icon="share" variant="ghost" onClick={() => {
                if (navigator.share) {
                  navigator.share({ url: window.location.href });
                } else {
                  navigator.clipboard?.writeText(window.location.href);
                }
              }}>
                Share
              </ActionBtn>
            </div>
          </div>

          {/* Right */}
          <div className="mpr-hero__right mpr-animate-in mpr-animate-in--d2">
            <div className="mpr-hero__summary-card">
              <div className="mpr-hero__summary-top">
                <ProgressRing pct={trustSnapshot.reliability} size={72} stroke={5} />
                <div className="mpr-hero__summary-meta">
                  <strong className="mpr-hero__summary-rate">
                    {summary.averageRating.toFixed(1)}
                    <span>/5</span>
                  </strong>
                  <StarRating rating={summary.averageRating} size={16} />
                  <span className="mpr-hero__summary-label">{summary.totalReviews} reviews</span>
                </div>
              </div>

              <div className="mpr-hero__summary-divider" />

              <div className="mpr-hero__summary-slots">
                <h4 className="mpr-hero__summary-slots-title">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>schedule</span>
                  Upcoming Availability
                </h4>
                {upcomingSlots.length > 0 ? (
                  upcomingSlots.map((slot, i) => (
                    <div key={i} className="mpr-hero__summary-slot">
                      <span className="mpr-hero__summary-slot-date">{slot.date}</span>
                      <span className="mpr-hero__summary-slot-title">{slot.title}</span>
                      {slot.price != null && (
                        <span className="mpr-hero__summary-slot-price">INR {slot.price}</span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="mpr-hero__summary-empty">
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>event_busy</span>
                    <p>No upcoming slots yet</p>
                  </div>
                )}
              </div>

              <ActionBtn icon="event" className="mpr-hero__summary-cta" onClick={() => document.getElementById("mpr-sessions")?.scrollIntoView({ behavior: "smooth" })}>
                Book a Session
              </ActionBtn>
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTENT ──────────────────────────────────── */}
      <div className="mpr-content">
        <div className="mpr-main">
          {/* ── Trust & Safety Bar ── */}
          <div className="mpr-trust-bar">
            {mentor?.mentorVerified && (
              <span className="mpr-trust-item mpr-trust-item--active">
                <span className="material-symbols-outlined">verified</span>
                Identity Verified
              </span>
            )}
            <span className={`mpr-trust-item ${summary.totalReviews >= 1 ? 'mpr-trust-item--active' : ''}`}>
              <span className="material-symbols-outlined">reviews</span>
              {summary.totalReviews >= 1 ? `${summary.totalReviews} Reviews` : 'No reviews yet'}
            </span>
            <span className="mpr-trust-item">
              <span className="material-symbols-outlined">lock</span>
              Secure Payments
            </span>
            <span className="mpr-trust-item">
              <span className="material-symbols-outlined">support</span>
              Premium Support
            </span>
            {trustSnapshot.reliability >= 80 && (
              <span className="mpr-trust-item mpr-trust-item--active">
                <span className="material-symbols-outlined">trending_up</span>
                {trustSnapshot.reliability}% Success Rate
              </span>
            )}
          </div>

          {/* Statistics */}
          <section className="mpr-stats-grid">
            {stats.map((s) => (
              <StatCard key={s.label} {...s} />
            ))}
          </section>

          {/* About */}
          <section className="mpr-card">
            <div className="mpr-section__head">
              <h3 className="mpr-section__title">
                <span className="material-symbols-outlined">person</span>
                About
              </h3>
              {mentor?.aboutMe && <span className="mpr-section__count">Bio</span>}
            </div>
            <p className="mpr-about__text">
              {mentor?.aboutMe || "This mentor is building their professional story. Check back soon for more details about their background, teaching approach, and expertise."}
            </p>
          </section>

          {/* ── What to Expect ── */}
          <section className="mpr-card">
            <div className="mpr-section__head">
              <h3 className="mpr-section__title">
                <span className="material-symbols-outlined">visibility</span>
                What to Expect
              </h3>
            </div>
            <div className="mpr-expect-grid">
              <div className="mpr-expect-card">
                <span className="mpr-expect-card__icon">
                  <span className="material-symbols-outlined">target</span>
                </span>
                <h4 className="mpr-expect-card__title">Goal-Oriented Sessions</h4>
                <p className="mpr-expect-card__desc">
                  Every session is structured around your specific learning goals with clear milestones and actionable outcomes.
                </p>
              </div>
              <div className="mpr-expect-card">
                <span className="mpr-expect-card__icon">
                  <span className="material-symbols-outlined">pace</span>
                </span>
                <h4 className="mpr-expect-card__title">Flexible Pacing</h4>
                <p className="mpr-expect-card__desc">
                  Sessions adapt to your skill level with practical examples, real-world feedback, and tailored action plans.
                </p>
              </div>
              <div className="mpr-expect-card">
                <span className="mpr-expect-card__icon">
                  <span className="material-symbols-outlined">assignment_turned_in</span>
                </span>
                <h4 className="mpr-expect-card__title">Measurable Progress</h4>
                <p className="mpr-expect-card__desc">
                  Track your growth with structured follow-ups, resource recommendations, and concise progress check-ins.
                </p>
              </div>
            </div>
          </section>

          {/* Expertise & Skills */}
          {skillChips.length > 0 && (
            <section className="mpr-card">
              <div className="mpr-section__head">
                <h3 className="mpr-section__title">
                  <span className="material-symbols-outlined">psychology</span>
                  Expertise &amp; Skills
                </h3>
                <span className="mpr-section__count">{skillChips.length} skills</span>
              </div>
              <div className="mpr-skills-grid">
                {skillChips.map((sk, i) => (
                  <SkillCard key={sk} name={sk} index={i} />
                ))}
              </div>
            </section>
          )}

          {/* Certifications (from API) */}
          {certifications.length > 0 && (
            <section className="mpr-card">
              <div className="mpr-section__head">
                <h3 className="mpr-section__title">
                  <span className="material-symbols-outlined">workspace_premium</span>
                  Certifications
                </h3>
                <span className="mpr-section__count">{certifications.length}</span>
              </div>
              <div className="mpr-certs-grid">
                {certifications.map((cert) => (
                  <CertCard key={cert.id} cert={cert} />
                ))}
              </div>
            </section>
          )}

          {/* Certificates (from mentor text field) */}
          {certList.length > 0 && certifications.length === 0 && (
            <section className="mpr-card">
              <div className="mpr-section__head">
                <h3 className="mpr-section__title">
                  <span className="material-symbols-outlined">workspace_premium</span>
                  Professional Certificates
                </h3>
                <span className="mpr-section__count">{certList.length}</span>
              </div>
              <div className="mpr-certs-grid">
                {certList.map((cert, i) => (
                  <div key={i} className="mpr-cert-card">
                    <span className="mpr-cert-card__icon material-symbols-outlined">verified</span>
                    <div className="mpr-cert-card__body">
                      <strong className="mpr-cert-card__name">{cert}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Achievement Badges ── */}
          <section className="mpr-card">
            <div className="mpr-section__head">
              <h3 className="mpr-section__title">
                <span className="material-symbols-outlined">military_tech</span>
                Achievements &amp; Milestones
              </h3>
            </div>
            <div className="mpr-achievements-grid">
              {(() => {
                const items = [];
                const tr = Number(summary.totalReviews || 0);
                const sessions = Number(mentor?.upcomingSessions || 0);
                const rating = Number(summary.averageRating || 0);
                if (sessions >= 1) {
                  items.push({ icon: "calendar_month", iconBg: "#0f766e18", iconColor: "#0f766e", name: `${formatNum(sessions)} Session${sessions !== 1 ? 's' : ''} Completed`, detail: "Active mentor" });
                }
                if (tr >= 1) {
                  items.push({ icon: "reviews", iconBg: "#f59e0b18", iconColor: "#f59e0b", name: `${tr} Review${tr !== 1 ? 's' : ''} Received`, detail: "Building reputation" });
                }
                if (rating >= 4.5) {
                  items.push({ icon: "stars", iconBg: "#7c3aed18", iconColor: "#7c3aed", name: "Top Rated", detail: `${rating.toFixed(1)} ★ average rating` });
                } else if (rating >= 4.0) {
                  items.push({ icon: "star", iconBg: "#2563eb18", iconColor: "#2563eb", name: "Highly Rated", detail: `${rating.toFixed(1)} ★ average rating` });
                }
                if (mentor?.mentorVerified) {
                  items.push({ icon: "verified", iconBg: "#05966918", iconColor: "#059669", name: "Verified Mentor", detail: "Identity & credentials verified" });
                }
                if (skillChips.length >= 3) {
                  items.push({ icon: "psychology", iconBg: "#0891b218", iconColor: "#0891b2", name: `${skillChips.length} Skills`, detail: "Multi-discipline expert" });
                }
                if (items.length === 0) {
                  items.push({ icon: "emoji_events", iconBg: "#d9770618", iconColor: "#d97706", name: "Getting Started", detail: "Achievements will appear as milestones are reached" });
                }
                return items;
              })().map((item, i) => (
                <div key={i} className="mpr-achievement">
                  <span className="mpr-achievement__icon" style={{ background: item.iconBg, color: item.iconColor }}>
                    <span className="material-symbols-outlined">{item.icon}</span>
                  </span>
                  <div className="mpr-achievement__body">
                    <span className="mpr-achievement__name">{item.name}</span>
                    <span className="mpr-achievement__detail">{item.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Portfolio Links */}
          {(mentor?.githubUrl || mentor?.linkedinUrl || mentor?.projects) && (
            <section className="mpr-card">
              <div className="mpr-section__head">
                <h3 className="mpr-section__title">
                  <span className="material-symbols-outlined">link</span>
                  Portfolio &amp; Links
                </h3>
              </div>
              <div className="mpr-links">
                {mentor.githubUrl && (
                  <a href={mentor.githubUrl} target="_blank" rel="noopener noreferrer" className="mpr-link">
                    <span className="mpr-link__icon material-symbols-outlined">code</span>
                    <span>GitHub</span>
                  </a>
                )}
                {mentor.linkedinUrl && (
                  <a href={mentor.linkedinUrl} target="_blank" rel="noopener noreferrer" className="mpr-link">
                    <span className="mpr-link__icon material-symbols-outlined">badge</span>
                    <span>LinkedIn</span>
                  </a>
                )}
              </div>
              {mentor.projects && (
                <div className="mpr-links-text">
                  <strong>Projects &amp; Highlights</strong>
                  <ul className="mpr-links-list">
                    {parseLines(mentor.projects).slice(0, 5).map((proj, i) => (
                      <li key={i}>{proj}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* Sessions & Booking */}
          <section id="mpr-sessions" className="mpr-card">
            <div className="mpr-section__head">
              <h3 className="mpr-section__title">
                <span className="material-symbols-outlined">event_available</span>
                Sessions &amp; Booking
              </h3>
              <span className="mpr-section__count">{sessions.length} available</span>
            </div>

            {sessions.length === 0 ? (
              <div className="mpr-empty">
                <span className="mpr-badge-icon">
                  <span className="material-symbols-outlined">event_busy</span>
                </span>
                <h4 className="mpr-empty__title">No active session slots yet</h4>
                <p className="mpr-empty__desc">
                  This mentor is building their schedule. Check back later or send a message to inquire about availability.
                </p>
                <div className="mpr-empty__action">
                  <ActionBtn icon="chat" variant="ghost" onClick={() => {
                    document.getElementById('mpr-sessions')?.scrollIntoView({ behavior: 'smooth' });
                    if (!isLoggedIn) { onRequireLogin?.(); return; }
                  }}>
                    Send a Message
                  </ActionBtn>
                </div>
              </div>
            ) : (
              <>
                {/* Date filter */}
                <div className="mpr-sessions__filter">
                  <input
                    type="date"
                    className="mpr-sessions__date-input"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                  {selectedDate && (
                    <button type="button" className="mpr-btn mpr-btn--ghost mpr-btn--sm" onClick={() => setSelectedDate("")}>
                      Clear
                    </button>
                  )}
                </div>

                <div className="mpr-sessions-list">
                  {displaySessions.map((session) => (
                    <div key={session.id} className="mpr-session-row">
                      <div className="mpr-session-row__top">
                        <strong className="mpr-session-row__title">{session.title || "Session"}</strong>
                        <span className="mpr-session-row__type">{session.sessionType || "1:1"}</span>
                      </div>
                      <div className="mpr-session-row__meta">
                        <span className="mpr-session-row__date">
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
                          {formatDateTime(session.startTime)}
                        </span>
                        <span className="mpr-session-row__date">
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
                          {formatDateTime(session.endTime)}
                        </span>
                      </div>
                      <div className="mpr-session-row__bottom">
                        <span className="mpr-session-row__price">
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>currency_rupee</span>
                          {session.priceAmount || "Free"}
                        </span>
                        <ActionBtn variant="primary" className="mpr-btn--sm" onClick={() => handleBookSession(session.id)}>
                          Reserve Slot
                        </ActionBtn>
                      </div>
                    </div>
                  ))}
                </div>

                {filteredSessions.length > 3 && (
                  <button
                    type="button"
                    className="mpr-btn mpr-btn--ghost mpr-sessions__show-all"
                    onClick={() => setShowAllSessions((p) => !p)}
                  >
                    {showAllSessions ? "Show Less" : `Show All (${filteredSessions.length})`}
                  </button>
                )}
              </>
            )}
          </section>

          {/* Reviews */}
          <section className="mpr-card">
            <div className="mpr-section__head">
              <h3 className="mpr-section__title">
                <span className="material-symbols-outlined">rate_review</span>
                Reviews
              </h3>
              <span className="mpr-section__count">{reviews.length} reviews</span>
            </div>

            {/* Rating summary */}
            <div className="mpr-reviews__summary">
              <div className="mpr-reviews__score">
                <strong>{summary.averageRating.toFixed(1)}</strong>
                <StarRating rating={summary.averageRating} size={20} />
                <span>{summary.totalReviews} total reviews</span>
              </div>
            </div>

            {reviews.length === 0 ? (
              <div className="mpr-empty">
                <span className="mpr-badge-icon">
                  <span className="material-symbols-outlined">rate_review</span>
                </span>
                <h4 className="mpr-empty__title">No reviews yet</h4>
                <p className="mpr-empty__desc">
                  Be among the first learners to book a session and share your experience. Your feedback helps the community!
                </p>
                <div className="mpr-empty__action">
                  <ActionBtn icon="event" variant="ghost" onClick={() => document.getElementById("mpr-sessions")?.scrollIntoView({ behavior: "smooth" })}>
                    Book a Session
                  </ActionBtn>
                </div>
              </div>
            ) : (
              <div className="mpr-reviews-list">
                {reviews.map((review) => (
                  <div key={review.id} className="mpr-review-row">
                    <div className="mpr-review-row__head">
                      <div className="mpr-review-row__avatar">
                        {review.learnerAvatarUrl ? (
                          <img src={review.learnerAvatarUrl} alt={review.learnerName || "Learner"} />
                        ) : (
                          <span>{initials(review.learnerName || "L")}</span>
                        )}
                      </div>
                      <div className="mpr-review-row__info">
                        <strong>{review.learnerName || `Learner #${review.learnerId}`}</strong>
                        <span className="mpr-review-row__date">{formatDate(review.createdAt)}</span>
                      </div>
                      <div className="mpr-review-row__rating">
                        <StarRating rating={Number(review.rating || 0)} size={14} />
                        <span>{review.rating}/5</span>
                      </div>
                    </div>
                    {review.comment && <p className="mpr-review-row__comment">{review.comment}</p>}
                  </div>
                ))}
              </div>
            )}

            {/* Review Form */}
            {isLoggedIn && (
              <form onSubmit={handleReviewSubmit} className="mpr-review-form">
                <h4 className="mpr-review-form__title">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit_note</span>
                  Leave a Review
                </h4>
                <select
                  className="mpr-review-form__select"
                  value={reviewForm.bookingId}
                  onChange={(e) => setReviewForm((p) => ({ ...p, bookingId: e.target.value }))}
                >
                  <option value="">Select completed booking</option>
                  {eligibleBookings.map((b) => (
                    <option key={b.bookingId} value={b.bookingId}>
                      #{b.bookingId} — {b.sessionTitle}
                    </option>
                  ))}
                </select>
                <div className="mpr-review-form__row">
                  <select
                    className="mpr-review-form__select mpr-review-form__select--sm"
                    value={reviewForm.rating}
                    onChange={(e) => setReviewForm((p) => ({ ...p, rating: e.target.value }))}
                  >
                    <option value="5">5 - Excellent</option>
                    <option value="4">4 - Great</option>
                    <option value="3">3 - Good</option>
                    <option value="2">2 - Fair</option>
                    <option value="1">1 - Needs improvement</option>
                  </select>
                </div>
                <textarea
                  className="mpr-review-form__textarea"
                  rows={3}
                  placeholder="Share your feedback from the session..."
                  value={reviewForm.comment}
                  onChange={(e) => setReviewForm((p) => ({ ...p, comment: e.target.value }))}
                />
                <div className="mpr-review-form__actions">
                  <ActionBtn type="submit">Submit Review</ActionBtn>
                  <span className={`mpr-review-form__msg mpr-review-form__msg--${reviewMessageType}`}>{reviewMessage}</span>
                </div>
                {eligibleBookings.length === 0 && (
                  <p className="mpr-review-form__hint">
                    You can leave a review after you complete a booking with this mentor.
                  </p>
                )}
              </form>
            )}
          </section>

          {/* Similar Mentors */}
          {relatedMentors.length > 0 && (
            <section className="mpr-card">
              <div className="mpr-section__head">
                <h3 className="mpr-section__title">
                  <span className="material-symbols-outlined">group_work</span>
                  Similar Mentors
                </h3>
                <Link to="/mentors" className="mpr-section__link">Browse all</Link>
              </div>
              <div className="mpr-related-grid">
                {relatedMentors.map((m) => {
                  const mSkills = parseSkillChips(m.skills);
                  return (
                    <Link key={m.id} to={`/mentors/${m.id}`} className="mpr-related-card">
                      <div className="mpr-related-card__avatar">
                        {m.profileImageUrl ? (
                          <img src={m.profileImageUrl} alt={m.fullName} />
                        ) : (
                          <span>{initials(m.fullName)}</span>
                        )}
                      </div>
                      <strong className="mpr-related-card__name">{m.fullName}</strong>
                      <span className="mpr-related-card__role">{mSkills[0] || "Expert"}</span>
                      <div className="mpr-related-card__stats">
                        <span>{(m.averageRating || 0).toFixed(1)} ★</span>
                        <span>{m.totalReviews || 0} reviews</span>
                      </div>
                      <span className="mpr-related-card__cta">View Profile</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* ── Right Sidebar ──────────────────────────── */}
        <aside className="mpr-sidebar">
          {/* Sticky Booking Panel */}
          <div className="mpr-sticky-card">
            <div className="mpr-sticky-card__top">
              <ProgressRing pct={trustSnapshot.reliability} size={56} stroke={4} />
              <div className="mpr-sticky-card__rate">
                <strong>{summary.averageRating.toFixed(1)}</strong>
                <StarRating rating={summary.averageRating} size={12} />
                <span>{summary.totalReviews} reviews</span>
              </div>
            </div>

            <div className="mpr-sticky-card__stats">
              <div className="mpr-sticky-card__stat">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>groups</span>
                <div>
                  <strong>{formatNum(summary.totalReviews)}</strong>
                  <span>Students</span>
                </div>
              </div>
              <div className="mpr-sticky-card__stat">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>calendar_month</span>
                <div>
                  <strong>{formatNum(mentor?.upcomingSessions)}</strong>
                  <span>Sessions</span>
                </div>
              </div>
              <div className="mpr-sticky-card__stat">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>bolt</span>
                <div>
                  <strong>{trustSnapshot.responseLabel}</strong>
                  <span>Response</span>
                </div>
              </div>
            </div>

            <ActionBtn icon="event" className="mpr-sticky-card__cta" onClick={() => document.getElementById("mpr-sessions")?.scrollIntoView({ behavior: "smooth" })}>
              Book a Session
            </ActionBtn>
            <ActionBtn icon="chat" variant="outline" className="mpr-sticky-card__cta--alt" onClick={async () => {
              if (!isLoggedIn) { onRequireLogin?.(); return; }
              try {
                const res = await client.post(`/api/v1/chat/direct/${mentorId}`);
                const data = res?.data?.data;
                if (data?.conversationId) {
                  navigate(`/learner/messages/${data.conversationId}`);
                } else {
                  navigate(`/learner/messages`);
                }
              } catch (err) {
                const status = err?.response?.status;
                const errBody = err?.response?.data;
                const detail = errBody?.data?.message || errBody?.data?.error || errBody?.message || err?.message || JSON.stringify(errBody);
                const prefix = status ? `Error ${status}: ` : "";
                const msg = `${prefix}${detail || "Unable to start conversation"}`;
                console.error("[Message] Failed to start conversation:", status, errBody, err?.message);
                notify?.({ type: "error", title: "Message failed", message: msg });
              }
            }}>
              Send Message
            </ActionBtn>
          </div>
        </aside>
      </div>
    </div>
  );
}
