import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import client from "../api/client";
import MobileBottomNav from "../components/MobileBottomNav";
import ProfileGateModal from "../components/ProfileGateModal";
import { getApiErrorMessage } from "../utils/apiErrors";
import MentorPageHero from "../modules/mentor/components/MentorPageHero";
import Icon from "../modules/common/dashboard/Icon";
import StatsCard from "../modules/common/dashboard/StatsCard";
import useMentorGate from "../modules/common/useMentorGate";
import "../modules/mentor/mentor-pages.css";

const SORT_OPTIONS = [
  { value: "dateAsc", label: "Date ↑" },
  { value: "dateDesc", label: "Date ↓" },
  { value: "priceAsc", label: "Price ↑" },
  { value: "priceDesc", label: "Price ↓" },
  { value: "seatsAsc", label: "Seats ↑" },
  { value: "seatsDesc", label: "Seats ↓" },
];

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "Available", label: "Available" },
  { key: "Booked", label: "Booked" },
  { key: "Completed", label: "Completed" },
  { key: "Cancelled", label: "Cancelled" },
];

const ISO_DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDateTime = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "TBD";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/* ═══════════════════ Session Requests Section ═══════════════════ */

function SessionRequestsSection({ notify, highlightRequestId, gateRequest }) {
  const highlightRef = useRef(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null); // 'requestId-action'
  const [setupRequest, setSetupRequest] = useState(null); // request being set up
  const [setupForm, setSetupForm] = useState({
    title: "",
    description: "",
    startTime: "",
    endTime: "",
    priceAmount: "",
    meetingLink: "",
  });
  const [setupSaving, setSetupSaving] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [acceptingRequestId, setAcceptingRequestId] = useState(null);
  const [acceptMessage, setAcceptMessage] = useState("");
  const acceptTextareaRef = useRef(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get("/api/v1/session-requests");
      setRequests(res?.data?.data || []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Scroll to highlighted request when data loads
  useEffect(() => {
    if (!loading && highlightRequestId && highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }, [loading, highlightRequestId]);

  // Focus the accept modal textarea when it opens
  useEffect(() => {
    if (showAcceptModal && acceptTextareaRef.current) {
      setTimeout(() => {
        acceptTextareaRef.current?.focus();
      }, 50);
    }
  }, [showAcceptModal]);

  const handleAccept = (requestId) => {
    // Marketplace gate — accepting a request requires a verified mentor.
    gateRequest?.(() => {
      setAcceptingRequestId(requestId);
      setAcceptMessage("");
      setShowAcceptModal(true);
    });
  };

  const handleAcceptConfirm = async () => {
    if (!acceptingRequestId) return;
    setActionLoading(acceptingRequestId + "-accept");
    setShowAcceptModal(false);
    try {
      const body = acceptMessage.trim() ? { message: acceptMessage.trim() } : {};
      await client.post(`/api/v1/session-requests/${acceptingRequestId}/accept`, body);
      notify?.({ type: "success", title: "Request accepted", message: "Now set up the session time and details." });
      setSetupRequest(requests.find(r => r.id === acceptingRequestId));
      loadRequests();
    } catch (err) {
      notify?.({ type: "error", title: "Accept failed", message: err?.response?.data?.message || "Could not accept request." });
    } finally {
      setActionLoading(null);
      setAcceptingRequestId(null);
    }
  };

  const handleDecline = async (requestId) => {
    const reason = window.prompt("Reason for declining (optional):");
    setActionLoading(requestId + "-decline");
    try {
      await client.post(`/api/v1/session-requests/${requestId}/decline${reason ? `?reason=${encodeURIComponent(reason)}` : ""}`);
      notify?.({ type: "success", title: "Request declined", message: "The learner has been notified." });
      loadRequests();
    } catch (err) {
      notify?.({ type: "error", title: "Decline failed", message: err?.response?.data?.message || "Could not decline request." });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetupSubmit = async (e) => {
    e.preventDefault();
    if (!setupRequest) return;
    if (!setupForm.title.trim() || !setupForm.startTime || !setupForm.endTime) {
      notify?.({ type: "error", title: "Missing fields", message: "Title, start time, and end time are required." });
      return;
    }
    setSetupSaving(true);
    try {
      await client.post(`/api/v1/session-requests/${setupRequest.id}/create-session`, {
        title: setupForm.title.trim(),
        description: setupForm.description.trim(),
        startTime: new Date(setupForm.startTime).toISOString(),
        endTime: new Date(setupForm.endTime).toISOString(),
        priceAmount: Number(setupForm.priceAmount || 0),
        meetingLink: setupForm.meetingLink.trim() || null,
      });
      notify?.({ type: "success", title: "Session created!", message: "The learner has been notified with session details." });
      setSetupRequest(null);
      setSetupForm({ title: "", description: "", startTime: "", endTime: "", priceAmount: "", meetingLink: "" });
      loadRequests();
    } catch (err) {
      notify?.({ type: "error", title: "Setup failed", message: err?.response?.data?.message || "Could not create session." });
    } finally {
      setSetupSaving(false);
    }
  };

  const pendingRequests = requests.filter(r => r.status === "PENDING");
  const acceptedRequests = requests.filter(r => r.status === "ACCEPTED");
  const repliedRequests = requests.filter(r => r.status !== "PENDING" && r.status !== "ACCEPTED" && r.replyMessage);

  if (setupRequest) {
    return (
      <div className="md-card md-animate" style={{ gap: 14 }}>
        <div className="mp-section__head" style={{ marginBottom: 0 }}>
          <div>
            <p className="mp-head__sub" style={{ margin: 0, fontSize: "0.72rem" }}>Session Setup</p>
            <h3 className="mp-section__title">Set Up Session</h3>
          </div>
          <button
            type="button"
            className="md-btn md-btn--outline md-btn--sm"
            onClick={() => setSetupRequest(null)}
          >
            Cancel
          </button>
        </div>
        <div style={{ padding: "0 4px", fontSize: "0.84rem", color: "var(--mp-text-secondary, #64748b)" }}>
          Learner: <strong>{setupRequest.learner?.fullName || `User #${setupRequest.learner?.id}`}</strong>
          {setupRequest.message && <p style={{ margin: "4px 0 0", fontStyle: "italic", fontSize: "0.8rem" }}>"{setupRequest.message}"</p>}
        </div>
        <form onSubmit={handleSetupSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="mp-field">
            <label className="mp-label" htmlFor="setup-title">Session Title</label>
            <input id="setup-title" type="text" className="mp-input"
              value={setupForm.title}
              onChange={(e) => setSetupForm(p => ({ ...p, title: e.target.value }))}
              placeholder="e.g. React Fundamentals" required />
          </div>
          <div className="mp-field">
            <label className="mp-label" htmlFor="setup-desc">Description</label>
            <textarea id="setup-desc" className="mp-textarea" rows={2}
              value={setupForm.description}
              onChange={(e) => setSetupForm(p => ({ ...p, description: e.target.value }))}
              placeholder="What will this session cover?" />
          </div>
          <div className="mp-field--row">
            <div className="mp-field">
              <label className="mp-label" htmlFor="setup-start">Start</label>
              <input id="setup-start" type="datetime-local" className="mp-input"
                value={setupForm.startTime}
                onChange={(e) => setSetupForm(p => ({ ...p, startTime: e.target.value }))}
                required />
            </div>
            <div className="mp-field">
              <label className="mp-label" htmlFor="setup-end">End</label>
              <input id="setup-end" type="datetime-local" className="mp-input"
                value={setupForm.endTime}
                onChange={(e) => setSetupForm(p => ({ ...p, endTime: e.target.value }))}
                required />
            </div>
          </div>
          <div className="mp-field--row">
            <div className="mp-field">
              <label className="mp-label" htmlFor="setup-price">Price ($)</label>
              <input id="setup-price" type="number" min="0" step="0.01" className="mp-input"
                value={setupForm.priceAmount}
                onChange={(e) => setSetupForm(p => ({ ...p, priceAmount: e.target.value }))}
                placeholder="0.00" />
            </div>
            <div className="mp-field">
              <label className="mp-label" htmlFor="setup-link">Meeting Link</label>
              <input id="setup-link" type="url" className="mp-input"
                value={setupForm.meetingLink}
                onChange={(e) => setSetupForm(p => ({ ...p, meetingLink: e.target.value }))}
                placeholder="https://meet.google.com/..." />
            </div>
          </div>
          <div className="mp-drawer__foot" style={{ padding: "8px 0 0" }}>
            <button type="submit" className="md-btn md-btn--brand md-btn--sm" disabled={setupSaving}>
              {setupSaving ? "Creating…" : "Create Session for Learner"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="md-card md-animate" style={{ gap: 14 }}>
      <div className="mp-section__head" style={{ marginBottom: 0 }}>
        <div>
          <p className="mp-head__sub" style={{ margin: 0 }}>Learner Requests</p>
          <h3 className="mp-section__title">Session Requests</h3>
        </div>
        <span className="mp-pill mp-pill--pending">
          {loading ? "..." : `${pendingRequests.length} pending`}
        </span>
      </div>

      <div className="mp-feed" style={{ maxHeight: 400, overflowY: "auto" }}>
        {loading ? (
          <div style={{ padding: "24px", textAlign: "center", color: "var(--mp-text-muted, #94a3b8)", fontSize: "0.84rem" }}>
            Loading requests...
          </div>
        ) : pendingRequests.length === 0 && acceptedRequests.length === 0 && repliedRequests.length === 0 ? (
          <div className="md-empty" style={{ padding: "24px 16px" }}>
            <div className="md-empty__icon" style={{ width: 48, height: 48, fontSize: "1.3rem" }}>
              <Icon name="person_add" />
            </div>
            <p className="md-empty__title">No session requests</p>
            <p className="md-empty__desc">
              When learners request a custom session, it will appear here.
            </p>
          </div>
        ) : (
          <>
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                ref={highlightRequestId === String(req.id) ? highlightRef : null}
                className="mp-review-card"
                style={{
                  cursor: "default",
                  padding: "16px",
                  ...(highlightRequestId === String(req.id) ? {
                    border: "2px solid var(--mp-primary, #0f766e)",
                    boxShadow: "0 0 0 3px rgba(15, 118, 110, 0.15)",
                    borderRadius: "var(--mp-radius-lg, 12px)",
                    transition: "box-shadow 0.3s ease",
                  } : {}),
                }}
              >
                <div className="mp-review-card__head">
                  <div className="mp-review-card__user">
                    <div className="mp-review-card__avatar" style={{ width: 38, height: 38, fontSize: "0.8rem" }}>
                      {String(req.learner?.fullName || "?").charAt(0)}
                    </div>
                    <div>
                      <p className="mp-review-card__name">{req.learner?.fullName || "Learner"}</p>
                      <p className="mp-review-card__meta">{new Date(req.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
                {/* Extra fields: subject, date, time, duration, budget */}
                <div className="mp-mini-row" style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {req.subject && (
                    <span className="mp-chip">{req.subject}</span>
                  )}
                  {req.preferredDate && (
                    <span className="mp-chip" style={{ background: "rgba(15,157,138,0.08)", color: "var(--mp-primary, #0f766e)" }}>
                      📅 {new Date(req.preferredDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                  {req.preferredTime && (
                    <span className="mp-chip" style={{ background: "rgba(99,102,241,0.08)", color: "#6366F1" }}>
                      🕐 {req.preferredTime}
                    </span>
                  )}
                  {req.preferredDuration && (
                    <span className="mp-chip" style={{ background: "rgba(217,119,6,0.08)", color: "#D97706" }}>
                      ⏱ {req.preferredDuration} min
                    </span>
                  )}
                  {req.budget && !isNaN(Number(req.budget)) && (
                    <span className="mp-chip" style={{ background: "rgba(22,163,74,0.08)", color: "#16A34A" }}>
                      💰 ₹{Number(req.budget).toLocaleString()}
                    </span>
                  )}
                </div>
                {req.message && (
                  <p className="mp-mini-row__m" style={{ marginTop: 6, fontStyle: "italic", fontSize: "0.84rem" }}>
                    "{req.message}"
                  </p>
                )}
                <div className="mp-drawer__foot" style={{ padding: "10px 0 0" }}>
                  <button
                    type="button"
                    className="md-btn md-btn--brand md-btn--sm"
                    disabled={actionLoading === req.id + "-accept"}
                    onClick={() => handleAccept(req.id)}
                  >
                    {actionLoading === req.id + "-accept" ? "..." : "Accept"}
                  </button>
                  <button
                    type="button"
                    className="md-btn md-btn--outline md-btn--sm"
                    disabled={actionLoading === req.id + "-decline"}
                    onClick={() => handleDecline(req.id)}
                  >
                    {actionLoading === req.id + "-decline" ? "..." : "Decline"}
                  </button>
                </div>
              </div>
            ))}                {repliedRequests.length > 0 && (
              <div style={{ padding: "4px 0", fontSize: "0.75rem", fontWeight: 600, color: "var(--mp-text-muted, #94a3b8)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Learner Replies
              </div>
            )}
            {repliedRequests.map((req) => (
              <div
                key={req.id}
                ref={highlightRequestId === String(req.id) ? highlightRef : null}
                className="mp-review-card"
                style={{
                  cursor: "default",
                  padding: "16px",
                  opacity: 0.7,
                  ...(highlightRequestId === String(req.id) ? {
                    opacity: 1,
                    border: "2px solid var(--mp-primary, #0f766e)",
                    boxShadow: "0 0 0 3px rgba(15, 118, 110, 0.15)",
                    borderRadius: "var(--mp-radius-lg, 12px)",
                  } : {}),
                }}
              >
                <div className="mp-review-card__head">
                  <div className="mp-review-card__user">
                    <div className="mp-review-card__avatar" style={{ width: 38, height: 38, fontSize: "0.8rem", background: "rgba(79, 70, 229, 0.1)" }}>
                      💬
                    </div>
                    <div>
                      <p className="mp-review-card__name">{req.learner?.fullName || "Learner"}</p>
                      <p className="mp-review-card__meta" style={{ color: "var(--mp-text-muted, #94a3b8)" }}>
                        {req.status === "DECLINED" ? "Declined" : "Replied"} · {new Date(req.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
                {req.replyMessage && (
                  <p className="mp-mini-row__m" style={{ marginTop: 8, padding: "8px 10px", background: "rgba(79, 70, 229, 0.06)", borderRadius: "6px", fontSize: "0.82rem" }}>
                    <strong>Learner replied:</strong> "{req.replyMessage}"
                  </p>
                )}
              </div>
            ))}
            {acceptedRequests.map((req) => (
              <div
                key={req.id}
                ref={highlightRequestId === String(req.id) ? highlightRef : null}
                className="mp-review-card"
                style={{
                  cursor: "default",
                  padding: "16px",
                  opacity: 0.7,
                  ...(highlightRequestId === String(req.id) ? {
                    opacity: 1,
                    border: "2px solid var(--mp-primary, #0f766e)",
                    boxShadow: "0 0 0 3px rgba(15, 118, 110, 0.15)",
                    borderRadius: "var(--mp-radius-lg, 12px)",
                  } : {}),
                }}
              >
                <div className="mp-review-card__head">
                  <div className="mp-review-card__user">
                    <div className="mp-review-card__avatar" style={{ width: 38, height: 38, fontSize: "0.8rem", background: "var(--mp-success-bg, #dcfce7)" }}>
                      ✓
                    </div>
                    <div>
                      <p className="mp-review-card__name">{req.learner?.fullName || "Learner"}</p>
                      {req.sessionId ? (
                        <p className="mp-review-card__meta" style={{ color: "var(--mp-success, #16a34a)" }}>
                          Session created · #{req.sessionId}
                        </p>
                      ) : (
                        <p className="mp-review-card__meta" style={{ color: "var(--mp-warning, #d97706)" }}>
                          Accepted — set up session
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                {req.replyMessage && (
                  <p className="mp-mini-row__m" style={{ marginTop: 8, padding: "8px 10px", background: "rgba(15, 118, 110, 0.06)", borderRadius: "6px", fontSize: "0.82rem" }}>
                    <strong>Learner replied:</strong> "{req.replyMessage}"
                  </p>
                )}
                {!req.sessionId && (
                  <div className="mp-drawer__foot" style={{ padding: "8px 0 0" }}>
                    <button
                      type="button"
                      className="md-btn md-btn--brand md-btn--sm"
                      onClick={() => setSetupRequest(req)}
                    >
                      Set Up Session
                    </button>
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* ─── Accept Message Modal ─── */}
      {showAcceptModal && (
        <div
          className="mp-overlay mp-overlay--center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAcceptModal(false); }}
        >
          <div
            className="mp-drawer"
            style={{
              width: "min(480px, 100%)",
              height: "auto",
              maxHeight: "80vh",
              borderRadius: "var(--mp-radius-xl)",
              borderLeft: "none",
            }}
          >
            <div className="mp-drawer__head">
              <div className="mp-drawer__head-main">
                <p className="mp-head__sub" style={{ margin: 0, fontSize: "0.72rem" }}>
                  Accept Request
                </p>
                <h3 className="mp-drawer__title">
                  Message to {requests.find(r => r.id === acceptingRequestId)?.learner?.fullName || "Learner"}
                </h3>
              </div>
              <button
                type="button"
                className="mp-icon-btn"
                onClick={() => setShowAcceptModal(false)}
                aria-label="Close"
              >
                <Icon name="close" />
              </button>
            </div>

            <div className="mp-drawer__body" style={{ gap: 16 }}>
              <div className="mp-field">
                <label className="mp-label" htmlFor="accept-msg">
                  Personal message (optional)
                </label>
                <textarea
                  id="accept-msg"
                  className="mp-textarea"
                  rows={3}
                  value={acceptMessage}
                  onChange={(e) => setAcceptMessage(e.target.value)}
                  placeholder="e.g. I'm excited to work with you! Let's set up a time that works."
                  ref={acceptTextareaRef}
                />
                <span
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--mp-text-muted, #94a3b8)",
                    marginTop: 4,
                  }}
                >
                  This message will be included in the acceptance notification sent to the learner.
                </span>
              </div>
            </div>

            <div className="mp-drawer__foot">
              <button
                type="button"
                className="md-btn md-btn--outline md-btn--sm"
                onClick={() => setShowAcceptModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="md-btn md-btn--brand md-btn--sm"
                onClick={handleAcceptConfirm}
                disabled={actionLoading === (acceptingRequestId || "") + "-accept"}
              >
                {actionLoading === (acceptingRequestId || "") + "-accept" ? "Accepting…" : "Accept & Notify Learner"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════ Helpers ═══════════════════ */

const formatDateOnly = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "TBD";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
};

const getStatusLabel = (session) => {
  const raw = String(session?.status || session?.sessionStatus || "").toUpperCase();
  if (raw === "CANCELLED") return "Cancelled";
  if (raw === "COMPLETED") return "Completed";
  if (raw === "ARCHIVED") return "Completed";
  // The booking state (from the backend booking snapshot) wins over the static
  // session status for the 1:1 lifecycle: BOOKED → UPCOMING → IN_PROGRESS → COMPLETED.
  const bs = String(session?.bookingState || "").toUpperCase();
  if (["PENDING", "ACCEPTED", "CONFIRMED", "IN_PROGRESS", "RESCHEDULE_REQUESTED"].includes(bs)) {
    return "Booked";
  }
  if (!session?.startTime) return "Available";
  if (new Date(session.startTime).getTime() < Date.now()) return "Completed";
  return "Available";
};

const statusPillClass = (status) => {
  switch (status) {
    case "Available":
      return "mp-pill mp-pill--active";
    case "Booked":
      return "mp-pill mp-pill--pending";
    case "Completed":
      return "mp-pill mp-pill--completed";
    case "Cancelled":
      return "mp-pill mp-pill--cancelled";
    default:
      return "mp-pill mp-pill--inactive";
  }
};

const sessionTypeBadge = (session) => {
  const type = String(session?.sessionType || "").toUpperCase();
  if (type === "PRIVATE") {
    const name = session?.targetLearner?.fullName || "";
    return { label: "PRIVATE", detail: name ? `For: ${name}` : "Private", cls: "mp-pill mp-pill--inactive" };
  }
  return { label: "PUBLIC", detail: "Available to eligible learners", cls: "mp-pill mp-pill--active" };
};

export default function TeachingPage({ profile: profileProp, notify }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightRequestId = searchParams.get("requestId");
  const [profile, setProfile] = useState(profileProp || null);
  // Marketplace gate — blocks create/publish/availability/accept until the
  // mentor's profile is complete AND admin-verified.
  const gate = useMentorGate(profile, null);

  // Keep the local copy in sync when the parent supplies a fresher profile
  // (e.g. after the mentor completes onboarding and navigates here).
  useEffect(() => {
    if (profileProp) setProfile(profileProp);
  }, [profileProp]);
  const [sessions, setSessions] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [availabilitySlots, setAvailabilitySlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingSlot, setSavingSlot] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState("dateAsc");
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [sessionForm, setSessionForm] = useState({
    title: "",
    sessionType: "PUBLIC", // PUBLIC | PRIVATE
    targetLearnerId: null,
    targetLearnerName: "",
    description: "",
    startTime: "",
    endTime: "",
    priceAmount: "",
    meetingLink: "",
    maxParticipants: 1,
    cancellationWindowHours: 24,
    rescheduleWindowHours: 12,
    confirmMakePublic: false,
  });
  const [sessionErrors, setSessionErrors] = useState({});
  const [sessionMessage, setSessionMessage] = useState("");
  /* ── Private-session learner search ── */
  const [learnerQuery, setLearnerQuery] = useState("");
  const [learnerResults, setLearnerResults] = useState([]);
  const [learnerSearching, setLearnerSearching] = useState(false);
  const [learnerSearchOpen, setLearnerSearchOpen] = useState(false);
  const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false);
  const [editingAvailability, setEditingAvailability] = useState(null);
  const [availabilityForm, setAvailabilityForm] = useState({
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "17:00",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });
  const [availabilityMessage, setAvailabilityMessage] = useState("");

  /* Debounced learner search for the private-session form (name / username / email). */
  const debouncedLearnerQuery = useDebouncedValue(learnerQuery, 350);
  useEffect(() => {
    let active = true;
    if (!debouncedLearnerQuery || String(debouncedLearnerQuery).trim().length < 2) {
      setLearnerResults([]);
      return;
    }
    setLearnerSearching(true);
    client
      .get("/api/v1/sessions/learners", { params: { q: debouncedLearnerQuery.trim(), size: 8 } })
      .then((res) => {
        if (!active) return;
        const page = res?.data?.data;
        setLearnerResults(Array.isArray(page) ? page : Array.isArray(page?.content) ? page.content : []);
      })
      .catch(() => {
        if (active) setLearnerResults([]);
      })
      .finally(() => {
        if (active) setLearnerSearching(false);
      });
    return () => { active = false; };
  }, [debouncedLearnerQuery]);

  const selectLearner = (learner) => {
    setSessionForm((prev) => ({
      ...prev,
      targetLearnerId: learner?.id ?? null,
      targetLearnerName: learner?.fullName || "",
    }));
    setLearnerQuery("");
    setLearnerResults([]);
    setLearnerSearchOpen(false);
  };

  const clearSelectedLearner = () => {
    setSessionForm((prev) => ({ ...prev, targetLearnerId: null, targetLearnerName: "" }));
  };

  const loadWorkspaceData = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [profileRes, sessionsRes, bookingsRes, availabilityRes] =
        await Promise.all([
          client.get("/api/v1/users/me"),
          client.get("/api/v1/sessions"),
          client.get("/api/v1/bookings"),
          client.get("/api/v1/availability/my-slots"),
        ]);

      setProfile(profileRes?.data?.data || null);
      // Paginated responses — unwrap .content from the Page objects.
      setSessions(sessionsRes?.data?.data?.content || []);
      setBookings(bookingsRes?.data?.data?.content || []);
      setAvailabilitySlots(availabilityRes?.data?.data?.content || []);
    } catch (error) {
      setLoadError("Could not load your sessions. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, []);

  const mentorSessions = useMemo(
    () =>
      sessions.filter((session) => {
        if (!session) return false;
        if (!profile?.id || !session?.mentor?.id) return true;
        return session.mentor.id === profile.id;
      }),
    [sessions, profile],
  );

  const pendingRequests = useMemo(
    () =>
      bookings.filter((booking) =>
        ["PENDING", "RESCHEDULE_REQUESTED"].includes(
          String(booking?.bookingStatus || booking?.status || "").toUpperCase(),
        ),
      ),
    [bookings],
  );

  const stats = useMemo(() => {
    const active = mentorSessions.filter(
      (session) => getStatusLabel(session) === "Available",
    ).length;
    const thisWeek = mentorSessions.filter((session) => {
      const start = session?.startTime
        ? new Date(session.startTime).getTime()
        : 0;
      const now = Date.now();
      return start >= now && start <= now + 7 * 24 * 60 * 60 * 1000;
    }).length;

    const lastWeek = mentorSessions.filter((session) => {
      const start = session?.startTime
        ? new Date(session.startTime).getTime()
        : 0;
      const now = Date.now();
      return (
        start >= now - 14 * 24 * 60 * 60 * 1000 &&
        start < now - 7 * 24 * 60 * 60 * 1000
      );
    }).length;

    const trend =
      lastWeek === 0
        ? thisWeek > 0
          ? "New this week"
          : "No change"
        : `${Math.round(((thisWeek - lastWeek) / Math.max(1, lastWeek)) * 100)}% this week`;
    return {
      total: mentorSessions.length,
      active,
      pending: pendingRequests.length,
      thisWeek,
      trend,
    };
  }, [mentorSessions, pendingRequests]);

  const filteredSessions = useMemo(() => {
    return mentorSessions
      .filter((session) => {
        const status = getStatusLabel(session);
        if (statusFilter !== "all" && status !== statusFilter) return false;
        if (upcomingOnly) {
          const startTime = session?.startTime
            ? new Date(session.startTime).getTime()
            : 0;
          if (startTime < Date.now()) return false;
        }
        if (!searchTerm) return true;
        const query = searchTerm.toLowerCase();
        return [
          session?.title,
          session?.sessionType,
          session?.description,
          session?.skill?.name,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .sort((a, b) => {
        const aDate = new Date(a?.startTime || 0).getTime();
        const bDate = new Date(b?.startTime || 0).getTime();
        const aPrice = Number(a?.priceAmount || a?.pricePerHour || 0);
        const bPrice = Number(b?.priceAmount || b?.pricePerHour || 0);
        const aSeats = Number(a?.maxParticipants || a?.capacity || 1);
        const bSeats = Number(b?.maxParticipants || b?.capacity || 1);

        switch (sortKey) {
          case "dateDesc":
            return bDate - aDate;
          case "priceAsc":
            return aPrice - bPrice;
          case "priceDesc":
            return bPrice - aPrice;
          case "seatsAsc":
            return aSeats - bSeats;
          case "seatsDesc":
            return bSeats - aSeats;
          default:
            return aDate - bDate;
        }
      });
  }, [mentorSessions, searchTerm, statusFilter, sortKey, upcomingOnly]);

  const openSessionModal = (session = null) => {
    // Marketplace gate — creating a session requires a verified mentor.
    gate.requestAction(() => {
      setEditingSession(session);
      if (session) {
        setSessionForm({
          title: session.title || "",
          sessionType: String(session.sessionType || "PUBLIC").toUpperCase() === "PRIVATE" ? "PRIVATE" : "PUBLIC",
          targetLearnerId: session.targetLearner?.id ?? null,
          targetLearnerName: session.targetLearner?.fullName || "",
          description: session.description || "",
          startTime: session.startTime ? session.startTime.slice(0, 16) : "",
          endTime: session.endTime ? session.endTime.slice(0, 16) : "",
          priceAmount: session.priceAmount != null ? session.priceAmount : "",
          meetingLink: session.meetingLink || "",
          maxParticipants: 1,
          cancellationWindowHours: session.cancellationWindowHours ?? 24,
          rescheduleWindowHours: session.rescheduleWindowHours ?? 12,
          confirmMakePublic: false,
        });
      } else {
        setSessionForm({
          title: "",
          sessionType: "PUBLIC",
          targetLearnerId: null,
          targetLearnerName: "",
          description: "",
          startTime: "",
          endTime: "",
          priceAmount: "",
          meetingLink: "",
          maxParticipants: 1,
          cancellationWindowHours: 24,
          rescheduleWindowHours: 12,
          confirmMakePublic: false,
        });
      }
      setLearnerQuery("");
      setLearnerResults([]);
      setSessionErrors({});
      setSessionMessage("");
      setIsSessionModalOpen(true);
    });
  };

  const validateSession = (form) => {
    const errors = {};
    if (!String(form.title || "").trim())
      errors.title = "Please enter a session title.";
    if (String(form.sessionType || "").toUpperCase() === "PRIVATE" && !form.targetLearnerId)
      errors.targetLearner = "Please select the learner this private session is for.";
    if (!String(form.description || "").trim())
      errors.description = "Please add a short session description.";
    if (!form.startTime) errors.startTime = "Please choose a start time.";
    if (!form.endTime) errors.endTime = "Please choose an end time.";
    if (
      form.startTime &&
      form.endTime &&
      new Date(form.endTime) <= new Date(form.startTime)
    ) {
      errors.endTime = "End time must be after start time.";
    }
    if (
      !Number.isFinite(Number(form.priceAmount)) ||
      Number(form.priceAmount) < 0
    ) {
      errors.priceAmount = "Price must be 0 or greater.";
    }
    return errors;
  };

  const handleSessionChange = (field, value) => {
    setSessionForm((prev) => ({ ...prev, [field]: value }));
    if (Object.keys(sessionErrors).length > 0) {
      setSessionErrors((prev) => ({
        ...prev,
        ...validateSession({ ...sessionForm, [field]: value }),
      }));
    }
  };

  const saveSession = async (event) => {
    event.preventDefault();
    const errors = validateSession(sessionForm);
    if (Object.keys(errors).length > 0) {
      setSessionErrors(errors);
      setSessionMessage("Please fix the highlighted fields.");
      return;
    }

    const isPrivate = String(sessionForm.sessionType || "PUBLIC").toUpperCase() === "PRIVATE";
    const payload = {
      title: sessionForm.title.trim(),
      description: sessionForm.description.trim(),
      sessionType: isPrivate ? "PRIVATE" : "PUBLIC",
      targetLearnerId: isPrivate ? sessionForm.targetLearnerId : null,
      confirmMakePublic: Boolean(sessionForm.confirmMakePublic),
      startTime: new Date(sessionForm.startTime).toISOString(),
      endTime: new Date(sessionForm.endTime).toISOString(),
      priceAmount: Number(sessionForm.priceAmount || 0),
      meetingLink: sessionForm.meetingLink.trim(),
      maxParticipants: 1,
      cancellationWindowHours: Number(
        sessionForm.cancellationWindowHours || 24,
      ),
      rescheduleWindowHours: Number(sessionForm.rescheduleWindowHours || 12),
    };

    try {
      let response;
      if (editingSession?.id) {
        response = await client.patch(
          `/api/v1/sessions/${editingSession.id}`,
          payload,
        );
        const updated = response?.data?.data;
        setSessions((prev) =>
          prev.map((session) =>
            session.id === updated.id ? updated : session,
          ),
        );
        notify?.({
          type: "success",
          title: "Session updated",
          message: "Changes were saved.",
        });
      } else {
        response = await client.post("/api/v1/sessions", payload);
        const created = response?.data?.data;
        if (created) setSessions((prev) => [created, ...prev]);
        notify?.({
          type: "success",
          title: "Session created",
          message: "Your session is now available.",
        });
      }
      setIsSessionModalOpen(false);
    } catch (error) {
      setSessionMessage(getApiErrorMessage(error, "Could not save session."));
      notify?.({
        type: "error",
        title: "Save failed",
        message: getApiErrorMessage(error, "Could not save session."),
      });
    }
  };

  const duplicateSession = async (session) => {
    const isPrivate = String(session.sessionType || "PUBLIC").toUpperCase() === "PRIVATE";
    const payload = {
      title: `${session.title || "Session"} (Copy)`,
      description: session.description || "",
      sessionType: isPrivate ? "PRIVATE" : "PUBLIC",
      targetLearnerId: isPrivate ? session.targetLearner?.id ?? null : null,
      confirmMakePublic: false,
      startTime: session.startTime || new Date().toISOString(),
      endTime: session.endTime || new Date().toISOString(),
      priceAmount: Number(session.priceAmount || session.pricePerHour || 0),
      meetingLink: session.meetingLink || "",
      maxParticipants: 1,
      cancellationWindowHours: Number(session.cancellationWindowHours || 24),
      rescheduleWindowHours: Number(session.rescheduleWindowHours || 12),
    };
    try {
      const response = await client.post("/api/v1/sessions", payload);
      const created = response?.data?.data;
      if (created) setSessions((prev) => [created, ...prev]);
      notify?.({
        type: "success",
        title: "Session duplicated",
        message: "A copy was added.",
      });
    } catch (error) {
      notify?.({
        type: "error",
        title: "Duplicate failed",
        message: getApiErrorMessage(error, "Could not duplicate session."),
      });
    }
  };

  const cancelSession = async (sessionId) => {
    if (!window.confirm("Cancel this session? Learners with active bookings will be notified and refunded.")) return;
    try {
      const response = await client.post(`/api/v1/sessions/${sessionId}/cancel`);
      const updated = response?.data?.data;
      setSessions((prev) =>
        prev.map((session) => (session.id === updated.id ? updated : session)),
      );
      notify?.({
        type: "success",
        title: "Session cancelled",
        message: "The session was cancelled and learners were notified.",
      });
    } catch (error) {
      notify?.({
        type: "error",
        title: "Cancel failed",
        message: getApiErrorMessage(error, "Could not cancel session."),
      });
    }
  };

  const deleteSession = async (sessionId) => {
    try {
      await client.delete(`/api/v1/sessions/${sessionId}`);
      setSessions((prev) => prev.filter((session) => session.id !== sessionId));
      notify?.({
        type: "success",
        title: "Session deleted",
        message: "The session was removed.",
      });
    } catch (error) {
      notify?.({
        type: "error",
        title: "Delete failed",
        message: getApiErrorMessage(error, "Could not delete session."),
      });
    }
  };

  const updateBookingStatus = async (bookingId, status) => {
    try {
      const response = await client.patch(
        `/api/v1/bookings/${bookingId}/status`,
        { status },
      );
      const updated = response?.data?.data;
      setBookings((prev) =>
        prev.map((booking) => (booking.id === updated.id ? updated : booking)),
      );
      notify?.({
        type: "success",
        title: "Request updated",
        message: `Request ${status.toLowerCase()} successfully.`,
      });
    } catch (error) {
      notify?.({
        type: "error",
        title: "Update failed",
        message: getApiErrorMessage(error, "Could not update request."),
      });
    }
  };

  const openAvailabilityModal = (slot = null, dayOfWeek = null) => {
    // Marketplace gate — setting availability requires a verified mentor.
    gate.requestAction(() => {
      setEditingAvailability(slot);
      setAvailabilityForm({
        dayOfWeek: dayOfWeek ?? slot?.dayOfWeek ?? 1,
        startTime: slot?.startTime || "09:00",
        endTime: slot?.endTime || "17:00",
        timezone:
          slot?.timezone ||
          Intl.DateTimeFormat().resolvedOptions().timeZone ||
          "UTC",
      });
      setAvailabilityMessage("");
      setIsAvailabilityModalOpen(true);
    });
  };

  const saveAvailability = async (event) => {
    event.preventDefault();
    setAvailabilityMessage("");

    if (!availabilityForm.startTime || !availabilityForm.endTime) {
      setAvailabilityMessage("Please provide both start and end times.");
      return;
    }
    if (availabilityForm.startTime >= availabilityForm.endTime) {
      setAvailabilityMessage("Start time must be before end time.");
      return;
    }

    const payload = {
      dayOfWeek: Number(availabilityForm.dayOfWeek),
      startTime: availabilityForm.startTime,
      endTime: availabilityForm.endTime,
      timezone: availabilityForm.timezone,
      active: true,
    };

    setSavingSlot(true);
    try {
      let response;
      if (editingAvailability?.id) {
        response = await client.patch(
          `/api/v1/availability/my-slots/${editingAvailability.id}`,
          payload,
        );
        const updated = response?.data?.data;
        setAvailabilitySlots((prev) =>
          prev.map((slot) => (slot.id === updated.id ? updated : slot)),
        );
        notify?.({
          type: "success",
          title: "Availability updated",
          message: "Your availability was saved.",
        });
      } else {
        response = await client.post("/api/v1/availability/my-slots", payload);
        const created = response?.data?.data;
        if (created) setAvailabilitySlots((prev) => [...prev, created]);
        notify?.({
          type: "success",
          title: "Availability added",
          message: "Your availability was saved.",
        });
      }
      setIsAvailabilityModalOpen(false);
      setEditingAvailability(null);
    } catch (error) {
      setAvailabilityMessage(
        getApiErrorMessage(error, "Could not save availability."),
      );
      notify?.({
        type: "error",
        title: "Save failed",
        message: getApiErrorMessage(error, "Could not save availability."),
      });
    } finally {
      setSavingSlot(false);
    }
  };

  const removeAvailability = async (slotId) => {
    try {
      await client.delete(`/api/v1/availability/my-slots/${slotId}`);
      setAvailabilitySlots((prev) => prev.filter((slot) => slot.id !== slotId));
      notify?.({
        type: "success",
        title: "Availability removed",
        message: "This window was deleted.",
      });
    } catch (error) {
      notify?.({
        type: "error",
        title: "Delete failed",
        message: getApiErrorMessage(error, "Could not delete availability."),
      });
    }
  };

  const availabilityByDay = useMemo(() => {
    const slotMap = new Map();
    availabilitySlots.forEach((slot) => {
      const day = Number(slot?.dayOfWeek || 1);
      if (!slotMap.has(day)) slotMap.set(day, slot);
    });

    return ISO_DAY_NAMES.map((dayName, index) => {
      const dayNumber = index + 1;
      return {
        dayName,
        dayNumber,
        slot: slotMap.get(dayNumber),
      };
    });
  }, [availabilitySlots]);

  return (
    <div className="md-page">
      {/* ═══════════════════ PREMIUM HERO ═══════════════════ */}
      <MentorPageHero
        eyebrow="Mentor › Manage Sessions"
        icon="video_camera_front"
        title="Manage Sessions"
        sub="Sessions are auto-created when you set your weekly availability. Manage your sessions, bookings, and schedule from here."
      >
        <button
          type="button"
          className="md-btn md-btn--outline md-btn--sm"
          onClick={() => gate.requestAction(() => navigate("/mentor/calendar"))}
        >
          <Icon name="schedule" /> Set Availability
        </button>
        <button
          type="button"
          className="md-btn md-btn--ghost md-btn--sm"
          onClick={() => gate.requestAction(() => navigate("/mentor/calendar"))}
        >
          <Icon name="calendar_month" /> Import Calendar
        </button>
      </MentorPageHero>

      {/* ═══════════════════ STATS CARDS ═══════════════════ */}
      <div
        className="md-stats md-animate"
        style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}
      >
        <StatsCard
          icon="calendar_month"
          label="Total Sessions"
          value={stats.total}
          description="All published and historical sessions"
        />
        <StatsCard
          icon="bolt"
          label="Active Sessions"
          value={stats.active}
          description="Upcoming sessions learners can book"
        />
        <StatsCard
          icon="mail"
          label="Pending Requests"
          value={stats.pending}
          description="Bookings awaiting your response"
        />
        <StatsCard
          icon="schedule"
          label="This Week"
          value={stats.thisWeek}
          description={stats.trend}
        />
      </div>

      {/* ═══════════════════ MAIN CONTENT + SIDEBAR ═══════════════════ */}
      <section className="mp-reviews-layout">
        <div className="space-y-6">
          {/* ─── Session Management Card ─── */}
          <div className="md-card md-animate" style={{ gap: 16 }}>
            <div className="mp-head">
              <div>
                <p className="mp-head__sub" style={{ margin: 0 }}>
                  Session Management
                </p>
                <h2 className="mp-head__title">Your Sessions</h2>
                <p className="mp-head__sub">
                  Sessions are automatically generated from your availability slots.
                  Set your weekly availability to create sessions for the upcoming
                  two weeks, then manage them here.
                </p>
              </div>
              <div className="mp-head__actions">
                <button
                  type="button"
                  className="md-btn md-btn--outline md-btn--sm"
                  onClick={() => navigate("/mentor/calendar")}
                >
                  <Icon name="schedule" /> Manage Availability
                </button>
                <button
                  type="button"
                  className="md-btn md-btn--brand md-btn--sm"
                  onClick={() => openSessionModal()}
                >
                  <Icon name="add" /> New Session
                </button>
              </div>
            </div>

            {/* Mini stats */}
            <div className="mp-stats" style={{ gridTemplateColumns: "repeat(3, minmax(0,1fr))" }}>
              <div className="mp-stat">
                <p className="mp-stat__label">Sessions live</p>
                <p className="mp-stat__value">{mentorSessions.length}</p>
                <p className="mp-stat__desc">Total sessions currently available.</p>
              </div>
              <div className="mp-stat">
                <p className="mp-stat__label">Pending requests</p>
                <p className="mp-stat__value">{pendingRequests.length}</p>
                <p className="mp-stat__desc">Requests waiting for your response.</p>
              </div>
              <div className="mp-stat">
                <p className="mp-stat__label">Filter</p>
                <p className="mp-stat__value">{upcomingOnly ? "Yes" : "No"}</p>
                <p className="mp-stat__desc">Showing {upcomingOnly ? "only upcoming" : "all"} sessions.</p>
              </div>
            </div>
          </div>

          {/* ─── Sessions Table / Controls ─── */}
          <div className="md-card md-animate" style={{ gap: 16 }}>
            {/* Status tabs */}
            <div className="mp-section__head">
              <div>
                <p className="mp-head__sub" style={{ margin: 0 }}>
                  Sessions overview
                </p>
                <h3 className="mp-section__title" style={{ fontSize: "1.1rem", marginTop: 2 }}>
                  Live sessions & controls
                </h3>
              </div>
              <div className="mp-toolbar">
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`md-btn md-btn--sm ${statusFilter === tab.key ? "md-btn--brand" : "md-btn--outline"}`}
                    onClick={() => setStatusFilter(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search + Sort */}
            <div className="mp-toolbar" style={{ flexWrap: "wrap", gap: 12 }}>
              <div className="mp-search" style={{ flex: "1", minWidth: 220 }}>
                <Icon name="search" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search sessions..."
                />
              </div>
              <div className="mp-toolbar" style={{ gap: 8 }}>
                <select
                  value={sortKey}
                  onChange={(event) => setSortKey(event.target.value)}
                  className="mp-select"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className={`md-btn md-btn--sm ${upcomingOnly ? "md-btn--brand" : "md-btn--outline"}`}
                  onClick={() => setUpcomingOnly((prev) => !prev)}
                >
                  {upcomingOnly ? "Upcoming only" : "All dates"}
                </button>
              </div>
            </div>

            {/* Results count */}
            <div className="mp-avail-row" style={{ padding: "8px 14px" }}>
              <p style={{ fontSize: "0.82rem", color: "var(--mp-text-secondary)", margin: 0 }}>
                Showing <strong>{filteredSessions.length}</strong> of{" "}
                <strong>{mentorSessions.length}</strong> sessions
              </p>
              <span className="mp-pill mp-pill--inactive" style={{ fontSize: "0.7rem" }}>
                {upcomingOnly ? "Upcoming only" : "All dates"}
              </span>
            </div>

            {/* Loading state */}
            {loading ? (
              <div className="mp-skeleton" style={{ padding: "24px 0" }}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="mp-skeleton__row" />
                ))}
              </div>
            ) : filteredSessions.length === 0 ? (
              /* Premium empty state */
              <div className="md-empty">
                <div className="md-empty__icon">
                  <Icon name="calendar_month" />
                </div>
                <p className="md-empty__title">No Sessions Available Yet</p>
                <p className="md-empty__desc">
                  Set your weekly availability and sessions will be created
                  automatically for the next two weeks. Or create a one-off
                  session directly.
                </p>
                <div className="mp-head__actions" style={{ marginTop: 4, gap: 8 }}>
                  <button
                    type="button"
                    className="md-btn md-btn--brand md-btn--sm"
                    onClick={() => navigate("/mentor/calendar")}
                  >
                    <Icon name="schedule" /> Set Availability
                  </button>
                  <button
                    type="button"
                    className="md-btn md-btn--outline md-btn--sm"
                    onClick={() => openSessionModal()}
                  >
                    <Icon name="add" /> Create Manually
                  </button>
                </div>
              </div>
            ) : (
              /* Premium table */
              <div className="mp-table-wrap">
                <table className="mp-table">
                  <thead>
                    <tr>
                      <th>Session</th>
                      <th>Type</th>
                      <th>Date & Time</th>
                      <th>Price</th>
                      <th>Seats</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSessions.map((session) => {
                      const status = getStatusLabel(session);
                      return (
                        <tr
                          key={session.id}
                          onClick={() => {
                            setActiveMenu(
                              activeMenu === session.id ? null : session.id,
                            );
                          }}
                        >
                          <td>
                            <div className="mp-cell-user">
                              <div>
                                <p className="mp-cell-user__name">
                                  {session.title || "Untitled session"}
                                </p>
                                <p className="mp-cell-user__email">
                                  {session.description
                                    ? session.description.length > 60
                                      ? `${session.description.substring(0, 60)}…`
                                      : session.description
                                    : "No description."}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start" }}>
                              <span className={sessionTypeBadge(session).cls}>
                                {sessionTypeBadge(session).label}
                              </span>
                              <span style={{ fontSize: "0.72rem", color: "var(--mp-text-muted)" }}>
                                {sessionTypeBadge(session).detail}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: "0.84rem" }}>
                              {formatDateTime(session.startTime)}
                            </span>
                            <br />
                            <span style={{ fontSize: "0.72rem", color: "var(--mp-text-muted)" }}>
                              {formatDateTime(session.endTime)}
                            </span>
                          </td>
                          <td>
                            {formatCurrency(
                              session.priceAmount || session.pricePerHour || 0,
                            )}
                            {Number(session.priceAmount || 0) <= 0 && (
                              <span style={{ display: "block", fontSize: "0.68rem", color: "var(--mp-success, #16a34a)" }}>
                                FREE
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: "0.84rem", color: "var(--mp-text-muted)" }}>1:1</td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start" }}>
                              <span className={statusPillClass(status)}>
                                {status}
                              </span>
                              {session.bookedByLearnerName && (
                                <span style={{ fontSize: "0.7rem", color: "var(--mp-text-secondary, #475569)" }}>
                                  Booked by {session.bookedByLearnerName}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="mp-row-actions">
                              <button
                                type="button"
                                className="mp-icon-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openSessionModal(session);
                                }}
                                title="Edit"
                              >
                                <Icon name="edit" />
                              </button>
                              <button
                                type="button"
                                className="mp-icon-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  duplicateSession(session);
                                }}
                                title="Duplicate"
                              >
                                <Icon name="content_copy" />
                              </button>
                              {status !== "Cancelled" && status !== "Completed" && (
                                <button
                                  type="button"
                                  className="mp-icon-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    cancelSession(session.id);
                                  }}
                                  title="Cancel session"
                                >
                                  <Icon name="cancel" />
                                </button>
                              )}
                              {String(session.sessionType || "").toUpperCase() === "PRIVATE" && (
                                <button
                                  type="button"
                                  className="mp-icon-btn"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    const targetId = session.targetLearner?.id;
                                    if (targetId == null) return;
                                    try {
                                      const res = await client.post(`/api/v1/chat/direct/${targetId}`);
                                      const convId = res?.data?.data?.conversationId;
                                      navigate(convId ? `/mentor/messages/${convId}` : "/mentor/messages");
                                    } catch {
                                      navigate("/mentor/messages");
                                    }
                                  }}
                                  title="Message learner"
                                >
                                  <Icon name="chat" />
                                </button>
                              )}
                              <button
                                type="button"
                                className="mp-icon-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteSession(session.id);
                                }}
                                title="Delete"
                              >
                                <Icon name="delete" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════ RIGHT SIDEBAR ═══════════════════ */}
        <aside className="space-y-6">
          {/* Pending Requests */}
          <div className="md-card md-animate" style={{ gap: 14 }}>
            <div className="mp-section__head" style={{ marginBottom: 0 }}>
              <div>
                <p className="mp-head__sub" style={{ margin: 0 }}>
                  Session Requests
                </p>
                <h3 className="mp-section__title">Pending Requests</h3>
              </div>
              <span className="mp-pill mp-pill--pending">
                {pendingRequests.length} open
              </span>
            </div>

            <div
              className="mp-feed"
              style={{ maxHeight: 400, overflowY: "auto" }}
            >
              {pendingRequests.length === 0 ? (
                <div className="md-empty" style={{ padding: "24px 16px" }}>
                  <div className="md-empty__icon" style={{ width: 48, height: 48, fontSize: "1.3rem" }}>
                    <Icon name="inbox" />
                  </div>
                  <p className="md-empty__title">No pending requests</p>
                  <p className="md-empty__desc">
                    Requests will appear here as soon as learners book.
                  </p>
                  <Link
                    to="/mentor/messages"
                    className="md-btn md-btn--outline md-btn--sm"
                  >
                    View All Requests
                  </Link>
                </div>
              ) : (
                pendingRequests.slice(0, 4).map((booking) => (
                  <div key={booking.id} className="mp-review-card" style={{ cursor: "default", padding: "16px" }}>
                    <div className="mp-review-card__head">
                      <div className="mp-review-card__user">
                        {booking.learner?.profileImageUrl ? (
                          <img
                            src={booking.learner.profileImageUrl}
                            alt={booking.learner.fullName}
                            className="mp-review-card__avatar"
                            style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover" }}
                          />
                        ) : (
                          <div className="mp-review-card__avatar" style={{ width: 38, height: 38, fontSize: "0.8rem" }}>
                            {String(booking.learner?.fullName || "?").charAt(0)}
                          </div>
                        )}
                        <div>
                          <p className="mp-review-card__name">
                            {booking.learner?.fullName || "Learner"}
                          </p>
                          <p className="mp-review-card__meta">
                            {formatDateOnly(booking.session?.startTime)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <p className="mp-mini-row__m" style={{ marginTop: 8 }}>
                      {booking.session?.title || "Session request"}
                    </p>
                    <div className="mp-drawer__foot" style={{ padding: "10px 0 0" }}>
                      <button
                        type="button"
                        className="md-btn md-btn--brand md-btn--sm"
                        onClick={() => updateBookingStatus(booking.id, "ACCEPTED")}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="md-btn md-btn--outline md-btn--sm"
                        onClick={() => updateBookingStatus(booking.id, "REJECTED")}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {pendingRequests.length > 0 && (
              <Link
                to="/mentor/messages"
                className="md-btn md-btn--outline md-btn--sm"
                style={{ width: "100%", justifyContent: "center" }}
              >
                View all requests
              </Link>
            )}
          </div>

          {/* Session Requests */}
          <SessionRequestsSection
            notify={notify}
            highlightRequestId={highlightRequestId}
            gateRequest={gate.requestAction}
          />

          {/* Quick Tips */}
          <div className="md-card md-animate" style={{ gap: 14 }}>
            <div className="mp-section__head" style={{ marginBottom: 0 }}>
              <div className="mp-section__title" style={{ gap: 10 }}>
                <span
                  className="md-stat__icon"
                  style={{ width: 36, height: 36, fontSize: "1rem" }}
                >
                  <Icon name="tips_and_updates" />
                </span>
                <div>
                  <p className="mp-section__title" style={{ fontSize: "0.9rem" }}>
                    Quick tips
                  </p>
                  <p className="mp-head__sub" style={{ fontSize: "0.78rem" }}>
                    Keep the mentor experience polished.
                  </p>
                </div>
              </div>
            </div>
            <ul className="mp-tip-list">
              {[
                "Set availability → sessions are auto-created",
                "Sessions use your headline and hourly rate as defaults",
                "Keep your availability updated for each week",
                "Respond to booking requests quickly",
              ].map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        </aside>
      </section>

      {/* ═══════════════════ AVAILABILITY SECTION ═══════════════════ */}
      <section className="md-card md-animate" style={{ gap: 18 }}>
        <div className="mp-head">
          <div>
            <p className="mp-head__sub" style={{ margin: 0 }}>
              Availability
            </p>
            <h2 className="mp-head__title">Availability</h2>
            <p className="mp-head__sub">
              Define recurring weekly slots. Sessions will be auto-created for each
              slot for the next two weeks.
            </p>
          </div>
          <button
            type="button"
            className="md-btn md-btn--brand md-btn--sm"
            onClick={() => openAvailabilityModal()}
          >
            <Icon name="add" /> Add Time
          </button>
        </div>

        <div className="mp-stats" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {availabilityByDay.map(({ dayName, dayNumber, slot }) => (
            <div
              key={dayName}
              className="mp-stat"
              style={{ cursor: "default", padding: "16px", minHeight: 140 }}
            >
              <div className="mp-stat__top">
                <div className="mp-stat__icon" style={{ width: 34, height: 34, fontSize: "1rem" }}>
                  <Icon name="schedule" />
                </div>
                <span
                  className={`mp-stat__delta ${slot?.active ? "mp-stat__delta--pos" : "mp-stat__delta--flat"}`}
                >
                  {slot ? (slot.active ? "Active" : "Open") : "Closed"}
                </span>
              </div>
              <p className="mp-stat__label" style={{ fontSize: "0.78rem" }}>
                {dayName}
              </p>
              <p className="mp-stat__value" style={{ fontSize: "1.1rem", margin: "4px 0" }}>
                {slot ? `${slot.startTime}–${slot.endTime}` : "—"}
              </p>
              {slot?.timezone && (
                <p className="mp-stat__desc" style={{ fontSize: "0.68rem" }}>
                  {slot.timezone}
                </p>
              )}
              <div className="mp-head__actions" style={{ marginTop: 8 }}>
                {slot ? (
                  <>
                    <button
                      type="button"
                      className="md-btn md-btn--outline md-btn--sm"
                      onClick={() => openAvailabilityModal(slot)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="md-btn md-btn--outline md-btn--sm"
                      onClick={() => removeAvailability(slot.id)}
                    >
                      Delete
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="md-btn md-btn--outline md-btn--sm"
                    onClick={() => openAvailabilityModal(null, dayNumber)}
                  >
                    + Add Time
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {availabilityMessage && (
          <p className="mp-mini-row__m" style={{ color: "var(--mp-primary)", fontWeight: 600 }}>
            {availabilityMessage}
          </p>
        )}
      </section>

      {/* ═══════════════════ SESSION MODAL ═══════════════════ */}
      {isSessionModalOpen && (
        <div className="mp-overlay mp-overlay--center">
          <div
            className="mp-drawer"
            style={{ width: "min(640px, 100%)", height: "auto", maxHeight: "90vh", borderRadius: "var(--mp-radius-xl)", borderLeft: "none" }}
          >
            <form onSubmit={saveSession} style={{ display: "contents" }}>
              <div className="mp-drawer__head">
                <div className="mp-drawer__head-main">
                  <p className="mp-head__sub" style={{ margin: 0, fontSize: "0.72rem" }}>
                    {editingSession ? "Edit session" : "Create session"}
                  </p>
                  <h3 className="mp-drawer__title">
                    {editingSession ? "Update session" : "New session"}
                  </h3>
                </div>
                <button
                  type="button"
                  className="mp-icon-btn"
                  onClick={() => setIsSessionModalOpen(false)}
                  aria-label="Close"
                >
                  <Icon name="close" />
                </button>
              </div>

              <div className="mp-drawer__body" style={{ gap: 16 }}>
                <div className="mp-field">
                  <label className="mp-label" htmlFor="teach-title">Title</label>
                  <input
                    id="teach-title"
                    type="text"
                    className={`mp-input ${sessionErrors.title ? "mp-input--error" : ""}`}
                    value={sessionForm.title}
                    onChange={(event) => handleSessionChange("title", event.target.value)}
                    placeholder="e.g. React Deep Dive"
                  />
                  {sessionErrors.title && (
                    <span className="mp-mini-row__m" style={{ color: "var(--mp-danger)" }}>
                      {sessionErrors.title}
                    </span>
                  )}
                </div>

                <div className="mp-field">
                  <label className="mp-label">Session Type</label>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => handleSessionChange("sessionType", "PUBLIC")}
                      className={`mp-type-card${String(sessionForm.sessionType).toUpperCase() !== "PRIVATE" ? " is-selected" : ""}`}
                      style={{
                        flex: "1", minWidth: 180, cursor: "pointer", padding: "12px 14px", textAlign: "left",
                        border: `1px solid ${String(sessionForm.sessionType).toUpperCase() !== "PRIVATE" ? "var(--mp-primary, #0f766e)" : "var(--mp-border, #e2e8f0)"}`,
                        background: String(sessionForm.sessionType).toUpperCase() !== "PRIVATE" ? "rgba(15,118,110,0.06)" : "transparent",
                        borderRadius: 12, fontSize: "0.84rem", color: "inherit",
                      }}
                    >
                      <strong>○ Public Session</strong>
                      <span style={{ display: "block", fontSize: "0.72rem", color: "var(--mp-text-muted, #64748b)", marginTop: 3 }}>
                        Available to all eligible learners
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSessionChange("sessionType", "PRIVATE")}
                      className={`mp-type-card${String(sessionForm.sessionType).toUpperCase() === "PRIVATE" ? " is-selected" : ""}`}
                      style={{
                        flex: "1", minWidth: 180, cursor: "pointer", padding: "12px 14px", textAlign: "left",
                        border: `1px solid ${String(sessionForm.sessionType).toUpperCase() === "PRIVATE" ? "var(--mp-primary, #0f766e)" : "var(--mp-border, #e2e8f0)"}`,
                        background: String(sessionForm.sessionType).toUpperCase() === "PRIVATE" ? "rgba(15,118,110,0.06)" : "transparent",
                        borderRadius: 12, fontSize: "0.84rem", color: "inherit",
                      }}
                    >
                      <strong>○ Private / Custom</strong>
                      <span style={{ display: "block", fontSize: "0.72rem", color: "var(--mp-text-muted, #64748b)", marginTop: 3 }}>
                        Only for one specific learner
                      </span>
                    </button>
                  </div>
                  {sessionErrors.targetLearner && (
                    <span className="mp-mini-row__m" style={{ color: "var(--mp-danger)" }}>
                      {sessionErrors.targetLearner}
                    </span>
                  )}
                </div>

                {String(sessionForm.sessionType).toUpperCase() === "PRIVATE" && (
                  <div className="mp-field">
                    <label className="mp-label" htmlFor="teach-learner">Select Learner</label>
                    {sessionForm.targetLearnerId ? (
                      <div
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                          padding: "10px 12px", borderRadius: 10, background: "rgba(15,118,110,0.06)",
                          border: "1px solid rgba(15,118,110,0.25)",
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: "0.86rem" }}>{sessionForm.targetLearnerName}</strong>
                          <span style={{ display: "block", fontSize: "0.72rem", color: "var(--mp-text-muted, #64748b)" }}>
                            Selected learner
                          </span>
                        </div>
                        <button
                          type="button"
                          className="md-btn md-btn--outline md-btn--sm"
                          onClick={clearSelectedLearner}
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          id="teach-learner"
                          type="search"
                          className="mp-input"
                          value={learnerQuery}
                          onChange={(e) => { setLearnerQuery(e.target.value); setLearnerSearchOpen(true); }}
                          onFocus={() => setLearnerSearchOpen(true)}
                          placeholder="Search learner by name, username, or email…"
                          autoComplete="off"
                        />
                        {learnerSearchOpen && learnerResults.length > 0 && (
                          <div
                            style={{
                              marginTop: 6, border: "1px solid var(--mp-border, #e2e8f0)", borderRadius: 10,
                              overflow: "hidden", background: "var(--mp-card-bg, #fff)", maxHeight: 220, overflowY: "auto",
                            }}
                          >
                            {learnerResults.map((learner) => (
                              <button
                                key={learner.id}
                                type="button"
                                onClick={() => selectLearner(learner)}
                                style={{
                                  display: "block", width: "100%", textAlign: "left", padding: "10px 12px",
                                  border: "none", borderBottom: "1px solid var(--mp-border, #f1f5f9)",
                                  background: "transparent", cursor: "pointer", fontSize: "0.84rem", color: "inherit",
                                }}
                              >
                                <strong>{learner.fullName}</strong>
                                <span style={{ display: "block", fontSize: "0.72rem", color: "var(--mp-text-muted, #64748b)" }}>
                                  @{learner.username || "—"} · {learner.email}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                        {learnerSearching && (
                          <span style={{ fontSize: "0.74rem", color: "var(--mp-text-muted, #64748b)" }}>
                            Searching…
                          </span>
                        )}
                        {!learnerSearching && learnerSearchOpen && learnerQuery.length >= 2 && learnerResults.length === 0 && (
                          <span style={{ fontSize: "0.74rem", color: "var(--mp-text-muted, #64748b)" }}>
                            No learners found. Try a different name, username, or email.
                          </span>
                        )}
                      </>
                    )}
                    <span style={{ fontSize: "0.72rem", color: "var(--mp-text-muted, #64748b)", marginTop: 4, display: "block" }}>
                      Only ONE learner can be selected. Other learners will never see this session.
                    </span>
                  </div>
                )}

                {editingSession &&
                  String(editingSession.sessionType || "PUBLIC").toUpperCase() === "PRIVATE" &&
                  String(sessionForm.sessionType).toUpperCase() === "PUBLIC" &&
                  !sessionForm.confirmMakePublic && (
                    <div
                      style={{
                        padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(217,119,6,0.4)",
                        background: "rgba(217,119,6,0.07)", display: "flex", flexDirection: "column", gap: 8,
                      }}
                    >
                      <strong style={{ fontSize: "0.84rem" }}>Make this session public?</strong>
                      <span style={{ fontSize: "0.78rem", color: "var(--mp-text-secondary, #475569)" }}>
                        It will become visible to other learners and can be booked by anyone.
                      </span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" className="md-btn md-btn--outline md-btn--sm" onClick={() => handleSessionChange("sessionType", "PRIVATE")}>
                          Cancel
                        </button>
                        <button type="button" className="md-btn md-btn--brand md-btn--sm" onClick={() => handleSessionChange("confirmMakePublic", true)}>
                          Make Public
                        </button>
                      </div>
                    </div>
                  )}

                <div className="mp-field--row">
                  <div className="mp-field">
                    <label className="mp-label" htmlFor="teach-price">Price (₹)</label>
                    <input
                      id="teach-price"
                      type="number"
                      min="0"
                      step="1"
                      className={`mp-input ${sessionErrors.priceAmount ? "mp-input--error" : ""}`}
                      value={sessionForm.priceAmount}
                      onChange={(event) => handleSessionChange("priceAmount", event.target.value)}
                      placeholder="0 — free session"
                    />
                    {sessionErrors.priceAmount && (
                      <span className="mp-mini-row__m" style={{ color: "var(--mp-danger)" }}>
                        {sessionErrors.priceAmount}
                      </span>
                    )}
                  </div>
                  <div className="mp-field">
                    <label className="mp-label" htmlFor="teach-link">Meeting link</label>
                    <input
                      id="teach-link"
                      type="url"
                      className="mp-input"
                      value={sessionForm.meetingLink}
                      onChange={(event) => handleSessionChange("meetingLink", event.target.value)}
                      placeholder="https://meet.google.com/..."
                    />
                  </div>
                </div>

                <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--mp-text-muted, #94a3b8)" }}>
                  1:1 session — one session instance belongs to one learner. Once booked or completed, a session can never be booked again.
                </p>

                <div className="mp-field">
                  <label className="mp-label" htmlFor="teach-desc">Description</label>
                  <textarea
                    id="teach-desc"
                    rows={3}
                    className={`mp-textarea ${sessionErrors.description ? "mp-input--error" : ""}`}
                    value={sessionForm.description}
                    onChange={(event) => handleSessionChange("description", event.target.value)}
                    placeholder="What will learners take away from this session?"
                  />
                  {sessionErrors.description && (
                    <span className="mp-mini-row__m" style={{ color: "var(--mp-danger)" }}>
                      {sessionErrors.description}
                    </span>
                  )}
                </div>

                <div className="mp-field--row">
                  <div className="mp-field">
                    <label className="mp-label" htmlFor="teach-start">Start</label>
                    <input
                      id="teach-start"
                      type="datetime-local"
                      className={`mp-input ${sessionErrors.startTime ? "mp-input--error" : ""}`}
                      value={sessionForm.startTime}
                      onChange={(event) => handleSessionChange("startTime", event.target.value)}
                    />
                    {sessionErrors.startTime && (
                      <span className="mp-mini-row__m" style={{ color: "var(--mp-danger)" }}>
                        {sessionErrors.startTime}
                      </span>
                    )}
                  </div>
                  <div className="mp-field">
                    <label className="mp-label" htmlFor="teach-end">End</label>
                    <input
                      id="teach-end"
                      type="datetime-local"
                      className={`mp-input ${sessionErrors.endTime ? "mp-input--error" : ""}`}
                      value={sessionForm.endTime}
                      onChange={(event) => handleSessionChange("endTime", event.target.value)}
                    />
                    {sessionErrors.endTime && (
                      <span className="mp-mini-row__m" style={{ color: "var(--mp-danger)" }}>
                        {sessionErrors.endTime}
                      </span>
                    )}
                  </div>
                </div>

                {sessionMessage && (
                  <p className="mp-mini-row__m" style={{ color: "var(--mp-primary)", fontWeight: 600 }}>
                    {sessionMessage}
                  </p>
                )}
              </div>

              <div className="mp-drawer__foot">
                <button
                  type="button"
                  className="md-btn md-btn--outline md-btn--sm"
                  onClick={() => setIsSessionModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="md-btn md-btn--brand md-btn--sm"
                >
                  {editingSession ? "Save changes" : "Publish session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═══════════════════ AVAILABILITY MODAL ═══════════════════ */}
      {isAvailabilityModalOpen && (
        <div className="mp-overlay mp-overlay--center">
          <div
            className="mp-drawer"
            style={{ width: "min(520px, 100%)", height: "auto", maxHeight: "80vh", borderRadius: "var(--mp-radius-xl)", borderLeft: "none" }}
          >
            <form onSubmit={saveAvailability} style={{ display: "contents" }}>
              <div className="mp-drawer__head">
                <div className="mp-drawer__head-main">
                  <p className="mp-head__sub" style={{ margin: 0, fontSize: "0.72rem" }}>
                    {editingAvailability ? "Edit availability" : "Add availability"}
                  </p>
                  <h3 className="mp-drawer__title">
                    {editingAvailability ? "Update availability" : "New availability"}
                  </h3>
                </div>
                <button
                  type="button"
                  className="mp-icon-btn"
                  onClick={() => {
                    setIsAvailabilityModalOpen(false);
                    setEditingAvailability(null);
                  }}
                  aria-label="Close"
                >
                  <Icon name="close" />
                </button>
              </div>

              <div className="mp-drawer__body" style={{ gap: 16 }}>
                <div className="mp-field--row">
                  <div className="mp-field">
                    <label className="mp-label" htmlFor="avail-day">Day</label>
                    <select
                      id="avail-day"
                      className="mp-input"
                      value={availabilityForm.dayOfWeek}
                      onChange={(event) =>
                        setAvailabilityForm((prev) => ({
                          ...prev,
                          dayOfWeek: Number(event.target.value),
                        }))
                      }
                    >
                      {ISO_DAY_NAMES.map((day, index) => (
                        <option key={day} value={index + 1}>
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mp-field">
                    <label className="mp-label" htmlFor="avail-tz">Timezone</label>
                    <div className="mp-timezone-display">
                      <Icon name="schedule" />
                      <span>{availabilityForm.timezone}</span>
                    </div>
                  </div>
                </div>

                <div className="mp-field--row">
                  <div className="mp-field">
                    <label className="mp-label" htmlFor="avail-start">Start time</label>
                    <input
                      id="avail-start"
                      type="time"
                      className="mp-input"
                      value={availabilityForm.startTime}
                      onChange={(event) =>
                        setAvailabilityForm((prev) => ({
                          ...prev,
                          startTime: event.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="mp-field">
                    <label className="mp-label" htmlFor="avail-end">End time</label>
                    <input
                      id="avail-end"
                      type="time"
                      className="mp-input"
                      value={availabilityForm.endTime}
                      onChange={(event) =>
                        setAvailabilityForm((prev) => ({
                          ...prev,
                          endTime: event.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                </div>

                {availabilityMessage && (
                  <p className="mp-mini-row__m" style={{ color: "var(--mp-primary)", fontWeight: 600 }}>
                    {availabilityMessage}
                  </p>
                )}
              </div>

              <div className="mp-drawer__foot">
                <button
                  type="button"
                  className="md-btn md-btn--outline md-btn--sm"
                  onClick={() => {
                    setIsAvailabilityModalOpen(false);
                    setEditingAvailability(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="md-btn md-btn--brand md-btn--sm"
                  disabled={savingSlot}
                >
                  {savingSlot ? (
                    <>
                      <span className="mp-spinner" /> Saving…
                    </>
                  ) : editingAvailability ? (
                    "Save availability"
                  ) : (
                    "Add availability"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Error toast */}
      {loadError && (
        <div className="mp-overlay mp-overlay--center" style={{ alignItems: "flex-end", padding: "24px", background: "transparent", pointerEvents: "none" }}>
          <div
            style={{
              background: "var(--mp-card)",
              border: "1px solid var(--mp-card-border)",
              borderRadius: "var(--mp-radius-lg)",
              padding: "16px 20px",
              boxShadow: "var(--mp-shadow-lg)",
              pointerEvents: "auto",
              maxWidth: 400,
            }}
          >
            <p style={{ margin: 0, fontWeight: 600, color: "var(--mp-text)" }}>
              {loadError}
            </p>
          </div>
        </div>
      )}

      <MobileBottomNav />

      {/* Marketplace gate modal — blocks create/publish/availability/accept
          until the mentor's profile is complete AND admin-verified. */}
      <ProfileGateModal {...gate.gate} />
    </div>
  );
}
