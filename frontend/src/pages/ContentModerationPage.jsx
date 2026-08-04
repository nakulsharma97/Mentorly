import { useCallback, useEffect, useRef, useState } from "react";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import "./AdminOperationsPage.css";
import "./ContentModerationPage.css";
import "../modules/admin/ui/admin-ui.css";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "PENDING_REVIEW", label: "Pending review" },
  { value: "UNDER_INVESTIGATION", label: "Under investigation" },
  { value: "APPROVED", label: "Approved" },
  { value: "REMOVED", label: "Removed" },
  { value: "DISMISSED", label: "Dismissed" },
  { value: "RESTORED", label: "Restored" },
];

const CONTENT_TYPE_OPTIONS = [
  { value: "", label: "All content" },
  { value: "SKILL", label: "Skill" },
  { value: "USER_PROFILE", label: "User profile" },
  { value: "MENTOR_BIO", label: "Mentor bio" },
  { value: "LEARNER_BIO", label: "Learner bio" },
  { value: "SESSION_TITLE", label: "Session title" },
  { value: "SESSION_DESCRIPTION", label: "Session description" },
  { value: "REVIEW", label: "Review" },
  { value: "CHAT_MESSAGE", label: "Chat message" },
  { value: "CERTIFICATE", label: "Certificate" },
  { value: "PORTFOLIO_ITEM", label: "Portfolio item" },
  { value: "UPLOADED_FILE", label: "Uploaded file" },
  { value: "IMAGE", label: "Image" },
  { value: "AI_GENERATED_CONTENT", label: "AI generated" },
  { value: "CUSTOM_REQUEST", label: "Custom request" },
];

const PRIORITY_OPTIONS = [
  { value: "", label: "All priorities" },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

const DETECTION_OPTIONS = [
  { value: "", label: "All sources" },
  { value: "MANUAL_REPORT", label: "Manual report" },
  { value: "AI_MODERATION", label: "AI moderation" },
  { value: "SPAM_DETECTION", label: "Spam detection" },
  { value: "PROFANITY_FILTER", label: "Profanity filter" },
  { value: "DUPLICATE_DETECTION", label: "Duplicate detection" },
  { value: "SCAM_DETECTION", label: "Scam detection" },
  { value: "FAKE_CERTIFICATE_DETECTION", label: "Fake certificate" },
  { value: "SUSPICIOUS_LINK_DETECTION", label: "Suspicious link" },
  { value: "PHONE_NUMBER_DETECTION", label: "Phone number" },
  { value: "EMAIL_DETECTION", label: "Email detection" },
  { value: "PAYMENT_OUTSIDE_PLATFORM_DETECTION", label: "Off-platform payment" },
];

const PAGE_SIZE = 10;
const SORTABLE_COLUMNS = ["id", "createdAt", "priority", "status", "contentType", "detectionSource"];

const STATUS_META = {
  PENDING_REVIEW: { label: "Pending review", icon: "schedule" },
  UNDER_INVESTIGATION: { label: "Under investigation", icon: "search" },
  APPROVED: { label: "Approved", icon: "check_circle" },
  REMOVED: { label: "Removed", icon: "block" },
  DISMISSED: { label: "Dismissed", icon: "cancel" },
  RESTORED: { label: "Restored", icon: "restore" },
};

const CONTENT_TYPE_ICONS = {
  SKILL: "workspaces", USER_PROFILE: "person", MENTOR_BIO: "badge", LEARNER_BIO: "person",
  SESSION_TITLE: "event", SESSION_DESCRIPTION: "description", REVIEW: "star", CHAT_MESSAGE: "chat",
  CERTIFICATE: "workspace_premium", PORTFOLIO_ITEM: "folder", UPLOADED_FILE: "attach_file",
  IMAGE: "image", AI_GENERATED_CONTENT: "auto_awesome", CUSTOM_REQUEST: "handshake",
};

const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(d);
};

const formatDay = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit", year: "numeric" }).format(d);
};

const initialsOf = (name) => {
  if (!name) return "?";
  return name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
};

const errorMessage = (err, fallback) =>
  err?.response?.data?.data?.error || err?.response?.data?.message || fallback;

const previewSnippet = (preview, max = 90) => {
  if (!preview) return "";
  return preview.length > max ? `${preview.slice(0, max)}…` : preview;
};

export default function ContentModerationPage({ notify }) {
  // ── Filters & pagination ──────────────────────────────────────
  const [status, setStatus] = useState("");
  const [contentType, setContentType] = useState("");
  const [priority, setPriority] = useState("");
  const [detectionSource, setDetectionSource] = useState("");
  const [reporterId, setReporterId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");

  // ── Data ──────────────────────────────────────────────────────
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // ── Detail drawer ─────────────────────────────────────────────
  const [selected, setSelected] = useState(null); // { item, detail, events }
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Confirmation modal ────────────────────────────────────────
  const [confirm, setConfirm] = useState(null); // { item, action }
  const [noteText, setNoteText] = useState("");
  const [actingId, setActingId] = useState(null);

  const listRequestRef = useRef(0);
  const detailRequestRef = useRef(0);
  const searchTimerRef = useRef(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await client.get("/api/v1/admin/moderation/stats");
      if (res?.data?.data) setStats(res.data.data);
    } catch {
      // Stats are non-critical.
    }
  }, []);

  const loadItems = useCallback(async () => {
    const requestId = ++listRequestRef.current;
    setLoading(true);
    setLoadError(false);
    try {
      const params = new URLSearchParams({ page, size: PAGE_SIZE, sortBy, sortDir });
      if (status) params.set("status", status);
      if (contentType) params.set("contentType", contentType);
      if (priority) params.set("priority", priority);
      if (detectionSource) params.set("detectionSource", detectionSource);
      if (reporterId) params.set("reporterId", reporterId);
      if (ownerId) params.set("ownerId", ownerId);
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      if (searchApplied.trim()) params.set("q", searchApplied.trim());

      const res = await client.get(`/api/v1/admin/moderation?${params}`);
      if (requestId !== listRequestRef.current) return; // stale
      const data = res?.data?.data || {};
      setItems(data.content || []);
      setTotalElements(data.totalElements || 0);
      setTotalPages(data.totalPages || 0);
    } catch (err) {
      if (requestId !== listRequestRef.current) return;
      setLoadError(true);
      notify?.({
        type: "error",
        title: "Moderation queue unavailable",
        message: errorMessage(err, "Could not load flagged content."),
      });
    } finally {
      if (requestId === listRequestRef.current) setLoading(false);
    }
  }, [notify, page, status, contentType, priority, detectionSource,
    reporterId, ownerId, fromDate, toDate, searchApplied, sortBy, sortDir]);

  // Debounced search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      if (searchApplied !== search.trim()) {
        setSearchApplied(search.trim());
        setPage(0);
      }
    }, 400);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search, searchApplied]);

  useEffect(() => { loadItems(); }, [loadItems]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const applyFilterChange = (setter, value) => {
    setter(value);
    setPage(0);
  };

  const resetFilters = () => {
    setStatus(""); setContentType(""); setPriority(""); setDetectionSource("");
    setReporterId(""); setOwnerId(""); setFromDate(""); setToDate("");
    setSearch(""); setSearchApplied(""); setPage(0);
  };

  const hasActiveFilters = Boolean(status || contentType || priority || detectionSource
    || reporterId || ownerId || fromDate || toDate || searchApplied);

  const toggleSort = (column) => {
    if (!SORTABLE_COLUMNS.includes(column)) return;
    setPage(0);
    if (sortBy === column) setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    else { setSortBy(column); setSortDir("desc"); }
  };

  const openDetail = useCallback(async (item) => {
    setSelected({ item, detail: null, events: [] });
    setDetailLoading(true);
    const requestId = ++detailRequestRef.current;
    try {
      const [detailRes, eventsRes] = await Promise.all([
        client.get(`/api/v1/admin/moderation/${item.id}`),
        client.get(`/api/v1/admin/moderation/${item.id}/events`),
      ]);
      if (requestId !== detailRequestRef.current) return;
      setSelected({
        item,
        detail: detailRes?.data?.data || item,
        events: eventsRes?.data?.data || [],
      });
    } catch (err) {
      if (requestId !== detailRequestRef.current) return;
      notify?.({
        type: "error",
        title: "Could not open item",
        message: errorMessage(err, "Could not load the flagged content details."),
      });
    } finally {
      if (requestId === detailRequestRef.current) setDetailLoading(false);
    }
  }, [notify]);

  const closeDetail = () => {
    detailRequestRef.current++;
    setSelected(null);
  };

  const openConfirm = (item, action) => {
    setConfirm({ item, action });
    setNoteText("");
  };

  const runAction = async () => {
    if (!confirm) return;
    const { item, action } = confirm;
    setActingId(item.id);
    try {
      const id = item.id;
      switch (action) {
        case "ASSIGN": {
          await client.post(`/api/v1/admin/moderation/${id}/assign`, {});
          notify?.({ type: "success", title: "Assigned", message: `Item #${id} assigned to you.` });
          break;
        }
        case "ESCALATE": {
          await client.post(`/api/v1/admin/moderation/${id}/escalate`, { level: 1, reason: noteText.trim() || null });
          notify?.({ type: "success", title: "Escalated", message: `Item #${id} escalated to level 1.` });
          break;
        }
        case "APPROVE": {
          await client.post(`/api/v1/admin/moderation/${id}/approve`, { note: noteText.trim() || null });
          notify?.({ type: "success", title: "Content approved", message: `Item #${id} approved.` });
          break;
        }
        case "DISMISS": {
          await client.post(`/api/v1/admin/moderation/${id}/dismiss`, { note: noteText.trim() || null });
          notify?.({ type: "success", title: "Flag dismissed", message: `Item #${id} dismissed as a false positive.` });
          break;
        }
        case "REMOVE": {
          await client.post(`/api/v1/admin/moderation/${id}/remove`, { note: noteText.trim() || null });
          notify?.({ type: "success", title: "Content removed", message: `Item #${id} removed.` });
          break;
        }
        case "RESTORE": {
          await client.post(`/api/v1/admin/moderation/${id}/restore`, { note: noteText.trim() || null });
          notify?.({ type: "success", title: "Content restored", message: `Item #${id} restored.` });
          break;
        }
        case "WARN": {
          await client.post(`/api/v1/admin/moderation/${id}/warn`, { note: noteText.trim() });
          notify?.({ type: "success", title: "Warning issued", message: "The owner has been notified." });
          break;
        }
        case "SUSPEND": {
          await client.post(`/api/v1/admin/moderation/${id}/user-enabled`, { enabled: false });
          notify?.({ type: "success", title: "User suspended", message: "The account has been suspended." });
          break;
        }
        case "RESTORE_ACCOUNT": {
          await client.post(`/api/v1/admin/moderation/${id}/user-enabled`, { enabled: true });
          notify?.({ type: "success", title: "User restored", message: "The account has been re-enabled." });
          break;
        }
        case "NOTE": {
          await client.post(`/api/v1/admin/moderation/${id}/notes`, { note: noteText.trim() });
          notify?.({ type: "success", title: "Note added", message: "Internal note added." });
          break;
        }
        case "DELETE_PERMANENT": {
          await client.delete(`/api/v1/admin/moderation/${id}`, {
            data: { note: noteText.trim() || null },
          });
          notify?.({ type: "success", title: "Deleted permanently", message: `Item #${id} removed from the database.` });
          break;
        }
        default:
          break;
      }
      setConfirm(null);
      if (selected?.item?.id === id) closeDetail();
      loadItems();
      fetchStats();
    } catch (err) {
      notify?.({
        type: "error",
        title: "Action failed",
        message: errorMessage(err, "Could not complete the action."),
      });
    } finally {
      setActingId(null);
    }
  };

  const canActOn = (item) => item?.status === "PENDING_REVIEW" || item?.status === "UNDER_INVESTIGATION";

  // ── Stats cards (real DB counts) ──────────────────────────────
  const renderStats = () => {
    const cards = [
      { key: "total", label: "Total flagged", icon: "flag", tone: "slate", value: stats?.total ?? 0 },
      { key: "PENDING_REVIEW", label: "Pending review", icon: "schedule", tone: "blue", value: stats?.PENDING_REVIEW ?? 0 },
      { key: "UNDER_INVESTIGATION", label: "Under investigation", icon: "search", tone: "amber", value: stats?.UNDER_INVESTIGATION ?? 0 },
      { key: "APPROVED", label: "Approved", icon: "check_circle", tone: "green", value: stats?.APPROVED ?? 0 },
      { key: "REMOVED", label: "Removed", icon: "block", tone: "rose", value: stats?.REMOVED ?? 0 },
      { key: "priority_HIGH", label: "High priority", icon: "priority_high", tone: "orange", value: stats?.priority_HIGH ?? 0 },
      { key: "priority_CRITICAL", label: "Critical", icon: "dangerous", tone: "red", value: stats?.priority_CRITICAL ?? 0 },
      { key: "decidedToday", label: "Resolved today", icon: "today", tone: "violet", value: stats?.decidedToday ?? 0 },
    ];
    return (
      <div className="cmc-stats">
        {cards.map((c) => (
          <div className={`cmc-stat cmc-stat--${c.tone}`} key={c.key}>
            <span className="cmc-stat__icon"><Icon name={c.icon} /></span>
            <div>
              <p className="cmc-stat__label">{c.label}</p>
              <p className="cmc-stat__value">{c.value}</p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderFilters = () => (
    <div className="cmc-filters">
      <div className="admin-search cmc-filters__search">
        <Icon name="search" />
        <input
          type="text"
          placeholder="Search by user, email, content, skill, session, message, certificate, review, or ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search flagged content"
        />
      </div>

      <select value={status} onChange={(e) => applyFilterChange(setStatus, e.target.value)} aria-label="Filter by status">
        {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <select value={contentType} onChange={(e) => applyFilterChange(setContentType, e.target.value)} aria-label="Filter by content type">
        {CONTENT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <select value={priority} onChange={(e) => applyFilterChange(setPriority, e.target.value)} aria-label="Filter by priority">
        {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <select value={detectionSource} onChange={(e) => applyFilterChange(setDetectionSource, e.target.value)} aria-label="Filter by detection source">
        {DETECTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <input
        className="cmc-filters__id"
        type="number"
        min="1"
        placeholder="Reporter ID"
        value={reporterId}
        onChange={(e) => applyFilterChange(setReporterId, e.target.value)}
        aria-label="Filter by reporter ID"
      />

      <input
        className="cmc-filters__id"
        type="number"
        min="1"
        placeholder="Owner ID"
        value={ownerId}
        onChange={(e) => applyFilterChange(setOwnerId, e.target.value)}
        aria-label="Filter by owner ID"
      />

      <label className="cmc-filters__date">
        <span>From</span>
        <input type="date" value={fromDate} onChange={(e) => applyFilterChange(setFromDate, e.target.value)} />
      </label>

      <label className="cmc-filters__date">
        <span>To</span>
        <input type="date" value={toDate} onChange={(e) => applyFilterChange(setToDate, e.target.value)} />
      </label>

      <button type="button" className="admin-refresh-btn cmc-filters__reset" onClick={resetFilters} disabled={!hasActiveFilters}>
        <Icon name="restart_alt" /> Reset
      </button>
    </div>
  );

  const renderSortHeader = (label, column) => {
    const active = sortBy === column;
    return (
      <button type="button" className={`cmc-th-sort${active ? " is-active" : ""}`} onClick={() => toggleSort(column)} aria-label={`Sort by ${label}`}>
        {label}
        <Icon name={active ? (sortDir === "asc" ? "arrow_upward" : "arrow_downward") : "unfold_more"} />
      </button>
    );
  };

  const renderTable = () => (
    <div className="cmc-table-wrap">
      <table className="cmc-table">
        <thead>
          <tr>
            <th>{renderSortHeader("ID", "id")}</th>
            <th>{renderSortHeader("Content type", "contentType")}</th>
            <th>Preview</th>
            <th>Owner</th>
            <th>Reporter</th>
            <th>Reason</th>
            <th>{renderSortHeader("Priority", "priority")}</th>
            <th>{renderSortHeader("Status", "status")}</th>
            <th>{renderSortHeader("Source", "detectionSource")}</th>
            <th>{renderSortHeader("Created", "createdAt")}</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={item.id === selected?.item?.id ? "is-selected" : ""}>
              <td>
                <button type="button" className="cmc-id-link" onClick={() => openDetail(item)}>#{item.id}</button>
              </td>
              <td>
                <span className="cmc-type">
                  <Icon name={CONTENT_TYPE_ICONS[item.contentType] || "flag"} />
                  {(item.contentType || "USER_PROFILE").replaceAll("_", " ")}
                </span>
              </td>
              <td className="cmc-preview-cell" title={item.contentPreview}>
                {previewSnippet(item.contentPreview) || <span className="cmc-muted">—</span>}
              </td>
              <td>
                {item.ownerId ? (
                  <div className="cmc-user">
                    <span className="cmc-avatar">{initialsOf(item.ownerName)}</span>
                    <div>
                      <strong>{item.ownerName}</strong>
                      <small>{item.ownerEnabled === false ? "Suspended" : item.ownerEmail}</small>
                    </div>
                  </div>
                ) : <span className="cmc-muted">—</span>}
              </td>
              <td>
                {item.reporterId ? (
                  <div className="cmc-user cmc-user--compact">
                    <span className="cmc-avatar cmc-avatar--reporter">{initialsOf(item.reporterName)}</span>
                    <strong>{item.reporterName}</strong>
                  </div>
                ) : (
                  <span className="cmc-source-chip cmc-source-chip--auto">Auto</span>
                )}
              </td>
              <td className="cmc-reason-cell" title={item.reason}>{item.reason}</td>
              <td><span className={`cmc-priority cmc-priority--${(item.priority || "MEDIUM").toLowerCase()}`}>{item.priority || "MEDIUM"}</span></td>
              <td>
                <span className={`admin-status-pill admin-status-pill--${(item.status || "PENDING_REVIEW").toLowerCase()}`}>
                  {STATUS_META[item.status]?.label || item.status}
                </span>
              </td>
              <td><span className="cmc-source-chip">{item.detectionSource?.replaceAll("_", " ") || "MANUAL REPORT"}</span></td>
              <td className="cmc-date-cell" title={formatDate(item.createdAt)}>{formatDay(item.createdAt)}</td>
              <td>
                <div className="cmc-row-actions">
                  <button type="button" className="cmc-icon-btn" onClick={() => openDetail(item)} title="Open details" aria-label="Open details">
                    <Icon name="visibility" />
                  </button>
                  {canActOn(item) && (
                    <button type="button" className="cmc-icon-btn cmc-icon-btn--danger" onClick={() => openConfirm(item, "DELETE_PERMANENT")} title="Delete permanently" aria-label="Delete permanently">
                      <Icon name="delete_forever" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderEmpty = () => (
    <div className="cmc-empty">
      <div className="cmc-empty__art" aria-hidden="true">
        <span className="cmc-empty__shield"><Icon name="shield" /></span>
        <span className="cmc-empty__badge"><Icon name="verified_user" /></span>
      </div>
      <h3>{loadError ? "Could not load flagged content" : "No flagged content found"}</h3>
      <p>
        {loadError
          ? "The moderation queue could not be reached. Try refreshing the page."
          : hasActiveFilters
            ? "Try adjusting your search or filters to find what you're looking for."
            : "When content is reported or flagged by automated detection, it will appear here for review."}
      </p>
      {hasActiveFilters && !loadError && (
        <button type="button" className="admin-refresh-btn" onClick={resetFilters}>
          <Icon name="restart_alt" /> Clear filters
        </button>
      )}
    </div>
  );

  const renderSkeletons = () => (
    <div className="cmc-skeleton-table">
      {Array.from({ length: 5 }).map((_, i) => (
        <div className="cmc-skeleton-row" key={i}>
          <span className="cmc-skeleton-block" style={{ width: 40 }} />
          <span className="cmc-skeleton-block" style={{ width: 90 }} />
          <span className="cmc-skeleton-block" style={{ width: 200 }} />
          <span className="cmc-skeleton-block" style={{ width: 120 }} />
          <span className="cmc-skeleton-block" style={{ width: 90 }} />
          <span className="cmc-skeleton-block" style={{ width: 160 }} />
          <span className="cmc-skeleton-block" style={{ width: 70 }} />
          <span className="cmc-skeleton-block" style={{ width: 110 }} />
          <span className="cmc-skeleton-block" style={{ width: 80 }} />
        </div>
      ))}
    </div>
  );

  const renderPagination = () => (
    <div className="cmc-pagination">
      <span className="cmc-pagination__info">
        {totalElements === 0 ? "0 items" : `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, totalElements)} of ${totalElements}`}
      </span>
      <div className="cmc-pagination__controls">
        <button type="button" className="admin-refresh-btn" disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>
          <Icon name="chevron_left" /> Prev
        </button>
        <span className="cmc-pagination__pages">Page {totalPages === 0 ? 1 : page + 1} of {totalPages || 1}</span>
        <button type="button" className="admin-refresh-btn" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
          Next <Icon name="chevron_right" />
        </button>
      </div>
    </div>
  );

  // ── Detail drawer ─────────────────────────────────────────────
  const renderDetail = () => {
    const d = selected?.detail || selected?.item;
    if (!d) return null;
    const events = selected?.events || [];
    return (
      <div className="cmc-drawer" role="dialog" aria-modal="true" aria-label={`Flagged content #${d.id}`}>
        <div className="cmc-drawer__head">
          <div>
            <p className="admin-eyebrow">Flagged content #{d.id}</p>
            <h3>{d.contentType?.replaceAll("_", " ")}</h3>
          </div>
          <button type="button" className="cmc-icon-btn" onClick={closeDetail} aria-label="Close details">
            <Icon name="close" />
          </button>
        </div>

        {detailLoading ? (
          <p className="cmc-drawer__loading">Loading details…</p>
        ) : (
          <div className="cmc-drawer__body">
            <div className="cmc-drawer__badges">
              <span className={`admin-status-pill admin-status-pill--${(d.status || "PENDING_REVIEW").toLowerCase()}`}>
                {STATUS_META[d.status]?.label || d.status}
              </span>
              <span className={`cmc-priority cmc-priority--${(d.priority || "MEDIUM").toLowerCase()}`}>{d.priority || "MEDIUM"}</span>
              <span className="cmc-source-chip">{d.detectionSource?.replaceAll("_", " ") || "MANUAL REPORT"}</span>
            </div>

            {d.aiConfidence != null && (
              <div className="cmc-ai-score">
                <Icon name="auto_awesome" />
                <div>
                  <strong>AI confidence: {Math.round(d.aiConfidence * 100)}%</strong>
                  <span>Automated detection signal strength</span>
                </div>
              </div>
            )}

            {d.escalationLevel && (
              <div className="cmc-escalated">
                <Icon name="priority_high" />
                Escalated to level {d.escalationLevel}{d.escalationReason ? ` — ${d.escalationReason}` : ""}
                {d.escalatedAt ? ` · ${formatDate(d.escalatedAt)}` : ""}
              </div>
            )}

            <section className="cmc-section">
              <h4><Icon name={CONTENT_TYPE_ICONS[d.contentType] || "flag"} /> Content</h4>
              <p className="cmc-content-full">{d.contentPreview || "No preview available."}</p>
              {d.contentId != null && <p className="cmc-muted">Content ID: #{d.contentId}</p>}
            </section>

            <section className="cmc-section">
              <h4><Icon name="person" /> Owner</h4>
              {d.ownerId ? (
                <div className="cmc-user">
                  <span className="cmc-avatar">{initialsOf(d.ownerName)}</span>
                  <div>
                    <strong>{d.ownerName}</strong>
                    <small>{d.ownerEmail}{d.ownerUsername ? ` · @${d.ownerUsername}` : ""}</small>
                  </div>
                </div>
              ) : <p className="cmc-muted">No owner associated.</p>}
            </section>

            <section className="cmc-section">
              <h4><Icon name="flag" /> Reporter</h4>
              {d.reporterId ? (
                <div className="cmc-user">
                  <span className="cmc-avatar cmc-avatar--reporter">{initialsOf(d.reporterName)}</span>
                  <div>
                    <strong>{d.reporterName}</strong>
                    <small>{d.reporterEmail}</small>
                  </div>
                </div>
              ) : <p className="cmc-muted">Automatically detected — no manual reporter.</p>}
            </section>

            <section className="cmc-section">
              <h4><Icon name="report" /> Reason</h4>
              <p className="cmc-reason-full">{d.reason}</p>
            </section>

            {d.assignedModeratorName && (
              <section className="cmc-section">
                <h4><Icon name="admin_panel_settings" /> Assigned moderator</h4>
                <p className="cmc-muted">{d.assignedModeratorName}</p>
              </section>
            )}

            {d.internalNotes && (
              <section className="cmc-section">
                <h4><Icon name="notes" /> Internal notes</h4>
                <pre className="cmc-notes-pre">{d.internalNotes}</pre>
              </section>
            )}

            <section className="cmc-section">
              <h4><Icon name="history" /> Moderation timeline</h4>
              {events.length === 0 ? (
                <p className="cmc-muted">No timeline events yet.</p>
              ) : (
                <ul className="cmc-timeline">
                  {events.map((e) => (
                    <li key={e.id}>
                      <span className={`cmc-timeline__dot cmc-timeline__dot--${(e.action || "").toLowerCase()}`} />
                      <div className="cmc-timeline__body">
                        <strong>{e.action?.replaceAll("_", " ")}</strong>
                        <span className="cmc-timeline__actor">
                          {e.actorName}
                          {e.fromStatus && e.toStatus ? ` · ${e.fromStatus} → ${e.toStatus}` : ""}
                        </span>
                        {e.note && <p className="cmc-timeline__note">{e.note}</p>}
                        <time>{formatDate(e.createdAt)}</time>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="cmc-drawer__actions">
              {canActOn(d) && (
                <>
                  <button type="button" className="admin-refresh-btn" onClick={() => openConfirm(d, "ASSIGN")} disabled={actingId === d.id}>
                    <Icon name="how_to_reg" /> Assign to me
                  </button>
                  <button type="button" className="admin-refresh-btn" onClick={() => openConfirm(d, "ESCALATE")} disabled={actingId === d.id}>
                    <Icon name="trending_up" /> Escalate
                  </button>
                  <button type="button" className="admin-action-btn admin-action-approve" onClick={() => openConfirm(d, "APPROVE")} disabled={actingId === d.id}>
                    <Icon name="check_circle" /> Approve
                  </button>
                  <button type="button" className="admin-refresh-btn" onClick={() => openConfirm(d, "DISMISS")} disabled={actingId === d.id}>
                    <Icon name="cancel" /> Dismiss flag
                  </button>
                  <button type="button" className="admin-action-btn admin-action-reject" onClick={() => openConfirm(d, "REMOVE")} disabled={actingId === d.id}>
                    <Icon name="block" /> Remove
                  </button>
                </>
              )}
              {d.status === "REMOVED" && (
                <button type="button" className="admin-refresh-btn" onClick={() => openConfirm(d, "RESTORE")} disabled={actingId === d.id}>
                  <Icon name="restore" /> Restore content
                </button>
              )}
              {d.ownerId && (
                <>
                  <button type="button" className="admin-refresh-btn" onClick={() => openConfirm(d, "WARN")} disabled={actingId === d.id}>
                    <Icon name="warning" /> Warn user
                  </button>
                  {d.ownerEnabled === false ? (
                    <button type="button" className="admin-refresh-btn" onClick={() => openConfirm(d, "RESTORE_ACCOUNT")} disabled={actingId === d.id}>
                      <Icon name="lock_open" /> Restore account
                    </button>
                  ) : (
                    <button type="button" className="admin-action-btn admin-action-reject" onClick={() => openConfirm(d, "SUSPEND")} disabled={actingId === d.id}>
                      <Icon name="person_off" /> Suspend user
                    </button>
                  )}
                </>
              )}
              <button type="button" className="admin-refresh-btn" onClick={() => openConfirm(d, "NOTE")} disabled={actingId === d.id}>
                <Icon name="note_add" /> Add note
              </button>
              <button type="button" className="admin-action-btn admin-action-reject" onClick={() => openConfirm(d, "DELETE_PERMANENT")} disabled={actingId === d.id}>
                <Icon name="delete_forever" /> Delete permanently
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Confirmation modal ────────────────────────────────────────
  const renderConfirm = () => {
    if (!confirm) return null;
    const { item, action } = confirm;
    const meta = {
      ASSIGN: { title: "Assign to me", body: `Take ownership of item #${item.id}? It will be marked as under investigation.` },
      ESCALATE: { title: "Escalate item", body: "Escalate this item to level 1 for priority review? Optionally add a reason." },
      APPROVE: { title: "Approve content", body: `Approve item #${item.id}? The content stays and the owner is notified.` },
      DISMISS: { title: "Dismiss flag", body: `Dismiss the flag on item #${item.id} as a false positive?` },
      REMOVE: { title: "Remove content", body: `Remove the content for item #${item.id}? The owner will be notified.` },
      RESTORE: { title: "Restore content", body: `Restore the previously removed content for item #${item.id}?` },
      WARN: { title: "Warn user", body: "Issue a community warning to the content owner? The message is required." },
      SUSPEND: { title: "Suspend user", body: `Suspend ${item.ownerName || "the content owner"}? They will be unable to sign in until restored.` },
      RESTORE_ACCOUNT: { title: "Restore account", body: `Re-enable ${item.ownerName || "the content owner"}'s account?` },
      NOTE: { title: "Add internal note", body: "This note is visible to moderators only." },
      DELETE_PERMANENT: { title: "Delete permanently", body: `Permanently delete item #${item.id} and its timeline from the database? This cannot be undone.` },
    }[action];

    const needsNote = ["ESCALATE", "APPROVE", "DISMISS", "REMOVE", "RESTORE", "NOTE", "DELETE_PERMANENT"].includes(action);
    const needsRequiredNote = action === "WARN" || action === "NOTE";
    const isDanger = ["SUSPEND", "DELETE_PERMANENT", "REMOVE"].includes(action);

    return (
      <div className="cmc-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && actingId !== item.id) setConfirm(null); }}>
        <div className="cmc-confirm" role="dialog" aria-modal="true" aria-label={meta.title}>
          <div className="cmc-confirm__head">
            <h3>{meta.title} — #{item.id}</h3>
            <button type="button" className="cmc-confirm__close" onClick={() => setConfirm(null)} disabled={actingId === item.id} aria-label="Close">
              <Icon name="close" />
            </button>
          </div>

          <p className="cmc-confirm__body">{meta.body}</p>

          {needsNote && (
            <label className="admin-field">
              <span>{action === "WARN" ? "Warning message" : action === "ESCALATE" ? "Reason (optional)" : "Note (optional)"}</span>
              <textarea
                rows={3}
                placeholder={action === "WARN" ? "e.g. Please follow the community guidelines…" : "Add a note for the record…"}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
            </label>
          )}

          <div className="cmc-confirm__actions">
            <button type="button" className="admin-refresh-btn" onClick={() => setConfirm(null)} disabled={actingId === item.id}>Cancel</button>
            <button
              type="button"
              className={`admin-action-btn ${isDanger ? "admin-action-reject" : "admin-action-approve"}`}
              onClick={runAction}
              disabled={actingId === item.id || (needsRequiredNote && !noteText.trim())}
            >
              {actingId === item.id ? "Applying…" : "Confirm"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="admin-page">
      <div className="admin-hero">
        <div>
          <p className="admin-eyebrow">Moderation</p>
          <h1>Content Moderation Center</h1>
          <p>Review content flagged by reports and automated detection. Approve, remove, warn, or escalate — every action is tracked and notified.</p>
        </div>
        {stats && (
          <span className="admin-count-badge" style={{ alignSelf: "flex-start" }}>
            {(stats.PENDING_REVIEW || 0) + (stats.UNDER_INVESTIGATION || 0)} in queue
          </span>
        )}
      </div>

      {renderStats()}
      <div style={{ margin: "18px 0" }}>{renderFilters()}</div>

      {loading && items.length === 0 ? (
        renderSkeletons()
      ) : items.length === 0 ? (
        renderEmpty()
      ) : (
        <>
          {renderTable()}
          {renderPagination()}
        </>
      )}

      {selected && renderDetail()}
      {renderConfirm()}
    </section>
  );
}
