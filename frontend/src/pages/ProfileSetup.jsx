/* eslint-disable no-unused-vars */
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import client from "../api/client";
import RoleSwitcher from "../components/RoleSwitcher";
import OptimizedImage from "../components/OptimizedImage";
import {
  getProfileQualityScore,
  parseSkillTags,
  serializeSkillTags,
  SKILL_LEVELS,
} from "../utils/profileSkills";
import { getErrorFeedback } from "../utils/comingSoon";
import "./ProfileSetup.css";

const emptyForm = {
  skills: "",
  aboutMe: "",
  githubUrl: "",
  linkedinUrl: "",
  profileImageUrl: "",
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

export default function ProfileSetup({
  initialProfile,
  onCompleted,
  onLogout,
  onProfileUpdated,
  notify,
}) {
  const [form, setForm] = useState(emptyForm);
  const [skillTags, setSkillTags] = useState([]);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillLevel, setNewSkillLevel] = useState("Intermediate");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState([]);
  const [projectEditor, setProjectEditor] = useState(emptyProject);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [projectError, setProjectError] = useState("");

  const qualityScore = useMemo(
    () =>
      getProfileQualityScore({
        ...form,
        skills: serializeSkillTags(skillTags),
      }),
    [form, skillTags],
  );

  const basicInfoRef = useRef(null);
  const skillsRef = useRef(null);
  const experienceRef = useRef(null);
  const educationRef = useRef(null);
  const languagesRef = useRef(null);
  const portfolioRef = useRef(null);
  const pricingRef = useRef(null);
  const verificationRef = useRef(null);

  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [openSections, setOpenSections] = useState({
    basic: true,
    skills: false,
    experience: false,
    education: false,
    languages: false,
    portfolio: false,
    pricing: false,
    verification: false,
  });
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [skillSearch, setSkillSearch] = useState("");

  const fetchProjects = async () => {
    try {
      const response = await client.get("/api/v1/users/me/projects");
      setProjects(response.data.data || []);
    } catch (err) {
      console.debug("Unable to load profile projects", err);
    }
  };

  useEffect(() => {
    const parsedTags = parseSkillTags(initialProfile?.skills);
    setForm({
      skills: initialProfile?.skills || "",
      aboutMe: initialProfile?.aboutMe || "",
      githubUrl: initialProfile?.githubUrl || "",
      linkedinUrl: initialProfile?.linkedinUrl || "",
      profileImageUrl: initialProfile?.profileImageUrl || "",
    });
    setSkillTags(parsedTags);
    if (initialProfile?.id) {
      fetchProjects();
    }
  }, [initialProfile]);

  const addSkillTag = () => {
    const cleaned = newSkillName.trim();
    if (!cleaned) {
      return false;
    }

    const exists = skillTags.some(
      (tag) => tag.name.toLowerCase() === cleaned.toLowerCase(),
    );
    if (exists) {
      return true;
    }

    setSkillTags((prev) => [...prev, { name: cleaned, level: newSkillLevel }]);
    setNewSkillName("");
    setNewSkillLevel("Intermediate");
    return true;
  };

  const removeSkillTag = (name) => {
    setSkillTags((prev) => prev.filter((tag) => tag.name !== name));
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSaving(true);

    try {
      let finalSkillTags = skillTags;
      const pendingSkill = newSkillName.trim();
      if (pendingSkill) {
        const alreadyExists = finalSkillTags.some(
          (tag) => tag.name.toLowerCase() === pendingSkill.toLowerCase(),
        );
        if (!alreadyExists) {
          finalSkillTags = [
            ...finalSkillTags,
            { name: pendingSkill, level: newSkillLevel },
          ];
          setSkillTags(finalSkillTags);
        }
      }

      if (finalSkillTags.length === 0) {
        setError(getErrorFeedback("profileSetupMissingSkills").message);
        notify?.({
          type: "warning",
          title: getErrorFeedback("profileSetupMissingSkills").title,
          message:
            "Add at least one skill tag so mentors/learners can discover your profile.",
        });
        setSaving(false);
        return;
      }

      const hasValidGithub = /^https?:\/\//i.test(
        String(form.githubUrl || "").trim(),
      );
      const hasValidLinkedin = /^https?:\/\//i.test(
        String(form.linkedinUrl || "").trim(),
      );
      if (!hasValidGithub || !hasValidLinkedin) {
        setError(getErrorFeedback("profileSetupInvalidLinks").message);
        notify?.({
          type: "warning",
          title: getErrorFeedback("profileSetupInvalidLinks").title,
          message: "Use full URLs including https:// for GitHub and LinkedIn.",
        });
        setSaving(false);
        return;
      }

      const serializedSkills = serializeSkillTags(finalSkillTags);
      const payload = {
        skills: serializedSkills,
        aboutMe: form.aboutMe,
        githubUrl: form.githubUrl,
        linkedinUrl: form.linkedinUrl,
        profileImageUrl: form.profileImageUrl,
      };
      const response = await saveProfile(payload, { notifySuccess: true });
      if (response && onCompleted) onCompleted(response);
    } catch (err) {
      const backendError =
        err?.response?.data?.data?.error ||
        getErrorFeedback("profileSetupSaveFailed").message;
      setError(backendError);
      notify?.({
        type: "error",
        title: getErrorFeedback("profileSetupSaveFailed").title,
        message: backendError,
      });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    async function fetchProjects() {
      try {
        const response = await client.get("/api/v1/users/me/projects");
        setProjects(response.data.data || []);
      } catch {
        // ignore project load failures until save
      }
    }

    if (initialProfile?.id) {
      fetchProjects();
    }
  }, [initialProfile?.id]);

  const resetProjectEditor = () => {
    setActiveProjectId(null);
    setProjectEditor(emptyProject);
    setProjectError("");
  };

  const editProject = (project) => {
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
  };

  const validateProjectInput = () => {
    if (!projectEditor.title.trim()) {
      return "Project title is required";
    }
    if (!projectEditor.description.trim()) {
      return "Project description is required";
    }
    if (!projectEditor.technologies.trim()) {
      return "Project technologies are required";
    }
    if (!projectEditor.startDate) {
      return "Project start date is required";
    }
    if (!projectEditor.currentlyWorking && projectEditor.endDate) {
      const start = new Date(projectEditor.startDate);
      const end = new Date(projectEditor.endDate);
      if (end < start) {
        return "End date cannot be before start date";
      }
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
      console.debug(
        "Saving project",
        activeProjectId ? `update ${activeProjectId}` : "create",
        payload,
      );

      const response = activeProjectId
        ? await client.put(
            `/api/v1/users/me/projects/${activeProjectId}`,
            payload,
          )
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
    } catch (err) {
      setProjectError(
        "Unable to save project. Verify required fields and try again.",
      );
    }
  };

  const removeProject = async (projectId) => {
    try {
      await client.delete(`/api/v1/users/me/projects/${projectId}`);
      setProjects((current) =>
        current.filter((project) => project.id !== projectId),
      );
      if (activeProjectId === projectId) {
        resetProjectEditor();
      }
    } catch {
      setProjectError("Unable to delete project. Try again.");
    }
  };

  const openAddSkill = () => {
    setSkillSearch("");
    setSkillModalOpen(true);
  };

  const confirmAddSkill = () => {
    const cleaned = skillSearch.trim();
    if (!cleaned) return;
    const exists = skillTags.some(
      (t) => t.name.toLowerCase() === cleaned.toLowerCase(),
    );
    if (!exists) {
      setSkillTags((prev) => [
        ...prev,
        { name: cleaned, level: "Intermediate" },
      ]);
    }
    setSkillModalOpen(false);
    setSkillSearch("");
  };

  const startEditSkill = (tag) => {
    setNewSkillName(tag.name);
    setNewSkillLevel(tag.level || "Intermediate");
    setSkillModalOpen(true);
  };

  const deleteSkill = (name) => {
    setSkillTags((prev) => prev.filter((t) => t.name !== name));
  };

  const handleProjectFieldChange = (event) => {
    const { name, value, type, checked } = event.target;
    setProjectEditor((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setProjectError("");
  };

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
        console.debug("Profile save failed", err);
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

  useEffect(() => {
    const interval = setInterval(() => {
      // autosave minimal payload
      const payload = {
        skills: serializeSkillTags(skillTags),
        aboutMe: form.aboutMe,
        githubUrl: form.githubUrl,
        linkedinUrl: form.linkedinUrl,
        profileImageUrl: form.profileImageUrl,
      };
      saveProfile(payload).catch(() => {});
    }, 30000);

    return () => clearInterval(interval);
  }, [form, skillTags, saveProfile]);

  const scrollToSection = (key) => {
    const mapping = {
      basic: basicInfoRef,
      skills: skillsRef,
      experience: experienceRef,
      education: educationRef,
      languages: languagesRef,
      portfolio: portfolioRef,
      pricing: pricingRef,
      verification: verificationRef,
    };
    const ref = mapping[key];
    if (ref && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
      setOpenSections((prev) => ({ ...prev, [key]: true }));
    }
  };

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

  return (
    <main className="profile-setup-wrapper">
      <div className="profile-setup-container">
        {/* Header Section */}
        <div className="profile-setup-header">
          <h1>Complete Your Mentor Profile</h1>
          <p>
            Complete your profile to increase trust and attract more learners.
          </p>

          <div className="progress-indicator">
            <div className="progress-step completed">
              <div className="progress-step-circle">✓</div>
              <div className="progress-step-label">Basic Information</div>
            </div>
            <div className="progress-step active">
              <div className="progress-step-circle">2</div>
              <div className="progress-step-label">Skills & Experience</div>
            </div>
            <div className="progress-step">
              <div className="progress-step-circle">3</div>
              <div className="progress-step-label">Links & Portfolio</div>
            </div>
          </div>
        </div>

        <div className="profile-setup-content">
          <div className="profile-setup-tips">
            <div className="tips-card">
              <h3>Profile Tips 💡</h3>
              <div className="aside-checklist">
                <h4>Checklist</h4>
                <div
                  className="checklist-item"
                  onClick={() => scrollToSection("basic")}
                >
                  <input
                    type="checkbox"
                    readOnly
                    checked={form.aboutMe?.length > 0}
                  />
                  <div>Basic information</div>
                </div>
                <div
                  className="checklist-item"
                  onClick={() => scrollToSection("skills")}
                >
                  <input
                    type="checkbox"
                    readOnly
                    checked={skillTags.length > 0}
                  />
                  <div>Skills & experience</div>
                </div>
                <div
                  className="checklist-item"
                  onClick={() => scrollToSection("portfolio")}
                >
                  <input
                    type="checkbox"
                    readOnly
                    checked={projects.length > 0}
                  />
                  <div>Portfolio</div>
                </div>
              </div>
            </div>
          </div>

          <div className="profile-setup-form-wrapper">
            <div className="profile-completion-card">
              <div className="completion-progress-circle">
                <svg viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.1)"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="url(#gradient)"
                    strokeWidth="8"
                    strokeDasharray={`${(qualityScore / 100) * 282.7} 282.7`}
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%">
                      <stop offset="0%" stopColor="#0f766e" />
                      <stop offset="100%" stopColor="#16a085" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="completion-progress-text">
                  <div className="completion-percentage">{qualityScore}%</div>
                  <div className="completion-label">Complete</div>
                </div>
              </div>
              <div className="completion-message">
                <h4>
                  {qualityScore < 33
                    ? "Get started"
                    : qualityScore < 66
                      ? "Almost there!"
                      : "Great progress!"}
                </h4>
                <p>
                  {qualityScore < 33
                    ? "Start filling out your profile to attract more learners."
                    : qualityScore < 66
                      ? "You're doing great! Complete a few more fields."
                      : "Your profile is looking amazing!"}
                </p>
              </div>
            </div>

            <div className="profile-form-card">
              <form className="profile-setup-form" onSubmit={handleSubmit}>
                {/* Basic Information Section */}
                <div
                  className="form-section"
                  ref={basicInfoRef}
                  data-open={openSections.basic}
                >
                  <div>
                    <h3 className="form-section-title">Basic Information</h3>
                    <p className="form-section-description">
                      Tell learners who you are and what you do.
                    </p>
                  </div>

                  <div className="form-group">
                    <label htmlFor="aboutMe">About Yourself</label>
                    <div className="input-with-counter">
                      <textarea
                        id="aboutMe"
                        name="aboutMe"
                        placeholder="Tell others about yourself, your background, and expertise..."
                        value={form.aboutMe}
                        onChange={handleChange}
                        rows={5}
                        required
                      />
                      <div className="character-counter">
                        {form.aboutMe.length}/500
                      </div>
                    </div>
                    <p className="form-helper-text">
                      A great bio helps build trust with learners.
                    </p>
                  </div>

                  <div className="form-group">
                    <label htmlFor="profileImageUrl">Profile Picture URL</label>
                    <input
                      id="profileImageUrl"
                      name="profileImageUrl"
                      type="url"
                      placeholder="https://example.com/your-profile-picture.jpg"
                      value={form.profileImageUrl}
                      onChange={handleChange}
                    />
                    <p className="form-helper-text">
                      Use a professional headshot (JPG, PNG, or WebP).
                    </p>
                  </div>
                </div>

                {error && <p className="error">{error}</p>}

                <div className="profile-setup-actions">
                  <button
                    type="submit"
                    className="submit-btn"
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save & Continue"}
                  </button>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="secondary-btn"
                  >
                    Logout
                  </button>
                </div>

                <input
                  type="hidden"
                  name="skills"
                  value={serializeSkillTags(skillTags)}
                  readOnly
                />
              </form>
            </div>

            <div
              className="profile-setup-footer"
              role="region"
              aria-label="Profile actions"
            >
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() =>
                    saveProfile(
                      {
                        skills: serializeSkillTags(skillTags),
                        aboutMe: form.aboutMe,
                        githubUrl: form.githubUrl,
                        linkedinUrl: form.linkedinUrl,
                        profileImageUrl: form.profileImageUrl,
                      },
                      { notifySuccess: true },
                    )
                  }
                  className="secondary-btn"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  onClick={() =>
                    notify?.({
                      type: "info",
                      title: "Preview",
                      message: "Preview not implemented",
                    })
                  }
                  className="secondary-btn"
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => handleUndo()}
                  className="secondary-btn"
                >
                  Undo
                </button>
              </div>

              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ fontSize: 13, color: "var(--muted, #6b7280)" }}>
                  {isSaving
                    ? "Saving..."
                    : lastSavedAt
                      ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}`
                      : "Not saved"}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    document
                      .querySelector(".profile-setup-form")
                      .dispatchEvent(new Event("submit", { cancelable: true }))
                  }
                  className="submit-btn"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Role Switcher */}
        {/* Modals */}
        {skillModalOpen && (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="modal">
              <h3>{newSkillName ? "Edit Skill" : "Add Skill"}</h3>
              <p className="muted">
                Search or type a skill name and choose proficiency.
              </p>
              <input
                list="skill-suggestions"
                placeholder="e.g. React, Java, Spring Boot"
                value={skillSearch || newSkillName}
                onChange={(e) => setSkillSearch(e.target.value)}
              />
              <datalist id="skill-suggestions">
                <option>Java</option>
                <option>Spring Boot</option>
                <option>React</option>
                <option>Python</option>
                <option>Node.js</option>
                <option>TypeScript</option>
              </datalist>
              <div style={{ marginTop: 8 }}>
                <label style={{ fontWeight: 600 }}>Proficiency</label>
                <select
                  value={newSkillLevel}
                  onChange={(e) => setNewSkillLevel(e.target.value)}
                >
                  {SKILL_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    setSkillModalOpen(false);
                    setNewSkillName("");
                    setNewSkillLevel("Intermediate");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="submit-btn"
                  onClick={() => {
                    const name = (skillSearch || newSkillName).trim();
                    if (!name) return;
                    const exists = skillTags.some(
                      (t) => t.name.toLowerCase() === name.toLowerCase(),
                    );
                    if (!exists) {
                      setSkillTags((prev) => [
                        ...prev,
                        { name, level: newSkillLevel },
                      ]);
                    } else {
                      setSkillTags((prev) =>
                        prev.map((t) =>
                          t.name.toLowerCase() === name.toLowerCase()
                            ? { ...t, level: newSkillLevel }
                            : t,
                        ),
                      );
                    }
                    setSkillModalOpen(false);
                    setSkillSearch("");
                    setNewSkillName("");
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {projectModalOpen && (
          <div className="modal-backdrop" role="dialog" aria-modal="true">
            <div className="modal modal-large">
              <h3>{activeProjectId ? "Edit Project" : "Add Project"}</h3>
              {projectError && <p className="error">{projectError}</p>}
              <div className="project-form-grid">
                <input
                  name="title"
                  placeholder="Project title"
                  value={projectEditor.title}
                  onChange={handleProjectFieldChange}
                />
                <textarea
                  name="description"
                  placeholder="Project description"
                  value={projectEditor.description}
                  onChange={handleProjectFieldChange}
                  rows={4}
                />
                <input
                  name="technologies"
                  placeholder="Technologies used"
                  value={projectEditor.technologies}
                  onChange={handleProjectFieldChange}
                />
                <input
                  name="githubUrl"
                  type="url"
                  placeholder="GitHub repository URL (optional)"
                  value={projectEditor.githubUrl}
                  onChange={handleProjectFieldChange}
                />
                <input
                  name="liveDemoUrl"
                  type="url"
                  placeholder="Live demo URL (optional)"
                  value={projectEditor.liveDemoUrl}
                  onChange={handleProjectFieldChange}
                />
                <div className="project-dates-row">
                  <input
                    name="startDate"
                    type="date"
                    placeholder="DD / MM / YYYY"
                    value={projectEditor.startDate}
                    onChange={handleProjectFieldChange}
                  />
                  <input
                    name="endDate"
                    type="date"
                    placeholder="DD / MM / YYYY"
                    value={projectEditor.endDate}
                    onChange={handleProjectFieldChange}
                    disabled={projectEditor.currentlyWorking}
                  />
                </div>
                <label className="project-currently-working">
                  <input
                    name="currentlyWorking"
                    type="checkbox"
                    checked={projectEditor.currentlyWorking}
                    onChange={handleProjectFieldChange}
                  />{" "}
                  Currently working on this project
                </label>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                  marginTop: 12,
                }}
              >
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    setProjectModalOpen(false);
                    resetProjectEditor();
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="submit-btn"
                  onClick={() => {
                    saveProject()
                      .then(() => setProjectModalOpen(false))
                      .catch(() => {});
                  }}
                >
                  {activeProjectId ? "Update Project" : "Save Project"}
                </button>
              </div>
            </div>
          </div>
        )}

        {initialProfile && (
          <div style={{ marginTop: "40px", textAlign: "center" }}>
            <RoleSwitcher
              profile={initialProfile}
              onProfileUpdated={(updated) => {
                if (onProfileUpdated) {
                  onProfileUpdated(updated);
                }
              }}
            />
          </div>
        )}
      </div>
    </main>
  );
}
