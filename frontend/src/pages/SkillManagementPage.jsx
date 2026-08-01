import { useCallback, useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import Icon from '../modules/common/dashboard/Icon';
import './AdminOperationsPage.css';
import './SkillManagementPage.css';

const REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'];

const formatDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: '2-digit', year: 'numeric',
  }).format(d);
};

export default function SkillManagementPage({ notify }) {
  const [tab, setTab] = useState('skills');
  const [loading, setLoading] = useState(true);
  const [skills, setSkills] = useState([]);
  const [search, setSearch] = useState('');

  // Skill requests
  const [requests, setRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestStatus, setRequestStatus] = useState('PENDING');

  // Edit / merge state
  const [editingSkill, setEditingSkill] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [mergingSkill, setMergingSkill] = useState(null);
  const [mergeTargetId, setMergeTargetId] = useState('');
  const [saving, setSaving] = useState(false);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await client.get('/api/v1/admin/skills');
      setSkills(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch {
      notify?.({ type: 'error', title: 'Skills unavailable', message: 'Could not load skills.' });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  const loadRequests = useCallback(async (status) => {
    setRequestsLoading(true);
    try {
      const res = await client.get(`/api/v1/admin/skills/skill-requests?status=${status}`);
      setRequests(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch {
      notify?.({ type: 'error', title: 'Requests unavailable', message: 'Could not load skill requests.' });
    } finally {
      setRequestsLoading(false);
    }
  }, [notify]);

  useEffect(() => { loadSkills(); }, [loadSkills]);
  useEffect(() => { loadRequests(requestStatus); }, [loadRequests, requestStatus]);

  const filteredSkills = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return skills;
    return skills.filter((s) =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.category || '').toLowerCase().includes(q),
    );
  }, [skills, search]);

  // ── Edit ──
  const openEdit = (skill) => {
    setEditingSkill(skill);
    setEditName(skill.name || '');
    setEditCategory(skill.category || '');
  };

  const saveEdit = async () => {
    if (!editName.trim()) {
      notify?.({ type: 'error', title: 'Name required', message: 'Skill name cannot be empty.' });
      return;
    }
    if (!editCategory.trim()) {
      notify?.({ type: 'error', title: 'Category required', message: 'Skill category cannot be empty.' });
      return;
    }
    setSaving(true);
    try {
      await client.patch(`/api/v1/admin/skills/${editingSkill.id}`, {
        name: editName.trim(),
        category: editCategory.trim(),
      });
      notify?.({ type: 'success', title: 'Skill updated', message: `"${editName.trim()}" updated.` });
      setEditingSkill(null);
      loadSkills();
    } catch (err) {
      notify?.({ type: 'error', title: 'Update failed', message: err?.response?.data?.data?.error || err.message });
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──
  const deleteSkill = async (skill) => {
    if (!window.confirm(`Delete skill "${skill.name}"? This removes it from the catalog and learner watchlists.`)) return;
    setSaving(true);
    try {
      await client.delete(`/api/v1/admin/skills/${skill.id}`);
      notify?.({ type: 'success', title: 'Skill deleted', message: `"${skill.name}" deleted.` });
      setSkills((prev) => prev.filter((s) => s.id !== skill.id));
    } catch (err) {
      notify?.({ type: 'error', title: 'Delete failed', message: err?.response?.data?.data?.error || err.message });
    } finally {
      setSaving(false);
    }
  };

  // ── Merge ──
  const mergeSkill = async () => {
    if (!mergeTargetId) {
      notify?.({ type: 'error', title: 'Target required', message: 'Choose the skill to keep.' });
      return;
    }
    setSaving(true);
    try {
      await client.post(`/api/v1/admin/skills/${mergingSkill.id}/merge`, { targetSkillId: Number(mergeTargetId) });
      notify?.({
        type: 'success',
        title: 'Skills merged',
        message: `"${mergingSkill.name}" merged into "${skills.find((s) => s.id === Number(mergeTargetId))?.name}".`,
      });
      setMergingSkill(null);
      setMergeTargetId('');
      loadSkills();
    } catch (err) {
      notify?.({ type: 'error', title: 'Merge failed', message: err?.response?.data?.data?.error || err.message });
    } finally {
      setSaving(false);
    }
  };

  // ── Approve / Reject request ──
  const decideRequest = async (req, decision) => {
    if (decision === 'REJECTED') {
      const reason = window.prompt(`Reason for rejecting "${req.name}":`, '');
      if (reason === null) return;
      try {
        await client.patch(`/api/v1/admin/skills/skill-requests/${req.id}`, {
          status: 'REJECTED',
          adminNote: reason.trim() || null,
        });
      } catch (err) {
        notify?.({ type: 'error', title: 'Rejection failed', message: err?.response?.data?.data?.error || err.message });
        return;
      }
    } else {
      if (!window.confirm(`Approve skill category "${req.name}"? It will be added to the catalog.`)) return;
      try {
        await client.patch(`/api/v1/admin/skills/skill-requests/${req.id}`, { status: 'APPROVED' });
      } catch (err) {
        notify?.({ type: 'error', title: 'Approval failed', message: err?.response?.data?.data?.error || err.message });
        return;
      }
    }
    notify?.({
      type: 'success',
      title: decision === 'APPROVED' ? 'Request approved' : 'Request rejected',
      message: `"${req.name}" ${decision === 'APPROVED' ? 'approved and added' : 'rejected'}.`,
    });
    loadRequests(requestStatus);
    if (decision === 'APPROVED') loadSkills();
  };

  const closeModal = (e) => {
    if (e?.target === e?.currentTarget) {
      setEditingSkill(null);
      setMergingSkill(null);
    }
  };

  const mergeCandidates = useMemo(
    () => skills.filter((s) => s.id !== mergingSkill?.id),
    [skills, mergingSkill],
  );

  return (
    <section className="admin-page">
      <div className="admin-hero" style={{ marginBottom: 0, borderRadius: '0 0 18px 18px' }}>
        <div>
          <p className="admin-eyebrow">Administration</p>
          <h1>Skill Management</h1>
          <p>
            Manage the skill catalog: edit or delete skills, merge duplicates into a single
            canonical entry, and approve new skill categories proposed by users.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs" style={{ marginTop: 18 }}>
        <button type="button" className={`admin-tab${tab === 'skills' ? ' admin-tab--active' : ''}`} onClick={() => setTab('skills')}>
          <Icon name="workspaces" /> Skill Catalog
        </button>
        <button type="button" className={`admin-tab${tab === 'requests' ? ' admin-tab--active' : ''}`} onClick={() => setTab('requests')}>
          <Icon name="task_alt" /> Skill Requests
          {requestsLoading ? null : requests.length > 0 && tab !== 'requests' && (
            <span className="admin-count-badge" style={{ marginLeft: 6 }}>{requests.length}</span>
          )}
        </button>
      </div>

      {/* ═══════════ SKILL CATALOG ═══════════ */}
      {tab === 'skills' && (
        <div className="admin-panel" style={{ padding: 0, marginTop: 0 }}>
          <div className="admin-section-heading" style={{ padding: '16px 22px', borderBottom: '1px solid var(--admin-border)', margin: 0 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>All Skills</h3>
              <p className="admin-text-muted" style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>
                {skills.length} skills in the catalog · {skills.reduce((sum, s) => sum + Number(s.watchers || 0), 0)} total watchers
              </p>
            </div>
            <div className="admin-field-group">
              <div className="admin-search" style={{ minWidth: 220 }}>
                <Icon name="search" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search skills or categories..."
                />
                {search && (
                  <button type="button" className="admin-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                    <Icon name="close" />
                  </button>
                )}
              </div>
              <button type="button" className="admin-refresh-btn" onClick={loadSkills} disabled={loading}>
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Watchers</th>
                  <th>Verif. Tasks</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" style={{ padding: 32, textAlign: 'center', color: 'var(--admin-empty)' }}>Loading...</td></tr>
                ) : filteredSkills.length === 0 ? (
                  <tr><td colSpan="6">
                    <div className="admin-empty-state"><Icon name="workspaces" /><p>No skills found.</p></div>
                  </td></tr>
                ) : (
                  filteredSkills.map((s) => (
                    <tr key={s.id}>
                      <td className="admin-cell-mono">#{s.id}</td>
                      <td><strong>{s.name}</strong></td>
                      <td><span className="admin-status-pill admin-status-pill--released">{s.category || '—'}</span></td>
                      <td>{Number(s.watchers || 0)}</td>
                      <td>{Number(s.verificationTasks || 0)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button type="button" className="admin-action-btn admin-action-cancel" onClick={() => openEdit(s)}>
                            <Icon name="edit" style={{ fontSize: 15 }} /> Edit
                          </button>
                          <button
                            type="button"
                            className="admin-action-btn admin-action-approve"
                            onClick={() => { setMergingSkill(s); setMergeTargetId(''); }}
                            title="Merge this skill into another to remove duplicates"
                          >
                            <Icon name="call_merge" style={{ fontSize: 15 }} /> Merge
                          </button>
                          <button type="button" className="admin-action-btn admin-action-delete" onClick={() => deleteSkill(s)}>
                            <Icon name="delete" /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════ SKILL REQUESTS ═══════════ */}
      {tab === 'requests' && (
        <div className="admin-panel" style={{ padding: 0, marginTop: 0 }}>
          <div className="admin-section-heading" style={{ padding: '16px 22px', borderBottom: '1px solid var(--admin-border)', margin: 0 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem' }}>Skill Category Requests</h3>
              <p className="admin-text-muted" style={{ margin: '4px 0 0', fontSize: '0.8rem' }}>
                Approve proposals to add new skills, or reject them with a reason.
              </p>
            </div>
            <div className="admin-field-group">
              <label className="admin-field" htmlFor="request-status-filter">
                <Icon name="filter_alt" style={{ fontSize: 18 }} /> Status
              </label>
              <select id="request-status-filter" value={requestStatus} onChange={(e) => setRequestStatus(e.target.value)}>
                {REQUEST_STATUSES.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>

          {requestsLoading ? (
            <div className="admin-empty-state"><p>Loading requests...</p></div>
          ) : requests.length === 0 ? (
            <div className="admin-empty-state">
              <Icon name="task_alt" />
              <p>No {requestStatus.toLowerCase()} requests.</p>
            </div>
          ) : (
            <div style={{ padding: 16, display: 'grid', gap: 12 }}>
              {requests.map((req) => (
                <div key={req.id} className="skill-req-card" style={{}}>
                  <div className="skill-req-card__head">
                    <div>
                      <strong className="skill-req-card__name">{req.name}</strong>
                      <span className="admin-status-pill admin-status-pill--released">{req.category}</span>
                    </div>
                    <span className={`admin-status-pill admin-status-pill--${req.status.toLowerCase()}`}>{req.status}</span>
                  </div>
                  <div className="skill-req-card__meta">
                    <span><Icon name="person" style={{ fontSize: 15 }} /> {req.requestedByName || 'Unknown user'}</span>
                    <span><Icon name="calendar_today" style={{ fontSize: 15 }} /> {formatDate(req.createdAt)}</span>
                  </div>
                  {req.adminNote && (
                    <p className="skill-req-card__note"><strong>Admin note:</strong> {req.adminNote}</p>
                  )}
                  {req.status === 'PENDING' && (
                    <div className="admin-verification-actions" style={{ marginTop: 10 }}>
                      <button type="button" className="admin-action-btn admin-action-approve" onClick={() => decideRequest(req, 'APPROVED')}>
                        <Icon name="check" style={{ fontSize: 15 }} /> Approve
                      </button>
                      <button type="button" className="admin-action-btn admin-action-reject" onClick={() => decideRequest(req, 'REJECTED')}>
                        <Icon name="close" style={{ fontSize: 15 }} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Edit modal ── */}
      {editingSkill && (
        <div className="skill-modal-backdrop" onClick={closeModal}>
          <div className="skill-modal" role="dialog" aria-modal="true" aria-label="Edit skill">
            <div className="skill-modal__head">
              <h3>Edit Skill</h3>
              <button type="button" className="skill-modal__close" onClick={() => setEditingSkill(null)} aria-label="Close">
                <Icon name="close" />
              </button>
            </div>
            <div className="skill-modal__body">
              <label className="skill-modal__label" htmlFor="edit-name">Skill name</label>
              <input id="edit-name" className="skill-modal__input" value={editName}
                onChange={(e) => setEditName(e.target.value)} placeholder="e.g. Kubernetes" />
              <label className="skill-modal__label" htmlFor="edit-category">Category</label>
              <input id="edit-category" className="skill-modal__input" value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)} placeholder="e.g. DevOps" />
            </div>
            <div className="skill-modal__foot">
              <button type="button" className="admin-action-btn admin-action-cancel" onClick={() => setEditingSkill(null)}>Cancel</button>
              <button type="button" className="admin-action-btn admin-action-approve" disabled={saving} onClick={saveEdit}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Merge modal ── */}
      {mergingSkill && (
        <div className="skill-modal-backdrop" onClick={closeModal}>
          <div className="skill-modal" role="dialog" aria-modal="true" aria-label="Merge skill">
            <div className="skill-modal__head">
              <h3>Merge Skill</h3>
              <button type="button" className="skill-modal__close" onClick={() => setMergingSkill(null)} aria-label="Close">
                <Icon name="close" />
              </button>
            </div>
            <div className="skill-modal__body">
              <p style={{ margin: '0 0 8px', color: 'var(--admin-muted)', fontSize: '0.85rem' }}>
                Merge <strong>{mergingSkill.name}</strong> into another skill. Watchlists and
                verification tasks will be re-pointed to the target, then the duplicate is removed.
              </p>
              <label className="skill-modal__label" htmlFor="merge-target">Merge into</label>
              <select id="merge-target" className="skill-modal__input" value={mergeTargetId}
                onChange={(e) => setMergeTargetId(e.target.value)}>
                <option value="">Choose target skill...</option>
                {mergeCandidates.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.category})</option>
                ))}
              </select>
            </div>
            <div className="skill-modal__foot">
              <button type="button" className="admin-action-btn admin-action-cancel" onClick={() => setMergingSkill(null)}>Cancel</button>
              <button type="button" className="admin-action-btn admin-action-approve" disabled={saving} onClick={mergeSkill}>
                {saving ? 'Merging...' : 'Merge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
