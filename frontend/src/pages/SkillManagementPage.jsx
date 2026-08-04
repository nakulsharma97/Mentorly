import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Edit3, GitMerge, PlusCircle, Trash2, X } from 'lucide-react';
import client from '../api/client';
import {
  AuBadge,
  AuButton,
  AuEmpty,
  AuPageHeader,
  AuSkeleton,
  AuTable,
  AuToolbar,
  toneFor,
} from '../modules/admin/ui';
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

  const mergeCandidates = useMemo(
    () => skills.filter((s) => s.id !== mergingSkill?.id),
    [skills, mergingSkill],
  );

  return (
    <div className="au au-page">
      <div className="au-inner">
        <AuPageHeader
          crumb={["Admin", "Skills"]}
          title="Skill Management"
          subtitle="Manage the skill catalog: edit or delete skills, merge duplicates into a single canonical entry, and approve new skill categories proposed by users."
        />

        {/* Tabs */}
        <div className="au-card" style={{ padding: 8, display: "flex", gap: 6, flexWrap: "wrap", width: "fit-content" }}>
          <button type="button"
            className={`au-btn au-btn--sm ${tab === "skills" ? "au-btn--primary" : "au-btn--ghost"}`}
            onClick={() => setTab("skills")}>
            <BookOpen size={16} /> Skill Catalog
          </button>
          <button type="button"
            className={`au-btn au-btn--sm ${tab === "requests" ? "au-btn--primary" : "au-btn--ghost"}`}
            onClick={() => setTab("requests")}>
            <PlusCircle size={16} /> Skill Requests
            {requestsLoading ? null : requests.length > 0 && tab !== "requests" && (
              <span className="au-badge au-badge--purple" style={{ marginLeft: 6, height: 22, padding: "0 8px" }}>{requests.length}</span>
            )}
          </button>
        </div>

      {/* ═══════════ SKILL CATALOG ═══════════ */}
      {tab === 'skills' && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <AuToolbar
            search={search}
            onSearchChange={setSearch}
            placeholder="Search skills or categories..."
            actions={[{ label: "Refresh", icon: "download", disabled: loading, onClick: loadSkills }]}
            count={`${skills.length} skills · ${skills.reduce((sum, s) => sum + Number(s.watchers || 0), 0)} watchers`}
          />

          {loading ? (
            <AuSkeleton rows={6} label="Loading skills" />
          ) : filteredSkills.length === 0 ? (
            <div className="au-table-card">
              <AuEmpty icon={BookOpen} title="No skills found" description="Try a different search term." />
            </div>
          ) : (
            <AuTable
              columns={[
                { key: "id", label: "ID" },
                { key: "name", label: "Name" },
                { key: "category", label: "Category" },
                { key: "watchers", label: "Watchers" },
                { key: "tasks", label: "Verif. Tasks" },
                { key: "actions", label: "Actions", style: { textAlign: "right" } },
              ]}
              busy={loading}
            >
              {filteredSkills.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 700, color: "var(--au-primary-dark)" }}>#{s.id}</td>
                  <td><strong>{s.name}</strong></td>
                  <td><AuBadge tone="green">{s.category || "—"}</AuBadge></td>
                  <td>{Number(s.watchers || 0)}</td>
                  <td>{Number(s.verificationTasks || 0)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <button type="button" className="au-btn au-btn--ghost au-btn--sm" onClick={() => openEdit(s)}>
                        <Edit3 size={15} /> Edit
                      </button>
                      <button type="button" className="au-btn au-btn--outline au-btn--sm" onClick={() => { setMergingSkill(s); setMergeTargetId(""); }} title="Merge this skill into another to remove duplicates">
                        <GitMerge size={15} /> Merge
                      </button>
                      <button type="button" className="au-btn au-btn--danger au-btn--sm" onClick={() => deleteSkill(s)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </AuTable>
          )}
        </div>
      )}

      {/* ═══════════ SKILL REQUESTS ═══════════ */}
      {tab === 'requests' && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <AuToolbar
            search=""
            onSearchChange={() => {}}
            placeholder=""
            selects={[{
              label: "Filter by request status",
              value: requestStatus,
              onChange: setRequestStatus,
              options: REQUEST_STATUSES.map((status) => ({ value: status, label: status })),
            }]}
            count={`${requests.length} requests`}
          />

          {requestsLoading ? (
            <AuSkeleton rows={4} label="Loading requests" />
          ) : requests.length === 0 ? (
            <div className="au-table-card">
              <AuEmpty icon={PlusCircle} title={`No ${requestStatus.toLowerCase()} requests`} description="Approve proposals to add new skills, or reject them with a reason." />
            </div>
          ) : (
            <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
              {requests.map((req) => (
                <motion.div
                  key={req.id}
                  className="au-card"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                    <div>
                      <strong style={{ fontSize: 16 }}>{req.name}</strong>
                      <div style={{ marginTop: 6 }}><AuBadge tone="green">{req.category}</AuBadge></div>
                    </div>
                    <AuBadge tone={toneFor(req.status)} dot>{req.status}</AuBadge>
                  </div>
                  <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--au-text-2)" }}>
                    Requested by {req.requestedByName || "Unknown user"} · {formatDate(req.createdAt)}
                  </p>
                  {req.adminNote && (
                    <p style={{ margin: "0 0 12px", padding: 10, borderRadius: 10, background: "var(--au-hover)", fontSize: 13, color: "var(--au-text-2)" }}>
                      <strong>Admin note:</strong> {req.adminNote}
                    </p>
                  )}
                  {req.status === "PENDING" && (
                    <div style={{ display: "flex", gap: 10 }}>
                      <AuButton size="sm" variant="success" onClick={() => decideRequest(req, "APPROVED")}>Approve</AuButton>
                      <AuButton size="sm" variant="danger" onClick={() => decideRequest(req, "REJECTED")}>Reject</AuButton>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Edit modal ── */}
      {editingSkill && (
        <motion.div className="au-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setEditingSkill(null); }} role="presentation">
          <motion.div className="au-modal" role="dialog" aria-modal="true" aria-label="Edit skill"
            initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Edit Skill</h3>
              <button type="button" className="au-icon-btn" onClick={() => setEditingSkill(null)} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="au-modal__body">
              <label className="au-field" htmlFor="edit-name">
                <span className="au-field__label">Skill name</span>
                <input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="e.g. Kubernetes" />
              </label>
              <label className="au-field" htmlFor="edit-category" style={{ marginTop: 12 }}>
                <span className="au-field__label">Category</span>
                <input id="edit-category" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} placeholder="e.g. DevOps" />
              </label>
            </div>
            <div className="au-modal__foot">
              <AuButton onClick={() => setEditingSkill(null)}>Cancel</AuButton>
              <AuButton variant="primary" disabled={saving} onClick={saveEdit}>{saving ? "Saving..." : "Save"}</AuButton>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* ── Merge modal ── */}
      {mergingSkill && (
        <motion.div className="au-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) setMergingSkill(null); }} role="presentation">
          <motion.div className="au-modal" role="dialog" aria-modal="true" aria-label="Merge skill"
            initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>Merge Skill</h3>
              <button type="button" className="au-icon-btn" onClick={() => setMergingSkill(null)} aria-label="Close"><X size={18} /></button>
            </div>
            <div className="au-modal__body">
              <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--au-text-2)" }}>
                Merge <strong style={{ color: "var(--au-text)" }}>{mergingSkill.name}</strong> into another skill. Watchlists and
                verification tasks will be re-pointed to the target, then the duplicate is removed.
              </p>
              <label className="au-field" htmlFor="merge-target">
                <span className="au-field__label">Merge into</span>
                <select id="merge-target" value={mergeTargetId} onChange={(e) => setMergeTargetId(e.target.value)}>
                  <option value="">Choose target skill...</option>
                  {mergeCandidates.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.category})</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="au-modal__foot">
              <AuButton onClick={() => setMergingSkill(null)}>Cancel</AuButton>
              <AuButton variant="primary" disabled={saving} onClick={mergeSkill}>{saving ? "Merging..." : "Merge"}</AuButton>
            </div>
          </motion.div>
        </motion.div>
      )}
      </div>
    </div>
  );
}
