import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import client from "../api/client";
import { getApiErrorMessage } from "../utils/apiErrors";
import MentorCertificationsManager from "../components/mentor/MentorCertificationsManager";
import "./ProfessionalProfilePage.css";

/* ── Helpers ─────────────────────────────────────────── */

const initials = (name) =>
  String(name || "P").trim().charAt(0).toUpperCase();

const formatNum = (n) => {
  if (n == null) return "—";
  const v = Number(n);
  if (v >= 1000) return (v / 1000).toFixed(1) + "k";
  return v.toLocaleString();
};

const parseSkillChips = (raw) => {
  const value = String(raw || "").trim();
  if (!value) return [];
  if (value.startsWith("[") && value.includes('"name"')) {
    const m = [...value.matchAll(/"name"\s*:\s*"([^"]+)"/g)].map((x) => x[1].trim()).filter(Boolean);
    if (m.length) return [...new Set(m)];
  }
  return [...new Set(value.split(/[,\n;|]+/).map((s) => s.trim()).filter(Boolean))];
};

const skillChipsToString = (chips) => chips.join(", ");

/* ── Tab config ──────────────────────────────────────── */

const TABS = [
  { key: "personal", label: "Personal", icon: "person" },
  { key: "about", label: "About", icon: "description" },
  { key: "skills", label: "Skills", icon: "auto_awesome" },
  { key: "experience", label: "Experience", icon: "work" },
  { key: "certifications", label: "Certifications", icon: "workspace_premium" },
  { key: "portfolio", label: "Portfolio", icon: "folder_open" },
];

/* ── SVG Sub-Components ──────────────────────────────── */

const ProgressRing = ({ pct, size = 72, stroke = 5 }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="pp-ring">
      <defs>
        <linearGradient id="ppRingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0f766e" />
          <stop offset="100%" stopColor="#14b8a6" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="url(#ppRingGrad)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 1s ease" }}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill="#f8fafc" fontSize={size * 0.2} fontWeight={800}>
        {Math.round(pct)}%
      </text>
    </svg>
  );
};

/* ── Input Components ────────────────────────────────── */

function TextInput({ label, value, onChange, placeholder, maxLength, multiline, rows = 3 }) {
  const id = `pp-field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className="pp-field">
      <label className="pp-field__label" htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea
          id={id}
          className="pp-field__input pp-field__input--textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={rows}
        />
      ) : (
        <input
          id={id}
          className="pp-field__input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
        />
      )}
      {maxLength && (
        <span className="pp-field__count">{String(value || "").length}/{maxLength}</span>
      )}
    </div>
  );
}

function UrlInput({ label, value, onChange, placeholder }) {
  return (
    <TextInput
      label={label}
      value={value}
      onChange={onChange}
      placeholder={placeholder || "https://"}
    />
  );
}

/* ── Main Component ──────────────────────────────────── */

export default function ProfessionalProfilePage({ profile, notify }) {
  const [searchParams, setSearchParams] = useSearchParams();

  /* ── State ── */
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    aboutMe: "",
    skills: "",
    githubUrl: "",
    linkedinUrl: "",
    profileImageUrl: "",
    projects: "",
    pastTeachingSessions: "",
    certificates: "",
  });
  const [skillChips, setSkillChips] = useState([]);
  const [skillInput, setSkillInput] = useState("");
  const [dirty, setDirty] = useState(false);
  const [imgError, setImgError] = useState(false);

  /* ── Active Tab (derived from ?tab= query param) ── */
  const activeTab = (() => {
    const tabKey = searchParams.get("tab") || "personal";
    const tab = TABS.find((t) => t.key === tabKey);
    return tab?.key || "personal";
  })();

  /* ── Populate form from profile ── */
  useEffect(() => {
    if (!profile) return;
    setForm({
      aboutMe: profile.aboutMe || "",
      skills: profile.skills || "",
      githubUrl: profile.githubUrl || "",
      linkedinUrl: profile.linkedinUrl || "",
      profileImageUrl: profile.profileImageUrl || "",
      projects: profile.projects || "",
      pastTeachingSessions: profile.pastTeachingSessions || "",
      certificates: profile.certificates || "",
    });
    setSkillChips(parseSkillChips(profile.skills));
    setImgError(false);
  }, [profile]);

  /* Reset imgError when the user changes the URL */
  useEffect(() => {
    setImgError(false);
  }, [form.profileImageUrl]);

  /* ── Profile completion ── */
  const completion = useMemo(() => ({
    percent: profile?.profileCompletionPercent ?? 0,
    missing: profile?.profileCompletionMissing || [],
  }), [profile]);

  const completionMessage = completion.percent >= 100
    ? "Your profile is complete — you're ready to attract more learners."
    : completion.missing.length
      ? `Add your ${completion.missing.slice(0, 2).join(" and ").toLowerCase()} to attract more learners.`
      : "Complete your profile to attract more learners.";

  /* ── Stats ── */
  const stats = useMemo(() => {
    const chips = parseSkillChips(profile?.skills);
    return [
      { icon: "auto_awesome", value: chips.length, label: "Skills" },
      { icon: "workspace_premium", value: formatNum(profile?.profileCompletionPercent || 0), label: "Completion", suffix: "%" },
      { icon: "link", value: [profile?.githubUrl, profile?.linkedinUrl].filter(Boolean).length, label: "Links" },
    ];
  }, [profile]);

  /* ── Save ── */
  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {};
      if (dirty) {
        if (form.aboutMe !== (profile?.aboutMe || "")) payload.aboutMe = form.aboutMe;
        if (form.skills !== (profile?.skills || "")) payload.skills = form.skills;
        if (form.githubUrl !== (profile?.githubUrl || "")) payload.githubUrl = form.githubUrl;
        if (form.linkedinUrl !== (profile?.linkedinUrl || "")) payload.linkedinUrl = form.linkedinUrl;
        if (form.profileImageUrl !== (profile?.profileImageUrl || "")) payload.profileImageUrl = form.profileImageUrl;
        if (form.projects !== (profile?.projects || "")) payload.projects = form.projects;
        if (form.pastTeachingSessions !== (profile?.pastTeachingSessions || "")) payload.pastTeachingSessions = form.pastTeachingSessions;
        if (form.certificates !== (profile?.certificates || "")) payload.certificates = form.certificates;
      }
      if (Object.keys(payload).length === 0) {
        notify?.({ type: "info", title: "No changes", message: "Nothing to save." });
        setSaving(false);
        return;
      }
      await client.put("/api/v1/users/me/profile", payload);
      notify?.({ type: "success", title: "Profile updated", message: "Your professional profile has been saved." });
      setDirty(false);
    } catch (err) {
      notify?.({ type: "error", title: "Save failed", message: getApiErrorMessage(err, "Could not save profile.") });
    } finally {
      setSaving(false);
    }
  }, [dirty, form, profile, notify]);

  /* ── Skill chip management ── */
  const addSkill = () => {
    const trimmed = skillInput.trim();
    if (!trimmed || skillChips.includes(trimmed)) return;
    const updated = [...skillChips, trimmed];
    setSkillChips(updated);
    setForm((prev) => ({ ...prev, skills: skillChipsToString(updated) }));
    setSkillInput("");
    setDirty(true);
  };

  const removeSkill = (skill) => {
    const updated = skillChips.filter((s) => s !== skill);
    setSkillChips(updated);
    setForm((prev) => ({ ...prev, skills: skillChipsToString(updated) }));
    setDirty(true);
  };

  const handleSkillKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSkill();
    }
  };

  /* ── Render helpers ── */
  const setField = (field) => (value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  };

  /* ── Save bar (shown when dirty) ── */
  const resetForm = useCallback(() => {
    if (!profile) return;
    setForm({
      aboutMe: profile.aboutMe || "",
      skills: profile.skills || "",
      githubUrl: profile.githubUrl || "",
      linkedinUrl: profile.linkedinUrl || "",
      profileImageUrl: profile.profileImageUrl || "",
      projects: profile.projects || "",
      pastTeachingSessions: profile.pastTeachingSessions || "",
      certificates: profile.certificates || "",
    });
    setSkillChips(parseSkillChips(profile.skills));
    setDirty(false);
  }, [profile]);

  const saveBar = dirty ? (
    <div className="pp-save-bar">
      <span className="pp-save-bar__text">You have unsaved changes</span>
      <div className="pp-save-bar__actions">
        <button
          type="button"
          className="pp-btn pp-btn--ghost pp-btn--sm"
          onClick={resetForm}
          disabled={saving}
        >
          Discard
        </button>
        <button
          type="button"
          className="pp-btn pp-btn--primary pp-btn--sm"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  ) : null;

  /* ── Render ────────────────────────────────────────── */
  return (
    <div className="pp-shell">
      {/* ── Hero ── */}
      <section className="pp-hero">
        <div className="pp-hero__bg" />
        <div className="pp-hero__body">
          <div className="pp-hero__left">
            <div className="pp-hero__eyebrow">
              <span className="pp-hero__eyebrow-dot" />
              PROFESSIONAL PROFILE
            </div>

            <div className="pp-hero__info">
              <div className="pp-hero__avatar-wrap">
                {profile?.profileImageUrl ? (
                  <img src={profile.profileImageUrl} alt={profile.fullName || "Profile"} className="pp-hero__avatar" />
                ) : (
                  <div className="pp-hero__avatar-fallback">{initials(profile?.fullName)}</div>
                )}
              </div>
              <div className="pp-hero__text">
                <h1 className="pp-hero__name">{profile?.fullName || "Your Profile"}</h1>
                {profile?.username && (
                  <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "rgba(255,255,255,0.55)" }}>
                    @{profile.username}
                  </p>
                )}
                <p className="pp-hero__subtitle">
                  Manage your mentor profile, skills, and credentials to build learner trust.
                </p>
              </div>
            </div>

            <div className="pp-hero__stats">
              {stats.map((s) => (
                <div key={s.label} className="pp-hero__stat">
                  <span className="material-symbols-outlined pp-hero__stat-icon">{s.icon}</span>
                  <strong>{s.value}{s.suffix || ""}</strong>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pp-hero__right">
            <div className="pp-hero__completion">
              <ProgressRing pct={completion.percent} size={80} stroke={5} />
              <div className="pp-hero__completion-text">
                <strong>Profile Completion</strong>
                <span>{completionMessage}</span>
              </div>
            </div>
            <Link to="/profile-setup" className="pp-btn pp-btn--primary pp-btn--sm" style={{ width: "100%", textAlign: "center" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>edit</span>
              Full Profile Setup
            </Link>
          </div>
        </div>
      </section>

      {/* ── Tabs ── */}
      <nav className="pp-tabs" aria-label="Profile sections">
        <div className="pp-tabs__track" role="tablist">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                id={`pp-tab-${tab.key}`}
                className={`pp-tab${isActive ? " pp-tab--active" : ""}`}
                aria-selected={isActive}
                aria-controls={`pp-panel-${tab.key}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => {
                  setSearchParams(
                    tab.key === "personal" ? {} : { tab: tab.key },
                    { replace: true },
                  );
                }}
              >
                <span className="material-symbols-outlined pp-tab__icon">{tab.icon}</span>
                <span className="pp-tab__label">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Save Bar ── */}
      {saveBar}

      {/* ── Tab Content ── */}
      <div className="pp-content">

        {/* PERSONAL */}
        {activeTab === "personal" && (
          <div
            className="pp-card"
            role="tabpanel"
            id="pp-panel-personal"
            aria-labelledby="pp-tab-personal"
          >
            <div className="pp-card__head">
              <h3 className="pp-card__title">
                <span className="material-symbols-outlined">person</span>
                Personal Information
              </h3>
              <p className="pp-card__subtitle">The basics learners see first.</p>
            </div>
            <div className="pp-card__body">
              <dl className="pp-detail-list">
                <div className="pp-detail-row">
                  <dt>Name</dt>
                  <dd>{profile?.fullName || "Not provided"}</dd>
                </div>
                <div className="pp-detail-row">
                  <dt>Email</dt>
                  <dd>{profile?.email || "Not provided"}</dd>
                </div>
                <div className="pp-detail-row">
                  <dt>Role</dt>
                  <dd><span className="pp-badge pp-badge--mentor">Mentor</span></dd>
                </div>
                <div className="pp-detail-row">
                  <dt>Verification</dt>
                  <dd>
                    {profile?.mentorVerified ? (
                      <span className="pp-badge pp-badge--verified">
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>verified</span>
                        Verified
                      </span>
                    ) : (
                      <span className="pp-badge pp-badge--pending">Pending</span>
                    )}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {/* ABOUT */}
        {activeTab === "about" && (
          <div
            className="pp-card"
            role="tabpanel"
            id="pp-panel-about"
            aria-labelledby="pp-tab-about"
          >
            <div className="pp-card__head">
              <h3 className="pp-card__title">
                <span className="material-symbols-outlined">description</span>
                About You
              </h3>
              <p className="pp-card__subtitle">Tell learners about your background and teaching approach.</p>
            </div>
            <div className="pp-card__body">
              {/* Profile Image */}
              <div className="pp-avatar-editor">
                <div className="pp-avatar-editor__preview">
                  {form.profileImageUrl && !imgError ? (
                    <img
                      src={form.profileImageUrl}
                      alt="Profile preview"
                      className="pp-avatar-editor__img"
                      onError={() => setImgError(true)}
                    />
                  ) : null}
                  <div className="pp-avatar-editor__fallback" style={{ display: form.profileImageUrl && !imgError ? "none" : "flex" }}>
                    <span className="material-symbols-outlined">person</span>
                  </div>
                </div>
                <div className="pp-avatar-editor__fields">
                  <UrlInput
                    label="Profile Image URL"
                    value={form.profileImageUrl}
                    onChange={setField("profileImageUrl")}
                    placeholder="https://example.com/your-photo.jpg"
                  />
                  <p className="pp-avatar-editor__hint">
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>info</span>
                    Paste a URL to your profile photo. URL must start with http:// or https://. Supported formats: JPEG, PNG, WebP.
                  </p>
                </div>
              </div>

              <TextInput
                label="Bio"
                value={form.aboutMe}
                onChange={setField("aboutMe")}
                placeholder="Share your professional background, teaching philosophy, and what learners can expect..."
                maxLength={2000}
                multiline
                rows={5}
              />
              <div className="pp-field-row">
                <UrlInput
                  label="GitHub URL"
                  value={form.githubUrl}
                  onChange={setField("githubUrl")}
                  placeholder="https://github.com/your-profile"
                />
                <UrlInput
                  label="LinkedIn URL"
                  value={form.linkedinUrl}
                  onChange={setField("linkedinUrl")}
                  placeholder="https://linkedin.com/in/your-profile"
                />
              </div>
            </div>
          </div>
        )}

        {/* SKILLS */}
        {activeTab === "skills" && (
          <div
            className="pp-card"
            role="tabpanel"
            id="pp-panel-skills"
            aria-labelledby="pp-tab-skills"
          >
            <div className="pp-card__head">
              <h3 className="pp-card__title">
                <span className="material-symbols-outlined">auto_awesome</span>
                Skills
              </h3>
              <p className="pp-card__subtitle">Help learners discover your expertise by adding relevant skills.</p>
            </div>
            <div className="pp-card__body">
              <div className="pp-skill-editor">
                <div className="pp-skill-editor__input-row">
                  <input
                    type="text"
                    className="pp-field__input"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={handleSkillKeyDown}
                    placeholder="Type a skill and press Enter..."
                  />
                  <button type="button" className="pp-btn pp-btn--primary pp-btn--sm" onClick={addSkill} disabled={!skillInput.trim()}>
                    Add
                  </button>
                </div>
                <div className="pp-skill-editor__chips">
                  {skillChips.length > 0 ? (
                    skillChips.map((skill) => (
                      <span key={skill} className="pp-chip">
                        {skill}
                        <button type="button" className="pp-chip__remove" onClick={() => removeSkill(skill)} aria-label={`Remove ${skill}`}>
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                        </button>
                      </span>
                    ))
                  ) : (
                    <p className="pp-muted">No skills added yet. Start typing above to add your expertise.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* EXPERIENCE */}
        {activeTab === "experience" && (
          <div
            className="pp-card"
            role="tabpanel"
            id="pp-panel-experience"
            aria-labelledby="pp-tab-experience"
          >
            <div className="pp-card__head">
              <h3 className="pp-card__title">
                <span className="material-symbols-outlined">work</span>
                Experience
              </h3>
              <p className="pp-card__subtitle">Your professional background and teaching highlights.</p>
            </div>
            <div className="pp-card__body">
              <TextInput
                label="Past Teaching & Session Highlights"
                value={form.pastTeachingSessions}
                onChange={setField("pastTeachingSessions")}
                placeholder="Describe your past teaching experience, notable sessions, and professional achievements..."
                maxLength={6000}
                multiline
                rows={6}
              />
            </div>
          </div>
        )}

        {/* CERTIFICATIONS */}
        {activeTab === "certifications" && (
          <div
            role="tabpanel"
            id="pp-panel-certifications"
            aria-labelledby="pp-tab-certifications"
          >
            <MentorCertificationsManager mentorId={profile?.id} notify={notify} />
          </div>
        )}

        {/* PORTFOLIO */}
        {activeTab === "portfolio" && (
          <div
            className="pp-card"
            role="tabpanel"
            id="pp-panel-portfolio"
            aria-labelledby="pp-tab-portfolio"
          >
            <div className="pp-card__head">
              <h3 className="pp-card__title">
                <span className="material-symbols-outlined">folder_open</span>
                Portfolio
              </h3>
              <p className="pp-card__subtitle">Show learners your best work and project highlights.</p>
            </div>
            <div className="pp-card__body">
              <div className="pp-field-row">
                <UrlInput
                  label="GitHub URL"
                  value={form.githubUrl}
                  onChange={setField("githubUrl")}
                  placeholder="https://github.com/your-profile"
                />
                <UrlInput
                  label="LinkedIn URL"
                  value={form.linkedinUrl}
                  onChange={setField("linkedinUrl")}
                  placeholder="https://linkedin.com/in/your-profile"
                />
              </div>
              <TextInput
                label="Projects & Highlights"
                value={form.projects}
                onChange={setField("projects")}
                placeholder="Describe your key projects, outcomes, and links to live demos..."
                maxLength={6000}
                multiline
                rows={6}
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
