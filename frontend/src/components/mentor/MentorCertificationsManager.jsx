import { useCallback, useEffect, useState } from "react";
import {
  listCertifications,
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
  issueDate: "",
  expiryDate: "",
  certificateUrl: "",
  certificateImage: "",
  verificationUrl: "",
  description: "",
};

const toFormState = (cert) => ({
  certificationName: cert.certificationName || "",
  issuingOrganization: cert.issuingOrganization || "",
  credentialId: cert.credentialId || "",
  issueDate: cert.issueDate ? String(cert.issueDate).slice(0, 10) : "",
  expiryDate: cert.expiryDate ? String(cert.expiryDate).slice(0, 10) : "",
  certificateUrl: cert.certificateUrl || "",
  certificateImage: cert.certificateImage || "",
  verificationUrl: cert.verificationUrl || "",
  description: cert.description || "",
});

const buildPayload = (form) => ({
  certificationName: form.certificationName.trim(),
  issuingOrganization: form.issuingOrganization.trim(),
  credentialId: form.credentialId.trim() || null,
  issueDate: form.issueDate || null,
  expiryDate: form.expiryDate || null,
  certificateUrl: form.certificateUrl.trim() || null,
  certificateImage: form.certificateImage.trim() || null,
  verificationUrl: form.verificationUrl.trim() || null,
  description: form.description.trim() || null,
});

const validate = (form) => {
  if (!form.certificationName.trim()) {
    return "Certification name is required.";
  }
  if (!form.issuingOrganization.trim()) {
    return "Issuing organization is required.";
  }
  if (!form.issueDate) {
    return "Issue date is required.";
  }
  if (form.expiryDate && form.expiryDate < form.issueDate) {
    return "Expiry date must be after the issue date.";
  }
  return "";
};

/**
 * Owner-only manager: lists the logged-in mentor's professional
 * certifications and supports add / edit / delete against the backend.
 * Refetches after every mutation so the list stays in sync.
 */
export default function MentorCertificationsManager({ mentorId, notify }) {
  const [certifications, setCertifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!mentorId) {
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await listCertifications(mentorId);
      setCertifications(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load certifications."));
    } finally {
      setLoading(false);
    }
  }, [mentorId]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
    setFormError("");
  };

  const startAdd = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setFormError("");
    setShowForm(true);
  };

  const startEdit = (cert) => {
    setForm(toFormState(cert));
    setEditingId(cert.id);
    setFormError("");
    setShowForm(true);
  };

  const setField = (field) => (event) =>
    setForm((prev) => ({ ...prev, [field]: event.target.value }));

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
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Delete "${cert.certificationName}"?`)
    ) {
      return;
    }
    try {
      await deleteCertification(cert.id);
      notify?.({
        type: "info",
        title: "Certification deleted",
        message: cert.certificationName,
      });
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not delete certification."));
    }
  };

  return (
    <section
      id="certifications"
      className="dashboard-card mentor-section-card"
      style={{ scrollMarginTop: "90px" }}
    >
      <div className="cert-section-header">
        <div>
          <h3>Professional Certifications</h3>
          <p className="cert-section-copy">
            Add the credentials you have earned to build learner trust.
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            className="cert-btn cert-btn-primary"
            onClick={startAdd}
          >
            <span className="material-symbols-outlined">add</span>
            Add Certification
          </button>
        )}
      </div>

      {error && <p className="cert-error">{error}</p>}

      {showForm && (
        <form className="cert-form" onSubmit={handleSubmit}>
          <label>
            Certification name *
            <input
              type="text"
              value={form.certificationName}
              onChange={setField("certificationName")}
              maxLength={500}
              required
            />
          </label>
          <label>
            Issuing organization *
            <input
              type="text"
              value={form.issuingOrganization}
              onChange={setField("issuingOrganization")}
              maxLength={500}
              required
            />
          </label>
          <label>
            Credential ID
            <input
              type="text"
              value={form.credentialId}
              onChange={setField("credentialId")}
            />
          </label>
          <label>
            Issue date *
            <input
              type="date"
              value={form.issueDate}
              onChange={setField("issueDate")}
              required
            />
          </label>
          <label>
            Expiry date
            <input
              type="date"
              value={form.expiryDate}
              onChange={setField("expiryDate")}
            />
          </label>
          <label>
            Certificate URL
            <input
              type="url"
              value={form.certificateUrl}
              onChange={setField("certificateUrl")}
              placeholder="https://"
            />
          </label>
          <label>
            Certificate image URL
            <input
              type="url"
              value={form.certificateImage}
              onChange={setField("certificateImage")}
              placeholder="https://"
            />
          </label>
          <label>
            Verification URL
            <input
              type="url"
              value={form.verificationUrl}
              onChange={setField("verificationUrl")}
              placeholder="https://"
            />
          </label>
          <label className="cert-field-full">
            Description
            <textarea
              rows={3}
              value={form.description}
              onChange={setField("description")}
            />
          </label>

          {formError && <p className="cert-error cert-field-full">{formError}</p>}

          <div className="cert-form-actions">
            <button type="button" className="cert-btn" onClick={resetForm}>
              Cancel
            </button>
            <button
              type="submit"
              className="cert-btn cert-btn-primary"
              disabled={saving}
            >
              {saving
                ? "Saving…"
                : editingId
                  ? "Save changes"
                  : "Add certification"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="cert-empty">Loading certifications…</p>
      ) : certifications.length === 0 ? (
        !showForm && (
          <div className="cert-empty-state">
            <div className="cert-empty-icon" aria-hidden="true">
              <span className="material-symbols-outlined">workspace_premium</span>
            </div>
            <h4 className="cert-empty-title">No Certifications Yet</h4>
            <p className="cert-empty-subtitle">
              Showcase your professional achievements by adding certificates.
            </p>
            <button type="button" className="cert-btn-cta" onClick={startAdd}>
              <span className="material-symbols-outlined">add</span>
              Add Certification
            </button>
            <p className="cert-empty-supported">
              Supported: <strong>PDF</strong> • <strong>PNG</strong> •{" "}
              <strong>JPG</strong>
            </p>
          </div>
        )
      ) : (
        <div className="cert-grid" style={{ marginTop: "16px" }}>
          {certifications.map((cert) => (
            <article className="cert-card" key={cert.id}>
              <div className="cert-card-top">
                {cert.certificateImage ? (
                  <img
                    className="cert-logo"
                    src={cert.certificateImage}
                    alt={`${cert.issuingOrganization || "Certification"} logo`}
                    loading="lazy"
                  />
                ) : (
                  <span className="cert-logo-fallback" aria-hidden="true">
                    <span className="material-symbols-outlined">
                      workspace_premium
                    </span>
                  </span>
                )}
                <div className="cert-card-heading">
                  <p className="cert-name">{cert.certificationName}</p>
                  {cert.issuingOrganization && (
                    <p className="cert-org">{cert.issuingOrganization}</p>
                  )}
                </div>
              </div>

              <div className="cert-meta">
                {cert.issueDate && (
                  <span>Issued {String(cert.issueDate).slice(0, 10)}</span>
                )}
                {cert.verificationUrl && (
                  <a
                    className="cert-badge-verified"
                    href={cert.verificationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="material-symbols-outlined">verified</span>
                    Verified
                  </a>
                )}
              </div>

              <div className="cert-card-actions">
                <button
                  type="button"
                  className="cert-btn"
                  onClick={() => startEdit(cert)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="cert-btn cert-btn-danger"
                  onClick={() => handleDelete(cert)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
