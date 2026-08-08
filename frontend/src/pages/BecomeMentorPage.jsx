import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import client from "../api/client";
import HeroSection from "../components/HeroSection";
import SsIcon from "../components/ui/SsIcon";
import { SsBadge } from "../components/ui/SsCard";
import "./BecomeMentorPage.css";

/* ── Helpers ───────────────────────────────────────────────────── */

const errorMessage = (err, fallback) =>
  err?.response?.data?.data?.error
    || err?.response?.data?.message
    || err?.message
    || fallback;

const STATUS_META = {
  PENDING: { label: "Pending review", icon: "hourglass_top", tone: "warning" },
  APPROVED: { label: "Approved", icon: "verified", tone: "success" },
  REJECTED: { label: "Rejected", icon: "cancel", tone: "danger" },
  MORE_INFORMATION_REQUIRED: { label: "Action needed", icon: "info", tone: "warning" },
};

const emptyForm = {
  fullName: "",
  headline: "",
  skills: "",
  yearsOfExperience: "",
  aboutMe: "",
  hourlyRate: "",
  linkedinUrl: "",
  githubUrl: "",
  portfolioUrl: "",
  resumeUrl: "",
  certificateUrls: "",
  documentUrl: "",
  documentType: "",
  availability: "",
};

/* ── Field building block ──────────────────────────────────────── */

function Field({ label, hint, required, children }) {
  return (
    <label className="bcm-field">
      <span className="bcm-field__label">
        {label}
        {required && <em className="bcm-field__req">*</em>}
      </span>
      {children}
      {hint && <span className="bcm-field__hint">{hint}</span>}
    </label>
  );
}

/* Field without the wrapping <label> — for controls that contain nested
   interactive elements (e.g. an upload button + text input), where nesting
   inside a label is an accessibility anti-pattern. */
function FieldPlain({ label, hint, required, children }) {
  return (
    <div className="bcm-field">
      <span className="bcm-field__label">
        {label}
        {required && <em className="bcm-field__req">*</em>}
      </span>
      {children}
      {hint && <span className="bcm-field__hint">{hint}</span>}
    </div>
  );
}

/* ── File upload with manual-link fallback ─────────────────────── */

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // matches backend 10 MB limit

function FileUploadField({
  label,
  hint,
  value,
  onChange,
  multi = false,
  accept = ".pdf,.doc,.docx,.png,.jpg,.jpeg,image/*",
  placeholder = "https://…",
  error,
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const upload = async (file) => {
    setUploadError("");
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError("File must be 10 MB or smaller.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      // Multipart upload — axios derives the boundary automatically.
      const res = await client.post("/api/v1/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = res?.data?.data?.url;
      if (!url) {
        throw new Error("Upload response did not include a URL");
      }
      if (multi) {
        const existing = String(value || "").trim();
        onChange(existing ? `${existing}\n${url}` : url);
      } else {
        onChange(url);
      }
    } catch (err) {
      setUploadError(errorMessage(err, "Upload failed. Try again or paste a link instead."));
    } finally {
      setUploading(false);
    }
  };

  const links = multi
    ? String(value || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    : value
      ? [value]
      : [];

  const removeLink = (target) => {
    if (multi) {
      onChange(links.filter((url) => url !== target).join("\n"));
    } else {
      onChange("");
    }
  };

  return (
    <FieldPlain label={label} hint={hint}>
      <div className="bcm-upload">
        <div className="bcm-upload__row">
          <button
            type="button"
            className="ss-btn ss-btn--secondary bcm-upload__btn"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            <SsIcon name={uploading ? "loader" : "upload"} size={16} />
            {uploading ? "Uploading…" : "Upload file"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            className="bcm-upload__input"
            aria-label={`Upload ${label}`}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ""; // allow re-selecting the same file
              if (file) upload(file);
            }}
          />
          <span className="bcm-upload__hint">or paste a link</span>
        </div>

        <input
          type="url"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setUploadError("");
          }}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
        />
        {(uploadError || error) && (
          <span className="bcm-field__error" role="alert">{uploadError || error}</span>
        )}

        {links.length > 0 && (
          <ul className="bcm-upload__list">
            {links.map((url, idx) => (
              <li className="bcm-upload__chip" key={`${url}-${idx}`}>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <SsIcon name="file-text" size={14} />
                  <span className="bcm-upload__chip-url">{url}</span>
                </a>
                <button
                  type="button"
                  className="bcm-upload__chip-remove"
                  aria-label="Remove link"
                  onClick={() => removeLink(url)}
                >
                  <SsIcon name="close" size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </FieldPlain>
  );
}

/* ── Status banner ─────────────────────────────────────────────── */

function StatusBanner({ status }) {
  if (!status || !status.requestId) return null;
  const meta = STATUS_META[status.status] || STATUS_META.PENDING;

  return (
    <section className={`bcm-status bcm-status--${(status.status || "PENDING").toLowerCase()}`} aria-label="Application status">
      <span className="bcm-status__icon"><SsIcon name={meta.icon} size={26} /></span>
      <div className="bcm-status__body">
        <p className="bcm-status__eyebrow">Your application</p>
        <h2>{meta.label}</h2>
        {status.status === "MORE_INFORMATION_REQUIRED" && status.requestedInfo && (
          <p className="bcm-status__message">
            {status.requestedInfo} You can revise your application below and resubmit.
          </p>
        )}
        {status.status === "REJECTED" && status.adminNote && (
          <p className="bcm-status__message">{status.adminNote}</p>
        )}
        {status.status === "PENDING" && (
          <p className="bcm-status__message">
            Our team is reviewing your application. You can update your details below —
            changes apply to your next submission.
          </p>
        )}
        {status.status === "APPROVED" && (
          <p className="bcm-status__message">
            Welcome aboard! You can now use your mentor dashboard to create sessions
            and set your availability.
          </p>
        )}
      </div>
      <SsBadge status={meta.tone}>{meta.label}</SsBadge>
    </section>
  );
}

/* ── Main page ─────────────────────────────────────────────────── */

export default function BecomeMentorPage({ profile, notify }) {
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formKey, setFormKey] = useState(0);

  /* Prefill from the profile */
  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      fullName: profile?.fullName || "",
      headline: profile?.headline || "",
      skills: profile?.skills || "",
      yearsOfExperience: profile?.yearsOfExperience != null ? String(profile.yearsOfExperience) : "",
      aboutMe: profile?.aboutMe || "",
      hourlyRate: profile?.hourlyRate != null ? String(profile.hourlyRate) : "",
      linkedinUrl: profile?.linkedinUrl || "",
      githubUrl: profile?.githubUrl || "",
      resumeUrl: profile?.resumeUrl || "",
    }));
  }, [profile]);

  /* Load application status */
  const loadStatus = useCallback(async () => {
    try {
      const res = await client.get("/api/v1/verification/mentor/status");
      setStatus(res?.data?.data || null);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const canSubmit = useMemo(
    () => !status?.requestId || status.status === "REJECTED" || status.status === "MORE_INFORMATION_REQUIRED",
    [status],
  );

  const validate = () => {
    const next = {};
    if (!form.fullName.trim()) next.fullName = "Full name is required.";
    if (!form.skills.trim()) next.skills = "Add at least one skill.";
    if (form.yearsOfExperience !== "" && (Number(form.yearsOfExperience) < 0 || Number.isNaN(Number(form.yearsOfExperience)))) {
      next.yearsOfExperience = "Enter a valid number.";
    }
    if (!form.resumeUrl.trim() && !form.documentUrl.trim()) {
      next.resumeUrl = "Add your resume (or an identity document) so admins can verify your application.";
    }
    const urls = [
      ["linkedinUrl", "LinkedIn"],
      ["githubUrl", "GitHub"],
      ["portfolioUrl", "Portfolio"],
      ["resumeUrl", "Resume"],
      ["documentUrl", "Document"],
    ];
    urls.forEach(([key, label]) => {
      const value = form[key].trim();
      if (value && !/^https?:\/\//i.test(value)) next[key] = `${label} URL must start with http:// or https://`;
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      notify?.({ type: "error", title: "Check the form", message: "Please fix the highlighted fields." });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        email: profile?.email || "",
        yearsOfExperience: form.yearsOfExperience === "" ? null : Number(form.yearsOfExperience),
        hourlyRate: form.hourlyRate === "" ? null : Number(form.hourlyRate),
        documentUrl: form.documentUrl.trim() || (form.resumeUrl.trim() || null),
        // Leave documentType unset unless explicitly chosen — the backend
        // infers "identity_proof" vs "resume" from which URL was provided.
        documentType: form.documentType.trim() || null,
      };
      const res = await client.post("/api/v1/verification/mentor/request", payload);
      setStatus((prev) => ({
        requestId: res?.data?.data?.id ?? prev?.requestId,
        status: "PENDING",
        requestedInfo: null,
        adminNote: null,
      }));
      setFormKey((k) => k + 1);
      notify?.({
        type: "success",
        title: "Application submitted",
        message: "Your mentor verification application is now pending review.",
      });
    } catch (err) {
      notify?.({
        type: "error",
        title: "Submission failed",
        message: errorMessage(err, "Could not submit your application. Try again."),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="ss-page bcm-page">
      {/* ── Hero — Unified Design System ── */}
      <HeroSection
        badge={
          <>
            <SsIcon name="verified" size={14} />
            Mentor program
          </>
        }
        title="Become a Mentor"
        subtitle="Share your expertise, run live sessions, and get paid for teaching. Apply now — our team verifies every mentor before they appear on the platform."
        primaryButton={
          status?.status === "APPROVED" ? (
            <Link
              to="/mentor/dashboard"
              className="hero-section__btn hero-section__btn--primary"
            >
              <SsIcon name="arrow-up-right" size={16} />
              Open mentor dashboard
            </Link>
          ) : (
            <a
              href="#bcm-form"
              className="hero-section__btn hero-section__btn--primary"
            >
              {canSubmit ? "Start your application" : "Application pending"}
              <SsIcon name="chevron-down" size={16} />
            </a>
          )
        }
        floatingCards={
          <div className="hero-section__watermark" aria-hidden="true">
            <SsIcon name="workspace_premium" size={96} />
          </div>
        }
      />

      <div className="bcm-inner">
        {/* Status banner (loading skeleton while fetching) */}
        {loading ? (
          <div className="bcm-skel bcm-skel--banner" aria-label="Loading application status" />
        ) : (
          <StatusBanner status={status} />
        )}

        {/* Application form */}
        <section className="bcm-card" id="bcm-form">
          <div className="bcm-card__head">
            <div>
              <p className="bcm-card__eyebrow">Application</p>
              <h2>Mentor profile details</h2>
              <p className="bcm-card__sub">
                Tell us about your experience. Fields marked * are required.
              </p>
            </div>
            <span className="bcm-card__badge"><SsIcon name="shield" size={16} /> Reviewed by our team</span>
          </div>

          {!canSubmit && (
            <div className="bcm-locked" role="status">
              <SsIcon name="hourglass_top" size={20} />
              You already have an application under review. You'll be able to edit your
              details again after the review is complete.
            </div>
          )}

          <form key={formKey} className="bcm-form" onSubmit={handleSubmit} noValidate>
            <div className="bcm-form__grid">
              <Field label="Full name" required>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setField("fullName", e.target.value)}
                  placeholder="Your full name"
                  aria-invalid={Boolean(errors.fullName)}
                />
                {errors.fullName && <span className="bcm-field__error">{errors.fullName}</span>}
              </Field>

              <Field label="Headline">
                <input
                  type="text"
                  value={form.headline}
                  onChange={(e) => setField("headline", e.target.value)}
                  placeholder="e.g., Senior Full Stack Engineer"
                  aria-invalid={Boolean(errors.headline)}
                />
              </Field>

              <Field label="Skills" required hint="Comma-separated, e.g. Java, Spring Boot, React">
                <input
                  type="text"
                  value={form.skills}
                  onChange={(e) => setField("skills", e.target.value)}
                  placeholder="Java, Spring Boot, React"
                  aria-invalid={Boolean(errors.skills)}
                />
                {errors.skills && <span className="bcm-field__error">{errors.skills}</span>}
              </Field>

              <Field label="Years of experience">
                <input
                  type="number"
                  min="0"
                  value={form.yearsOfExperience}
                  onChange={(e) => setField("yearsOfExperience", e.target.value)}
                  placeholder="e.g. 5"
                  aria-invalid={Boolean(errors.yearsOfExperience)}
                />
                {errors.yearsOfExperience && <span className="bcm-field__error">{errors.yearsOfExperience}</span>}
              </Field>

              <Field label="Hourly price (₹)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.hourlyRate}
                  onChange={(e) => setField("hourlyRate", e.target.value)}
                  placeholder="e.g. 299 — enter 0 for free sessions"
                />
                <span className="bcm-field__hint">Enter 0 to offer free mentoring sessions.</span>
              </Field>

              <Field label="Availability">
                <select value={form.availability} onChange={(e) => setField("availability", e.target.value)}>
                  <option value="">Select availability</option>
                  <option value="WEEKDAYS">Weekdays</option>
                  <option value="WEEKENDS">Weekends</option>
                  <option value="EVENINGS">Evenings</option>
                  <option value="FULL_TIME">Full time</option>
                  <option value="FLEXIBLE">Flexible</option>
                </select>
              </Field>
            </div>

            <Field label="About yourself" hint="What makes you a great mentor?">
              <textarea
                rows={5}
                value={form.aboutMe}
                onChange={(e) => setField("aboutMe", e.target.value)}
                placeholder="Share your background, teaching style, and what learners will get from your sessions…"
              />
            </Field>

            <div className="bcm-form__grid">
              <Field label="LinkedIn URL">
                <input
                  type="url"
                  value={form.linkedinUrl}
                  onChange={(e) => setField("linkedinUrl", e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                  aria-invalid={Boolean(errors.linkedinUrl)}
                />
                {errors.linkedinUrl && <span className="bcm-field__error">{errors.linkedinUrl}</span>}
              </Field>

              <Field label="GitHub URL">
                <input
                  type="url"
                  value={form.githubUrl}
                  onChange={(e) => setField("githubUrl", e.target.value)}
                  placeholder="https://github.com/username"
                  aria-invalid={Boolean(errors.githubUrl)}
                />
                {errors.githubUrl && <span className="bcm-field__error">{errors.githubUrl}</span>}
              </Field>

              <Field label="Portfolio URL">
                <input
                  type="url"
                  value={form.portfolioUrl}
                  onChange={(e) => setField("portfolioUrl", e.target.value)}
                  placeholder="https://yourportfolio.dev"
                  aria-invalid={Boolean(errors.portfolioUrl)}
                />
                {errors.portfolioUrl && <span className="bcm-field__error">{errors.portfolioUrl}</span>}
              </Field>

              <FileUploadField
                label="Resume"
                hint="Upload a PDF or paste a link. Admins review it during verification."
                value={form.resumeUrl}
                onChange={(v) => setField("resumeUrl", v)}
                placeholder="https://…/resume.pdf"
                error={errors.resumeUrl}
              />

              <FileUploadField
                label="Certificates"
                hint="Upload one or more certificate files (or paste links)."
                value={form.certificateUrls}
                onChange={(v) => setField("certificateUrls", v)}
                multi
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,image/*"
                placeholder="https://…/cert1.pdf"
              />

              <FileUploadField
                label="Identity proof (optional)"
                hint="Government ID or credential document. If left empty, your resume is used as evidence."
                value={form.documentUrl}
                onChange={(v) => setField("documentUrl", v)}
                placeholder="https://…/government-id.pdf"
                error={errors.documentUrl}
              />
            </div>

            <div className="bcm-form__actions">
              <button type="submit" className="ss-btn ss-btn--primary" disabled={submitting || !canSubmit}>
                {submitting ? <><SsIcon name="loader" size={16} /> Submitting…</> : (
                  <><SsIcon name="send" size={16} /> Submit application</>
                )}
              </button>
              {!canSubmit && (
                <span className="bcm-form__locked-hint">You can resubmit after your current review finishes.</span>
              )}
            </div>
          </form>
        </section>

        {/* How it works */}
        <section className="bcm-steps" aria-label="How it works">
          <h2 className="bcm-steps__title">What happens next?</h2>
          <div className="bcm-steps__grid">
            {[
              { icon: "file-text", title: "Submit your application", desc: "Fill in your details and attach your resume, certificates, and links." },
              { icon: "hourglass_top", title: "Review", desc: "Our moderation team reviews your application, documents, and experience." },
              { icon: "check_circle", title: "Get verified", desc: "Once approved, your role becomes Mentor and your dashboard unlocks." },
              { icon: "rocket_launch", title: "Start teaching", desc: "Create sessions, set availability, and start earning." },
            ].map((step, i) => (
              <article className="bcm-step" key={step.title}>
                <span className="bcm-step__num">{i + 1}</span>
                <span className="bcm-step__icon"><SsIcon name={step.icon} size={22} /></span>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
