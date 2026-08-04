import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Hourglass,
  Inbox,
  Search,
  SlidersHorizontal,
  X,
  XCircle,
} from "lucide-react";
import client from "../api/client";
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

const goBack = () => {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "/learner/dashboard";
  }
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
    document.title = "My Requests | SkillSwap";
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
    <div className="lqr-page">
      <motion.div
        className="lqr-inner"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* ─── Top header ─── */}
        <header className="lqr-header">
          <div className="lqr-header__left">
            <div className="lqr-header__crumbs">
              <button
                type="button"
                className="lqr-back"
                onClick={goBack}
                aria-label="Go back"
              >
                <ArrowLeft size={19} />
              </button>
              <nav className="lqr-breadcrumb" aria-label="Breadcrumb">
                <span>Learner</span>
                <span className="lqr-breadcrumb__sep"><ChevronRight size={14} /></span>
                <span className="lqr-breadcrumb__current">My Requests</span>
              </nav>
            </div>
            <div className="lqr-header__titles">
              <h1>My Requests</h1>
              <p>Track and manage all your mentor requests in one place.</p>
            </div>
          </div>

          <div className="lqr-tools">
            <div className="lqr-search">
              <span className="lqr-search__icon" aria-hidden="true">
                <Search size={19} />
              </span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search mentor, skill, request..."
                aria-label="Search requests"
                autoComplete="off"
              />
              {query && (
                <button
                  type="button"
                  className="lqr-search__clear"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="lqr-filter-wrap" ref={filterRef}>
              <button
                type="button"
                className="lqr-filter-btn"
                onClick={() => setFilterOpen((v) => !v)}
                aria-label="Filter by status"
                aria-haspopup="listbox"
                aria-expanded={filterOpen}
              >
                <SlidersHorizontal size={20} />
                {activeFilter && <span className="lqr-filter-badge">1</span>}
              </button>

              <AnimatePresence>
                {filterOpen && (
                  <motion.div
                    className="lqr-filter-menu"
                    role="listbox"
                    aria-label="Filter by status"
                    initial={{ opacity: 0, scale: 0.96, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.97, y: -4 }}
                    transition={{ duration: 0.16 }}
                  >
                    <p className="lqr-filter-menu__label">Status</p>
                    {STATUS_FILTERS.map((option) => {
                      const selected = statusFilter === option.value;
                      const count = option.value === "ALL" ? requests.length : statusCounts[option.value] || 0;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          className="lqr-filter-option"
                          onClick={() => {
                            setStatusFilter(option.value);
                            setFilterOpen(false);
                          }}
                        >
                          <span>{option.label}</span>
                          <span className="lqr-filter-option__count">{count}</span>
                          {selected && (
                            <span className="lqr-filter-option__check" aria-hidden="true">
                              <Check size={16} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

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
      </motion.div>
    </div>
  );
}
