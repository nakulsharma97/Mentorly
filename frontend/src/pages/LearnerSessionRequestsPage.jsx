import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import StatsCard from "../modules/common/dashboard/StatsCard";
import MentorPageHero from "../modules/mentor/components/MentorPageHero";
import "../modules/mentor/mentor-pages.css";

const STATUS_CONFIG = {
  PENDING: { label: "Pending", icon: "hourglass_empty", className: "mp-pill mp-pill--pending" },
  ACCEPTED: { label: "Accepted", icon: "check_circle", className: "mp-pill mp-pill--active" },
  DECLINED: { label: "Declined", icon: "cancel", className: "mp-pill mp-pill--cancelled" },
};

const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
};

export default function LearnerSessionRequestsPage() {
  const [searchParams] = useSearchParams();
  const highlightRequestId = searchParams.get("requestId");
  const highlightRef = useRef(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState(null);
  const [replyModalId, setReplyModalId] = useState(null);
  const [replyMessage, setReplyMessage] = useState("");
  const [replySending, setReplySending] = useState(false);
  const replyTextareaRef = useRef(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await client.get("/api/v1/session-requests");
      setRequests(res?.data?.data || []);
    } catch (err) {
      const msg = err?.response?.data?.message || "Could not load your requests.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = "My Requests | SkillSwap";
    loadRequests();
  }, [loadRequests]);

  // Scroll to highlighted request when data loads
  useEffect(() => {
    if (!loading && highlightRequestId && highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
    }
  }, [loading, highlightRequestId]);

  // Focus the reply modal textarea when it opens
  useEffect(() => {
    if (replyModalId && replyTextareaRef.current) {
      setTimeout(() => {
        replyTextareaRef.current?.focus();
      }, 50);
    }
  }, [replyModalId]);

  const stats = useMemo(() => {
    const pending = requests.filter((r) => r.status === "PENDING").length;
    const accepted = requests.filter((r) => r.status === "ACCEPTED").length;
    const declined = requests.filter((r) => r.status === "DECLINED").length;
    return { total: requests.length, pending, accepted, declined };
  }, [requests]);

  return (
    <div className="md-page">
      <MentorPageHero
        eyebrow="Learner › Requests"
        icon="handshake"
        title="My Session Requests"
        sub="Track the custom session requests you have sent to mentors. Once accepted, your session will appear in Booked Sessions."
      >
        <Link to="/learner/mentors" className="md-btn md-btn--outline md-btn--sm">
          <Icon name="person_search" /> Find Mentors
        </Link>
        <Link to="/learner/sessions" className="md-btn md-btn--ghost md-btn--sm">
          <Icon name="calendar_month" /> Booked Sessions
        </Link>
      </MentorPageHero>

      <div className="md-stats md-animate" style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}>
        <StatsCard icon="handshake" label="Total Requests" value={stats.total} description="All requests sent" />
        <StatsCard icon="hourglass_empty" label="Pending" value={stats.pending} description="Awaiting mentor response" />
        <StatsCard icon="check_circle" label="Accepted" value={stats.accepted} description="Ready for setup" />
        <StatsCard icon="cancel" label="Declined" value={stats.declined} description="Not accepted" />
      </div>

      <div className="md-card md-animate" style={{ gap: 16 }}>
        <div className="mp-head">
          <div>
            <h2 className="mp-head__title">Your Requests</h2>
            <p className="mp-head__sub">
              View and track the status of sessions you have requested from mentors.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mp-skeleton" style={{ padding: "24px 0" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="mp-skeleton__row" />
            ))}
          </div>
        ) : error ? (
          <div className="md-empty">
            <div className="md-empty__icon"><Icon name="error_outline" /></div>
            <p className="md-empty__title">Could not load requests</p>
            <p className="md-empty__desc">{error}</p>
            <button type="button" className="md-btn md-btn--brand md-btn--sm" onClick={loadRequests}>
              Retry
            </button>
          </div>
        ) : requests.length === 0 ? (
          <div className="md-empty">
            <div className="md-empty__icon"><Icon name="handshake" /></div>
            <p className="md-empty__title">No session requests yet</p>
            <p className="md-empty__desc">
              Browse mentors and request a custom session. Once a mentor accepts, you will get a notification.
            </p>
            <Link to="/learner/mentors" className="md-btn md-btn--brand md-btn--sm">
              <Icon name="person_search" /> Browse Mentors
            </Link>
          </div>
        ) : (
          <div className="mp-table-wrap">
            <table className="mp-table">
              <thead>
                <tr>
                  <th>Mentor</th>
                  <th>Your Message / Mentor's Response</th>
                  <th>Status</th>
                  <th>Sent On</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => {
                  const config = STATUS_CONFIG[req.status] || STATUS_CONFIG.PENDING;
                  return (
                    <tr
                    key={req.id}
                    ref={highlightRequestId === String(req.id) ? highlightRef : null}
                    style={highlightRequestId === String(req.id) ? {
                      background: "rgba(15, 118, 110, 0.06)",
                      boxShadow: "inset 3px 0 0 var(--mp-primary, #0f766e)",
                    } : {}}
                  >
                      <td>
                        <div className="mp-cell-user">
                          <div className="mp-cell-user__avatar">
                            {req.mentor?.profileImageUrl ? (
                              <img src={req.mentor.profileImageUrl} alt={req.mentor.fullName} />
                            ) : (
                              <span>{String(req.mentor?.fullName || "?").charAt(0)}</span>
                            )}
                          </div>
                          <div>
                            <p className="mp-cell-user__name">
                              <Link to={`/mentors/${req.mentor?.id}`} className="md-link">
                                {req.mentor?.fullName || `Mentor #${req.mentor?.id}`}
                              </Link>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td style={{ maxWidth: 300 }}>
                        <p style={{ fontSize: "0.84rem", margin: 0 }}>{req.message || "—"}</p>
                        {req.declineReason && req.status === "DECLINED" && (
                          <p style={{ fontSize: "0.78rem", margin: "4px 0 0", color: "var(--mp-danger, #ef4444)" }}>
                            ↳ Mentor said: {req.declineReason}
                          </p>
                        )}
                        {req.replyMessage && req.status === "DECLINED" && (
                          <p style={{ fontSize: "0.78rem", margin: "4px 0 0", color: "var(--mp-text-muted, #94a3b8)", fontStyle: "italic" }}>
                            Your reply: "{req.replyMessage}"
                          </p>
                        )}
                      </td>
                      <td>
                        <span className={config.className}>{config.label}</span>
                      </td>
                      <td style={{ fontSize: "0.82rem" }}>{formatDate(req.createdAt)}</td>
                      <td>
                        {req.status === "PENDING" && (
                          <button
                            type="button"
                            className="md-btn md-btn--outline md-btn--sm"
                            disabled={cancellingId === req.id}
                            onClick={async () => {
                              if (!window.confirm("Cancel this session request?")) return;
                              setCancellingId(req.id);
                              try {
                                await client.post(`/api/v1/session-requests/${req.id}/cancel`);
                                setRequests((prev) => prev.filter((r) => r.id !== req.id));
                              } catch (err) {
                                const msg = err?.response?.data?.message || "Could not cancel request.";
                                setError(msg);
                              } finally {
                                setCancellingId(null);
                              }
                            }}
                          >
                            {cancellingId === req.id ? "..." : "Cancel"}
                          </button>
                        )}
                        {req.status === "ACCEPTED" && !req.sessionId && (
                          <span style={{ fontSize: "0.78rem", color: "var(--mp-warning, #d97706)" }}>
                            Awaiting session setup
                          </span>
                        )}
                        {req.status !== "PENDING" && !req.replyMessage && (
                          <button
                            type="button"
                            className="md-btn md-btn--outline md-btn--sm"
                            onClick={() => { setReplyModalId(req.id); setReplyMessage(""); }}
                          >
                            Reply to Mentor
                          </button>
                        )}
                        {req.sessionId && (
                          <Link to="/learner/sessions" className="md-btn md-btn--ghost md-btn--sm">
                            View Session
                          </Link>
                        )}
                        {req.status === "DECLINED" && req.declineReason && (
                          <span style={{ fontSize: "0.78rem", color: "var(--mp-text-muted, #94a3b8)" }}>
                            Reason: {req.declineReason}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Reply Modal ─── */}
      {replyModalId && (
        <div
          className="mp-overlay mp-overlay--center"
          onClick={(e) => { if (e.target === e.currentTarget) setReplyModalId(null); }}
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
                  Reply to Mentor
                </p>
                <h3 className="mp-drawer__title">
                  Reply to {requests.find(r => r.id === replyModalId)?.mentor?.fullName || "Mentor"}
                </h3>
              </div>
              <button
                type="button"
                className="mp-icon-btn"
                onClick={() => setReplyModalId(null)}
                aria-label="Close"
              >
                <Icon name="close" />
              </button>
            </div>

            <div className="mp-drawer__body" style={{ gap: 16 }}>
              {(() => {
                const req = requests.find(r => r.id === replyModalId);
                if (!req) return null;
                return (
                  <>
                    {req.declineReason && req.status === "DECLINED" && (
                      <div style={{ padding: "12px", background: "rgba(239, 68, 68, 0.06)", borderRadius: "var(--mp-radius-md, 8px)", fontSize: "0.84rem" }}>
                        <strong>Mentor said:</strong> {req.declineReason}
                      </div>
                    )}
                    <div className="mp-field">
                      <label className="mp-label" htmlFor="reply-msg">Your Reply</label>
                      <textarea
                        id="reply-msg"
                        className="mp-textarea"
                        rows={4}
                        value={replyMessage}
                        onChange={(e) => setReplyMessage(e.target.value)}
                        placeholder="Write your reply to the mentor..."
                      ref={replyTextareaRef}
                      />
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="mp-drawer__foot">
              <button
                type="button"
                className="md-btn md-btn--outline md-btn--sm"
                onClick={() => setReplyModalId(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="md-btn md-btn--brand md-btn--sm"
                disabled={replySending || !replyMessage.trim()}
                onClick={async () => {
                  if (!replyMessage.trim() || !replyModalId) return;
                  setReplySending(true);
                  try {
                    await client.post(`/api/v1/session-requests/${replyModalId}/reply`, {
                      message: replyMessage.trim(),
                    });
                    setRequests((prev) =>
                      prev.map((r) =>
                        r.id === replyModalId ? { ...r, replyMessage: replyMessage.trim() } : r
                      )
                    );
                    setReplyModalId(null);
                    setReplyMessage("");
                  } catch (err) {
                    const msg = err?.response?.data?.message || "Could not send reply.";
                    setError(msg);
                  } finally {
                    setReplySending(false);
                  }
                }}
              >
                {replySending ? "Sending…" : "Send Reply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
