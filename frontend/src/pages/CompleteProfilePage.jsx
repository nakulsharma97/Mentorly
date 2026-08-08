import { useEffect, useMemo, useRef, useState } from "react";
import client from "../api/client";
import {
  parseSkillTags,
  serializeSkillTags,
  SKILL_LEVELS,
} from "../utils/profileSkills";
import { normalizeSkills } from "../utils/skills";
import { computeProfileCompletion } from "../modules/common/profileCompletion";
import MentorCertificationsManager from "../components/mentor/MentorCertificationsManager";
import MentorProjectsManager from "../components/mentor/MentorProjectsManager";
import "./CompleteProfilePage.css";

/* ─────────────────────────────────────────────────────────────
   Constants
   ───────────────────────────────────────────────────────────── */

const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "America/Bogota",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Warsaw",
  "Europe/Istanbul",
  "Europe/Moscow",
  "Africa/Cairo",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Taipei",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Perth",
  "Pacific/Auckland",
];

const COUNTRIES = [
  "India", "United States", "United Kingdom", "Canada", "Australia", "Germany",
  "France", "Spain", "Italy", "Netherlands", "Portugal", "Poland", "Sweden",
  "Norway", "Denmark", "Finland", "Switzerland", "Austria", "Belgium",
  "Ireland", "Brazil", "Mexico", "Argentina", "Colombia", "Chile", "Peru",
  "United Arab Emirates", "Saudi Arabia", "Israel", "Turkey", "Egypt",
  "Nigeria", "Kenya", "South Africa", "Morocco", "Ghana", "Singapore",
  "Malaysia", "Indonesia", "Philippines", "Vietnam", "Thailand", "Pakistan",
  "Bangladesh", "Sri Lanka", "Nepal", "Japan", "South Korea", "China",
  "Taiwan", "Hong Kong", "New Zealand", "Ukraine", "Romania", "Czech Republic",
  "Greece", "Qatar", "Kuwait", "Oman", "Jordan",
];

const URL_PATTERN = /^https?:\/\//i;
const PHONE_PATTERN = /^[+()\-.\s\d]{7,25}$/;

const FIELD_TYPES = {
  text: "text",
  tel: "tel",
  url: "url",
  number: "number",
  textarea: "textarea",
  select: "select",
  photo: "photo",
  experience: "experience",
  languages: "languages",
};

/** Defines every field shown on the onboarding form, per role. */
const FIELDS_BY_ROLE = {
  MENTOR: [
    { name: "profileImageUrl", label: "Profile Photo", type: FIELD_TYPES.photo, span: 2, required: true },
    { name: "fullName", label: "Full Name", type: FIELD_TYPES.text, placeholder: "Your full name", required: true },
    { name: "headline", label: "Headline", type: FIELD_TYPES.text, placeholder: "e.g. Senior React Engineer & Mentor", required: true, span: 2 },
    { name: "aboutMe", label: "Bio", type: FIELD_TYPES.textarea, placeholder: "Tell learners about your background, expertise, and teaching style…", required: true, span: 2 },
    { name: "skills", label: "Skills You Teach", type: FIELD_TYPES.chips, required: true, span: 2 },
    { name: "experience", label: "Experience", type: FIELD_TYPES.experience, required: true, hint: "0 years is fine — freshers are welcome to mentor too." },
    { name: "languages", label: "Languages", type: FIELD_TYPES.languages, required: true },
    { name: "education", label: "Education", type: FIELD_TYPES.text, placeholder: "e.g. B.Tech Computer Science, IIT Delhi", required: true, span: 2 },
    { name: "linkedinUrl", label: "LinkedIn URL", type: FIELD_TYPES.url, placeholder: "https://linkedin.com/in/username", required: true },
    { name: "portfolioUrl", label: "Portfolio URL", type: FIELD_TYPES.url, placeholder: "https://your-portfolio.com", required: true },
    { name: "hourlyRate", label: "Hourly Price (₹)", type: FIELD_TYPES.number, placeholder: "e.g. 299", required: true, min: 0, hint: "Enter 0 to offer free mentoring sessions." },
    { name: "timezone", label: "Timezone", type: FIELD_TYPES.select, required: true },
    { name: "availability", label: "Availability", type: FIELD_TYPES.textarea, placeholder: "e.g. Weekdays 6–9 PM IST · Weekends all day", required: true, span: 2 },
    { name: "country", label: "Country", type: FIELD_TYPES.text, required: true },
    { name: "state", label: "State / Province", type: FIELD_TYPES.text, placeholder: "e.g. Delhi", required: true },
    { name: "city", label: "City", type: FIELD_TYPES.text, placeholder: "e.g. New Delhi", required: true },
    { name: "phoneNumber", label: "Phone Number", type: FIELD_TYPES.tel, placeholder: "+91 98765 43210", required: true, span: 2 },
  ],
  LEARNER: [
    { name: "profileImageUrl", label: "Profile Photo", type: FIELD_TYPES.photo, span: 2, required: true },
    { name: "fullName", label: "Full Name", type: FIELD_TYPES.text, placeholder: "Your full name", required: true },
    { name: "learningGoals", label: "Learning Goals", type: FIELD_TYPES.textarea, placeholder: "What do you want to achieve? e.g. Master React, prepare for interviews…", required: true, span: 2 },
    { name: "aboutMe", label: "Bio", type: FIELD_TYPES.textarea, placeholder: "A short intro about yourself and your learning journey…", required: true, span: 2 },
    { name: "skills", label: "Interested Skills", type: FIELD_TYPES.chips, required: true, span: 2 },
    { name: "currentSkillLevel", label: "Current Skill Level", type: FIELD_TYPES.select, required: true },
    { name: "languages", label: "Languages", type: FIELD_TYPES.languages, required: true },
    { name: "timezone", label: "Timezone", type: FIELD_TYPES.select, required: true },
    { name: "country", label: "Country", type: FIELD_TYPES.text, required: true },
    { name: "state", label: "State / Province", type: FIELD_TYPES.text, placeholder: "e.g. Maharashtra", required: true },
    { name: "city", label: "City", type: FIELD_TYPES.text, placeholder: "e.g. Mumbai", required: true },
    { name: "phoneNumber", label: "Phone Number", type: FIELD_TYPES.tel, placeholder: "+91 98765 43210", required: true, span: 2 },
  ],
};

const SKILL_LEVELS_LABEL = SKILL_LEVELS;

function defaultTimezone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (COMMON_TIMEZONES.includes(tz)) return tz;
  } catch {
    // fall through
  }
  return "UTC";
}

/** Humanize a years+months duration, e.g. 1y6m → "1 Year 6 Months". */
function formatExperience(years, months) {
  const parts = [];
  if (years > 0) parts.push(years === 1 ? "1 Year" : `${years} Years`);
  if (months > 0) parts.push(months === 1 ? "1 Month" : `${months} Months`);
  return parts.length ? parts.join(" ") : "0 Years (Fresher)";
}

/* ─────────────────────────────────────────────────────────────
   Small presentational helpers
   ───────────────────────────────────────────────────────────── */

function FieldShell({ id, field, error, children, hint }) {
  return (
    <div
      className={`cpp-field${error ? " cpp-field--error" : ""}${field.span === 2 ? " cpp-field--span2" : ""}`}
    >
      <label className="cpp-label" htmlFor={id}>
        {field.label}
        {field.required && <span className="cpp-required" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && !error && <p className="cpp-hint">{hint}</p>}
      {error && (
        <p className="cpp-field-error" id={`${id}-error`} role="alert">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

function SectionHeading({ icon, title, subtitle, index }) {
  return (
    <div className="cpp-section-head">
      <div className="cpp-section-icon" aria-hidden="true">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </div>
      <div>
        <h2 className="cpp-section-title">{title}</h2>
        {subtitle && <p className="cpp-section-sub">{subtitle}</p>}
      </div>
      <span className="cpp-section-index" aria-hidden="true">{String(index).padStart(2, "0")}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Confetti / success overlay
   ───────────────────────────────────────────────────────────── */

function SuccessOverlay({ onGoDashboard, onViewProfile, editMode }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 36 }, (_, i) => ({
        id: i,
        left: `${(i * 2.9 + 4) % 100}%`,
        delay: `${(i % 12) * 0.09}s`,
        duration: `${1.4 + (i % 5) * 0.22}s`,
        color: ["#0F9D8A", "#14B8A6", "#F59E0B", "#3B82F6", "#EF4444", "#8B5CF6"][i % 6],
        rotate: `${(i % 7) * 52}deg`,
      })),
    [],
  );

  return (
    <div className="cpp-success" role="status" aria-live="polite">
      <div className="cpp-confetti" aria-hidden="true">
        {pieces.map((p) => (
          <span
            key={p.id}
            className="cpp-confetti-piece"
            style={{
              left: p.left,
              background: p.color,
              animationDelay: p.delay,
              animationDuration: p.duration,
              transform: `rotate(${p.rotate})`,
            }}
          />
        ))}
      </div>
      <div className="cpp-success-card">
        <div className="cpp-success-badge">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2>{editMode ? "✓ Profile Updated Successfully" : "🎉 Profile Completed Successfully"}</h2>
        {editMode ? (
          <p>
            Your profile changes have been saved. Certifications and projects are
            updated instantly — no re-verification is required for optional sections.
          </p>
        ) : (
          <p>
            Your profile has been submitted successfully. The SkillSwap Admin team will
            review and verify your mentor profile — usually within 24 hours.
          </p>
        )}
        {!editMode && (
          <p className="cpp-success-note">
            Until then you cannot create mentoring sessions and learners cannot discover
            your profile. You will receive a notification once your account is verified.
          </p>
        )}
        <div className="cpp-success-actions">
          <button type="button" className="cpp-btn cpp-btn--primary" onClick={onGoDashboard}>
            Go to Dashboard
          </button>
          <button type="button" className="cpp-btn cpp-btn--soft" onClick={onViewProfile}>
            View Profile
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main component
   ───────────────────────────────────────────────────────────── */

export default function CompleteProfilePage({
  profile,
  notify,
  onLogout,
  onDismiss,
  onGoDashboard,
  onViewProfile,
}) {
  const isMentor = profile?.role === "MENTOR";
  // Edit mode: the profile is already complete, so this is an update flow
  // ("Full Profile Setup") rather than first-login onboarding.
  const editMode = Boolean(profile?.profileCompleted);
  const fields = FIELDS_BY_ROLE[profile?.role] || FIELDS_BY_ROLE.LEARNER;

  const [form, setForm] = useState(() => {
    const initial = {};
    fields.forEach((f) => {
      if (f.type === FIELD_TYPES.experience) {
        initial.yearsOfExperience = profile?.yearsOfExperience ?? 0;
        initial.monthsOfExperience = profile?.monthsOfExperience ?? 0;
        return;
      }
      initial[f.name] = profile?.[f.name] ?? "";
    });
    initial.timezone = initial.timezone || defaultTimezone();
    return initial;
  });
  const [skillTags, setSkillTags] = useState(() =>
    parseSkillTags(profile?.skills || ""),
  );
  const [newSkill, setNewSkill] = useState("");
  const [newSkillLevel, setNewSkillLevel] = useState("Intermediate");
  const [skillError, setSkillError] = useState("");
  const [langTags, setLangTags] = useState(() =>
    normalizeSkills(profile?.languages),
  );
  const [newLang, setNewLang] = useState("");
  const [langError, setLangError] = useState("");
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const skillInputRef = useRef(null);
  const langInputRef = useRef(null);
  const formRef = useRef(null);
  // Holds the server response so the success animation can hand the freshly
  // updated (profileCompleted=true) profile to the auth layer before redirect.
  const completedProfileRef = useRef(null);

  /* ── Live completion % (encourages users to finish) ──
     Mirrors the backend ProfileCompletionService exactly (same sections,
     same weights) so the preview always matches the persisted percentage. */
  const progress = useMemo(
    () =>
      computeProfileCompletion(
        {
          ...form,
          skills: skillTags.length ? "filled" : "",
          languages: langTags.length ? "filled" : "",
        },
        profile?.role,
      ),
    [form, skillTags, langTags, profile?.role],
  );

  // Auto-redirect as a convenience, but the success overlay now also exposes
  // explicit Go to Dashboard / View Profile buttons, so the mentor is never
  // stuck waiting.
  useEffect(() => {
    if (!success) return undefined;
    // Auto-redirect hands the fresh server profile (profileCompleted=true) to
    // the auth layer so needsProfileSetup flips false and the mentor is NOT
    // bounced straight back to onboarding.
    const timer = window.setTimeout(() => {
      onGoDashboard?.(completedProfileRef.current);
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [success, onGoDashboard]);

  /* ── Field validation ── */
  function validateField(field, value) {
    const text = String(value || "").trim();
    if (field.type === FIELD_TYPES.chips) {
      if (!Array.isArray(value) || value.length === 0) {
        return `Please add at least one skill.`;
      }
      return null;
    }
    if (field.type === FIELD_TYPES.experience) {
      const years = Number(value?.yearsOfExperience);
      const months = Number(value?.monthsOfExperience);
      if (!Number.isFinite(years) || years < 0 || years > 30) {
        return "Experience years must be between 0 and 30.";
      }
      if (!Number.isFinite(months) || months < 0 || months > 11) {
        return "Experience months must be between 0 and 11.";
      }
      return null;
    }
    if (field.type === FIELD_TYPES.languages) {
      if (!Array.isArray(value) || value.length === 0) {
        return "Please add at least one language.";
      }
      return null;
    }
    if (field.type === FIELD_TYPES.number) {
      const n = Number(value);
      if (value === "" || value == null || !Number.isFinite(n)) {
        return `${field.label} is required.`;
      }
      if (field.min && n < field.min) {
        return `${field.label} must be at least ${field.min}.`;
      }
      return null;
    }
    if (field.type === FIELD_TYPES.select) {
      if (!text) return `Please choose your ${field.label.toLowerCase()}.`;
      return null;
    }
    if (!text) {
      return `${field.label} is required.`;
    }
    if (field.type === FIELD_TYPES.url && !URL_PATTERN.test(text)) {
      return "Please enter a full URL starting with https://";
    }
    if (field.type === FIELD_TYPES.tel && !PHONE_PATTERN.test(text)) {
      return "Please enter a valid phone number (e.g. +91 98765 43210).";
    }
    return null;
  }

  /* ── Form handlers ── */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const addSkill = () => {
    const name = newSkill.trim();
    if (!name) {
      setSkillError("Enter a skill name first.");
      return;
    }
    setSkillError("");
    setSkillTags((prev) => {
      const exists = prev.some((t) => t.name.toLowerCase() === name.toLowerCase());
      if (exists) {
        return prev.map((t) =>
          t.name.toLowerCase() === name.toLowerCase()
            ? { ...t, level: newSkillLevel }
            : t,
        );
      }
      return [...prev, { name, level: newSkillLevel }];
    });
    setNewSkill("");
    setNewSkillLevel("Intermediate");
    skillInputRef.current?.focus();
  };

  const removeSkill = (index) => {
    setSkillTags((prev) => prev.filter((_, i) => i !== index));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.skills;
      return next;
    });
  };

  const handleSkillKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSkill();
    }
  };

  /* ── Languages chip input ── */
  const addLang = () => {
    const value = newLang.trim();
    if (!value) {
      setLangError("Enter a language first.");
      return;
    }
    if (langTags.some((l) => l.toLowerCase() === value.toLowerCase())) {
      setLangError("That language is already added.");
      return;
    }
    setLangTags((prev) => [...prev, value]);
    setLangError("");
    setNewLang("");
    langInputRef.current?.focus();
  };

  const removeLang = (index) => {
    setLangTags((prev) => prev.filter((_, i) => i !== index));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.languages;
      return next;
    });
  };

  const handleLangKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addLang();
    }
  };

  /* ── Submit ── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");

    const nextErrors = {};
    fields.forEach((field) => {
      if (!field.required) return;
      let value;
      if (field.name === "skills") value = skillTags;
      else if (field.name === "languages") value = langTags;
      else if (field.type === FIELD_TYPES.experience) value = form;
      else value = form[field.name];
      const message = validateField(field, value);
      if (message) nextErrors[field.name] = message;
    });
    setErrors(nextErrors);

    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      const target = formRef.current?.querySelector(`[data-field="${firstError}"]`);
      try {
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {
        // jsdom (tests) does not implement scrollIntoView — focus is enough.
      }
      target?.querySelector("input, textarea, select")?.focus();
      return;
    }

    setSubmitting(true);
    try {
      // `form` never carries an `experience` key (it is split into
      // yearsOfExperience + monthsOfExperience below), so spreading it is safe.
      const payload = {
        ...form,
        skills: serializeSkillTags(skillTags),
        languages: langTags.join(", "),
      };
      if (isMentor) {
        payload.yearsOfExperience = Number(form.yearsOfExperience) || 0;
        payload.monthsOfExperience = Number(form.monthsOfExperience) || 0;
      }
      const response = await client.post("/api/v1/users/me/profile/complete", payload);
      const updated = response?.data?.data || null;
      completedProfileRef.current = updated;
      notify?.({
        type: "success",
        title: "Profile completed",
        message: "Welcome to SkillSwap!",
      });
      setSuccess(true);
    } catch (err) {
      const backendError =
        err?.response?.data?.data?.error ||
        err?.response?.data?.data?.message ||
        err?.response?.data?.message ||
        "Could not save your profile. Please check the highlighted fields and try again.";
      setSubmitError(backendError);
      notify?.({ type: "error", title: "Profile update failed", message: backendError });
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field) => {
    const id = `cpp-${field.name}`;
    const error = errors[field.name];

    if (field.type === FIELD_TYPES.photo) {
      return (
        <FieldShell key={field.name} id={id} field={field} error={error}>
          <div className="cpp-photo" data-field={field.name}>
            {form.profileImageUrl ? (
              <img
                className="cpp-photo-preview"
                src={form.profileImageUrl}
                alt="Profile preview"
                onError={(e) => {
                  e.currentTarget.style.opacity = "0.25";
                }}
              />
            ) : (
              <div className="cpp-photo-placeholder" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
            )}
            <div className="cpp-photo-input">
              <input
                id={id}
                name="profileImageUrl"
                type="url"
                className="cpp-input"
                placeholder="https://…/your-photo.jpg"
                value={form.profileImageUrl}
                onChange={handleChange}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${id}-error` : undefined}
              />
              <p className="cpp-hint">Paste a public image URL — a professional headshot works best.</p>
            </div>
          </div>
        </FieldShell>
      );
    }

    if (field.type === FIELD_TYPES.chips) {
      return (
        <FieldShell key={field.name} id={id} field={field} error={error}>
          <div data-field={field.name}>
            <div className="cpp-skills-row">
              <input
                ref={skillInputRef}
                className="cpp-input"
                placeholder="Type a skill and press Enter"
                value={newSkill}
                onChange={(e) => {
                  setNewSkill(e.target.value);
                  setSkillError("");
                }}
                onKeyDown={handleSkillKeyDown}
                aria-label={`${field.label} — type a skill and press Enter to add`}
              />
              <select
                className="cpp-select cpp-select--sm"
                value={newSkillLevel}
                onChange={(e) => setNewSkillLevel(e.target.value)}
                aria-label="Skill proficiency level"
              >
                {SKILL_LEVELS_LABEL.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
              <button
                type="button"
                className="cpp-btn cpp-btn--soft"
                onClick={addSkill}
                disabled={!newSkill.trim()}
                aria-label="Add skill"
              >
                + Add
              </button>
            </div>
            {skillError && <p className="cpp-field-error">{skillError}</p>}
            {skillTags.length > 0 ? (
              <div className="cpp-tags">
                {skillTags.map((tag, idx) => (
                  <span key={`${tag.name}-${idx}`} className="cpp-tag">
                    {tag.name}
                    <span className="cpp-tag-level">{tag.level}</span>
                    <button
                      type="button"
                      className="cpp-tag-remove"
                      onClick={() => removeSkill(idx)}
                      aria-label={`Remove ${tag.name}`}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="cpp-tags-empty">{isMentor ? "Add the skills you can teach." : "Add the skills you want to learn."}</p>
            )}
          </div>
        </FieldShell>
      );
    }

    if (field.type === FIELD_TYPES.experience) {
      const years = Number(form.yearsOfExperience) || 0;
      const months = Number(form.monthsOfExperience) || 0;
      return (
        <FieldShell key={field.name} id={id} field={field} error={error} hint={field.hint}>
          <div className="cpp-experience" data-field={field.name}>
            <div className="cpp-experience-group">
              <label className="cpp-label cpp-label--inline" htmlFor="cpp-experience-years">Years</label>
              <select
                id="cpp-experience-years"
                name="yearsOfExperience"
                className="cpp-select"
                value={years}
                onChange={handleChange}
                aria-label="Years of experience"
              >
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i} value={i}>
                    {i === 0 ? "0 — Fresher" : `${i} ${i === 1 ? "Year" : "Years"}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="cpp-experience-group">
              <label className="cpp-label cpp-label--inline" htmlFor="cpp-experience-months">Months</label>
              <select
                id="cpp-experience-months"
                name="monthsOfExperience"
                className="cpp-select"
                value={months}
                onChange={handleChange}
                aria-label="Additional months of experience"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i}>
                    {i} {i === 1 ? "Month" : "Months"}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="cpp-experience-summary">
            <strong>{formatExperience(years, months)}</strong> of experience
          </p>
        </FieldShell>
      );
    }

    if (field.type === FIELD_TYPES.languages) {
      return (
        <FieldShell key={field.name} id={id} field={field} error={error}>
          <div data-field={field.name}>
            <div className="cpp-skills-row">
              <input
                ref={langInputRef}
                className="cpp-input"
                placeholder="Type a language and press Enter"
                value={newLang}
                onChange={(e) => {
                  setNewLang(e.target.value);
                  setLangError("");
                }}
                onKeyDown={handleLangKeyDown}
                aria-label={`${field.label} — type a language and press Enter to add`}
              />
              <button
                type="button"
                className="cpp-btn cpp-btn--soft"
                onClick={addLang}
                disabled={!newLang.trim()}
                aria-label="Add language"
              >
                + Add
              </button>
            </div>
            {langError && <p className="cpp-field-error">{langError}</p>}
            {langTags.length > 0 ? (
              <div className="cpp-tags">
                {langTags.map((lang, idx) => (
                  <span key={`${lang}-${idx}`} className="cpp-tag">
                    {lang}
                    <button
                      type="button"
                      className="cpp-tag-remove"
                      onClick={() => removeLang(idx)}
                      aria-label={`Remove ${lang}`}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="cpp-tags-empty">Add the languages you speak — e.g. English, Hindi.</p>
            )}
          </div>
        </FieldShell>
      );
    }

    if (field.type === FIELD_TYPES.textarea) {
      return (
        <FieldShell key={field.name} id={id} field={field} error={error}>
          <textarea
            id={id}
            name={field.name}
            className="cpp-textarea"
            rows={4}
            placeholder={field.placeholder}
            value={form[field.name] || ""}
            onChange={handleChange}
            data-field={field.name}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
          />
        </FieldShell>
      );
    }

    if (field.type === FIELD_TYPES.select) {
      const isSkillLevel = field.name === "currentSkillLevel";
      const options = isSkillLevel ? SKILL_LEVELS_LABEL : COMMON_TIMEZONES;
      return (
        <FieldShell key={field.name} id={id} field={field} error={error}>
          <select
            id={id}
            name={field.name}
            className="cpp-select"
            value={form[field.name] || ""}
            onChange={handleChange}
            data-field={field.name}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
          >
            <option value="" disabled>
              {isSkillLevel ? "Select your level…" : "Select your timezone…"}
            </option>
            {options.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </FieldShell>
      );
    }

    return (
      <FieldShell key={field.name} id={id} field={field} error={error}>
        <input
          id={id}
          name={field.name}
          type={field.type === FIELD_TYPES.number ? "number" : field.type === FIELD_TYPES.tel ? "tel" : "text"}
          className="cpp-input"
          placeholder={field.placeholder}
          value={form[field.name] || ""}
          onChange={handleChange}
          min={field.min}
          inputMode={field.type === FIELD_TYPES.tel ? "tel" : undefined}
          data-field={field.name}
          list={field.name === "country" ? "cpp-countries" : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {field.name === "country" && (
          <datalist id="cpp-countries">
            {COUNTRIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        )}
      </FieldShell>
    );
  };

  const isPhotoSet = Boolean(String(form.profileImageUrl || "").trim());

  return (
    <main className="cpp-page">
      {success && (
        <SuccessOverlay
          editMode={editMode}
          onGoDashboard={() => onGoDashboard?.(completedProfileRef.current)}
          onViewProfile={() => onViewProfile?.(completedProfileRef.current)}
        />
      )}

      {/* ── Minimal top bar: brand + logout only ── */}
      <header className="cpp-topbar">
        <div className="cpp-brand">
          <span className="cpp-logo">SS</span>
          <span className="cpp-brand-name">SkillSwap</span>
        </div>
        <div className="cpp-topbar-actions">
          <span className="cpp-role-chip">
            {editMode
              ? (isMentor ? "Mentor" : "Learner") + " profile"
              : (isMentor ? "Mentor" : "Learner") + " onboarding"}
          </span>
          {onDismiss && (
            <button
              type="button"
              className="cpp-close"
              onClick={onDismiss}
              aria-label="Close and continue to dashboard"
              title="Close and explore the dashboard"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Close
            </button>
          )}
          <button type="button" className="cpp-logout" onClick={onLogout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Logout
          </button>
        </div>
      </header>

      <div className="cpp-container">
        {/* ── Hero ── */}
        <header className="cpp-hero">
          <span className="cpp-hero-badge">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Get started
          </span>
          <h1 className="cpp-title">{editMode ? "Edit Your Profile" : "Complete Your Profile"}</h1>
          <p className="cpp-subtitle">
            {editMode
              ? "Update your professional details any time. Certifications and projects are optional."
              : "Please complete your profile before continuing to SkillSwap. This only takes a couple of minutes."}
          </p>

          {/* Progress */}
          <div className="cpp-progress-wrap">
            <div className="cpp-progress-meta">
              <span>Profile completion</span>
              <strong>{progress}%</strong>
            </div>
            <div
              className="cpp-progress"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Profile completion progress"
            >
              <div className="cpp-progress-bar" style={{ width: `${progress}%` }} />
            </div>
            {progress === 100 && (
              <p className="cpp-ready-hint">Everything looks great — you're ready to finish!</p>
            )}
          </div>
        </header>

        {/* ── Form card ── */}
        <div className="cpp-card">
          <form ref={formRef} onSubmit={handleSubmit} noValidate>
            {submitError && (
              <div className="cpp-submit-error" role="alert">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {submitError}
              </div>
            )}

            {/* Section 1 — Identity */}
            <section className="cpp-section" aria-labelledby="cpp-s1">
              <SectionHeading
                index={1}
                title="About you"
                subtitle={isMentor ? "Help learners get to know you as a mentor." : "Tell us a little about yourself."}
                icon={
                  <>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </>
                }
              />
              <div className="cpp-grid">
                {fields.slice(0, isMentor ? 4 : 4).map(renderField)}
              </div>
            </section>

            {/* Section 2 — Skills */}
            <section className="cpp-section" aria-labelledby="cpp-s2">
              <SectionHeading
                index={2}
                title={isMentor ? "Skills & pricing" : "Skills & goals"}
                subtitle={
                  isMentor
                    ? "What you teach, your experience, and your rates."
                    : "What you'd like to learn and where you're starting from."
                }
                icon={
                  <>
                    <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
                    <path d="M9 21h6" />
                  </>
                }
              />
              <div className="cpp-grid">
                {fields.slice(4, isMentor ? 11 : 8).map(renderField)}
              </div>
            </section>

            {/* Section 3 — Contact & location */}
            <section className="cpp-section" aria-labelledby="cpp-s3">
              <SectionHeading
                index={3}
                title="Contact & location"
                subtitle="So learners and the platform can reach you in the right timezone."
                icon={
                  <>
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </>
                }
              />
              <div className="cpp-grid">
                {fields.slice(isMentor ? 11 : 8).map(renderField)}
              </div>
            </section>

            {/* ── Optional: Certificates (mentor) ── */}
            {isMentor && (
              <section className="cpp-section cpp-section--optional" aria-labelledby="cpp-cert">
                <SectionHeading
                  index={4}
                  title="Certificates"
                  subtitle="Optional — add verified credentials to build learner trust."
                  icon={
                    <>
                      <path d="M9 12l2 2 4-4" />
                      <path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z" />
                    </>
                  }
                />
                <div className="cpp-optional-grid">
                  <MentorCertificationsManager mentorId={profile?.id} notify={notify} />
                </div>
              </section>
            )}

            {/* ── Optional: Projects (mentor) ── */}
            {isMentor && (
              <section className="cpp-section cpp-section--optional" aria-labelledby="cpp-projects">
                <SectionHeading
                  index={5}
                  title="Projects"
                  subtitle="Optional — showcase your best work to learners."
                  icon={
                    <>
                      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                    </>
                  }
                />
                <div className="cpp-optional-grid">
                  <MentorProjectsManager notify={notify} />
                </div>
              </section>
            )}

            {/* ── Actions ── */}
            <div className="cpp-actions">
              <p className="cpp-actions-note">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                Your details are stored securely and only shared when you book sessions.
              </p>
              <button
                type="submit"
                className="cpp-submit"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="cpp-spinner" aria-hidden="true" />
                    Saving…
                  </>
                ) : (
                  <>
                    {editMode ? "Save Changes" : "Complete Profile"}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        <footer className="cpp-footer">
          <span className="cpp-logo cpp-logo--sm">SS</span>
          <p>SkillSwap · {isPhotoSet ? "Profile photo added ✓" : "Add a profile photo to get discovered faster"}</p>
        </footer>
      </div>
    </main>
  );
}
