import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarX, CalendarDays, Clock, PlayCircle, Trash2, X, XOctagon } from "lucide-react";
import client from "../api/client";
import HeroSection from "../components/HeroSection";
import {
  AuBadge,
  AuEmpty,
  AuPagination,
  AuSkeleton,
  AuStat,
  AuTable,
  AuToolbar,
  toneFor,
} from "../modules/admin/ui";

const formatDate = (v) => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
};

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "PENDING", label: "Pending" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "COMPLETED", label: "Completed" },
];

const PAGE_SIZE = 20;

/** Derive display status for ACCEPTED sessions based on start/end times. */
function deriveStatus(s) {
  if (s.status !== "ACCEPTED") return s.status;
  const now = Date.now();
  const start = s.startTime ? new Date(s.startTime).getTime() : 0;
  const end = s.endTime ? new Date(s.endTime).getTime() : 0;
  if (start > now) return "UPCOMING";
  if (end >= now) return "ONGOING";
  return s.status;
}

const DISPLAY_TONES = { UPCOMING: "blue", ONGOING: "green", CANCELLED: "red" };

export default function SessionManagementPage({ notify }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [updatingId, setUpdatingId] = useState(null);
  const [drawerSession, setDrawerSession] = useState(null);
  const [drawerData, setDrawerData] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, upcoming: 0, ongoing: 0, cancelled: 0 });

  const loadStats = useCallback(async () => {
    try {
      const res = await client.get("/api/v1/admin/sessions/stats");
      if (res?.data?.data) setStats(res.data.data);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (search.trim()) params.set("q", search.trim());
      params.set("page", String(page));
      params.set("size", String(PAGE_SIZE));
      params.set("sort", "createdAt,desc");
      const res = await client.get(`/api/v1/admin/sessions?${params}`);
      const data = res?.data?.data;
      if (data?.content) {
        setSessions(data.content);
        setTotalPages(data.totalPages || 0);
        setTotalElements(data.totalElements || 0);
      } else {
        setSessions(Array.isArray(data) ? data : []);
      }
    } catch {
      notify?.({ type: "error", title: "Sessions unavailable", message: "Could not load sessions." });
    } finally { setLoading(false); }
  }, [notify, statusFilter, search, page]);

  useEffect(() => { setPage(0); }, [statusFilter, search]);
  useEffect(() => { loadSessions(); }, [loadSessions]);

  const cancelSession = async (sessionId) => {
    if (!window.confirm("Cancel this session? This will remove the meeting link.")) return;
    setUpdatingId(sessionId);
    try {
      await client.patch(`/api/v1/admin/sessions/${sessionId}/status`, { status: "CANCELLED" });
      notify?.({ type: "success", title: "Session cancelled", message: `Session #${sessionId} cancelled.` });
      loadSessions();
    } catch (err) {
      notify?.({ type: "error", title: "Cancel failed", message: err?.response?.data?.data?.error || err.message });
    } finally { setUpdatingId(null); }
  };

  const deleteSession = async (sessionId, title) => {
    if (!window.confirm(`Permanently delete "${title || `Session #${sessionId}`}"? This action cannot be undone. Sessions that already have bookings must be cancelled instead.`)) return;
    setUpdatingId(sessionId);
    try {
      await client.delete(`/api/v1/admin/sessions/${sessionId}`);
      const remaining = sessions.filter((s) => s.id !== sessionId);
      setSessions(remaining);
      setTotalElements((prev) => Math.max(0, Number(prev || 0) - 1));
      if (drawerSession?.id === sessionId) { setDrawerSession(null); setDrawerData(null); }
      if (remaining.length === 0 && page > 0) {
        setPage((p) => Math.max(0, p - 1));
      }
      notify?.({ type: "success", title: "Session deleted", message: `Session #${sessionId} permanently deleted.` });
    } catch (err) {
      notify?.({ type: "error", title: "Delete failed", message: err?.response?.data?.data?.error || err.message });
    } finally { setUpdatingId(null); }
  };

  const openDrawer = async (session) => {
    setDrawerSession(session);
    setDrawerLoading(true);
    setDrawerData(null);
    try {
      const res = await client.get(`/api/v1/admin/sessions/${session.id}/details`);
      setDrawerData(res?.data?.data);
    } catch {
      notify?.({ type: "error", title: "Details unavailable", message: "Could not load session details." });
    } finally { setDrawerLoading(false); }
  };

  return (
    <div className="au au-page">
      <div className="au-inner">
        <HeroSection
          badge="SESSIONS"
          title="Session Management"
          subtitle="View, search, filter, and manage all sessions. Cancel sessions to remove the meeting link, or permanently delete inappropriate sessions (only allowed when they have no bookings)."
          illustration={
            <div className="hero-section__watermark" aria-hidden="true">
              <span className="material-symbols-outlined">event</span>
            </div>
          }
        />

        {/* ── Stat cards ── */}
        <div className="au-stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <AuStat icon={CalendarDays} label="Total Sessions" value={stats.total} subtitle="All-time sessions" tone="slate" index={0} />
          <AuStat icon={Clock} label="Upcoming" value={stats.upcoming} subtitle="Scheduled sessions" tone="blue" index={1} />
          <AuStat icon={PlayCircle} label="Ongoing" value={stats.ongoing} subtitle="Currently in progress" tone="green" index={2} />
          <AuStat icon={XOctagon} label="Cancelled" value={stats.cancelled} subtitle="Cancelled sessions" tone="red" index={3} />
        </div>

        <AuToolbar
          search={search}
          onSearchChange={setSearch}
          placeholder="Search by title or mentor..."
          selects={[{ label: "Filter by status", value: statusFilter, onChange: setStatusFilter, options: STATUS_OPTIONS }]}
          count={`${totalElements} sessions`}
        />

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 420px)", gap: 20, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {loading ? (
              <AuSkeleton rows={6} label="Loading sessions" />
            ) : sessions.length === 0 ? (
              <div className="au-table-card">
                <AuEmpty icon={CalendarDays} title="No sessions found" description="Try a different search term or filter." />
              </div>
            ) : (
              <>
                <AuTable
                  columns={[
                    { key: "id", label: "ID" },
                    { key: "title", label: "Title" },
                    { key: "mentor", label: "Mentor" },
                    { key: "price", label: "Price" },
                    { key: "status", label: "Status" },
                    { key: "type", label: "Type" },
                    { key: "parts", label: "Parts" },
                    { key: "start", label: "Start" },
                    { key: "actions", label: "Actions", style: { textAlign: "right" } },
                  ]}
                  busy={loading}
                  minWidth={1080}
                >
                  {sessions.map((s) => (
                    <tr key={s.id} onClick={() => openDrawer(s)} style={{ cursor: "pointer" }} className={drawerSession?.id === s.id ? "is-selected" : ""}>
                      <td style={{ fontWeight: 700, color: "var(--au-primary-dark)" }}>#{s.id}</td>
                      <td><strong>{s.title}</strong></td>
                      <td>{s.mentorName}</td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>{Number(s.priceAmount || 0).toFixed(2)}</td>
                      <td><AuBadge tone={DISPLAY_TONES[deriveStatus(s)] || toneFor(s.status)} dot>{deriveStatus(s)}</AuBadge></td>
                      <td>{s.sessionType}</td>
                      <td style={{ fontSize: 13, color: "var(--au-text-2)" }}>{s.participantCount}/{s.maxParticipants}</td>
                      <td style={{ fontSize: 13, color: "var(--au-text-2)" }}>{formatDate(s.startTime)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          {(s.status === "ACTIVE" || s.status === "PENDING") && (
                            <button type="button" className="au-btn au-btn--danger au-btn--sm"
                              disabled={updatingId === s.id}
                              onClick={() => cancelSession(s.id)}>
                              {updatingId === s.id ? "..." : "Cancel"}
                            </button>
                          )}
                          <button type="button" className="au-btn au-btn--ghost au-btn--sm"
                            disabled={updatingId === s.id || (s.bookingCount || 0) > 0}
                            title={(s.bookingCount || 0) > 0
                              ? "Cannot delete: this session has bookings (active or past). Cancel it instead."
                              : "Permanently delete an inappropriate session (only possible when it has no bookings)"}
                            onClick={() => deleteSession(s.id, s.title)}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </AuTable>
                <AuPagination page={page} totalPages={totalPages} totalElements={totalElements} pageSize={PAGE_SIZE} onChange={setPage} loading={loading} />
              </>
            )}
          </div>

          {/* Detail drawer */}
          <motion.aside
            className="au-card"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            style={{ position: "sticky", top: 84 }}
            aria-label="Session details"
          >
            {!drawerSession ? (
              <AuEmpty icon={CalendarDays} title="Select a session" description="Click a session row to view bookings, revenue and rating." />
            ) : drawerLoading ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--au-text-3)" }}>Loading details...</div>
            ) : drawerData ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{drawerData.title}</h3>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--au-text-2)" }}>
                      Session #{drawerData.sessionId} · <AuBadge tone={toneFor(drawerData.status)}>{drawerData.status}</AuBadge>
                    </p>
                  </div>
                  <button type="button" className="au-icon-btn" onClick={() => setDrawerSession(null)} aria-label="Close details">
                    <X size={18} />
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    ["Total Bookings", drawerData.totalBookings || 0],
                    ["Total Revenue", `${Number(drawerData.totalRevenue || 0).toFixed(2)} INR`],
                    ["Avg Rating", drawerData.averageRating?.toFixed(1) || "—"],
                    ["Price", `${Number(drawerData.price || 0).toFixed(2)} INR`],
                  ].map(([label, value]) => (
                    <div key={label} style={{ padding: 14, borderRadius: 14, border: "1px solid var(--au-border)", background: "var(--au-hover)" }}>
                      <span style={{ display: "block", fontSize: 12, color: "var(--au-text-2)", marginBottom: 6, fontWeight: 600 }}>{label}</span>
                      <strong style={{ fontSize: 16 }}>{value}</strong>
                    </div>
                  ))}
                </div>

                {drawerData.bookingTrend && drawerData.bookingTrend.length > 0 && (
                  <div style={{ padding: 16, borderRadius: 14, border: "1px solid var(--au-border)" }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "var(--au-text-2)", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Booking Trend (6 months)</p>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 60, padding: "4px 0" }}>
                      {drawerData.bookingTrend.map((bucket, i) => {
                        const maxVal = Math.max(...drawerData.bookingTrend.map((b) => b.value), 1);
                        const pct = Math.round((bucket.value / maxVal) * 100);
                        return (
                          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                            <div style={{
                              width: "100%", height: `${Math.max(pct, 2)}%`,
                              background: "var(--au-gradient)", borderRadius: "4px 4px 0 0",
                              opacity: 0.7 + (pct / 100) * 0.3, minHeight: 4,
                              transition: "height 0.3s ease",
                            }} title={`${bucket.label}: ${bucket.value}`} />
                            <span style={{ fontSize: 10, color: "var(--au-text-3)", whiteSpace: "nowrap" }}>{bucket.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700 }}>
                    Bookings ({drawerData.totalBookings || 0})
                    {drawerData.completedCount > 0 && <span style={{ fontWeight: 400, color: "var(--au-text-3)", fontSize: 12 }}> · {drawerData.completedCount} completed</span>}
                    {drawerData.cancelledCount > 0 && <span style={{ fontWeight: 400, color: "#dc2626", fontSize: 12 }}> · {drawerData.cancelledCount} cancelled</span>}
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto" }}>
                    {(drawerData.bookings || []).length === 0 ? (
                      <p style={{ color: "var(--au-text-3)", fontSize: 13, textAlign: "center", padding: 20 }}>No bookings yet.</p>
                    ) : (
                      (drawerData.bookings || []).map((b) => (
                        <div key={b.id} style={{ padding: 12, borderRadius: 12, background: "var(--au-hover)", border: "1px solid var(--au-border)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <strong style={{ fontSize: 13 }}>{b?.learner?.fullName || `User #${b?.learner?.id || "?"}`}</strong>
                            <AuBadge tone={toneFor(b?.bookingStatus)}>{b?.bookingStatus || "PENDING"}</AuBadge>
                          </div>
                          <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--au-text-2)" }}>
                            {formatDate(b?.createdAt)}
                            {b?.session?.startTime ? ` · ${formatDate(b.session.startTime)}` : ""}
                            {b?.paymentStatus && b.paymentStatus !== "PENDING" && ` · ${b.paymentStatus}`}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <AuEmpty icon={CalendarX} title="Could not load details" />
            )}
          </motion.aside>
        </div>
      </div>
    </div>
  );
}
