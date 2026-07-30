import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listMyCertifications,
  createCertification,
  updateCertification,
  deleteCertification,
} from "../../api/certifications";
import { getApiErrorMessage } from "../../utils/apiErrors";
import "./MentorCertifications.css";

const EMPTY_FORM = {
  certificationName: "",
  issuingOrganization: "",
  credentialId: "",
  credentialUrl: "",
  issueDate: "",
  expirationDate: "",
  doesNotExpire: false,
  skillsCovered: "",
  description: "",
  certificateImage: "",
};

const DEFAULT_SKILLS = [
  "JavaScript", "React", "Node.js", "Python", "AWS", "Docker",
  "Kubernetes", "TypeScript", "Java", "Go", "SQL", "MongoDB",
];

const toFormState = (cert) => ({
  certificationName: cert.certificationName || "",
  issuingOrganization: cert.issuingOrganization || "",
  credentialId: cert.credentialId || "",
  credentialUrl: cert.credentialUrl || "",
  issueDate: cert.issueDate ? String(cert.issueDate).slice(0, 10) : "",
  expirationDate: cert.expirationDate ? String(cert.expirationDate).slice(0, 10) : "",
  doesNotExpire: cert.doesNotExpire || false,
  skillsCovered: cert.skillsCovered || "",
  description: cert.description || "",
  certificateImage: cert.certificateImage || "",
});

const buildPayload = (form) => ({
  certificationName: form.certificationName.trim(),
  issuingOrganization: form.issuingOrganization.trim(),
  credentialId: form.credentialId.trim() || null,
  credentialUrl: form.credentialUrl.trim() || null,
  issueDate: form.issueDate || null,
  expirationDate: form.doesNotExpire ? null : (form.expirationDate || null),
  doesNotExpire: form.doesNotExpire,
  skillsCovered: form.skillsCovered.trim() || null,
  description: form.description.trim() || null,
  certificateImage: form.certificateImage.trim() || null,
});

const validate = (form) => {
  if (!form.certificationName.trim()) return "Certification name is required.";
  if (!form.issuingOrganization.trim()) return "Issuing organization is required.";
  if (!form.issueDate) return "Issue date is required.";
  if (!form.doesNotExpire && form.expirationDate && form.expirationDate < form.issueDate) {
    return "Expiration date must be after the issue date.";
  }
  if (form.credentialUrl.trim()) {
    const url = form.credentialUrl.trim().toLowerCase();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return "Credential URL must start with http:// or https://";
    }
  }
  return "";
};

/** Parse skills string into array */
const parseSkills = (raw) => {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
};

/** Serialize skills array to comma-separated string */
const serializeSkills = (skills) => Array.isArray(skills) ? skills.join(", ") : skills || "";

export default function MentorCertificationsManager({ mentorId, notify, readonly, onCountChange }) {
  const [certifications, setCertifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [formTouched, setFormTouched] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [skillInput, setSkillInput] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [imagePreviewError, setImagePreviewError] = useState({});

  const load = useCallback(async () => {
    if (!mentorId) return;
    setLoading(true);
    setError("");
    try {
      const data = await listMyCertifications();
      setCertifications(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load certifications."));
    } finally {
      setLoading(false);
    }
  }, [mentorId]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
    setFormError("");
    setFormTouched({});
    setSkillInput("");
  };

  const startAdd = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError("");
    setFormTouched({});
    setShowForm(true);
  };

  const startEdit = (cert) => {
    setForm(toFormState(cert));
    setEditingId(cert.id);
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

  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (!trimmed) return;
    const currentSkills = parseSkills(form.skillsCovered);
    if (currentSkills.includes(trimmed)) return;
    setForm((prev) => ({ ...prev, skillsCovered: serializeSkills([...currentSkills, trimmed]) }));
    setSkillInput("");
  };

  const removeSkill = (skill) => {
    const currentSkills = parseSkills(form.skillsCovered);
    setForm((prev) => ({ ...prev, skillsCovered: serializeSkills(currentSkills.filter((s) => s !== skill)) }));
  };

  const handleSkillKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); addSkill(); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(file.type)) {
      setFormError("Only PDF, JPG, and PNG files are allowed.");
      return;
    }
    // Convert to base64 data URL for preview
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm((prev) => ({ ...prev, certificateImage: ev.target?.result || "" }));
    };
    reader.readAsDataURL(file);
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
        await updateCertification(editingId, payload);
      } else {
        await createCertification(payload);
      }
      notify?.({
        type: "success",
        title: editingId ? "Certification updated" : "Certification added",
        message: payload.certificationName,
      });
      resetForm();
      await load();
    } catch (err) {
      setFormError(getApiErrorMessage(err, "Could not save certification."));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cert) => {
    if (typeof window !== "undefined" && !window.confirm(`Delete "${cert.certificationName}"?`)) return;
    setDeletingId(cert.id);
    try {
      await deleteCertification(cert.id);
      notify?.({ type: "info", title: "Certification deleted", message: cert.certificationName });
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not delete certification."));
    } finally {
      setDeletingId(null);
    }
  };

  // Report certification count to parent whenever it changes
  useEffect(() => {
    onCountChange?.(certifications.length);
  }, [certifications.length, onCountChange]);

  const formErrors = useMemo(() => {
    const errs = {};
    if (formTouched.certificationName && !form.certificationName.trim()) errs.certificationName = "Required";
    if (formTouched.issuingOrganization && !form.issuingOrganization.trim()) errs.issuingOrganization = "Required";
    if (formTouched.issueDate && !form.issueDate) errs.issueDate = "Required";
    return errs;
  }, [form, formTouched]);

  if (loading) {
    return (
      <section className="mcm-shell">
        <div className="mcm-loading">
          <div className="mcm-loading__spinner" />
          <p>Loading certifications…</p>
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
            <span className="material-symbols-outlined">workspace_premium</span>
            Professional Certifications
          </h3>
          <p className="mcm-card__subtitle">Add your verified credentials to build learner trust.</p>
        </div>
        {!showForm && !readonly && (
          <button type="button" className="mcm-btn mcm-btn--primary mcm-btn--sm" onClick={startAdd}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
            Add Certification
          </button>
        )}
      </div>

      {/* ── Add/Edit Form Modal ── */}
      {showForm && (
        <div className="mcm-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !saving) resetForm(); }}>
          <div className="mcm-modal" role="dialog" aria-label={editingId ? "Edit certification" : "Add certification"}>
            <div className="mcm-modal__head">
              <h3>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>workspace_premium</span>
                {editingId ? "Edit Certification" : "Add Certification"}
              </h3>
              <button type="button" className="mcm-modal__close" onClick={resetForm} aria-label="Close" disabled={saving}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form className="mcm-form" onSubmit={handleSubmit}>
              {formError && <div className="mcm-form__error"><span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>{formError}</div>}

              <div className="mcm-form__row">
                <div className="mcm-form__field">
                  <label className="mcm-form__label">Certification Name *</label>
                  <input
                    className={`mcm-form__input ${formErrors.certificationName ? "mcm-form__input--error" : ""}`}
                    type="text"
                    value={form.certificationName}
                    onChange={setField("certificationName")}
                    onBlur={handleBlur("certificationName")}
                    placeholder="e.g. AWS Certified Solutions Architect"
                    maxLength={500}
                  />
                  {formErrors.certificationName && <span className="mcm-form__field-error">Required</span>}
                </div>
                <div className="mcm-form__field">
                  <label className="mcm-form__label">Issuing Organization *</label>
                  <input
                    className={`mcm-form__input ${formErrors.issuingOrganization ? "mcm-form__input--error" : ""}`}
                    type="text"
                    value={form.issuingOrganization}
                    onChange={setField("issuingOrganization")}
                    onBlur={handleBlur("issuingOrganization")}
                    placeholder="e.g. Amazon Web Services"
                    maxLength={500}
                  />
                  {formErrors.issuingOrganization && <span className="mcm-form__field-error">Required</span>}
                </div>
              </div>

              <div className="mcm-form__row">
                <div className="mcm-form__field">
                  <label className="mcm-form__label">Credential ID</label>
                  <input
                    className="mcm-form__input"
                    type="text"
                    value={form.credentialId}
                    onChange={setField("credentialId")}
                    placeholder="e.g. AWS-12345-ABCDE"
                  />
                </div>
                <div className="mcm-form__field">
                  <label className="mcm-form__label">Credential URL</label>
                  <input
                    className="mcm-form__input"
                    type="url"
                    value={form.credentialUrl}
                    onChange={setField("credentialUrl")}
                    onBlur={handleBlur("credentialUrl")}
                    placeholder="https://credential.example.com/verify"
                  />
                </div>
              </div>

              <div className="mcm-form__row">
                <div className="mcm-form__field">
                  <label className="mcm-form__label">Issue Date *</label>
                  <input
                    className={`mcm-form__input mcm-form__input--date ${formErrors.issueDate ? "mcm-form__input--error" : ""}`}
                    type="date"
                    value={form.issueDate}
                    onChange={setField("issueDate")}
                    onBlur={handleBlur("issueDate")}
                  />
                  {formErrors.issueDate && <span className="mcm-form__field-error">Required</span>}
                </div>
                <div className="mcm-form__field">
                  <label className="mcm-form__label">Expiration Date</label>
                  <input
                    className="mcm-form__input mcm-form__input--date"
                    type="date"
                    value={form.expirationDate}
                    onChange={setField("expirationDate")}
                    disabled={form.doesNotExpire}
                  />
                </div>
              </div>

              <label className="mcm-form__checkbox">
                <input
                  type="checkbox"
                  checked={form.doesNotExpire}
                  onChange={setField("doesNotExpire")}
                />
                <span>This credential does not expire</span>
              </label>

              <div className="mcm-form__field">
                <label className="mcm-form__label">Skills Covered</label>
                <div className="mcm-form__skill-input">
                  <input
                    className="mcm-form__input"
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={handleSkillKeyDown}
                    placeholder="Type a skill and press Enter..."
                    list="mcm-skill-suggestions"
                  />
                  <datalist id="mcm-skill-suggestions">
                    {DEFAULT_SKILLS.filter(s => !parseSkills(form.skillsCovered).includes(s)).map(s => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                  <button type="button" className="mcm-btn mcm-btn--outline mcm-btn--sm" onClick={addSkill} disabled={!skillInput.trim()}>
                    Add
                  </button>
                </div>
                {parseSkills(form.skillsCovered).length > 0 && (
                  <div className="mcm-form__chips">
                    {parseSkills(form.skillsCovered).map((skill) => (
                      <span key={skill} className="mcm-chip">
                        {skill}
                        <button type="button" className="mcm-chip__remove" onClick={() => removeSkill(skill)} aria-label={`Remove ${skill}`}>
                          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mcm-form__field">
                <label className="mcm-form__label">Description</label>
                <textarea
                  className="mcm-form__input mcm-form__input--textarea"
                  rows={3}
                  value={form.description}
                  onChange={setField("description")}
                  placeholder="Brief description of what this certification covers..."
                />
              </div>

              <div className="mcm-form__field">
                <label className="mcm-form__label">Certificate Image / Upload</label>
                <div className="mcm-form__upload">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileUpload}
                    className="mcm-form__file-input"
                    id="mcm-cert-upload"
                  />
                  <label htmlFor="mcm-cert-upload" className="mcm-form__file-label">
                    <span className="material-symbols-outlined">cloud_upload</span>
                    <span>Choose file (PDF, JPG, PNG)</span>
                  </label>
                </div>
                {form.certificateImage && (
                  <div className="mcm-form__preview">
                    {form.certificateImage.startsWith("data:image/") ? (
                      <img src={form.certificateImage} alt="Certificate preview" className="mcm-form__preview-img" />
                    ) : form.certificateImage.startsWith("data:application/pdf") ? (
                      <div className="mcm-form__preview-pdf">
                        <span className="material-symbols-outlined" style={{ fontSize: 32, color: "#dc2626" }}>picture_as_pdf</span>
                        <span>PDF document uploaded</span>
                      </div>
                    ) : (
                      <div className="mcm-form__preview-url">
                        <img src={form.certificateImage} alt="Certificate" className="mcm-form__preview-img" onError={(e) => { e.target.style.display = "none"; }} />
                        <a href={form.certificateImage} target="_blank" rel="noopener noreferrer" className="mcm-btn mcm-btn--outline mcm-btn--sm">View</a>
                      </div>
                    )}
                    <button type="button" className="mcm-form__preview-remove" onClick={() => setForm((prev) => ({ ...prev, certificateImage: "" }))}>
                      <span className="material-symbols-outlined">delete</span> Remove
                    </button>
                  </div>
                )}
              </div>

              <div className="mcm-form__actions">
                <button type="button" className="mcm-btn mcm-btn--ghost" onClick={resetForm} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="mcm-btn mcm-btn--primary" disabled={saving}>
                  {saving ? "Saving…" : editingId ? "Save Changes" : "Add Certification"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Certification List / Empty State ── */}
      {certifications.length === 0 ? (
        !showForm && (
          <div className="mcm-empty">
            <div className="mcm-empty__icon">
              <span className="material-symbols-outlined">workspace_premium</span>
            </div>
            <h4 className="mcm-empty__title">No Certifications Added Yet</h4>
            <p className="mcm-empty__desc">Show your verified credentials to build learner trust.</p>
            {!readonly && (
              <button type="button" className="mcm-btn mcm-btn--primary" onClick={startAdd}>
                <span className="material-symbols-outlined">add</span>
                Add Certification
              </button>
            )}
          </div>
        )
      ) : (
        <div className="mcm-grid">
          {certifications.map((cert) => {
            const isExpanded = expandedId === cert.id;
            const skills = parseSkills(cert.skillsCovered);
            return (
              <div key={cert.id} className={`mcm-card-item ${isExpanded ? "mcm-card-item--expanded" : ""}`}>
                <div className="mcm-card-item__top">
                  <div className="mcm-card-item__logo-wrap">
                    {cert.certificateImage ? (
                      <img
                        src={cert.certificateImage}
                        alt={`${cert.issuingOrganization} logo`}
                        className="mcm-card-item__logo"
                        onError={(e) => { e.target.style.display = "none"; e.target.nextElementSibling.style.display = "flex"; }}
                      />
                    ) : null}
                    <div className="mcm-card-item__logo-fallback" style={{ display: cert.certificateImage ? "none" : "flex" }}>
                      <span className="material-symbols-outlined">workspace_premium</span>
                    </div>
                  </div>
                  <div className="mcm-card-item__info">
                    <h4 className="mcm-card-item__name">{cert.certificationName}</h4>
                    <p className="mcm-card-item__org">{cert.issuingOrganization}</p>
                    <div className="mcm-card-item__meta">
                      {cert.issueDate && <span>Issued {formatDate(cert.issueDate)}</span>}
                      {!cert.doesNotExpire && cert.expirationDate && (
                        <span> · Expires {formatDate(cert.expirationDate)}</span>
                      )}
                      {cert.doesNotExpire && <span> · No expiration</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="mcm-card-item__expand"
                    onClick={() => setExpandedId(isExpanded ? null : cert.id)}
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                  >
                    <span className="material-symbols-outlined">{isExpanded ? "expand_less" : "expand_more"}</span>
                  </button>
                </div>

                {/* Expandable details */}
                {isExpanded && (
                  <div className="mcm-card-item__details">
                    {cert.credentialId && (
                      <div className="mcm-detail-row">
                        <span className="mcm-detail-row__label">Credential ID</span>
                        <span className="mcm-detail-row__value">{cert.credentialId}</span>
                      </div>
                    )}
                    {cert.credentialUrl && (
                      <div className="mcm-detail-row">
                        <span className="mcm-detail-row__label">Credential URL</span>
                        <a href={cert.credentialUrl} target="_blank" rel="noopener noreferrer" className="mcm-detail-row__value mcm-detail-row__value--link">
                          View Credential <span className="material-symbols-outlined" style={{ fontSize: 14 }}>open_in_new</span>
                        </a>
                      </div>
                    )}
                    {cert.description && (
                      <div className="mcm-detail-row">
                        <span className="mcm-detail-row__label">Description</span>
                        <p className="mcm-detail-row__value">{cert.description}</p>
                      </div>
                    )}
                    {skills.length > 0 && (
                      <div className="mcm-detail-row">
                        <span className="mcm-detail-row__label">Skills</span>
                        <div className="mcm-detail-row__chips">
                          {skills.map((skill) => (
                            <span key={skill} className="mcm-chip mcm-chip--sm">{skill}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {cert.certificateImage && (
                      <div className="mcm-detail-row">
                        <span className="mcm-detail-row__label">Certificate</span>
                        <div className="mcm-detail-row__cert">
                          {cert.certificateImage.startsWith("data:image/") || cert.certificateImage.match(/\.(jpg|jpeg|png|webp)(\?.*)?$/i) ? (
                            <img src={cert.certificateImage} alt="Certificate" className="mcm-detail-row__cert-img" />
                          ) : (
                            <a href={cert.certificateImage} target="_blank" rel="noopener noreferrer" className="mcm-btn mcm-btn--outline mcm-btn--sm">
                              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
                              Download Certificate
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {!readonly && (
                      <div className="mcm-card-item__actions">
                        <button type="button" className="mcm-btn mcm-btn--ghost mcm-btn--sm" onClick={() => startEdit(cert)}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="mcm-btn mcm-btn--ghost mcm-btn--sm mcm-btn--danger"
                          onClick={() => handleDelete(cert)}
                          disabled={deletingId === cert.id}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                          {deletingId === cert.id ? "Deleting…" : "Delete"}
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

/** Format a date string for display */
function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
