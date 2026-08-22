import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useModalA11y from "../modules/admin/components/reports/useModalA11y";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  CircleDot,
  Flag,
  Search,
  UserX,
  ShieldAlert,
  StickyNote,
  UserCheck,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import client from "../api/client";
import {
  PAGE_SIZE,
  PRIORITY_OPTIONS,
  Pagination,
  PriorityBadge,
  ReportsFilters,
  ReportsHero,
  ReportsTable,
  RippleButton,
  StatusBadge,
  StatsCard,
  TARGET_LABELS,
  UserCell,
  errorMessage,
  formatDate,
  formatDay,
} from "../modules/admin/components/reports";

const SORTABLE_COLUMNS = ["id", "createdAt", "priority", "status"];

const CONFIRM_META = {
  ASSIGN: { title: "Assign report", body: (id) => `Assign report #${id} to you for investigation? It will be marked as under investigation.`, danger: false },
  IN_REVIEW: { title: "Start investigation", body: (id) => `Mark report #${id} as under investigation?`, danger: false },
  RESOLVED: { title: "Resolve report", body: (id) => `Resolve report #${id}? The reporter will be notified.`, danger: false },
  REJECTED: { title: "Reject report", body: (id) => `Reject report #${id}? The reporter will be notified.`, danger: false },
  SUSPEND: { title: "Suspend user", body: (id, r) => `Suspend ${r?.reportedName || "the reported user"}? They will be unable to sign in until restored.`, danger: true },
  RESTORE: { title: "Restore account", body: (id, r) => `Re-enable ${r?.reportedName || "the reported user"}'s account? They will be able to sign in again.`, danger: false },
  PRIORITY: { title: "Set priority", body: () => "Choose the triage priority for this report.", danger: false },
  NOTE: { title: "Add internal note", body: () => "This note is visible to admins only — never shown to users.", danger: false },
  DELETE: { title: "Delete report", body: (id) => `Remove report #${id} from the queue as spam? This hides it permanently from the list.`, danger: true },
};

const CONFIRM_ICONS = {
  ASSIGN: UserCheck,
  IN_REVIEW: Search,
  RESOLVED: CheckCircle2,
  REJECTED: XCircle,
  SUSPEND: UserX,
  RESTORE: UserCheck,
  PRIORITY: Zap,
  NOTE: StickyNote,
  DELETE: ShieldAlert,
};

export default function ReportsManagementPage({ notify }) {
  // ── Filters & pagination ──
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

  // ── Data ──
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // ── Drawer / confirm ──
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [actingId, setActingId] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [suspendChecked, setSuspendChecked] = useState(false);

  const queueRef = useRef(null);
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
      if (requestId !== listRequestRef.current) return;
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

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const hasActiveFilters = Boolean(
    status || targetType || priority || fromDate || toDate || searchApplied,
  );

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
    detailRequestRef.current++;
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
        case "ASSIGN":
          await client.patch(`/api/v1/admin/reports/${reportId}/assign`, {});
          notify?.({ type: "success", title: "Report assigned", message: `Report #${reportId} assigned to you.` });
          break;
        case "IN_REVIEW":
          await client.patch(`/api/v1/admin/reports/${reportId}/status`, { status: "IN_REVIEW" });
          notify?.({ type: "success", title: "Investigation started", message: `Report #${reportId} marked under investigation.` });
          break;
        case "RESOLVED":
          await client.patch(`/api/v1/admin/reports/${reportId}/decision`, {
            status: "RESOLVED",
            note: noteText.trim() || null,
            suspendUser: suspendChecked,
          });
          notify?.({ type: "success", title: "Report resolved", message: suspendChecked ? "Report resolved and user suspended." : "Report marked as resolved." });
          break;
        case "REJECTED":
          await client.patch(`/api/v1/admin/reports/${reportId}/decision`, {
            status: "REJECTED",
            note: noteText.trim() || null,
            suspendUser: false,
          });
          notify?.({ type: "success", title: "Report rejected", message: "Report rejected." });
          break;
        case "SUSPEND":
          await client.patch(`/api/v1/admin/reports/${reportId}/user-enabled`, { enabled: false });
          notify?.({ type: "success", title: "User suspended", message: "The reported account has been suspended." });
          break;
        case "RESTORE":
          await client.patch(`/api/v1/admin/reports/${reportId}/user-enabled`, { enabled: true });
          notify?.({ type: "success", title: "User restored", message: "The account has been re-enabled." });
          break;
        case "PRIORITY":
          await client.patch(`/api/v1/admin/reports/${reportId}/priority`, { priority: noteText.toUpperCase() });
          notify?.({ type: "success", title: "Priority updated", message: `Priority set to ${noteText.toUpperCase()}.` });
          break;
        case "NOTE":
          await client.patch(`/api/v1/admin/reports/${reportId}/notes`, { note: noteText.trim() });
          notify?.({ type: "success", title: "Note added", message: "Internal note added to the report." });
          break;
        case "DELETE":
          await client.delete(`/api/v1/admin/reports/${reportId}`);
          notify?.({ type: "success", title: "Report deleted", message: `Report #${reportId} removed from the queue.` });
          break;
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

  const exportCsv = () => {
    if (!reports.length) return;
    const rows = [
      ["Report ID", "Status", "Priority", "Target Type", "Target Label", "Reason", "Reporter", "Reporter Email", "Reported User", "Reported Email", "Reported On"],
      ...reports.map((r) => [
        r.id,
        r.status || "",
        r.priority || "",
        r.targetType || "",
        r.targetLabel || "",
        (r.reason || "").replace(/["\n]/g, " "),
        r.reporterName || "",
        r.reporterEmail || "",
        r.reportedName || "",
        r.reportedEmail || "",
        formatDay(r.createdAt),
      ]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    // \uFEFF BOM so Excel opens UTF-8 names (emails, labels) correctly.
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reports-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const canActOn = (report) => report?.status === "OPEN" || report?.status === "IN_REVIEW";
  const hasReportedUser = (report) => Boolean(report?.reportedUserId);

  const statCards = useMemo(
    () => [
      { key: "total", label: "Total reports", icon: Flag, tone: "slate", value: stats?.total ?? 0, subtitle: "All time" },
      { key: "open", label: "Open", icon: CircleDot, tone: "blue", value: stats?.open ?? 0, subtitle: "Awaiting review" },
      { key: "inReview", label: "In review", icon: Search, tone: "amber", value: stats?.inReview ?? 0, subtitle: "Under investigation" },
      { key: "resolved", label: "Resolved", icon: CheckCircle2, tone: "green", value: stats?.resolved ?? 0, subtitle: "Action taken" },
      { key: "rejected", label: "Rejected", icon: XCircle, tone: "rose", value: stats?.rejected ?? 0, subtitle: "Not valid" },
      { key: "suspendedUsers", label: "Suspended users", icon: UserX, tone: "violet", value: stats?.suspendedUsers ?? 0, subtitle: "Accounts disabled" },
    ],
    [stats],
  );

  return (
    <div className="rpt rpt-page">
      <motion.div
        className="rpt-inner"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* ── Hero banner ── */}
        <ReportsHero
          openCount={stats?.open ?? 0}
          onReview={() => queueRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        />

        {/* ── Statistics cards ── */}
        <section className="rpt-stats" aria-label="Report statistics">
          {statCards.map((card, i) => {
            const { key: cardKey, ...rest } = card;
            return <StatsCard key={cardKey} {...rest} index={i} />;
          })}
        </section>

        {/* ── Search & filters ── */}
        <ReportsFilters
          search={search}
          onSearchChange={setSearch}
          status={status}
          onStatusChange={(v) => applyFilterChange(setStatus, v)}
          targetType={targetType}
          onTargetTypeChange={(v) => applyFilterChange(setTargetType, v)}
          priority={priority}
          onPriorityChange={(v) => applyFilterChange(setPriority, v)}
          fromDate={fromDate}
          onFromDateChange={(v) => applyFilterChange(setFromDate, v)}
          toDate={toDate}
          onToDateChange={(v) => applyFilterChange(setToDate, v)}
          onExport={exportCsv}
          onReset={resetFilters}
          hasActiveFilters={hasActiveFilters}
          total={totalElements}
        />

        {/* ── Queue ── */}
        <div ref={queueRef} style={{ scrollMarginTop: 16 }}>
          {loading && reports.length === 0 ? (
            <ReportsSkeleton />
          ) : reports.length === 0 ? (
            <EmptyState loadError={loadError} hasFilters={hasActiveFilters} onRetry={loadReports} onReset={resetFilters} />
          ) : (
            <>
              <ReportsTable
                reports={reports}
                sortBy={sortBy}
                sortDir={sortDir}
                selectedId={selected?.report?.id}
                loading={loading}
                onSort={toggleSort}
                onView={openDetail}
                onQuickAction={openConfirm}
              />
              <Pagination
                page={page}
                totalPages={totalPages}
                totalElements={totalElements}
                pageSize={PAGE_SIZE}
                onChange={setPage}
                loading={loading}
              />
            </>
          )}
        </div>
      </motion.div>

      {/* ── Detail drawer ── */}
      <AnimatePresence>
        {selected && (
          <DetailDrawer
            selected={selected}
            detailLoading={detailLoading}
            actingId={actingId}
            canActOn={canActOn}
            hasReportedUser={hasReportedUser}
            onClose={closeDetail}
            onAction={openConfirm}
          />
        )}
      </AnimatePresence>

      {/* ── Confirm modal ── */}
      <AnimatePresence>
        {confirm && (
          <ConfirmModal
            confirm={confirm}
            actingId={actingId}
            noteText={noteText}
            setNoteText={setNoteText}
            suspendChecked={suspendChecked}
            setSuspendChecked={setSuspendChecked}
            onClose={() => setConfirm(null)}
            onConfirm={runAction}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Sub-render helpers
   ========================================================================== */

function ReportsSkeleton() {
  return (
    <div className="rpt-table-card" aria-busy="true" aria-label="Loading reports">
      <div className="rpt-skeleton" style={{ padding: 8 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rpt-skel__row">
            <span className="rpt-skel rpt-skel__avatar" />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="rpt-skel rpt-skel__line" style={{ width: "22%", height: 16 }} />
              <span className="rpt-skel rpt-skel__line" style={{ width: "34%" }} />
            </div>
            <span className="rpt-skel rpt-skel__line" style={{ width: "12%" }} />
            <span className="rpt-skel rpt-skel__line" style={{ width: "16%" }} />
            <span className="rpt-skel rpt-skel__line" style={{ width: "20%" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ loadError, hasFilters, onRetry, onReset }) {
  return (
    <motion.div
      className="rpt-table-card"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="rpt-empty">
        <div className="rpt-empty__art" aria-hidden="true">
          <span className="rpt-empty__blob rpt-empty__blob--back" />
          <span className="rpt-empty__blob" />
          <span className="rpt-empty__icon">
            <Flag size={44} strokeWidth={1.5} />
          </span>
        </div>
        <h3 className="rpt-empty__title">
          {loadError ? "Could not load reports" : hasFilters ? "No matching reports" : "No reports available"}
        </h3>
        <p className="rpt-empty__desc">
          {loadError
            ? "The reports queue could not be reached. Try refreshing the page."
            : hasFilters
              ? "Try adjusting your search or filters to find what you're looking for."
              : "When users report a problem, it will appear here for review."}
        </p>
        {loadError ? (
          <div className="rpt-empty__action">
            <RippleButton variant="primary" onClick={onRetry}>
              Retry
            </RippleButton>
          </div>
        ) : hasFilters ? (
          <div className="rpt-empty__action">
            <RippleButton variant="outline" onClick={onReset}>
              Clear filters
            </RippleButton>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

function DetailDrawer({ selected, detailLoading, actingId, canActOn, hasReportedUser, onClose, onAction }) {
  const d = selected?.detail || selected?.report;
  const drawerRef = useRef(null);
  useModalA11y({ open: Boolean(d), onClose, busy: false, dialogRef: drawerRef });
  if (!d) return null;
  return (
    <motion.div
      className="rpt-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <motion.aside
        ref={drawerRef}
        className="rpt-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Report #${d.id} details`}
        initial={{ x: 60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 60, opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="rpt-drawer__head">
          <div>
            <h3 className="rpt-drawer__title">Report #{d.id}</h3>
            <p className="rpt-drawer__sub">{d.targetLabel || TARGET_LABELS[d.targetType] || "Report"}</p>
          </div>
          <button type="button" className="rpt-icon-btn" onClick={onClose} aria-label="Close details">
            <X size={18} />
          </button>
        </div>

        {detailLoading ? (
          <p className="rpt-drawer__loading">Loading details…</p>
        ) : (
          <div className="rpt-drawer__body">
            <div className="rpt-drawer__badges">
              <StatusBadge status={d.status} />
              <PriorityBadge priority={d.priority} />
            </div>

            <DrawerSection title="Reporter">
              <UserCell name={d.reporterName} email={d.reporterEmail || d.reporterUsername} />
            </DrawerSection>

            <DrawerSection title="Reported user">
              {hasReportedUser(d) ? (
                <>
                  <UserCell
                    name={d.reportedName}
                    email={d.reportedEmail || d.reportedUsername}
                    tone="gray"
                    suspended={d.reportedEnabled === false}
                  />
                  <p className="rpt-drawer__text" style={{ marginTop: 10 }}>
                    {d.reportedEnabled === false ? "Account currently suspended." : "Account active."}
                  </p>
                </>
              ) : (
                <p className="rpt-drawer__text">No user account involved — content-level report.</p>
              )}
            </DrawerSection>

            <DrawerSection title="Reason">
              <p className="rpt-drawer__text">{d.reason}</p>
            </DrawerSection>

            {d.details && (
              <DrawerSection title="Description & evidence">
                <p className="rpt-drawer__text">{d.details}</p>
              </DrawerSection>
            )}

            {d.assignedAdminName && (
              <DrawerSection title="Assigned investigator">
                <p className="rpt-drawer__text">{d.assignedAdminName}</p>
              </DrawerSection>
            )}

            {d.internalNotes && (
              <DrawerSection title="Internal notes">
                <pre className="rpt-drawer__text" style={{ whiteSpace: "pre-wrap", font: "inherit" }}>{d.internalNotes}</pre>
              </DrawerSection>
            )}

            {d.escalated && (
              <DrawerSection title="Escalation">
                <p className="rpt-drawer__text">
                  Level {d.escalationLevel || 1}{d.escalationReason ? ` — ${d.escalationReason}` : ""}
                </p>
              </DrawerSection>
            )}

            <DrawerSection title="Timeline">
              <ul className="rpt-drawer__timeline">
                <li><span>Reported</span><time>{formatDate(d.createdAt)}</time></li>
                <li><span>Last updated</span><time>{formatDate(d.updatedAt)}</time></li>
              </ul>
            </DrawerSection>

            <div className="rpt-drawer__actions">
              {canActOn(d) && (
                <>
                  <RippleButton size="sm" onClick={() => onAction(d, "ASSIGN")} disabled={actingId === d.id}>
                    Assign to me
                  </RippleButton>
                  {d.status === "OPEN" && (
                    <RippleButton size="sm" onClick={() => onAction(d, "IN_REVIEW")} disabled={actingId === d.id}>
                      Investigate
                    </RippleButton>
                  )}
                  <RippleButton size="sm" variant="primary" onClick={() => onAction(d, "RESOLVED")} disabled={actingId === d.id}>
                    Resolve
                  </RippleButton>
                  <RippleButton size="sm" variant="danger" onClick={() => onAction(d, "REJECTED")} disabled={actingId === d.id}>
                    Reject
                  </RippleButton>
                </>
              )}
              {hasReportedUser(d) &&
                (d.reportedEnabled === false ? (
                  <RippleButton size="sm" onClick={() => onAction(d, "RESTORE")} disabled={actingId === d.id}>
                    Restore account
                  </RippleButton>
                ) : (
                  <RippleButton size="sm" variant="danger" onClick={() => onAction(d, "SUSPEND")} disabled={actingId === d.id}>
                    Suspend user
                  </RippleButton>
                ))}
              <RippleButton size="sm" onClick={() => onAction(d, "PRIORITY")} disabled={actingId === d.id}>
                Set priority
              </RippleButton>
              <RippleButton size="sm" onClick={() => onAction(d, "NOTE")} disabled={actingId === d.id}>
                Add note
              </RippleButton>
              {canActOn(d) && (
                <RippleButton size="sm" variant="danger" onClick={() => onAction(d, "DELETE")} disabled={actingId === d.id}>
                  Delete spam
                </RippleButton>
              )}
            </div>
          </div>
        )}
      </motion.aside>
    </motion.div>
  );
}

function DrawerSection({ title, children }) {
  return (
    <section className="rpt-drawer__section">
      <h4>{title}</h4>
      {children}
    </section>
  );
}

function ConfirmModal({ confirm, actingId, noteText, setNoteText, suspendChecked, setSuspendChecked, onClose, onConfirm }) {
  const { report, action } = confirm;
  const modalRef = useRef(null);
  useModalA11y({ open: true, onClose, busy: actingId === report.id, dialogRef: modalRef });
  const meta = CONFIRM_META[action] || { title: "Confirm", body: () => "", danger: false };
  const needsNote = ["RESOLVED", "REJECTED", "NOTE"].includes(action);
  const needsPriority = action === "PRIORITY";
  const needsSuspend = action === "RESOLVED" && report.reportedUserId;
  const Icon = CONFIRM_ICONS[action] || Flag;
  const canConfirm = !(
    (action === "PRIORITY" && !noteText) ||
    (action === "NOTE" && !noteText.trim())
  );

  return (
    <motion.div
      className="rpt-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && actingId !== report.id) onClose();
      }}
      role="presentation"
    >
      <motion.div
        ref={modalRef}
        className="rpt-modal"
        role="dialog"
        aria-modal="true"
        aria-label={meta.title}
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 10 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className={`rpt-modal__icon${meta.danger ? " rpt-modal__icon--danger" : ""}`} aria-hidden="true">
          <Icon size={22} />
        </span>
        <h3>{meta.title} — #{report.id}</h3>
        <p className="rpt-modal__desc">{meta.body(report.id, report)}</p>

        <div className="rpt-modal__body">
          {needsNote && (
            <label className="rpt-field">
              <span className="rpt-field__label">{action === "NOTE" ? "Note" : "Moderator note (optional)"}</span>
              <textarea
                rows={3}
                placeholder={action === "NOTE" ? "Investigator note…" : "Note for the record…"}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
            </label>
          )}

          {needsPriority && (
            <label className="rpt-field">
              <span className="rpt-field__label">Priority</span>
              <select value={noteText} onChange={(e) => setNoteText(e.target.value)}>
                <option value="">Choose…</option>
                {PRIORITY_OPTIONS.slice(1).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          )}

          {needsSuspend && (
            <label className="rpt-check">
              <input
                type="checkbox"
                checked={suspendChecked}
                onChange={(e) => setSuspendChecked(e.target.checked)}
              />
              <span>
                <strong>Suspend this user</strong>
                <small>{report.reportedName || "The reported user"} will be unable to sign in.</small>
              </span>
            </label>
          )}
        </div>

        <div className="rpt-modal__foot">
          <RippleButton onClick={onClose} disabled={actingId === report.id}>
            Cancel
          </RippleButton>
          <RippleButton variant={meta.danger ? "danger" : "primary"} disabled={actingId === report.id || !canConfirm} onClick={onConfirm}>
            {actingId === report.id ? "Applying…" : "Confirm"}
          </RippleButton>
        </div>
      </motion.div>
    </motion.div>
  );
}
