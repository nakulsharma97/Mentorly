import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listMyProjects,
  createProject,
  updateProject,
  deleteProject,
} from "../../api/projects";
import { getApiErrorMessage } from "../../utils/apiErrors";
import "./MentorCertifications.css";

const EMPTY_FORM = {
  title: "",
  description: "",
  technologies: "",
  role: "",
  githubUrl: "",
  liveDemoUrl: "",
  imageUrls: "",
  startDate: "",
  endDate: "",
  currentlyWorking: false,
};

const toFormState = (project) => ({
  title: project.title || "",
  description: project.description || "",
  technologies: project.technologies || "",
  role: project.role || "",
  githubUrl: project.githubUrl || "",
  liveDemoUrl: project.liveDemoUrl || "",
  imageUrls: project.imageUrls || "",
  startDate: project.startDate ? String(project.startDate).slice(0, 10) : "",
  endDate: project.endDate ? String(project.endDate).slice(0, 10) : "",
  currentlyWorking: Boolean(project.currentlyWorking),
});

const buildPayload = (form) => ({
  title: form.title.trim(),
  description: form.description.trim(),
  technologies: form.technologies.trim(),
  role: form.role.trim() || null,
  githubUrl: form.githubUrl.trim() || null,
  liveDemoUrl: form.liveDemoUrl.trim() || null,
  imageUrls: form.imageUrls.trim() || null,
  startDate: form.startDate || null,
  endDate: form.currentlyWorking ? null : (form.endDate || null),
  currentlyWorking: form.currentlyWorking,
});

const validate = (form) => {
  if (!form.title.trim()) return "Project title is required.";
  if (!form.description.trim()) return "Project description is required.";
  if (!form.technologies.trim()) return "Technologies used are required.";
  if (!form.startDate) return "Start date is required.";
  if (!form.currentlyWorking && form.endDate && form.endDate < form.startDate) {
    return "End date must be after the start date.";
  }
  for (const field of ["githubUrl", "liveDemoUrl"]) {
    const url = form[field].trim();
    if (url && !/^https?:\/\//i.test(url)) {
      return `${field === "githubUrl" ? "GitHub URL" : "Live demo URL"} must start with http:// or https://`;
    }
  }
  return "";
};

/** Split comma/newline separated technologies into an array. */
const toTechList = (raw) =>
  String(raw || "")
    .split(/[,\n]/)
    .map((t) => t.trim())
    .filter(Boolean);

export default function MentorProjectsManager({ notify, readonly, onCountChange }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [formTouched, setFormTouched] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [techInput, setTechInput] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listMyProjects();
      setProjects(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load projects."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
    setFormError("");
    setFormTouched({});
    setTechInput("");
  };

  const startAdd = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError("");
    setFormTouched({});
    setShowForm(true);
  };

  const startEdit = (project) => {
    setForm(toFormState(project));
    setEditingId(project.id);
    setFormError("");
    setFormTouched({});
    setShowForm(true);
  };

  const setField = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleBlur = (field) => () => {
    setFormTouched((prev) => ({ ...prev, [field]: true }));
  };

  const addTech = () => {
    const trimmed = techInput.trim();
    if (!trimmed) return;
    const current = toTechList(form.technologies);
    if (current.some((t) => t.toLowerCase() === trimmed.toLowerCase())) return;
    setForm((prev) => ({ ...prev, technologies: [...current, trimmed].join(", ") }));
    setTechInput("");
  };

  const removeTech = (tech) => {
    const next = toTechList(form.technologies).filter((t) => t !== tech);
    setForm((prev) => ({ ...prev, technologies: next.join(", ") }));
  };

  const handleTechKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTech();
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validate(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = buildPayload(form);
      if (editingId) {
        await updateProject(editingId, payload);
      } else {
        await createProject(payload);
      }
      notify?.({
        type: "success",
        title: editingId ? "Project updated" : "Project added",
        message: payload.title,
      });
      resetForm();
      await load();
    } catch (err) {
      setFormError(getApiErrorMessage(err, "Could not save project."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (project) => {
    if (typeof window !== "undefined" && !window.confirm(`Delete "${project.title}"?`)) return;
    setDeletingId(project.id);
    try {
      await deleteProject(project.id);
      notify?.({ type: "info", title: "Project deleted", message: project.title });
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not delete project."));
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    onCountChange?.(projects.length);
  }, [projects.length, onCountChange]);

  const formErrors = useMemo(() => {
    const errs = {};
    if (formTouched.title && !form.title.trim()) errs.title = "Required";
    if (formTouched.description && !form.description.trim()) errs.description = "Required";
    if (formTouched.technologies && !form.technologies.trim()) errs.technologies = "Required";
    if (formTouched.startDate && !form.startDate) errs.startDate = "Required";
    return errs;
  }, [form, formTouched]);

  const formatDate = (d) => {
    if (!d) return "";
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return String(d).slice(0, 10);
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short" });
  };

  if (loading) {
    return (
      <section className="mcm-shell">
        <div className="mcm-loading">
          <div className="mcm-loading__spinner" />
          <p>Loading projects…</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mcm-shell">
        <div className="mcm-error">
          <span className="material-symbols-outlined">error_outline</span>
          <p>{error}</p>
          <button type="button" className="mcm-btn mcm-btn--primary mcm-btn--sm" onClick={load}>
            Try Again
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mcm-shell mcm-card">
      {/* ── Header ── */}
      <div className="mcm-card__head">
        <div className="mcm-card__head-content">
          <h3 className="mcm-card__title">
            <span className="material-symbols-outlined">folder_open</span>
            Projects
          </h3>
          <p className="mcm-card__subtitle">Showcase your best work — this is optional and never affects profile completion.</p>
        </div>
        {!showForm && !readonly && (
          <button type="button" className="mcm-btn mcm-btn--primary mcm-btn--sm" onClick={startAdd}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
            Add Project
          </button>
        )}
      </div>

      {/* ── Add/Edit Form Modal ── */}
      {showForm && (
        <div className="mcm-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !saving) resetForm(); }}>
          <div className="mcm-modal" role="dialog" aria-label={editingId ? "Edit project" : "Add project"}>
            <div className="mcm-modal__head">
              <h3>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>folder_open</span>
                {editingId ? "Edit Project" : "Add Project"}
              </h3>
              <button type="button" className="mcm-modal__close" onClick={resetForm} aria-label="Close" disabled={saving}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form className="mcm-form" onSubmit={handleSubmit}>
              {formError && <div className="mcm-form__error"><span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>{formError}</div>}

              <div className="mcm-form__field">
                <label className="mcm-form__label">Project Title *</label>
                <input
                  className={`mcm-form__input ${formErrors.title ? "mcm-form__input--error" : ""}`}
                  type="text"
                  value={form.title}
                  onChange={setField("title")}
                  onBlur={handleBlur("title")}
                  placeholder="e.g. SkillSwap — Mentor Marketplace"
                  maxLength={500}
                />
                {formErrors.title && <span className="mcm-form__field-error">Required</span>}
              </div>

              <div className="mcm-form__field">
                <label className="mcm-form__label">Description *</label>
                <textarea
                  className={`mcm-form__input mcm-form__input--textarea ${formErrors.description ? "mcm-form__input--error" : ""}`}
                  rows={3}
                  value={form.description}
                  onChange={setField("description")}
                  onBlur={handleBlur("description")}
                  placeholder="What did you build, and what problem does it solve?"
                />
                {formErrors.description && <span className="mcm-form__field-error">Required</span>}
              </div>

              <div className="mcm-form__field">
                <label className="mcm-form__label">Technologies Used *</label>
                <div className="mcm-form__skill-input">
                  <input
                    className="mcm-form__input"
                    type="text"
                    value={techInput}
                    onChange={(e) => setTechInput(e.target.value)}
                    onKeyDown={handleTechKeyDown}
                    placeholder="Type a technology and press Enter..."
                  />
                  <button type="button" className="mcm-btn mcm-btn--outline mcm-btn--sm" onClick={addTech} disabled={!techInput.trim()}>
                    Add
                  </button>
                </div>
                {toTechList(form.technologies).length > 0 ? (
                  <div className="mcm-form__chips">
                    {toTechList(form.technologies).map((tech) => (
                      <span key={tech} className="mcm-chip">
                        {tech}
                        <button type="button" className="mcm-chip__remove" onClick={() => removeTech(tech)} aria-label={`Remove ${tech}`}>
                          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="mcm-form__field-error" style={formErrors.technologies ? undefined : { color: "transparent" }}>
                    {formErrors.technologies ? "Required" : "."}
                  </span>
                )}
              </div>

              <div className="mcm-form__row">
                <div className="mcm-form__field">
                  <label className="mcm-form__label">Your Role</label>
                  <input
                    className="mcm-form__input"
                    type="text"
                    value={form.role}
                    onChange={setField("role")}
                    placeholder="e.g. Full Stack Developer, Project Lead"
                    maxLength={200}
                  />
                </div>
                <div className="mcm-form__field">
                  <label className="mcm-form__label">Project Images (URLs)</label>
                  <input
                    className="mcm-form__input"
                    type="text"
                    value={form.imageUrls}
                    onChange={setField("imageUrls")}
                    placeholder="Comma-separated image URLs (optional)"
                  />
                </div>
              </div>

              <div className="mcm-form__row">
                <div className="mcm-form__field">
                  <label className="mcm-form__label">GitHub URL</label>
                  <input
                    className="mcm-form__input"
                    type="url"
                    value={form.githubUrl}
                    onChange={setField("githubUrl")}
                    onBlur={handleBlur("githubUrl")}
                    placeholder="https://github.com/username/repo"
                  />
                </div>
                <div className="mcm-form__field">
                  <label className="mcm-form__label">Live Demo URL</label>
                  <input
                    className="mcm-form__input"
                    type="url"
                    value={form.liveDemoUrl}
                    onChange={setField("liveDemoUrl")}
                    onBlur={handleBlur("liveDemoUrl")}
                    placeholder="https://your-project.vercel.app"
                  />
                </div>
              </div>

              <div className="mcm-form__row">
                <div className="mcm-form__field">
                  <label className="mcm-form__label">Start Date *</label>
                  <input
                    className={`mcm-form__input mcm-form__input--date ${formErrors.startDate ? "mcm-form__input--error" : ""}`}
                    type="date"
                    value={form.startDate}
                    onChange={setField("startDate")}
                    onBlur={handleBlur("startDate")}
                  />
                  {formErrors.startDate && <span className="mcm-form__field-error">Required</span>}
                </div>
                <div className="mcm-form__field">
                  <label className="mcm-form__label">End Date</label>
                  <input
                    className="mcm-form__input mcm-form__input--date"
                    type="date"
                    value={form.endDate}
                    onChange={setField("endDate")}
                    disabled={form.currentlyWorking}
                  />
                </div>
              </div>

              <label className="mcm-form__checkbox">
                <input
                  type="checkbox"
                  checked={form.currentlyWorking}
                  onChange={setField("currentlyWorking")}
                />
                <span>I am currently working on this project</span>
              </label>

              <div className="mcm-form__actions">
                <button type="button" className="mcm-btn mcm-btn--ghost" onClick={resetForm} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="mcm-btn mcm-btn--primary" disabled={saving}>
                  {saving ? "Saving…" : editingId ? "Save Changes" : "Add Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Project List / Empty State ── */}
      {projects.length === 0 ? (
        !showForm && (
          <div className="mcm-empty">
            <div className="mcm-empty__icon">
              <span className="material-symbols-outlined">folder_open</span>
            </div>
            <h4 className="mcm-empty__title">No Projects Added Yet</h4>
            <p className="mcm-empty__desc">Share your portfolio projects to help learners understand your expertise.</p>
            {!readonly && (
              <button type="button" className="mcm-btn mcm-btn--primary" onClick={startAdd}>
                <span className="material-symbols-outlined">add</span>
                Add Project
              </button>
            )}
          </div>
        )
      ) : (
        <div className="mcm-grid">
          {projects.map((project) => {
            const isExpanded = expandedId === project.id;
            const techs = toTechList(project.technologies);
            return (
              <div key={project.id} className={`mcm-card-item ${isExpanded ? "mcm-card-item--expanded" : ""}`}>
                <div className="mcm-card-item__top">
                  <div className="mcm-card-item__logo-wrap">
                    <div className="mcm-card-item__logo-fallback" style={{ display: "flex" }}>
                      <span className="material-symbols-outlined">folder_open</span>
                    </div>
                  </div>
                  <div className="mcm-card-item__info">
                    <h4 className="mcm-card-item__name">{project.title}</h4>
                    <p className="mcm-card-item__org">{project.description}</p>
                    <div className="mcm-card-item__meta">
                      {project.role && <span>{project.role}</span>}
                      <span>{formatDate(project.startDate)}</span>
                      {project.currentlyWorking ? (
                        <span> · Present</span>
                      ) : project.endDate ? (
                        <span> · {formatDate(project.endDate)}</span>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="mcm-card-item__expand"
                    onClick={() => setExpandedId(isExpanded ? null : project.id)}
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                  >
                    <span className="material-symbols-outlined">{isExpanded ? "expand_less" : "expand_more"}</span>
                  </button>
                </div>

                {isExpanded && (
                  <div className="mcm-card-item__details">
                    {techs.length > 0 && (
                      <div className="mcm-detail-row">
                        <span className="mcm-detail-row__label">Tech Stack</span>
                        <div className="mcm-detail-row__chips">
                          {techs.slice(0, 8).map((tech) => (
                            <span key={tech} className="mcm-chip mcm-chip--sm">{tech}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {(project.githubUrl || project.liveDemoUrl) && (
                      <div className="mcm-detail-row">
                        <span className="mcm-detail-row__label">Links</span>
                        <div className="mcm-detail-row__chips">
                          {project.githubUrl && (
                            <a className="mcm-detail-row__value--link" href={project.githubUrl} target="_blank" rel="noopener noreferrer">
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>code</span> GitHub
                            </a>
                          )}
                          {project.liveDemoUrl && (
                            <a className="mcm-detail-row__value--link" href={project.liveDemoUrl} target="_blank" rel="noopener noreferrer">
                              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span> Live Demo
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                    {!readonly && (
                      <div className="mcm-card-item__actions">
                        <button type="button" className="mcm-btn mcm-btn--outline mcm-btn--sm" onClick={() => startEdit(project)}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span> Edit
                        </button>
                        <button
                          type="button"
                          className="mcm-btn mcm-btn--danger mcm-btn--sm"
                          onClick={() => handleDelete(project)}
                          disabled={deletingId === project.id}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                          {deletingId === project.id ? "Deleting…" : "Remove"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
