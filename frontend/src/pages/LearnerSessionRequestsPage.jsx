import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  CheckCircle2,
  Hourglass,
  Inbox,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
import client from "../api/client";
import HeroSection from "../components/HeroSection";
import { normalizeSkills } from "../utils/skills";
import {
  RequestCard,
  RequestDetailsModal,
  RequestPaymentModal,
  RequestReplyModal,
  RequestStatCard,
  RequestsEmptyState,
  RequestsSkeleton,
  SORT_OPTIONS,
  STATUS_FILTERS,
} from "../modules/learner/components/requests";

const STATUS_ORDER = { PENDING: 0, ACCEPTED: 1, DECLINED: 2, COMPLETED: 3, CANCELLED: 4 };

const matchesSearch = (request, query) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    request.mentor?.fullName,
    request.subject,
    request.message,
    ...normalizeSkills(request.mentor?.skills),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
};

export default function LearnerSessionRequestsPage() {
  const [searchParams] = useSearchParams();
  const highlightRequestId = searchParams.get("requestId");
  const highlightRef = useRef(null);

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("newest");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef(null);

  const [detailsRequest, setDetailsRequest] = useState(null);
  const [replyRequest, setReplyRequest] = useState(null);
  const [payRequest, setPayRequest] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await client.get("/api/v1/session-requests");
      setRequests(res?.data?.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not load your requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = "My Requests | Mentorly";
    loadRequests();
  }, [loadRequests]);

  // Scroll to a highlighted request once data is ready
  useEffect(() => {
    if (!loading && highlightRequestId && highlightRef.current) {
      const t = window.setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [loading, highlightRequestId]);

  // Close the filter popover on outside click / Escape
  useEffect(() => {
    if (!filterOpen) return undefined;
    const onDown = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setFilterOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [filterOpen]);

  const stats = useMemo(() => {
    const pending = requests.filter((r) => r.status === "PENDING").length;
    const accepted = requests.filter((r) => r.status === "ACCEPTED").length;
    const declined = requests.filter((r) => r.status === "DECLINED").length;
    return { total: requests.length, pending, accepted, declined };
  }, [requests]);

  const visibleRequests = useMemo(() => {
    let list = requests.filter((r) => matchesSearch(r, query));
    if (statusFilter !== "ALL") list = list.filter((r) => r.status === statusFilter);
    // Guard against missing/invalid timestamps so the sort never produces NaN
    const timeOf = (value) => {
      const t = Date.parse(value);
      return Number.isNaN(t) ? 0 : t;
    };
    return [...list].sort((a, b) => {
      if (sortBy === "oldest") return timeOf(a.createdAt) - timeOf(b.createdAt);
      if (sortBy === "status") return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      return timeOf(b.createdAt) - timeOf(a.createdAt);
    });
  }, [requests, query, statusFilter, sortBy]);

  const statusCounts = useMemo(() => {
    const counts = { PENDING: 0, ACCEPTED: 0, DECLINED: 0 };
    requests.forEach((r) => {
      if (r.status in counts) counts[r.status] += 1;
    });
    return counts;
  }, [requests]);

  const activeFilter = statusFilter !== "ALL";

  const cancelRequest = async (request) => {
    if (cancellingId) return;
    // eslint-disable-next-line no-alert
    if (!window.confirm("Cancel this session request?")) return;
    setCancellingId(request.id);
    setError("");
    try {
      await client.post(`/api/v1/session-requests/${request.id}/cancel`);
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
      if (detailsRequest?.id === request.id) setDetailsRequest(null);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not cancel request.");
    } finally {
      setCancellingId(null);
    }
  };

  const handleReplySent = (request, message) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === request.id ? { ...r, replyMessage: message } : r)),
    );
  };

  return (
    <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* ─── Hero ─── */}
      <HeroSection
        className="hero-section--compact"
        badge={
          <>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>mail</span>
            Requests
          </>
        }
        title="My Requests"
        subtitle="Track and manage all your mentor requests in one place."
        illustration={
          <div className="hero-section__watermark" aria-hidden="true">
            <span className="material-symbols-outlined">inbox</span>
          </div>
        }
      >
        {/* Search + filter inside hero actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", maxWidth: 520 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "rgba(255,255,255,0.7)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>search</span>
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search mentor, skill, request..."
              aria-label="Search requests"
              autoComplete="off"
              style={{
                width: "100%", height: 40, padding: "0 36px 0 42px",
                border: "1px solid rgba(255,255,255,0.3)", borderRadius: 12,
                background: "rgba(255,255,255,0.12)", color: "#fff",
                fontSize: 14, fontWeight: 500, fontFamily: "inherit",
                backdropFilter: "blur(8px)", outline: "none",
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                style={{
                  position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", color: "rgba(255,255,255,0.7)",
                  cursor: "pointer", display: "inline-flex", padding: 4, borderRadius: 8,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            )}
          </div>

          <div style={{ position: "relative" }} ref={filterRef}>
            <button
              type="button"
              onClick={() => setFilterOpen((v) => !v)}
              aria-label="Filter by status"
              aria-haspopup="listbox"
              aria-expanded={filterOpen}
              style={{
                height: 40, padding: "0 14px", borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.12)",
                color: "#fff", cursor: "pointer", display: "inline-flex",
                alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600,
                backdropFilter: "blur(8px)", position: "relative",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>filter_list</span>
              {activeFilter && (
                <span style={{
                  width: 18, height: 18, borderRadius: 999, fontSize: 11, fontWeight: 700,
                  background: "#fff", color: "var(--hero-btn-text, #0f766e)",
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>1</span>
              )}
            </button>

            <AnimatePresence>
              {filterOpen && (
                <motion.div
                  role="listbox"
                  aria-label="Filter by status"
                  initial={{ opacity: 0, scale: 0.96, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: -4 }}
                  transition={{ duration: 0.16 }}
                  style={{
                    position: "absolute", top: "100%", right: 0, marginTop: 8,
                    minWidth: 200, padding: 8, borderRadius: 14,
                    background: "var(--lqr-card, #fff)", border: "1px solid var(--lqr-border, #e5e7eb)",
                    boxShadow: "var(--lqr-shadow-lg, 0 20px 40px rgba(0,0,0,0.08))",
                    zIndex: 50,
                  }}
                >
                  <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "var(--lqr-text-muted, #94a3b8)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</p>
                  {STATUS_FILTERS.map((option) => {
                    const selected = statusFilter === option.value;
                    const count = option.value === "ALL" ? requests.length : statusCounts[option.value] || 0;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => {
                          setStatusFilter(option.value);
                          setFilterOpen(false);
                        }}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          width: "100%", padding: "8px 12px", borderRadius: 10, border: "none",
                          background: selected ? "var(--lqr-primary-tint, rgba(20,184,166,0.1))" : "transparent",
                          color: "var(--lqr-text, #0f172a)", cursor: "pointer", fontSize: 14, fontWeight: 500,
                        }}
                      >
                        <span>{option.label}</span>
                        <span style={{ fontSize: 12, color: "var(--lqr-text-muted, #94a3b8)", fontWeight: 600 }}>{count}</span>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </HeroSection>

        {/* ─── Summary cards ─── */}
        <section className="lqr-stats" aria-label="Request summary">
          <RequestStatCard
            icon={Inbox}
            label="Total Requests"
            value={stats.total}
            description="All requests sent"
            tone="total"
            index={0}
          />
          <RequestStatCard
            icon={Hourglass}
            label="Pending"
            value={stats.pending}
            description="Awaiting mentor response"
            tone="pending"
            index={1}
          />
          <RequestStatCard
            icon={CheckCircle2}
            label="Accepted"
            value={stats.accepted}
            description="Ready for setup"
            tone="accepted"
            index={2}
          />
          <RequestStatCard
            icon={XCircle}
            label="Declined"
            value={stats.declined}
            description="Not accepted"
            tone="declined"
            index={3}
          />
        </section>

        {/* ─── Requests section ─── */}
        <section className="lqr-section" aria-label="Your requests">
          <div className="lqr-section__head">
            <div>
              <h2 className="lqr-section__title">Your Requests</h2>
              <p className="lqr-section__sub">Track and manage all your requests.</p>
              {!loading && (
                <p className="lqr-section__results">
                  {visibleRequests.length} of {requests.length} request{requests.length === 1 ? "" : "s"}
                </p>
              )}
            </div>
            <label className="lqr-sort">
              <span aria-hidden="true">
                <SlidersHorizontal size={16} />
              </span>
              <span className="sr-only">Sort requests</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && (
            <div className="lqr-banner lqr-banner--error" role="alert">
              <span>{error}</span>
              <button type="button" className="lqr-banner__retry" onClick={loadRequests}>
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <RequestsSkeleton count={4} />
          ) : requests.length === 0 ? (
            <RequestsEmptyState />
          ) : visibleRequests.length === 0 ? (
            <RequestsEmptyState
              title="No matching requests"
              description={`Nothing matches "${query || statusFilter.toLowerCase()}". Try a different search or filter.`}
              filtered
            />
          ) : (
            <div className="lqr-list">
              <AnimatePresence initial={false} mode="popLayout">
                {visibleRequests.map((request, index) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    index={index}
                    highlighted={highlightRequestId === String(request.id)}
                    innerRef={highlightRequestId === String(request.id) ? highlightRef : undefined}
                    cancelling={cancellingId === request.id}
                    onViewDetails={setDetailsRequest}
                    onCancel={cancelRequest}
                    onPay={setPayRequest}
                    onReply={setReplyRequest}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        {/* ─── Modals ─── */}
        <AnimatePresence>
          {detailsRequest && (
            <RequestDetailsModal
              key="details"
              request={detailsRequest}
              onClose={() => setDetailsRequest(null)}
              onReply={(req) => {
                setDetailsRequest(null);
                setReplyRequest(req);
              }}
            />
          )}
          {replyRequest && (
            <RequestReplyModal
              key="reply"
              request={replyRequest}
              onClose={() => setReplyRequest(null)}
              onSent={handleReplySent}
            />
          )}
          {payRequest && (
            <RequestPaymentModal
              key="pay"
              request={payRequest}
              onClose={() => setPayRequest(null)}
              onPaid={() => {
                setPayRequest(null);
                loadRequests();
              }}
            />
          )}
        </AnimatePresence>
    </div>
  );
}
