import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Ban,
  CheckCircle2,
  Search,
  Trash2,
  UserCog,
  Users as UsersIcon,
} from "lucide-react";
import client, { extractJwtUserId, getActiveAuthToken } from "../api/client";
import HeroSection from "../components/HeroSection";
import {
  AuAvatar,
  AuBadge,
  AuButton,
  AuEmpty,
  AuPagination,
  AuSkeleton,
  AuStat,
  AuTable,
  AuToolbar,
  toneFor,
} from "../modules/admin/ui";

const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
};

const PAGE_SIZE = 25;

const ROLE_OPTIONS = [
  { value: "", label: "All roles" },
  { value: "LEARNER", label: "Learner" },
  { value: "MENTOR", label: "Mentor" },
  { value: "ADMIN", label: "Admin" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "disabled", label: "Disabled" },
];

const SUB_ROLE_OPTIONS = [
  { value: "", label: "No sub-role" },
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "MODERATOR", label: "Moderator" },
  { value: "FINANCE", label: "Finance" },
  { value: "SUPPORT", label: "Support" },
];

export default function UserManagementPage({ notify }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [selectedUser, setSelectedUser] = useState(null);
  const [walletData, setWalletData] = useState(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter) params.set("role", roleFilter);
      if (search.trim()) params.set("q", search.trim());
      params.set("page", String(page));
      params.set("size", String(PAGE_SIZE));
      params.set("sort", "createdAt,desc");
      const res = await client.get(`/api/v1/admin/users?${params}`);
      const data = res?.data?.data;
      if (data?.content) {
        setUsers(data.content);
        setTotalPages(data.totalPages || 0);
        setTotalElements(data.totalElements || 0);
      } else {
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch {
      notify?.({ type: "error", title: "Users unavailable", message: "Could not load users." });
    } finally {
      setLoading(false);
    }
  }, [notify, roleFilter, search, page]);

  useEffect(() => { setPage(0); }, [roleFilter, search]);
  useEffect(() => { loadUsers(); }, [loadUsers]);

  /**
   * The signed-in admin, so their own row can never offer self-disable/delete.
   * Derived from the JWT's userId claim (the users list already does not expose
   * which row is "me").
   */
  const currentUserId = useMemo(() => extractJwtUserId(getActiveAuthToken()), []);
  // Sub-role only matters when the admin's own row is on this page; when it is
  // not we defer to the backend, which enforces super-admin for other admins.
  const mySubRole = useMemo(
    () => users.find((u) => u.id === currentUserId)?.adminSubRole || null,
    [users, currentUserId],
  );
  const isSuperAdmin = !mySubRole || mySubRole === "SUPER_ADMIN";
  const canManageUser = useCallback(
    (user) => user.id !== currentUserId && (user.role !== "ADMIN" || isSuperAdmin),
    [currentUserId, isSuperAdmin],
  );

  const toggleEnabled = async (userId, currentlyEnabled, userName) => {
    // Disabling signs the user out everywhere, so it needs an explicit warning.
    // Enabling is harmless and needs no confirmation.
    if (currentlyEnabled) {
      const label = userName || `user #${userId}`;
      const confirmed = window.confirm(
        `Disable "${label}" (#${userId})?\n\n`
        + "They will be signed out and cannot log in until re-enabled."
      );
      if (!confirmed) return;
    }

    setUpdatingId(userId);
    try {
      const res = await client.patch(`/api/v1/admin/users/${userId}/enabled`, {
        enabled: !currentlyEnabled,
      });
      // Trust the server's answer, not the click: the backend may normalise the
      // state (e.g. idempotent calls) and is the source of truth after refresh.
      const payload = res?.data?.data;
      const nextEnabled =
        typeof payload?.enabled === "boolean" ? payload.enabled : !currentlyEnabled;
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, enabled: nextEnabled, fullName: payload?.fullName || u.fullName }
            : u,
        ),
      );
      notify?.({
        type: "success",
        title: "User updated",
        message: `${payload?.fullName || `User #${userId}`} ${nextEnabled ? "enabled" : "disabled"}.`,
      });
    } catch (err) {
      // Nothing was applied optimistically, so the row already shows the true
      // server state — just surface the reason.
      notify?.({
        type: "error",
        title: "Update failed",
        message: err?.response?.data?.data?.error || err?.message || "The user was not updated.",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const changeRole = async (userId, newRole) => {
    setUpdatingId(userId);
    try {
      await client.patch(`/api/v1/admin/users/${userId}/role`, { role: newRole });
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u));
      notify?.({ type: "success", title: "Role changed", message: `User #${userId} role changed to ${newRole}.` });
    } catch (err) {
      notify?.({ type: "error", title: "Role change failed", message: err?.response?.data?.data?.error || err.message });
    } finally {
      setUpdatingId(null);
    }
  };

  const changeAdminSubRole = async (userId, adminSubRole) => {
    setUpdatingId(userId);
    try {
      await client.patch(`/api/v1/admin/users/${userId}/admin-sub-role`, { adminSubRole });
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, adminSubRole } : u));
      notify?.({ type: "success", title: "Sub-role updated", message: `Admin #${userId} sub-role set to ${adminSubRole}.` });
    } catch (err) {
      notify?.({ type: "error", title: "Update failed", message: err?.response?.data?.data?.error || err.message });
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteUser = async (userId, userName) => {
    // One deletion at a time — ignore extra clicks while a request is in flight.
    if (deletingId !== null) return;
    if (!window.confirm(
      `Delete user "${userName}" (#${userId})?\n\n`
      + "The account is disabled, personal details are removed and it leaves this list. "
      + "Bookings, payments and wallet history are kept for audit. This cannot be undone."
    )) return;

    setDeletingId(userId);
    try {
      await client.delete(`/api/v1/admin/users/${userId}`);
      // Only reflect the change once the backend has confirmed the deletion.
      const remainingOnPage = users.filter((u) => u.id !== userId).length;
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      if (selectedUser === userId) { setSelectedUser(null); setWalletData(null); }
      notify?.({ type: "success", title: "User deleted", message: `User #${userId} deleted.` });

      // Re-read from the server so counts and pages reflect the deletion —
      // deleted accounts are excluded by the users query from now on.
      if (remainingOnPage === 0 && page > 0) {
        setPage((p) => Math.max(0, p - 1)); // reloads through the page effect
      } else {
        loadUsers();
      }
    } catch (err) {
      // The user stays in the list — nothing was removed locally.
      notify?.({
        type: "error",
        title: "Delete failed",
        message: err?.response?.data?.data?.error || err?.message || "The user was not deleted.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const viewWallet = async (userId) => {
    setSelectedUser(userId);
    setWalletLoading(true);
    setWalletData(null);
    try {
      const res = await client.get(`/api/v1/admin/users/${userId}/wallet`);
      setWalletData(res?.data?.data);
    } catch {
      notify?.({ type: "error", title: "Wallet unavailable", message: "Could not load wallet." });
    } finally {
      setWalletLoading(false);
    }
  };

  const toggleOne = (id) => { setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };

  const bulkAction = async (action) => {
    const ids = [...selectedIds];
    if (ids.length === 0) { notify?.({ type: "error", title: "No users selected", message: "Select users first." }); return; }
    const verb = action === "enable" ? "Enable" : action === "disable" ? "Disable" : "Change role of";
    const warning = action === "disable"
      ? "\n\nSelected users will be signed out and cannot log in until re-enabled."
      : "";
    if (!window.confirm(`${verb} ${ids.length} user(s)?${warning}`)) return;
    setBulkActionLoading(true);
    try {
      let response = null;
      if (action === "enable") response = await client.post("/api/v1/admin/users/bulk/enable", { ids });
      else if (action === "disable") response = await client.post("/api/v1/admin/users/bulk/disable", { ids });
      else if (action === "role") {
        const newRole = prompt("Enter new role (LEARNER, MENTOR, ADMIN):");
        if (!newRole || !["LEARNER", "MENTOR", "ADMIN"].includes(newRole.toUpperCase())) return;
        response = await client.post("/api/v1/admin/users/bulk/role", { ids, role: newRole.toUpperCase() });
      }
      // The backend reports what it refused (own account, other admins, last
      // admin) — show that instead of pretending every id was updated.
      const payload = response?.data?.data;
      const updated = Number(payload?.updatedCount ?? ids.length);
      const skipped = Array.isArray(payload?.skipped) ? payload.skipped : [];
      notify?.({
        type: skipped.length ? "warning" : "success",
        title: skipped.length ? "Bulk action partly applied" : "Bulk action complete",
        message: skipped.length
          ? `${updated} updated, ${skipped.length} skipped: ${skipped.join(", ")}`
          : `${updated} user(s) updated.`,
      });
      setSelectedIds(new Set());
      loadUsers();
    } catch (err) {
      notify?.({ type: "error", title: "Bulk action failed", message: err?.response?.data?.data?.error || err.message });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleExportCsv = () => {
    setExportingCsv(true);
    try {
      const rows = [
        ["ID", "Name", "Email", "Role", "Enabled", "Verified", "Skills", "Wallet Balance", "Created At"],
        ...users.map((u) => [
          String(u.id), u.fullName, u.email, u.role,
          u.enabled ? "Yes" : "No", u.mentorVerified ? "Yes" : "No",
          u.skills || "", u.walletBalance || "0",
          formatDate(u.createdAt),
        ]),
      ];
      const csv = rows.map((r) => r.map((c) => `"${String(c || "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      notify?.({ type: "success", title: "CSV ready", message: "Users exported." });
    } catch { notify?.({ type: "error", title: "Export failed", message: "Could not export users." }); }
    finally { setExportingCsv(false); }
  };

  const stats = useMemo(() => {
    const counts = { LEARNER: 0, MENTOR: 0, ADMIN: 0 };
    users.forEach((u) => { if (counts[u.role] !== undefined) counts[u.role]++; });
    return { total: totalElements, learners: counts.LEARNER, mentors: counts.MENTOR, admins: counts.ADMIN, active: users.filter((u) => u.enabled).length };
  }, [users, totalElements]);

  // Status filtering is client-side over the current page (the users query is
  // already server-paginated by role/q). Accounts are never hidden from the
  // list itself — disabled rows stay visible so they can be re-enabled.
  const visibleUsers = useMemo(() => {
    if (statusFilter === "active") return users.filter((u) => u.enabled);
    if (statusFilter === "disabled") return users.filter((u) => !u.enabled);
    return users;
  }, [users, statusFilter]);

  const selectedUserObj = users.find((u) => u.id === selectedUser);

  return (
    <div className="au au-page">
      <div className="au-inner">
        <HeroSection
          className="hero-section--compact"
          badge="USERS"
          title="User Management"
          subtitle="View, search, enable/disable users and manage roles across the platform."
          primaryButton={
            <button
              type="button"
              className="hero-section__btn hero-section__btn--primary"
              onClick={handleExportCsv}
              disabled={exportingCsv}
            >
              <span className="material-symbols-outlined">download</span>
              {exportingCsv ? "Exporting..." : "Export CSV"}
            </button>
          }
          illustration={
            <div className="hero-section__watermark" aria-hidden="true">
              <span className="material-symbols-outlined">group</span>
            </div>
          }
        />

        {/* Stat strip */}
        <div className="au-stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <AuStat icon={UsersIcon} label="Total users" value={stats.total} subtitle="Across the platform" tone="slate" index={0} />
          <AuStat icon={UsersIcon} label="Learners" value={stats.learners} subtitle="On this page" tone="blue" index={1} />
          <AuStat icon={UsersIcon} label="Mentors" value={stats.mentors} subtitle="On this page" tone="violet" index={2} />
          <AuStat icon={UserCog} label="Admins" value={stats.admins} subtitle="On this page" tone="amber" index={3} />
        </div>

        {/* Bulk actions bar */}
        {selectedIds.size > 0 && (
          <motion.div
            className="au-card"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "14px 20px" }}
          >
            <strong style={{ fontSize: "0.9rem" }}>{selectedIds.size} selected</strong>
            <AuButton size="sm" variant="success" onClick={() => bulkAction("enable")} disabled={bulkActionLoading}>Enable</AuButton>
            <AuButton size="sm" variant="danger" onClick={() => bulkAction("disable")} disabled={bulkActionLoading}>Disable</AuButton>
            <AuButton size="sm" variant="outline" onClick={() => bulkAction("role")} disabled={bulkActionLoading}>Change Role</AuButton>
            <AuButton size="sm" onClick={() => setSelectedIds(new Set())}>Clear</AuButton>
          </motion.div>
        )}

        {/* Toolbar */}
        <AuToolbar
          search={search}
          onSearchChange={setSearch}
          placeholder="Search by name, email, or role..."
          selects={[
            { label: "Filter by role", value: roleFilter, onChange: setRoleFilter, options: ROLE_OPTIONS },
            { label: "Filter by status", value: statusFilter, onChange: setStatusFilter, options: STATUS_OPTIONS },
          ]}
          count={
            visibleUsers.length === users.length
              ? `${totalElements} users`
              : `Showing ${visibleUsers.length} of ${users.length} on this page`
          }
        />

        {/* Table + detail split */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 380px)", gap: 20, alignItems: "start" }}>
          {loading ? (
            <AuSkeleton rows={6} label="Loading users" />
          ) : users.length === 0 ? (
            <div className="au-table-card">
              <AuEmpty icon={UsersIcon} title="No users found" description="Try a different search term or filter." />
            </div>
          ) : visibleUsers.length === 0 ? (
            <div className="au-table-card">
              <AuEmpty
                icon={UsersIcon}
                title="No users match this filter"
                description={'Switch the status filter back to "All statuses" to see this page\u2019s users.'}
              />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <AuTable
                columns={[
                  { key: "sel", label: "", style: { width: 44 } },
                  { key: "user", label: "User" },
                  { key: "role", label: "Role" },
                  { key: "status", label: "Status" },
                  { key: "joined", label: "Joined" },
                  { key: "actions", label: "Actions", style: { textAlign: "right" } },
                ]}
                busy={loading}
                minWidth={820}
              >
                {visibleUsers.map((u) => (
                  <tr
                    key={u.id}
                    className={selectedUser === u.id ? "is-selected" : ""}
                    style={{ cursor: "pointer", opacity: u.enabled ? 1 : 0.55 }}
                    onClick={() => viewWallet(u.id)}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(u.id)} onChange={() => toggleOne(u.id)} aria-label={`Select ${u.fullName}`} />
                    </td>
                    <td>
                      <div className="au-user">
                        <AuAvatar name={u.fullName} size="sm" />
                        <div style={{ minWidth: 0 }}>
                          <p className="au-user__name">{u.fullName}</p>
                          <p className="au-user__email">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <AuBadge tone={toneFor(u.role)}>{u.role}</AuBadge>
                      {u.role === "ADMIN" && u.adminSubRole && (
                        <div style={{ marginTop: 6 }}><span className="au-badge au-badge--gray">{u.adminSubRole}</span></div>
                      )}
                    </td>
                    <td>
                      <AuBadge tone={u.enabled ? "green" : "red"} dot>{u.enabled ? "Active" : "Disabled"}</AuBadge>
                      {u.mentorVerified && <div style={{ marginTop: 6 }}><span className="au-badge au-badge--purple">Verified</span></div>}
                    </td>
                    <td style={{ fontSize: 13, color: "var(--au-text-2)" }}>{formatDate(u.createdAt)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                        <AuButton
                          size="sm"
                          variant={u.enabled ? "danger" : "success"}
                          icon={u.enabled ? Ban : CheckCircle2}
                          onClick={() => toggleEnabled(u.id, u.enabled, u.fullName)}
                          disabled={updatingId === u.id || !canManageUser(u)}
                          aria-label={`${u.enabled ? "Disable" : "Enable"} ${u.fullName}`}
                          title={
                            !canManageUser(u)
                              ? u.id === currentUserId
                                ? "You cannot change your own account"
                                : "Only a super admin can change another admin"
                              : undefined
                          }
                        >
                          {updatingId === u.id
                            ? (u.enabled ? "Disabling..." : "Enabling...")
                            : (u.enabled ? "Disable" : "Enable")}
                        </AuButton>
                        <AuButton
                          size="sm"
                          variant="danger"
                          icon={Trash2}
                          onClick={() => deleteUser(u.id, u.fullName)}
                          disabled={deletingId !== null || !canManageUser(u)}
                          aria-label={`Delete ${u.fullName}`}
                          title={
                            !canManageUser(u) ? "You cannot delete this account" : undefined
                          }
                        >
                          {deletingId === u.id ? "Deleting..." : "Delete"}
                        </AuButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </AuTable>
              <AuPagination page={page} totalPages={totalPages} totalElements={totalElements} pageSize={PAGE_SIZE} onChange={setPage} loading={loading} />
            </div>
          )}

          {/* Detail panel */}
          <motion.aside
            className="au-card"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            style={{ position: "sticky", top: 84 }}
            aria-label="User details"
          >
            {!selectedUser ? (
              <AuEmpty icon={Search} title="Select a user" description="Click a user row to view their wallet, role controls and account actions." />
            ) : walletLoading ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--au-text-3)" }}>Loading user details...</div>
            ) : walletData ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
                  <AuAvatar name={walletData.userName} size="lg" />
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{walletData.userName}</h3>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--au-text-2)" }}>
                      Balance: <strong>{Number(walletData.balance || 0).toFixed(2)} {walletData.currency}</strong>
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 14 }}>
                    <input type="checkbox" checked={Boolean(selectedUserObj?.enabled)}
                      onChange={() => {
                        if (selectedUserObj && canManageUser(selectedUserObj)) {
                          toggleEnabled(selectedUserObj.id, selectedUserObj.enabled, selectedUserObj.fullName);
                        }
                      }}
                      disabled={
                        updatingId === selectedUser
                        || !selectedUserObj
                        || !canManageUser(selectedUserObj)
                      } />
                    <span>Enabled</span>
                  </label>
                  <label className="au-field">
                    <span className="au-field__label">Role</span>
                    <select value={selectedUserObj?.role || ""} onChange={(e) => changeRole(selectedUser, e.target.value)} disabled={updatingId === selectedUser}>
                      <option value="LEARNER">Learner</option>
                      <option value="MENTOR">Mentor</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </label>
                  {selectedUserObj?.role === "ADMIN" && (
                    <label className="au-field">
                      <span className="au-field__label">Admin sub-role</span>
                      <select value={selectedUserObj?.adminSubRole || ""}
                        onChange={(e) => changeAdminSubRole(selectedUser, e.target.value || null)}
                        disabled={updatingId === selectedUser}>
                        {SUB_ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </label>
                  )}
                  <AuButton
                    variant="danger"
                    icon={Trash2}
                    onClick={() => {
                      if (selectedUserObj && canManageUser(selectedUserObj)) {
                        deleteUser(selectedUserObj.id, selectedUserObj.fullName);
                      }
                    }}
                    disabled={deletingId !== null || !selectedUserObj || !canManageUser(selectedUserObj)}
                  >
                    {deletingId === selectedUser ? "Deleting..." : "Delete User"}
                  </AuButton>
                </div>

                <h4 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700 }}>Wallet History</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 300, overflowY: "auto" }}>
                  {(!walletData.history || walletData.history.length === 0) ? (
                    <p style={{ color: "var(--au-text-3)", fontSize: 13, textAlign: "center", padding: 20 }}>No wallet transactions.</p>
                  ) : (
                    walletData.history.map((entry) => (
                      <div key={entry.id} style={{ padding: 12, borderRadius: 12, background: "var(--au-hover)", border: "1px solid var(--au-border)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <strong style={{ fontSize: 13 }}>{entry.type}</strong>
                          <span style={{ fontSize: 12, color: "var(--au-text-3)" }}>{formatDate(entry.createdAt)}</span>
                        </div>
                        <p style={{ margin: "4px 0", fontSize: 13, color: "var(--au-text-2)" }}>{entry.description}</p>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>
                          {Number(entry.amount || 0).toFixed(2)} {entry.currency}
                          {entry.balanceAfter != null && ` → Balance: ${Number(entry.balanceAfter).toFixed(2)}`}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <AuEmpty icon={UsersIcon} title="Could not load details" />
            )}
          </motion.aside>
        </div>
      </div>
    </div>
  );
}
