import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import Icon from '../modules/common/dashboard/Icon';
import './AdminOperationsPage.css';

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
};

const PAGE_SIZE = 25;

export default function UserManagementPage({ notify }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
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
      if (roleFilter) params.set('role', roleFilter);
      if (search.trim()) params.set('q', search.trim());
      params.set('page', String(page));
      params.set('size', String(PAGE_SIZE));
      params.set('sort', 'createdAt,desc');
      const res = await client.get(`/api/v1/admin/users?${params}`);
      const data = res?.data?.data;
      if (data?.content) {
        setUsers(data.content);
        setTotalPages(data.totalPages || 0);
        setTotalElements(data.totalElements || 0);
      } else {
        // Fallback if backend doesn't send paginated response
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch {
      notify?.({ type: 'error', title: 'Users unavailable', message: 'Could not load users.' });
    } finally {
      setLoading(false);
    }
  }, [notify, roleFilter, search, page]);

  useEffect(() => { setPage(0); }, [roleFilter, search]);
  useEffect(() => { loadUsers(); }, [loadUsers]);

  const toggleEnabled = async (userId, currentlyEnabled) => {
    setUpdatingId(userId);
    try {
      await client.patch(`/api/v1/admin/users/${userId}/enabled`, { enabled: !currentlyEnabled });
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, enabled: !currentlyEnabled } : u));
      notify?.({ type: 'success', title: 'User updated', message: `User #${userId} ${currentlyEnabled ? 'disabled' : 'enabled'}.` });
    } catch (err) {
      notify?.({ type: 'error', title: 'Update failed', message: err?.response?.data?.data?.error || err.message });
    } finally {
      setUpdatingId(null);
    }
  };

  const changeRole = async (userId, newRole) => {
    setUpdatingId(userId);
    try {
      await client.patch(`/api/v1/admin/users/${userId}/role`, { role: newRole });
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u));
      notify?.({ type: 'success', title: 'Role changed', message: `User #${userId} role changed to ${newRole}.` });
    } catch (err) {
      notify?.({ type: 'error', title: 'Role change failed', message: err?.response?.data?.data?.error || err.message });
    } finally {
      setUpdatingId(null);
    }
  };

  const changeAdminSubRole = async (userId, adminSubRole) => {
    setUpdatingId(userId);
    try {
      await client.patch(`/api/v1/admin/users/${userId}/admin-sub-role`, { adminSubRole });
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, adminSubRole } : u));
      notify?.({ type: 'success', title: 'Sub-role updated', message: `Admin #${userId} sub-role set to ${adminSubRole}.` });
    } catch (err) {
      notify?.({ type: 'error', title: 'Update failed', message: err?.response?.data?.data?.error || err.message });
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteUser = async (userId, userName) => {
    if (!window.confirm(`Permanently delete user "${userName}" (#${userId})? This action cannot be undone.`)) return;
    setDeletingId(userId);
    try {
      await client.delete(`/api/v1/admin/users/${userId}`);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      if (selectedUser === userId) { setSelectedUser(null); setWalletData(null); }
      notify?.({ type: 'success', title: 'User deleted', message: `User #${userId} permanently deleted.` });
    } catch (err) {
      notify?.({ type: 'error', title: 'Delete failed', message: err?.response?.data?.data?.error || err.message });
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
      notify?.({ type: 'error', title: 'Wallet unavailable', message: 'Could not load wallet.' });
    } finally {
      setWalletLoading(false);
    }
  };

  // Bulk selection
  const allSelected = users.length > 0 && selectedIds.size === users.length;
  const toggleAll = () => { if (allSelected) setSelectedIds(new Set()); else setSelectedIds(new Set(users.map((u) => u.id))); };
  const toggleOne = (id) => { setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };

  const bulkAction = async (action) => {
    const ids = [...selectedIds];
    if (ids.length === 0) { notify?.({ type: 'error', title: 'No users selected', message: 'Select users first.' }); return; }
    if (!window.confirm(`${action === 'enable' ? 'Enable' : action === 'disable' ? 'Disable' : 'Change role of'} ${ids.length} user(s)?`)) return;
    setBulkActionLoading(true);
    try {
      if (action === 'enable') await client.post('/api/v1/admin/users/bulk/enable', { ids });
      else if (action === 'disable') await client.post('/api/v1/admin/users/bulk/disable', { ids });
      else if (action === 'role') {
        const newRole = prompt('Enter new role (LEARNER, MENTOR, ADMIN):');
        if (!newRole || !['LEARNER', 'MENTOR', 'ADMIN'].includes(newRole.toUpperCase())) return;
        await client.post('/api/v1/admin/users/bulk/role', { ids, role: newRole.toUpperCase() });
      }
      notify?.({ type: 'success', title: 'Bulk action complete', message: `${ids.length} user(s) updated.` });
      setSelectedIds(new Set());
      loadUsers();
    } catch (err) {
      notify?.({ type: 'error', title: 'Bulk action failed', message: err?.response?.data?.data?.error || err.message });
    } finally {
      setBulkActionLoading(false);
    }
  };

  // CSV export
  const handleExportCsv = () => {
    setExportingCsv(true);
    try {
      const rows = [
        ['ID', 'Name', 'Email', 'Role', 'Enabled', 'Verified', 'Skills', 'Wallet Balance', 'Created At'],
        ...users.map((u) => [
          String(u.id), u.fullName, u.email, u.role,
          u.enabled ? 'Yes' : 'No', u.mentorVerified ? 'Yes' : 'No',
          u.skills || '', u.walletBalance || '0',
          formatDate(u.createdAt),
        ]),
      ];
      const csv = rows.map((r) => r.map((c) => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
      notify?.({ type: 'success', title: 'CSV ready', message: 'Users exported.' });
    } catch { notify?.({ type: 'error', title: 'Export failed', message: 'Could not export users.' }); }
    finally { setExportingCsv(false); }
  };

  return (
    <section className="admin-page">
      <div className="admin-hero" style={{ marginBottom: 0, borderRadius: '0 0 18px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <p className="admin-eyebrow">Administration</p>
            <h1>User Management</h1>
            <p>View, search, enable/disable users and manage roles across the platform.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="admin-refresh-btn" onClick={handleExportCsv} disabled={exportingCsv}
              style={{ background: '#059669' }}>
              <Icon name="table_chart" /> {exportingCsv ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, margin: '18px 0', flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="admin-search" style={{ flex: 1, maxWidth: 400 }}>
          <Icon name="search" />
          <input type="text" placeholder="Search by name, email, or role..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') loadUsers(); }} />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
          style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px' }}>
          <option value="">All roles</option>
          <option value="LEARNER">Learner</option>
          <option value="MENTOR">Mentor</option>
          <option value="ADMIN">Admin</option>
        </select>
        <button type="button" className="admin-refresh-btn" onClick={loadUsers} disabled={loading}>
          {loading ? 'Loading...' : 'Search'}
        </button>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="admin-panel" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', padding: '12px 16px', marginTop: 0, marginBottom: 12 }}>
          <Icon name="checklist" />
          <strong style={{ fontSize: '0.85rem' }}>{selectedIds.size} selected</strong>
          <button type="button" className="admin-refresh-btn" onClick={() => bulkAction('enable')} disabled={bulkActionLoading}
            style={{ background: '#16a34a', borderColor: '#15803d', padding: '6px 12px', fontSize: '0.82rem' }}>
            Enable
          </button>
          <button type="button" className="admin-refresh-btn" onClick={() => bulkAction('disable')} disabled={bulkActionLoading}
            style={{ background: '#dc2626', borderColor: '#b91c1c', padding: '6px 12px', fontSize: '0.82rem' }}>
            Disable
          </button>
          <button type="button" className="admin-refresh-btn" onClick={() => bulkAction('role')} disabled={bulkActionLoading}
            style={{ background: '#7c3aed', borderColor: '#6d28d9', padding: '6px 12px', fontSize: '0.82rem' }}>
            Change Role
          </button>
          <button type="button" className="admin-refresh-btn" onClick={() => setSelectedIds(new Set())}
            style={{ background: '#64748b', borderColor: '#475569', padding: '6px 12px', fontSize: '0.82rem' }}>
            Clear
          </button>
        </div>
      )}

      <div className="admin-conv-layout">
        <div className="admin-conv-list">
          {loading ? (<p style={{ padding: 20 }}>Loading users...</p>
          ) : users.length === 0 ? (
            <div className="admin-empty-state"><Icon name="people" /><p>No users found.</p></div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #f1f5f9' }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll}
                  style={{ marginRight: 8 }} title="Select all" />
                <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 700 }}>Select all</span>
              </div>
              {users.map((u) => (
                <button key={u.id} type="button"
                  className={`admin-conv-item ${selectedUser === u.id ? 'is-selected' : ''}`}
                  onClick={() => viewWallet(u.id)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <input type="checkbox" checked={selectedIds.has(u.id)}
                    onChange={() => toggleOne(u.id)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="admin-conv-item-top">
                      <strong>{u.fullName}</strong>
                      <span className={`admin-pill ${u.role === 'MENTOR' ? 'admin-pill--booking' : u.role === 'ADMIN' ? 'admin-pill--direct' : ''}`}
                        style={u.role === 'LEARNER' ? { background: '#fef3c7', color: '#92400e' } : {}}>
                        {u.role}
                      </span>
                    </div>
                    <div className="admin-conv-item-title">{u.email}</div>
                    <div className="admin-conv-item-meta">
                      <span>{u.enabled ? '✅ Active' : '⛔ Disabled'}</span>
                      <span>{formatDate(u.createdAt)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="ap-pagination" style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9' }}>
              <span className="ap-pagination__info" style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                {totalElements} total · Page {page + 1} of {totalPages}
              </span>
              <div className="ap-pagination__buttons" style={{ display: 'flex', gap: 4 }}>
                <button type="button" className="admin-action-btn admin-action-cancel"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
                  <Icon name="chevron_left" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const start = Math.max(0, Math.min(page - 2, totalPages - 5));
                  const p = start + i;
                  if (p >= totalPages) return null;
                  return (
                    <button key={p} type="button"
                      className={`ap-pagination__page ${page === p ? 'ap-pagination__page--active' : ''}`}
                      onClick={() => setPage(p)}
                      style={{ padding: '4px 8px', fontSize: '0.78rem' }}>
                      {p + 1}
                    </button>
                  );
                })}
                <button type="button" className="admin-action-btn admin-action-cancel"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  style={{ padding: '4px 10px', fontSize: '0.78rem' }}>
                  <Icon name="chevron_right" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail panel - same as before */}
        <div className="admin-conv-messages">
          {!selectedUser ? (
            <div className="admin-empty-state"><Icon name="person_search" /><p>Select a user to view details</p></div>
          ) : walletLoading ? (
            <p style={{ padding: 20 }}>Loading user details...</p>
          ) : walletData ? (
            <div style={{ padding: 16 }}>
              <div className="admin-conv-messages-header" style={{ position: 'static', padding: '0 0 12px 0', background: 'transparent', border: 'none' }}>
                <h3 style={{ margin: 0 }}>{walletData.userName}</h3>
                <p className="admin-text-muted">
                  Balance: <strong>{Number(walletData.balance || 0).toFixed(2)} {walletData.currency}</strong>
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={users.find((u) => u.id === selectedUser)?.enabled}
                    onChange={() => { const u2 = users.find((x) => x.id === selectedUser); if (u2) toggleEnabled(u2.id, u2.enabled); }}
                    disabled={updatingId === selectedUser} />
                  <span style={{ fontSize: '0.85rem' }}>Enabled</span>
                </label>
                <select value={users.find((u) => u.id === selectedUser)?.role || ''}
                  onChange={(e) => changeRole(selectedUser, e.target.value)}
                  disabled={updatingId === selectedUser}
                  style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px' }}>
                  <option value="LEARNER">Learner</option>
                  <option value="MENTOR">Mentor</option>
                  <option value="ADMIN">Admin</option>
                </select>
                {/* Admin sub-role dropdown (Feature 3) */}
                {users.find((u) => u.id === selectedUser)?.role === 'ADMIN' && (
                  <select value={users.find((u) => u.id === selectedUser)?.adminSubRole || ''}
                    onChange={(e) => changeAdminSubRole(selectedUser, e.target.value || null)}
                    disabled={updatingId === selectedUser}
                    style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px' }}>
                    <option value="">No sub-role</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                    <option value="MODERATOR">Moderator</option>
                    <option value="FINANCE">Finance</option>
                    <option value="SUPPORT">Support</option>
                  </select>
                )}
              </div>

              {/* Delete user (Feature 6) */}
              <div style={{ marginTop: 8 }}>
                <button type="button"
                  style={{ background: '#dc2626', color: '#fff', border: '1px solid #b91c1c', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}
                  onClick={() => {
                    const u = users.find((x) => x.id === selectedUser);
                    if (u) deleteUser(u.id, u.fullName);
                  }}
                  disabled={deletingId === selectedUser}>
                  <Icon name="delete" /> {deletingId === selectedUser ? 'Deleting...' : 'Delete User'}
                </button>
              </div>
              <h4 style={{ margin: '12px 0 8px', fontSize: '0.9rem' }}>Wallet History</h4>
              <div className="admin-conv-messages-list" style={{ maxHeight: 300, overflowY: 'auto' }}>
                {(!walletData.history || walletData.history.length === 0) ? (
                  <div className="admin-empty-state"><Icon name="account_balance_wallet" /><p>No wallet transactions.</p></div>
                ) : (
                  walletData.history.map((entry) => (
                    <div key={entry.id} className="admin-msg">
                      <div className="admin-msg-header">
                        <strong>{entry.type}</strong>
                        <span className="admin-text-muted">{formatDate(entry.createdAt)}</span>
                      </div>
                      <p className="admin-msg-content">{entry.description}</p>
                      <p className="admin-msg-content" style={{ fontWeight: 700 }}>
                        {Number(entry.amount || 0).toFixed(2)} {entry.currency}
                        {entry.balanceAfter != null && ` → Balance: ${Number(entry.balanceAfter).toFixed(2)}`}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="admin-empty-state"><Icon name="error" /><p>Could not load user details.</p></div>
          )}
        </div>
      </div>
    </section>
  );
}
