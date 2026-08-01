import { useCallback, useEffect, useRef, useState } from "react";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import "./AdminOperationsPage.css";
import "./ReportsManagementPage.css";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "OPEN", label: "Open" },
  { value: "IN_REVIEW", label: "Under investigation" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "REJECTED", label: "Rejected" },
];

const TARGET_OPTIONS = [
  { value: "", label: "All targets" },
  { value: "MENTOR", label: "Mentor" },
  { value: "LEARNER", label: "Learner" },
  { value: "SESSION", label: "Session" },
  { value: "SKILL", label: "Skill" },
];

const PRIORITY_OPTIONS = [
  { value: "", label: "All priorities" },
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

const PAGE_SIZE = 10;
const SORTABLE_COLUMNS = ["id", "createdAt", "priority", "status"];

const STATUS_META = {
  OPEN: { label: "Open", icon: "flag" },
  IN_REVIEW: { label: "In review", icon: "search" },
  RESOLVED: { label: "Resolved", icon: "check_circle" },
  REJECTED: { label: "Rejected", icon: "block" },
};

const TARGET_ICONS = { MENTOR: "badge", LEARNER: "person", SESSION: "event", SKILL: "school" };

const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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

export default function ReportsManagementPage({ notify }) {
  // ── Filters & pagination state ──────────────────────────────
  const [status, setStatus] = useState("");
  const [targetType, setTargetType] = useState("");
  const [priority, setPriority] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState("desc");

  // ── Data state ───────────────────────────────────────────────
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // ── Detail drawer ────────────────────────────────────────────
  const [selected, setSelected] = useState(null); // { report, detail }
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Action confirmation ──────────────────────────────────────
  const [confirm, setConfirm] = useState(null); // { report, action, note }
  const [actingId, setActingId] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [suspendChecked, setSuspendChecked] = useState(false);

  // Request sequencing — a stale response must never overwrite newer data.
  const listRequestRef = useRef(0);
  const detailRequestRef = useRef(0);
  const searchTimerRef = useRef(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await client.get("/api/v1/admin/reports/stats");
      if (res?.data?.data) setStats(res.data.data);
    } catch {
      // Stats are non-critical; the list is the primary surface.
    }
  }, []);

  const loadReports = useCallback(async () => {
    const requestId = ++listRequestRef.current;
    setLoading(true);
    setLoadError(false);
    try {
      const params = new URLSearchParams({ page, size: PAGE_SIZE, sortBy, sortDir });
      if (status) params.set("status", status);
      if (targetType) params.set("targetType", targetType);
      if (priority) params.set("priority", priority);
      if (fromDate) params.set("fromDate", fromDate);
      if (toDate) params.set("toDate", toDate);
      if (searchApplied.trim()) params.set("q", searchApplied.trim());

      const res = await client.get(`/api/v1/admin/reports?${params}`);
      if (requestId !== listRequestRef.current) return; // stale response — ignore
      const data = res?.data?.data || {};
      setReports(data.content || []);
      setTotalElements(data.totalElements || 0);
      setTotalPages(data.totalPages || 0);
    } catch (err) {
      if (requestId !== listRequestRef.current) return;
      setLoadError(true);
      notify?.({
        type: "error",
        title: "Reports unavailable",
        message: errorMessage(err, "Could not load reports."),
      });
    } finally {
      if (requestId === listRequestRef.current) setLoading(false);
    }
  }, [notify, page, status, targetType, priority, fromDate, toDate, searchApplied, sortBy, sortDir]);

  // Debounce search input — only re-query after the user pauses typing.
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

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const applyFilterChange = (setter, value) => {
    setter(value);
    setPage(0);
  };

  const resetFilters = () => {
    setStatus("");
    setTargetType("");
    setPriority("");
    setFromDate("");
    setToDate("");
    setSearch("");
    setSearchApplied("");
    setPage(0);
  };

  const toggleSort = (column) => {
    if (!SORTABLE_COLUMNS.includes(column)) return;
    setPage(0);
    if (sortBy === column) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("desc");
    }
  };

  const openDetail = useCallback(async (report) => {
    setSelected({ report, detail: null });
    setDetailLoading(true);
    const requestId = ++detailRequestRef.current;
    try {
      const res = await client.get(`/api/v1/admin/reports/${report.id}`);
      if (requestId !== detailRequestRef.current) return;
      setSelected({ report, detail: res?.data?.data || report });
    } catch (err) {
      if (requestId !== detailRequestRef.current) return;
      notify?.({
        type: "error",
        title: "Could not open report",
        message: errorMessage(err, "Could not load the report details."),
      });
    } finally {
      if (requestId === detailRequestRef.current) setDetailLoading(false);
    }
  }, [notify]);

  const closeDetail = () => {
    detailRequestRef.current++; // invalidate in-flight detail requests
    setSelected(null);
  };

  const openConfirm = (report, action) => {
    setConfirm({ report, action });
    setNoteText("");
    setSuspendChecked(false);
  };

  const runAction = async () => {
    if (!confirm) return;
    const { report, action } = confirm;
    setActingId(report.id);
    try {
      const reportId = report.id;
      switch (action) {
        case "ASSIGN": {
          await client.patch(`/api/v1/admin/reports/${reportId}/assign`, {});
          notify?.({ type: "success", title: "Report assigned", message: `Report #${reportId} assigned to you.` });
          break;
        }
        case "IN_REVIEW": {
          await client.patch(`/api/v1/admin/reports/${reportId}/status`, { status: "IN_REVIEW" });
          notify?.({ type: "success", title: "Investigation started", message: `Report #${reportId} marked under investigation.` });
          break;
        }
        case "RESOLVED": {
          await client.patch(`/api/v1/admin/reports/${reportId}/decision`, {
            status: "RESOLVED",
            note: noteText.trim() || null,
            suspendUser: suspendChecked,
          });
          notify?.({ type: "success", title: "Report resolved", message: suspendChecked ? "Report resolved and user suspended." : "Report marked as resolved." });
          break;
        }
        case "REJECTED": {
          await client.patch(`/api/v1/admin/reports/${reportId}/decision`, {
            status: "REJECTED",
            note: noteText.trim() || null,
            suspendUser: false,
          });
          notify?.({ type: "success", title: "Report rejected", message: "Report rejected." });
          break;
        }
        case "SUSPEND": {
          await client.patch(`/api/v1/admin/reports/${reportId}/user-enabled`, { enabled: false });
          notify?.({ type: "success", title: "User suspended", message: "The reported account has been suspended." });
          break;
        }
        case "RESTORE": {
          await client.patch(`/api/v1/admin/reports/${reportId}/user-enabled`, { enabled: true });
          notify?.({ type: "success", title: "User restored", message: "The account has been re-enabled." });
          break;
        }
        case "PRIORITY": {
          await client.patch(`/api/v1/admin/reports/${reportId}/priority`, { priority: noteText.toUpperCase() });
          notify?.({ type: "success", title: "Priority updated", message: `Priority set to ${noteText.toUpperCase()}.` });
          break;
        }
        case "NOTE": {
          await client.patch(`/api/v1/admin/reports/${reportId}/notes`, { note: noteText.trim() });
          notify?.({ type: "success", title: "Note added", message: "Internal note added to the report." });
          break;
        }
        case "DELETE": {
          await client.delete(`/api/v1/admin/reports/${reportId}`);
          notify?.({ type: "success", title: "Report deleted", message: `Report #${reportId} removed from the queue.` });
          break;
        }
        default:
          break;
      }
      setConfirm(null);
      if (selected?.report?.id === reportId) closeDetail();
      loadReports();
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

  const canActOn = (report) => report?.status === "OPEN" || report?.status === "IN_REVIEW";
  const hasReportedUser = (report) => Boolean(report?.reportedUserId);

  // ── Stats cards (real DB counts) ─────────────────────────────
  const renderStats = () => {
    const cards = [
      { key: "total", label: "Total reports", icon: "flag", tone: "slate", value: stats?.total ?? 0 },
      { key: "open", label: "Open", icon: "mark_email_unread", tone: "blue", value: stats?.open ?? 0 },
      { key: "inReview", label: "Under investigation", icon: "search", tone: "amber", value: stats?.inReview ?? 0 },
      { key: "resolved", label: "Resolved", icon: "check_circle", tone: "green", value: stats?.resolved ?? 0 },
      { key: "rejected", label: "Rejected", icon: "block", tone: "rose", value: stats?.rejected ?? 0 },
      { key: "suspendedUsers", label: "Suspended users", icon: "person_off", tone: "violet", value: stats?.suspendedUsers ?? 0 },
    ];
    return (
      <div className="rmg-stats">
        {cards.map((c) => (
          <div className={`rmg-stat rmg-stat--${c.tone}`} key={c.key}>
            <span className="rmg-stat__icon"><Icon name={c.icon} /></span>
            <div>
              <p className="rmg-stat__label">{c.label}</p>
              <p className="rmg-stat__value">{c.value}</p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderFilters = () => (
    <div className="rmg-filters">
      <div className="admin-search rmg-filters__search">
        <Icon name="search" />
        <input
          type="text"
          placeholder="Search by reporter, reported user, email, reason, or ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search reports"
        />
      </div>

      <select value={status} onChange={(e) => applyFilterChange(setStatus, e.target.value)} aria-label="Filter by status">
        {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <select value={targetType} onChange={(e) => applyFilterChange(setTargetType, e.target.value)} aria-label="Filter by target type">
        {TARGET_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <select value={priority} onChange={(e) => applyFilterChange(setPriority, e.target.value)} aria-label="Filter by priority">
        {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <label className="rmg-filters__date">
        <span>From</span>
        <input type="date" value={fromDate} onChange={(e) => applyFilterChange(setFromDate, e.target.value)} />
      </label>

      <label className="rmg-filters__date">
        <span>To</span>
        <input type="date" value={toDate} onChange={(e) => applyFilterChange(setToDate, e.target.value)} />
      </label>

      <button
        type="button"
        className="admin-refresh-btn rmg-filters__reset"
        onClick={resetFilters}
        disabled={!status && !targetType && !priority && !fromDate && !toDate && !searchApplied}
      >
        <Icon name="restart_alt" /> Reset
      </button>
    </div>
  );

  const renderSortHeader = (label, column) => {
    const active = sortBy === column;
    return (
      <button
        type="button"
        className={`rmg-th-sort${active ? " is-active" : ""}`}
        onClick={() => toggleSort(column)}
        aria-label={`Sort by ${label}`}
      >
        {label}
        <Icon name={active ? (sortDir === "asc" ? "arrow_upward" : "arrow_downward") : "unfold_more"} />
      </button>
    );
  };

  const renderTable = () => (
    <div className="rmg-table-wrap">
      <table className="rmg-table">
        <thead>
          <tr>
            <th>{renderSortHeader("Report", "id")}</th>
            <th>Reporter</th>
            <th>Reported user</th>
            <th>Target</th>
            <th>Reason</th>
            <th>{renderSortHeader("Priority", "priority")}</th>
            <th>{renderSortHeader("Status", "status")}</th>
            <th>{renderSortHeader("Created", "createdAt")}</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <tr key={r.id} className={r.id === selected?.report?.id ? "is-selected" : ""}>
              <td>
                <button type="button" className="rmg-id-link" onClick={() => openDetail(r)}>#{r.id}</button>
              </td>
              <td>
                <div className="rmg-user">
                  <span className="rmg-avatar">{initialsOf(r.reporterName)}</span>
                  <div>
                    <strong>{r.reporterName || "Unknown"}</strong>
                    <small>{r.reporterEmail}</small>
                  </div>
                </div>
              </td>
              <td>
                {r.reportedUserId ? (
                  <div className="rmg-user">
                    <span className="rmg-avatar rmg-avatar--reported">{initialsOf(r.reportedName)}</span>
                    <div>
                      <strong>{r.reportedName}</strong>
                      <small>{r.reportedEnabled === false ? "Suspended" : r.reportedEmail || ""}</small>
                    </div>
                  </div>
                ) : (
                  <span className="rmg-muted">—</span>
                )}
              </td>
              <td>
                <span className={`rmg-target rmg-target--${(r.targetType || "USER").toLowerCase()}`}>
                  <Icon name={TARGET_ICONS[r.targetType] || "flag"} />
                  {r.targetType || "USER"}
                </span>
                {r.targetLabel && <em className="rmg-target-label">{r.targetLabel}</em>}
              </td>
              <td className="rmg-reason-cell" title={r.reason}>{r.reason}</td>
              <td><span className={`rmg-priority rmg-priority--${(r.priority || "MEDIUM").toLowerCase()}`}>{r.priority || "MEDIUM"}</span></td>
              <td>
                <span className={`admin-status-pill admin-status-pill--${(r.status || "OPEN").toLowerCase()}`}>
                  {STATUS_META[r.status]?.label || r.status}
                </span>
              </td>
              <td className="rmg-date-cell" title={formatDate(r.createdAt)}>{formatDay(r.createdAt)}</td>
              <td>
                <div className="rmg-row-actions">
                  <button type="button" className="rmg-icon-btn" onClick={() => openDetail(r)} title="Open details" aria-label="Open details">
                    <Icon name="visibility" />
                  </button>
                  {canActOn(r) && (
                    <button type="button" className="rmg-icon-btn rmg-icon-btn--danger" onClick={() => openConfirm(r, "DELETE")} title="Delete spam" aria-label="Delete spam">
                      <Icon name="delete" />
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
    <div className="rmg-empty">
      <div className="rmg-empty__art" aria-hidden="true">
        <span className="rmg-empty__flag"><Icon name="verified_user" /></span>
        <span className="rmg-empty__shield"><Icon name="shield" /></span>
      </div>
      <h3>{loadError ? "Could not load reports" : searchApplied || status || targetType || priority || fromDate || toDate ? "No matching reports" : "No reports available"}</h3>
      <p>
        {loadError
          ? "The reports queue could not be reached. Try refreshing the page."
          : searchApplied || status || targetType || priority || fromDate || toDate
            ? "Try adjusting your search or filters to find what you're looking for."
            : "When users report a problem, it will appear here for review."}
      </p>
      {(searchApplied || status || targetType || priority || fromDate || toDate) && (
        <button type="button" className="admin-refresh-btn" onClick={resetFilters}>
          <Icon name="restart_alt" /> Clear filters
        </button>
      )}
    </div>
  );

  const renderPagination = () => (
    <div className="rmg-pagination">
      <span className="rmg-pagination__info">
        {totalElements === 0 ? "0 reports" : `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, totalElements)} of ${totalElements}`}
      </span>
      <div className="rmg-pagination__controls">
        <button type="button" className="admin-refresh-btn" disabled={page === 0 || loading} onClick={() => setPage((p) => p - 1)}>
          <Icon name="chevron_left" /> Prev
        </button>
        <span className="rmg-pagination__pages">Page {totalPages === 0 ? 1 : page + 1} of {totalPages || 1}</span>
        <button type="button" className="admin-refresh-btn" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
          Next <Icon name="chevron_right" />
        </button>
      </div>
    </div>
  );

  // ── Detail drawer ────────────────────────────────────────────
  const renderDetail = () => {
    const d = selected?.detail || selected?.report;
    if (!d) return null;
    return (
      <div className="rmg-drawer" role="dialog" aria-modal="true" aria-label={`Report #${d.id} details`}>
        <div className="rmg-drawer__head">
          <div>
            <p className="admin-eyebrow">Report #{d.id}</p>
            <h3>{d.targetLabel || d.targetType || "Report"}</h3>
          </div>
          <button type="button" className="rmg-icon-btn" onClick={closeDetail} aria-label="Close details">
            <Icon name="close" />
          </button>
        </div>

        {detailLoading ? (
          <p className="rmg-drawer__loading">Loading details…</p>
        ) : (
          <div className="rmg-drawer__body">
            <div className="rmg-drawer__badges">
              <span className={`admin-status-pill admin-status-pill--${(d.status || "OPEN").toLowerCase()}`}>
                {STATUS_META[d.status]?.label || d.status}
              </span>
              <span className={`rmg-priority rmg-priority--${(d.priority || "MEDIUM").toLowerCase()}`}>{d.priority || "MEDIUM"}</span>
              <span className={`rmg-target rmg-target--${(d.targetType || "USER").toLowerCase()}`}>
                <Icon name={TARGET_ICONS[d.targetType] || "flag"} /> {d.targetType || "USER"}
              </span>
            </div>

            <section className="rmg-section">
              <h4><Icon name="person" /> Reporter</h4>
              <div className="rmg-user">
                <span className="rmg-avatar">{initialsOf(d.reporterName)}</span>
                <div>
                  <strong>{d.reporterName || "Unknown"}</strong>
                  <small>{d.reporterEmail}{d.reporterUsername ? ` · @${d.reporterUsername}` : ""}</small>
                </div>
              </div>
            </section>

            {d.reportedUserId ? (
              <section className="rmg-section">
                <h4><Icon name="person_search" /> Reported user</h4>
                <div className="rmg-user">
                  <span className="rmg-avatar rmg-avatar--reported">{initialsOf(d.reportedName)}</span>
                  <div>
                    <strong>{d.reportedName}</strong>
                    <small>{d.reportedEmail}{d.reportedUsername ? ` · @${d.reportedUsername}` : ""}</small>
                  </div>
                </div>
                <p className={`rmg-account-state${d.reportedEnabled === false ? " is-suspended" : ""}`}>
                  {d.reportedEnabled === false ? "Account currently suspended" : "Account active"}
                </p>
              </section>
            ) : (
              <section className="rmg-section">
                <h4><Icon name="person_search" /> Reported user</h4>
                <p className="rmg-muted">No user account involved — content-level report.</p>
              </section>
            )}

            <section className="rmg-section">
              <h4><Icon name="flag" /> Reason</h4>
              <p className="rmg-reason-full">{d.reason}</p>
            </section>

            {d.details && (
              <section className="rmg-section">
                <h4><Icon name="subject" /> Description &amp; evidence</h4>
                <p className="rmg-details-full">{d.details}</p>
              </section>
            )}

            {d.assignedAdminName && (
              <section className="rmg-section">
                <h4><Icon name="admin_panel_settings" /> Assigned investigator</h4>
                <p className="rmg-muted">{d.assignedAdminName}</p>
              </section>
            )}

            {d.internalNotes && (
              <section className="rmg-section">
                <h4><Icon name="notes" /> Internal notes</h4>
                <pre className="rmg-notes-pre">{d.internalNotes}</pre>
              </section>
            )}

            {d.moderatorNote && (
              <section className="rmg-section">
                <h4><Icon name="sticky_note_2" /> Moderator note</h4>
                <p className="rmg-muted">{d.moderatorNote}</p>
              </section>
            )}

            {d.escalated && (
              <section className="rmg-section">
                <h4><Icon name="priority_high" /> Escalation</h4>
                <p className="rmg-muted">
                  Level {d.escalationLevel || 1}{d.escalationReason ? ` — ${d.escalationReason}` : ""}
                  {d.escalatedAt ? ` · ${formatDate(d.escalatedAt)}` : ""}
                </p>
              </section>
            )}

            <section className="rmg-section">
              <h4><Icon name="schedule" /> Timeline</h4>
              <ul className="rmg-timeline">
                <li><span>Reported</span><time>{formatDate(d.createdAt)}</time></li>
                <li><span>Last updated</span><time>{formatDate(d.updatedAt)}</time></li>
              </ul>
            </section>

            <div className="rmg-drawer__actions">
              {canActOn(d) && (
                <>
                  <button type="button" className="admin-refresh-btn" onClick={() => openConfirm(d, "ASSIGN")} disabled={actingId === d.id}>
                    <Icon name="how_to_reg" /> Assign to me
                  </button>
                  {d.status === "OPEN" && (
                    <button type="button" className="admin-refresh-btn" onClick={() => openConfirm(d, "IN_REVIEW")} disabled={actingId === d.id}>
                      <Icon name="search" /> Investigate
                    </button>
                  )}
                  <button type="button" className="admin-action-btn admin-action-approve" onClick={() => openConfirm(d, "RESOLVED")} disabled={actingId === d.id}>
                    <Icon name="check_circle" /> Resolve
                  </button>
                  <button type="button" className="admin-action-btn admin-action-reject" onClick={() => openConfirm(d, "REJECTED")} disabled={actingId === d.id}>
                    <Icon name="block" /> Reject
                  </button>
                </>
              )}
              {hasReportedUser(d) && (
                d.reportedEnabled === false ? (
                  <button type="button" className="admin-refresh-btn" onClick={() => openConfirm(d, "RESTORE")} disabled={actingId === d.id}>
                    <Icon name="lock_open" /> Restore account
                  </button>
                ) : (
                  <button type="button" className="admin-action-btn admin-action-reject" onClick={() => openConfirm(d, "SUSPEND")} disabled={actingId === d.id}>
                    <Icon name="person_off" /> Suspend user
                  </button>
                )
              )}
              <button type="button" className="admin-refresh-btn" onClick={() => openConfirm(d, "PRIORITY")} disabled={actingId === d.id}>
                <Icon name="priority_high" /> Set priority
              </button>
              <button type="button" className="admin-refresh-btn" onClick={() => openConfirm(d, "NOTE")} disabled={actingId === d.id}>
                <Icon name="note_add" /> Add note
              </button>
              {canActOn(d) && (
                <button type="button" className="admin-action-btn admin-action-reject" onClick={() => openConfirm(d, "DELETE")} disabled={actingId === d.id}>
                  <Icon name="delete" /> Delete spam
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Action confirmation modal ────────────────────────────────
  const renderConfirm = () => {
    if (!confirm) return null;
    const { report, action } = confirm;
    const meta = {
      ASSIGN: { title: "Assign report", body: `Assign report #${report.id} to you for investigation? It will be marked as under investigation.` },
      IN_REVIEW: { title: "Start investigation", body: `Mark report #${report.id} as under investigation?` },
      RESOLVED: { title: "Resolve report", body: `Resolve report #${report.id}? The reporter will be notified.` },
      REJECTED: { title: "Reject report", body: `Reject report #${report.id}? The reporter will be notified.` },
      SUSPEND: { title: "Suspend user", body: `Suspend ${report.reportedName || "the reported user"}? They will be unable to sign in until restored.` },
      RESTORE: { title: "Restore account", body: `Re-enable ${report.reportedName || "the reported user"}'s account? They will be able to sign in again.` },
      PRIORITY: { title: "Set priority", body: "Choose the triage priority for this report." },
      NOTE: { title: "Add internal note", body: "This note is visible to admins only — never shown to users." },
      DELETE: { title: "Delete report", body: `Remove report #${report.id} from the queue as spam? This hides it permanently from the list.` },
    }[action];

    const isDanger = ["SUSPEND", "DELETE"].includes(action);
    return (
      <div className="rmg-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && actingId !== report.id) setConfirm(null); }}>
        <div className="rmg-decision" role="dialog" aria-modal="true" aria-label={meta.title}>
          <div className="rmg-decision__head">
            <h3>{meta.title} — #{report.id}</h3>
            <button type="button" className="rmg-decision__close" onClick={() => setConfirm(null)} disabled={actingId === report.id} aria-label="Close">
              <Icon name="close" />
            </button>
          </div>

          <p className="rmg-decision__target">{meta.body}</p>

          {(action === "RESOLVED" || action === "REJECTED" || action === "NOTE") && (
            <label className="admin-field">
              <span>{action === "NOTE" ? "Note" : "Moderator note (optional)"}</span>
              <textarea
                rows={3}
                placeholder={action === "NOTE" ? "Investigator note…" : "Note for the record…"}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
            </label>
          )}

          {action === "PRIORITY" && (
            <label className="admin-field">
              <span>Priority</span>
              <select value={noteText} onChange={(e) => setNoteText(e.target.value)}>
                <option value="">Choose…</option>
                {PRIORITY_OPTIONS.slice(1).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          )}

          {action === "RESOLVED" && report.reportedUserId && (
            <label className="rmg-decision__suspend">
              <input type="checkbox" checked={suspendChecked} onChange={(e) => setSuspendChecked(e.target.checked)} />
              <span>
                <strong>Suspend this user</strong>
                <small>{report.reportedName || "The reported user"} will be unable to sign in.</small>
              </span>
            </label>
          )}

          <div className="rmg-decision__actions">
            <button type="button" className="admin-refresh-btn" onClick={() => setConfirm(null)} disabled={actingId === report.id}>Cancel</button>
            <button
              type="button"
              className={`admin-action-btn ${isDanger ? "admin-action-reject" : "admin-action-approve"}`}
              onClick={runAction}
              disabled={actingId === report.id || (action === "PRIORITY" && !noteText) || (action === "NOTE" && !noteText.trim())}
            >
              {actingId === report.id ? "Applying…" : "Confirm"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className="admin-page">
      <div className="admin-hero" style={{ marginBottom: 0, borderRadius: "0 0 18px 18px" }}>
        <div>
          <p className="admin-eyebrow">Trust &amp; Safety</p>
          <h1>Reports &amp; Complaints</h1>
          <p>Review reports about mentors, learners, sessions, and skills. Assign, investigate, resolve, or reject them — and take account action when needed.</p>
        </div>
        {stats && (
          <span className="admin-count-badge" style={{ alignSelf: "flex-start" }}>
            {stats.open} open
          </span>
        )}
      </div>

      {renderStats()}
      <div style={{ margin: "18px 0" }}>{renderFilters()}</div>

      {loading && reports.length === 0 ? (
        <div className="rmg-loading"><span className="rmg-loading__spinner" /> Loading reports…</div>
      ) : reports.length === 0 ? (
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
