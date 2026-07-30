import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import client from "../api/client";
import RoleSwitcher from "../components/RoleSwitcher";
import {
  getProfileQualityScore,
  parseSkillTags,
  serializeSkillTags,
  SKILL_LEVELS,
} from "../utils/profileSkills";
import "./ProfileSetup.css";

/* ─────────────────────────────────────────────────────────────
   Constants
   ───────────────────────────────────────────────────────────── */
const STEPS = [
  { key: "basic", label: "Basic Info", icon: "person" },
  { key: "skills", label: "Skills & Experience", icon: "psychology" },
  { key: "portfolio", label: "Links & Portfolio", icon: "link" },
];

const emptyForm = {
  skills: "",
  aboutMe: "",
  githubUrl: "",
  linkedinUrl: "",
  profileImageUrl: "",
  pastTeachingSessions: "",
  certificates: "",
  projects: "",
};

const emptyProject = {
  title: "",
  description: "",
  technologies: "",
  githubUrl: "",
  liveDemoUrl: "",
  startDate: "",
  endDate: "",
  currentlyWorking: false,
};

/* ─────────────────────────────────────────────────────────────
   Step Indicator Component
   ───────────────────────────────────────────────────────────── */
function StepIndicator({ currentStep, onStepClick }) {
  return (
    <div className="ps-stepper">
      {STEPS.map((step, idx) => {
        const isActive = currentStep === idx;
        const isCompleted = currentStep > idx;
        return (
          <div
            key={step.key}
            className={`ps-step${isCompleted ? " completed" : ""}${isActive ? " active" : ""}`}
          >
            <div
              className={`ps-step-circle${!isCompleted && !isActive ? " ps-step-circle--disabled" : ""}`}
              onClick={() => {
                if (isCompleted || isActive) onStepClick(idx);
              }}
              role="button"
              tabIndex={isCompleted || isActive ? 0 : -1}
              aria-disabled={!isCompleted && !isActive}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  if (isCompleted || isActive) onStepClick(idx);
                }
              }}
            >
              {isCompleted ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                idx + 1
              )}
            </div>
            <span className="ps-step-label">{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Circular Progress Component
   ───────────────────────────────────────────────────────────── */
function CircularProgress({ value, size = 88, strokeWidth = 7 }) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (Math.min(100, Math.max(0, value)) / 100) * circumference;

  return (
    <div className="ps-completion-ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`}>
        <circle className="ps-completion-ring-bg" cx={cx} cy={cx} r={r} />
        <circle
          className="ps-completion-ring-fg"
          cx={cx}
          cy={cx}
          r={r}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="ps-completion-ring-text">
        <span className="ps-completion-pct">{value}%</span>
        <span className="ps-completion-pct-label">complete</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Completion Card (Sidebar)
   ───────────────────────────────────────────────────────────── */
function CompletionCard({ qualityScore, completedChecks, totalChecks }) {
  const remaining = totalChecks - completedChecks;
  const message =
    qualityScore < 33
      ? { title: "Let's get started!", text: "Fill in your profile to help learners discover you." }
      : qualityScore < 66
        ? { title: "Almost there!", text: "Just a few more details to complete your profile." }
        : { title: "Looking great!", text: "Your profile is ready to impress learners." };

  return (
    <div className="ps-completion">
      <CircularProgress value={qualityScore} />
      <h4>{message.title}</h4>
      <p>{message.text}</p>
      {remaining > 0 && (
        <div className="ps-completion-remaining">
          <span>🔄</span>
          <span><strong>{remaining}</strong> of {totalChecks} sections remaining</span>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Tip Card (Sidebar)
   ───────────────────────────────────────────────────────────── */
function TipsCard({ checks }) {
  const total = checks.length;
  const done = checks.filter((c) => c.done).length;

  return (
    <div className="ps-tips">
      <h3>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
          <path d="M9 21h6" />
        </svg>
        Profile Checklist
      </h3>
      <div className="ps-checklist">
        {checks.map((check) => (
          <div
            key={check.key}
            className={`ps-checklist-item${check.done ? " done" : ""}`}
            onClick={check.onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") check.onClick();
            }}
          >
            <span className="ps-checklist-check">
              {check.done && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </span>
            <span>{check.label}</span>
            <span className="ps-checklist-count">{check.done ? "✓" : `${check.current ?? 0}/${check.required ?? 1}`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Field Helper
   ───────────────────────────────────────────────────────────── */
function Field({ label, helper, children, className = "" }) {
  return (
    <div className={`ps-field ${className}`}>
      {label && <label className="ps-label">{label}</label>}
      {children}
      {helper && <p className="ps-helper">{helper}</p>}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═════════════════════════════════════════════════════════════ */
export default function ProfileSetup({
  initialProfile,
  onCompleted,
  onLogout,
  onProfileUpdated,
  notify,
}) {
  /* ── State ── */
  const [currentStep, setCurrentStep] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [skillTags, setSkillTags] = useState([]);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillLevel, setNewSkillLevel] = useState("Intermediate");
  const [skillError, setSkillError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState([]);
  const [projectEditor, setProjectEditor] = useState(emptyProject);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [projectError, setProjectError] = useState("");
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [touchedFields, setTouchedFields] = useState({});
  const [structuredCertsCount, setStructuredCertsCount] = useState(0);

  /* ── Refs ── */
  const cardRef = useRef(null);
  const skillInputRef = useRef(null);

  /* ── Certification count callback ── */
  const handleCertCountChange = useCallback((count) => {
    setStructuredCertsCount(count);
  }, []);

  /* ── Compute quality score ── */
  const hasAboutMe = Boolean(String(form.aboutMe || "").trim());
  const hasSkills = skillTags.length > 0;
  const hasGithub = /^https?:\/\//i.test(String(form.githubUrl || "").trim());
  const hasLinkedin = /^https?:\/\//i.test(String(form.linkedinUrl || "").trim());
  const hasPortfolio = projects.length > 0;
  const hasExperience = Boolean(String(form.pastTeachingSessions || "").trim());
  const hasCertifications = Boolean(String(form.certificates || "").trim()) || structuredCertsCount > 0;

  const requiredChecks = [
    { key: "basic", label: "Basic Information", done: hasAboutMe, current: hasAboutMe ? 1 : 0, required: 1 },
    { key: "skills", label: "Skills & Experience", done: hasSkills, current: skillTags.length, required: 1 },
    { key: "experience", label: "Experience", done: hasExperience, current: hasExperience ? 1 : 0, required: 1 },
    { key: "certifications", label: "Certifications", done: hasCertifications, current: hasCertifications ? 1 : 0, required: 1 },
    { key: "portfolio", label: "Portfolio / Links", done: hasGithub && hasLinkedin, current: [hasGithub, hasLinkedin, hasPortfolio].filter(Boolean).length, required: 3 },
  ];
  const completedChecks = requiredChecks.filter((c) => c.done).length;
  const totalChecks = requiredChecks.length;

  const qualityScore = useMemo(
    () =>
      getProfileQualityScore({
        ...form,
        skills: serializeSkillTags(skillTags),
      }),
    [form, skillTags],
  );

  /* ── Scroll to top on step change ── */
  useEffect(() => {
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [currentStep]);

  /* ── Load initial data ── */
  useEffect(() => {
    const parsedTags = parseSkillTags(initialProfile?.skills);
    setForm({
      skills: initialProfile?.skills || "",
      aboutMe: initialProfile?.aboutMe || "",
      githubUrl: initialProfile?.githubUrl || "",
      linkedinUrl: initialProfile?.linkedinUrl || "",
      profileImageUrl: initialProfile?.profileImageUrl || "",
      pastTeachingSessions: initialProfile?.pastTeachingSessions || "",
      certificates: initialProfile?.certificates || "",
      projects: initialProfile?.projects || "",
    });
    setSkillTags(parsedTags);
    if (initialProfile?.id) {
      fetchProjects();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProfile]);

  const fetchProjects = async () => {
    try {
      const response = await client.get("/api/v1/users/me/projects");
      setProjects(response.data.data || []);
    } catch (err) {
      // silently ignore project load failures
    }
  };

  /* ── Form handlers ── */
  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleBlur = (e) => {
    setTouchedFields((prev) => ({ ...prev, [e.target.name]: true }));
  };

  /* ── Skill management ── */
  const addSkill = () => {
    const name = newSkillName.trim();
    if (!name) {
      setSkillError("Please enter a skill name before adding.");
      return;
    }

    setSkillError("");
    const exists = skillTags.some(
      (t) => t.name.toLowerCase() === name.toLowerCase(),
    );
    if (exists) {
      setSkillTags((prev) =>
        prev.map((t) =>
          t.name.toLowerCase() === name.toLowerCase()
            ? { ...t, level: newSkillLevel }
            : t,
        ),
      );
    } else {
      setSkillTags((prev) => [...prev, { name, level: newSkillLevel }]);
    }
    setNewSkillName("");
    setNewSkillLevel("Intermediate");
    // Re-focus the input after adding
    skillInputRef.current?.focus();
  };

  const removeSkill = (index) => {
    setSkillTags((prev) => prev.filter((_, i) => i !== index));
    setSkillError("");
  };

  const handleSkillKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addSkill();
    }
  };

  /* ── Project management ── */
  const resetProjectEditor = () => {
    setActiveProjectId(null);
    setProjectEditor(emptyProject);
    setProjectError("");
  };

  const validateProjectInput = () => {
    if (!projectEditor.title.trim()) return "Project title is required";
    if (!projectEditor.description.trim()) return "Project description is required";
    if (!projectEditor.technologies.trim()) return "Project technologies are required";
    if (!projectEditor.startDate) return "Project start date is required";
    if (!projectEditor.currentlyWorking && projectEditor.endDate) {
      const start = new Date(projectEditor.startDate);
      const end = new Date(projectEditor.endDate);
      if (end < start) return "End date cannot be before start date";
    }
    return null;
  };

  const saveProject = async () => {
    setProjectError("");
    const validationError = validateProjectInput();
    if (validationError) {
      setProjectError(validationError);
      return;
    }

    try {
      const payload = {
        ...projectEditor,
        title: projectEditor.title.trim(),
        description: projectEditor.description.trim(),
        technologies: projectEditor.technologies.trim(),
        githubUrl: projectEditor.githubUrl.trim() || null,
        liveDemoUrl: projectEditor.liveDemoUrl.trim() || null,
        endDate:
          projectEditor.currentlyWorking || !projectEditor.endDate
            ? null
            : projectEditor.endDate,
      };

      const response = activeProjectId
        ? await client.put(`/api/v1/users/me/projects/${activeProjectId}`, payload)
        : await client.post("/api/v1/users/me/projects", payload);

      const savedProject = response.data.data;
      setProjects((current) => {
        if (activeProjectId) {
          return current.map((item) =>
            item.id === activeProjectId ? savedProject : item,
          );
        }
        return [...current, savedProject];
      });
      resetProjectEditor();
      setProjectModalOpen(false);
    } catch (err) {
      // Extract backend error message from various possible response formats
      const extractErrorMessage = () => {
        const res = err?.response;
        if (!res) {
          return "Unable to connect to the server. Please check your connection and try again.";
        }

        // 1. Standard ApiResponse format: { message, data: { error, errors } }
        const dataObj = res.data?.data;
        if (dataObj) {
          // Single error string
          if (dataObj.error) return dataObj.error;
          // Field-level validation errors map
          if (dataObj.errors && typeof dataObj.errors === "object") {
            const firstValue = Object.values(dataObj.errors).find(Boolean);
            if (firstValue) return firstValue;
          }
        }

        // 2. Top-level ApiResponse message (skip the generic "Request failed" wrapper)
        //    Actual error details are already covered by #1 above.
        // 3. Spring Boot default error format: { error, message, status }

        // 3. Spring Boot default error format: { error, message, status }
        if (res.data?.error && typeof res.data.error === "string") {
          return res.data.error;
        }
        if (res.data?.message && typeof res.data.message === "string") {
          return res.data.message;
        }

        // 4. HTTP status-based fallback
        const statusMessages = {
          400: "Invalid request. Please check your inputs and try again.",
          401: "Your session has expired. Please log in again.",
          403: "You do not have permission to perform this action.",
          404: "The requested resource was not found.",
          409: "A conflict occurred. Please try again.",
          422: "Unprocessable entity. Please check your inputs.",
          500: "Server error. Please try again later.",
          503: "Service temporarily unavailable. Please try again later.",
        };
        if (statusMessages[res.status]) return statusMessages[res.status];

        return "Unable to save project. Verify required fields and try again.";
      };

      setProjectError(extractErrorMessage());
      // Log the full error for debugging
      if (process.env.NODE_ENV === 'development') {
        console.debug("[ProfileSetup] saveProject error:", err);
      }
    }
  };

  const deleteProject = async (projectId) => {
    try {
      await client.delete(`/api/v1/users/me/projects/${projectId}`);
      setProjects((current) => current.filter((p) => p.id !== projectId));
    } catch (err) {
      notify?.({
        type: "error",
        title: "Delete failed",
        message: "Unable to delete project.",
      });
    }
  };

  const handleProjectFieldChange = (event) => {
    const { name, value, type, checked } = event.target;
    setProjectEditor((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setProjectError("");
  };

  const openProjectModal = (project = null) => {
    if (project) {
      setActiveProjectId(project.id);
      setProjectEditor({
        title: project.title || "",
        description: project.description || "",
        technologies: project.technologies || "",
        githubUrl: project.githubUrl || "",
        liveDemoUrl: project.liveDemoUrl || "",
        startDate: project.startDate || "",
        endDate: project.endDate || "",
        currentlyWorking: project.currentlyWorking || false,
      });
    } else {
      resetProjectEditor();
    }
    setProjectModalOpen(true);
  };

  /* ── Profile save ── */
  const saveProfile = useCallback(
    async (payload, { notifySuccess } = {}) => {
      setIsSaving(true);
      try {
        const response = await client.put("/api/v1/users/me/profile", payload);
        const updated = response.data.data;
        setLastSavedAt(new Date());
        setLastSavedSnapshot({ form: { ...form }, skillTags: [...skillTags] });
        onProfileUpdated?.(updated);
        if (notifySuccess) {
          notify?.({
            type: "success",
            title: "Profile saved",
            message: "Changes saved.",
          });
        }
        return updated;
      } catch (err) {
        if (notifySuccess) {
          notify?.({
            type: "error",
            title: "Save failed",
            message: "Unable to save profile.",
          });
        }
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [form, skillTags, onProfileUpdated, notify],
  );

  /* ── Autosave ── */
  useEffect(() => {
    const interval = setInterval(() => {
      // Autosave: only include fields that have a value to avoid overwriting
      // previously saved data with empty strings
      const payload = {
        skills: serializeSkillTags(skillTags),
      };
      if (form.aboutMe) payload.aboutMe = form.aboutMe;
      if (form.githubUrl) payload.githubUrl = form.githubUrl;
      if (form.linkedinUrl) payload.linkedinUrl = form.linkedinUrl;
      if (form.profileImageUrl) payload.profileImageUrl = form.profileImageUrl;
      if (form.pastTeachingSessions) payload.pastTeachingSessions = form.pastTeachingSessions;
      if (form.certificates) payload.certificates = form.certificates;
      if (form.projects) payload.projects = form.projects;
      saveProfile(payload).catch(() => {});
    }, 30000);

    return () => clearInterval(interval);
  }, [form, skillTags, saveProfile]);

  /* ── Undo ── */
  const handleUndo = () => {
    if (!lastSavedSnapshot) return;
    setForm(lastSavedSnapshot.form || emptyForm);
    setSkillTags(lastSavedSnapshot.skillTags || []);
    notify?.({
      type: "info",
      title: "Restored",
      message: "Reverted to last saved draft.",
    });
  };

  /* ── Final Submit ── */
  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    // Validate all required fields before final save
    if (skillTags.length === 0) {
      setError("Please add at least one skill tag before saving.");
      setCurrentStep(1);
      notify?.({
        type: "warning",
        title: "Missing skills",
        message: "Add at least one skill so learners can discover your profile.",
      });
      return;
    }

    // Optional: validate URL format only if user entered a URL
    const enteredGithub = String(form.githubUrl || "").trim();
    const enteredLinkedin = String(form.linkedinUrl || "").trim();
    if (enteredGithub && !/^https?:\/\//i.test(enteredGithub)) {
      setError("GitHub URL must start with https://");
      setCurrentStep(2);
      return;
    }
    if (enteredLinkedin && !/^https?:\/\//i.test(enteredLinkedin)) {
      setError("LinkedIn URL must start with https://");
      setCurrentStep(2);
      return;
    }

    setSaving(true);
    try {
      const serializedSkills = serializeSkillTags(skillTags);
      const payload = {
        skills: serializedSkills,
        aboutMe: form.aboutMe,
        githubUrl: form.githubUrl,
        linkedinUrl: form.linkedinUrl,
        profileImageUrl: form.profileImageUrl,
        pastTeachingSessions: form.pastTeachingSessions,
        certificates: form.certificates,
        projects: form.projects,
      };
      const response = await saveProfile(payload, { notifySuccess: true });
      if (response && onCompleted) onCompleted(response);
    } catch (err) {
      const backendError =
        err?.response?.data?.data?.error ||
        "Could not save profile. Please check required fields and retry.";
      setError(backendError);
      notify?.({
        type: "error",
        title: "Profile update failed",
        message: backendError,
      });
    } finally {
      setSaving(false);
    }
  };

  /* ── Step navigation logic ── */
  const goToStep = (stepIndex) => {
    setError("");
    setSkillError("");

    // Going back is always allowed
    if (stepIndex < currentStep) {
      setCurrentStep(stepIndex);
      return;
    }

    // Going forward requires validation
    if (stepIndex > currentStep) {
      // Moving from Step 1 to Step 2: no validation needed (aboutMe is optional)
      if (currentStep === 0 && stepIndex === 1) {
        setCurrentStep(stepIndex);
        return;
      }

      // Moving from Step 2 to Step 3: must have at least 1 skill
      if (currentStep === 1 && stepIndex === 2) {
        if (skillTags.length === 0) {
          setSkillError("Please add at least one skill before continuing.");
          return;
        }
        setCurrentStep(stepIndex);
        return;
      }
    }
  };

  const handleContinue = () => {
    goToStep(currentStep + 1);
  };

  const scrollToChecklist = (key) => {
    // Map checklist keys to step indices: basic→0, skills→1, experience/certifications/portfolio→2
    const keyStepMap = {
      basic: 0,
      skills: 1,
      experience: 2,
      certifications: 2,
      portfolio: 2,
    };
    const stepIndex = keyStepMap[key] ?? STEPS.findIndex((s) => s.key === key);
    if (stepIndex >= 0) {
      setCurrentStep(stepIndex);
    }
  };

  /* ── Build checklist data ── */
  const checklistItems = [
    {
      key: "basic",
      label: "Basic Information",
      done: hasAboutMe,
      current: hasAboutMe ? 1 : 0,
      required: 1,
      onClick: () => scrollToChecklist("basic"),
    },
    {
      key: "skills",
      label: "Skills & Experience",
      done: hasSkills,
      current: skillTags.length,
      required: 1,
      onClick: () => scrollToChecklist("skills"),
    },
    {
      key: "experience",
      label: "Experience",
      done: hasExperience,
      current: hasExperience ? 1 : 0,
      required: 1,
      onClick: () => scrollToChecklist("experience"),
    },
    {
      key: "certifications",
      label: "Certifications",
      done: hasCertifications,
      current: hasCertifications ? Math.max(1, structuredCertsCount) : 0,
      required: 1,
      onClick: () => scrollToChecklist("certifications"),
    },
    {
      key: "portfolio",
      label: "Portfolio / Links",
      done: hasGithub && hasLinkedin,
      current: [hasGithub, hasLinkedin, hasPortfolio].filter(Boolean).length,
      required: 3,
      onClick: () => scrollToChecklist("portfolio"),
    },
  ];

  /* ─────────────────────────────────────────────────────────────
     Render
     ───────────────────────────────────────────────────────────── */
  return (
    <main className="ps-wrapper">
      <div className="ps-container">
        {/* ── Header ── */}
        <header className="ps-header">
          <h1>Complete Your Mentor Profile</h1>
          <p>Fill in your details to attract more learners and build trust in the community.</p>
          <StepIndicator currentStep={currentStep} onStepClick={goToStep} />
        </header>

        {/* ── Main Content ── */}
        <div className="ps-content">
          {/* ── Sidebar ── */}
          <aside className="ps-sidebar">
            <CompletionCard
              qualityScore={qualityScore}
              completedChecks={completedChecks}
              totalChecks={totalChecks}
            />
            <TipsCard checks={checklistItems} />
          </aside>

          {/* ── Form Area ── */}
          <div className="ps-main" ref={cardRef}>
            <div className="ps-card">
              <form onSubmit={handleSubmit}>
                {/* ═══ STEP 1: Basic Info ═══ */}
                {currentStep === 0 && (
                  <div className="ps-step-content">
                    <div className="ps-section-head">
                      <h2>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        Basic Information
                      </h2>
                      <p>Tell learners who you are and what you do.</p>
                    </div>

                    <Field
                      label="About Yourself"
                      helper="A great bio helps build trust with learners. Tell them about your background and expertise."
                    >
                      <div style={{ position: "relative" }}>
                        <textarea
                          className="ps-textarea"
                          name="aboutMe"
                          placeholder="Tell others about yourself, your background, and expertise..."
                          value={form.aboutMe}
                          onChange={handleChange}
                          rows={5}
                          maxLength={500}
                        />
                        <div className="ps-counter">{form.aboutMe.length}/500</div>
                      </div>
                    </Field>

                    <Field
                      label="Profile Picture URL"
                      helper="Use a professional headshot (JPG, PNG, or WebP)."
                    >
                      <input
                        className="ps-input"
                        name="profileImageUrl"
                        type="url"
                        placeholder="https://example.com/your-photo.jpg"
                        value={form.profileImageUrl}
                        onChange={handleChange}
                      />
                      {form.profileImageUrl && (
                        <div style={{ marginTop: 10, borderRadius: 10, overflow: "hidden", maxWidth: 160, border: "1px solid #e2e8f0" }}>
                          <img
                            src={form.profileImageUrl}
                            alt="Profile preview"
                            style={{ width: "100%", height: "auto", display: "block" }}
                            onError={(e) => { e.target.style.display = "none"; }}
                          />
                        </div>
                      )}
                    </Field>
                  </div>
                )}

                {/* ═══ STEP 2: Skills & Experience ═══ */}
                {currentStep === 1 && (
                  <div className="ps-step-content">
                    <div className="ps-section-head">
                      <h2>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
                          <path d="M9 21h6" />
                        </svg>
                        Skills &amp; Experience
                      </h2>
                      <p>Add the skills you can teach. Learners search by skill to find mentors like you.</p>
                    </div>

                    {/* Skill Input */}
                    <Field label="Add a Skill">
                      <div className="ps-skills-row">
                        <input
                          ref={skillInputRef}
                          className="ps-input"
                          placeholder="Enter a skill"
                          value={newSkillName}
                          onChange={(e) => setNewSkillName(e.target.value)}
                          onKeyDown={handleSkillKeyDown}
                        />
                        <select
                          className="ps-select"
                          value={newSkillLevel}
                          onChange={(e) => setNewSkillLevel(e.target.value)}
                        >
                          {SKILL_LEVELS.map((level) => (
                            <option key={level} value={level}>{level}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="ps-btn-add-skill"
                          onClick={addSkill}
                          disabled={!newSkillName.trim()}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                          Add
                        </button>
                      </div>
                    </Field>

                    {/* Inline validation for empty skill input */}
                    {skillError && (
                      <div className="ps-skill-error-inline">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        {skillError}
                      </div>
                    )}

                    {/* Skill Tags */}
                    {skillTags.length > 0 ? (
                      <div className="ps-tags">
                        {skillTags.map((tag, idx) => (
                          <span key={idx} className="ps-tag">
                            <span>{tag.name}</span>
                            <span className="ps-tag-level">{tag.level}</span>
                            <button
                              type="button"
                              className="ps-tag-remove"
                              onClick={() => removeSkill(idx)}
                              aria-label={`Remove ${tag.name}`}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="ps-tags-empty">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
                        </svg>
                        <span>No skills added yet. Type a skill above and click "Add".</span>
                      </div>
                    )}


                  </div>
                )}

                {/* ═══ STEP 3: Links & Portfolio ═══ */}
                {currentStep === 2 && (
                  <div className="ps-step-content">
                    <div className="ps-section-head">
                      <h2>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                        Links &amp; Portfolio
                      </h2>
                      <p>Connect your professional profiles and showcase your work.</p>
                    </div>

                    <Field
                      label="GitHub URL"
                      helper="Link to your GitHub profile so learners can see your open-source work."
                    >
                      <input
                        className="ps-input"
                        name="githubUrl"
                        type="url"
                        placeholder="https://github.com/your-username"
                        value={form.githubUrl}
                        onChange={handleChange}
                        onBlur={handleBlur}
                      />
                      {touchedFields.githubUrl && form.githubUrl && !hasGithub && (
                        <p className="ps-error" style={{ marginTop: 6, fontSize: 12, padding: "6px 10px" }}>
                          Please enter a full URL starting with https://
                        </p>
                      )}
                    </Field>

                    <Field
                      label="LinkedIn URL"
                      helper="Link to your LinkedIn profile for professional credibility."
                    >
                      <input
                        className="ps-input"
                        name="linkedinUrl"
                        type="url"
                        placeholder="https://linkedin.com/in/your-profile"
                        value={form.linkedinUrl}
                        onChange={handleChange}
                        onBlur={handleBlur}
                      />
                      {touchedFields.linkedinUrl && form.linkedinUrl && !hasLinkedin && (
                        <p className="ps-error" style={{ marginTop: 6, fontSize: 12, padding: "6px 10px" }}>
                          Please enter a full URL starting with https://
                        </p>
                      )}
                    </Field>

                    {/* Experience Section */}
                    <div style={{ marginTop: 32 }}>
                      <div className="ps-section-head" style={{ marginBottom: 16 }}>
                        <h3>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: 6 }}>
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                          Experience
                        </h3>
                        <p className="ps-helper">Describe your past teaching experience, notable sessions, and professional achievements.</p>
                      </div>
                      <Field label="Past Teaching & Session Highlights">
                        <div style={{ position: "relative" }}>
                          <textarea
                            className="ps-textarea"
                            name="pastTeachingSessions"
                            placeholder="Describe your past teaching experience, notable sessions, and professional achievements..."
                            value={form.pastTeachingSessions}
                            onChange={handleChange}
                            rows={4}
                            maxLength={6000}
                          />
                          <div className="ps-counter">{form.pastTeachingSessions.length}/6000</div>
                        </div>
                      </Field>
                    </div>

                    {/* Projects & Highlights (free-text) */}
                    <div style={{ marginTop: 32 }}>
                      <div className="ps-section-head" style={{ marginBottom: 16 }}>
                        <h3>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: 6 }}>
                            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                            <line x1="8" y1="21" x2="16" y2="21" />
                            <line x1="12" y1="17" x2="12" y2="21" />
                          </svg>
                          Projects & Highlights
                        </h3>
                        <p className="ps-helper">Describe your key projects, outcomes, and links to live demos.</p>
                      </div>
                      <Field label="Projects Overview">
                        <div style={{ position: "relative" }}>
                          <textarea
                            className="ps-textarea"
                            name="projects"
                            placeholder="Describe your key projects, outcomes, and links to live demos..."
                            value={form.projects}
                            onChange={handleChange}
                            rows={4}
                            maxLength={6000}
                          />
                          <div className="ps-counter">{form.projects.length}/6000</div>
                        </div>
                      </Field>
                    </div>

                    {/* Certifications Section */}
                    <div style={{ marginTop: 32 }}>
                      <div className="ps-section-head" style={{ marginBottom: 16 }}>
                        <h3>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: 6 }}>
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                          Certifications
                        </h3>
                        <p className="ps-helper">Add your professional certifications with structured details — name, issuing organization, dates, skills, and credential proof.</p>
                      </div>
                      <MentorCertificationsManager mentorId={initialProfile?.id} notify={notify} onCountChange={handleCertCountChange} />
                    </div>

                    {/* Projects Section */}
                    <div style={{ marginTop: 32 }}>
                      <div className="ps-projects-header">
                        <div>
                          <h3>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "middle", marginRight: 6 }}>
                              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                              <line x1="8" y1="21" x2="16" y2="21" />
                              <line x1="12" y1="17" x2="12" y2="21" />
                            </svg>
                            Projects
                          </h3>
                          <p className="ps-helper" style={{ margin: "2px 0 0" }}>Showcase your work with project descriptions.</p>
                        </div>
                        <button
                          type="button"
                          className="ps-btn-add-project"
                          onClick={() => openProjectModal()}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                          Add Project
                        </button>
                      </div>

                      {projects.length > 0 ? (
                        <div className="ps-project-grid">
                          {projects.map((project) => (
                            <div key={project.id} className="ps-project-card">
                              <div className="ps-project-top">
                                <div>
                                  <h4>{project.title}</h4>
                                  <p className="ps-project-desc">{project.description}</p>
                                  {project.technologies && (
                                    <div className="ps-project-tech">
                                      {project.technologies.split(",").map((tech, i) => (
                                        <span key={i}>{tech.trim()}</span>
                                      ))}
                                    </div>
                                  )}
                                  <p className="ps-project-meta">
                                    {project.startDate && `${project.startDate}`}
                                    {project.endDate && ` — ${project.endDate}`}
                                    {project.currentlyWorking && " (Current)"}
                                  </p>
                                </div>
                                <div className="ps-project-actions">
                                  <button
                                    type="button"
                                    className="ps-btn ps-btn-secondary ps-btn-sm"
                                    onClick={() => openProjectModal(project)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="ps-btn ps-btn-danger ps-btn-sm"
                                    onClick={() => deleteProject(project.id)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="ps-empty-projects">
                          No projects yet. Click "Add Project" to showcase your work.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Error Message ── */}
                {error && (
                  <div className="ps-error">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    {error}
                  </div>
                )}

                {/* ── Step Navigation / Actions ── */}
                <div className="ps-actions" style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid #e2e8f0" }}>
                  <div className="ps-actions-left">
                    {currentStep > 0 && (
                      <button
                        type="button"
                        className="ps-btn ps-btn-secondary"
                        onClick={() => goToStep(currentStep - 1)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="19" y1="12" x2="5" y2="12" />
                          <polyline points="12 19 5 12 12 5" />
                        </svg>
                        Back
                      </button>
                    )}
                    <button
                      type="button"
                      className="ps-btn ps-btn-ghost ps-btn-sm"
                      onClick={handleUndo}
                    >
                      Undo
                    </button>
                  </div>

                  <div className="ps-actions-right">
                    <span className="ps-save-indicator">
                      {isSaving
                        ? "Saving..."
                        : lastSavedAt
                          ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                          : ""}
                    </span>

                    {currentStep < STEPS.length - 1 ? (
                      <button
                        type="button"
                        className="ps-btn ps-btn-primary"
                        onClick={handleContinue}
                        disabled={currentStep === 1 && skillTags.length === 0}
                      >
                        Continue
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="5" y1="12" x2="19" y2="12" />
                          <polyline points="12 5 19 12 19" />
                        </svg>
                      </button>
                    ) : (
                      <button
                        type="submit"
                        className="ps-btn ps-btn-primary"
                        disabled={saving}
                      >
                        {saving ? "Saving..." : "Complete Profile"}
                      </button>
                    )}

                    <button
                      type="button"
                      className="ps-btn ps-btn-ghost ps-btn-sm"
                      onClick={onLogout}
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* ── Role Switcher ── */}
        {initialProfile && (
          <div className="ps-role-switcher">
            <RoleSwitcher
              profile={initialProfile}
              onProfileUpdated={(updated) => {
                if (onProfileUpdated) onProfileUpdated(updated);
              }}
            />
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════
          Project Modal
          ═══════════════════════════════════════════ */}
      {projectModalOpen && (
        <div
          className="ps-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setProjectModalOpen(false);
          }}
        >
          <div className="ps-modal">
            <h3>{activeProjectId ? "Edit Project" : "Add Project"}</h3>
            <p className="ps-helper">
              {activeProjectId
                ? "Update your project details."
                : "Add a project to showcase your work experience."}
            </p>

            {projectError && (
              <div className="ps-error">
                {projectError}
              </div>
            )}

            <div className="ps-project-form">
              <Field label="Project Title">
                <input
                  className="ps-input"
                  name="title"
                  placeholder="e.g. E-commerce Platform"
                  value={projectEditor.title}
                  onChange={handleProjectFieldChange}
                />
              </Field>

              <Field label="Description">
                <textarea
                  className="ps-textarea"
                  name="description"
                  placeholder="Describe your role and what you built..."
                  value={projectEditor.description}
                  onChange={handleProjectFieldChange}
                  rows={3}
                />
              </Field>

              <Field
                label="Technologies Used"
                helper="Separate with commas (e.g. React, Node.js, PostgreSQL)"
              >
                <input
                  className="ps-input"
                  name="technologies"
                  placeholder="React, Node.js, PostgreSQL"
                  value={projectEditor.technologies}
                  onChange={handleProjectFieldChange}
                />
              </Field>

              <Field label="GitHub URL (optional)">
                <input
                  className="ps-input"
                  name="githubUrl"
                  type="url"
                  placeholder="https://github.com/username/project"
                  value={projectEditor.githubUrl}
                  onChange={handleProjectFieldChange}
                />
              </Field>

              <Field label="Live Demo URL (optional)">
                <input
                  className="ps-input"
                  name="liveDemoUrl"
                  type="url"
                  placeholder="https://my-project.vercel.app"
                  value={projectEditor.liveDemoUrl}
                  onChange={handleProjectFieldChange}
                />
              </Field>

              <div className="ps-project-dates">
                <Field label="Start Date">
                  <input
                    className="ps-input"
                    name="startDate"
                    type="date"
                    value={projectEditor.startDate}
                    onChange={handleProjectFieldChange}
                  />
                </Field>
                <Field label="End Date">
                  <input
                    className="ps-input"
                    name="endDate"
                    type="date"
                    value={projectEditor.endDate}
                    onChange={handleProjectFieldChange}
                    disabled={projectEditor.currentlyWorking}
                  />
                </Field>
              </div>

              <label className="ps-check-row">
                <input
                  name="currentlyWorking"
                  type="checkbox"
                  checked={projectEditor.currentlyWorking}
                  onChange={handleProjectFieldChange}
                />
                Currently working on this project
              </label>
            </div>

            <div className="ps-modal-actions">
              <button
                type="button"
                className="ps-btn ps-btn-secondary"
                onClick={() => {
                  setProjectModalOpen(false);
                  resetProjectEditor();
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ps-btn ps-btn-primary"
                onClick={() => {
                  saveProject()
                    .catch(() => {});
                }}
              >
                {activeProjectId ? "Update Project" : "Save Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
