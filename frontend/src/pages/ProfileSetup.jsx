import { useEffect, useMemo, useState } from "react";
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
import { trackAnalyticsEvent } from "../utils/analyticsEvents";
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
      console.debug("Saving profile payload", payload);
      const response = await client.put("/api/v1/users/me/profile", payload);
      notify?.({
        type: "success",
        title: "Profile saved",
        message: "Your profile was updated successfully.",
      });
      trackAnalyticsEvent("profile_setup_completed", {
        qualityScore,
        skillTagCount: finalSkillTags.length,
      });
      onProfileUpdated?.(response.data.data);
      onCompleted(response.data.data);
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

  const handleProjectFieldChange = (event) => {
    const { name, value, type, checked } = event.target;
    setProjectEditor((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setProjectError("");
  };

  return (
    <main className="profile-setup-wrapper">
      <div className="profile-setup-container">
        {/* Header Section */}
        <div className="profile-setup-header">
          <h1>Complete your mentor profile</h1>
          <p>
            A complete profile helps learners trust you and book more sessions.
          </p>

          {/* Progress Indicator */}
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

        {/* Main Content - Two Column Layout */}
        <div className="profile-setup-content">
          {/* Left Column - Tips Panel */}
          <div className="profile-setup-tips">
            <div className="tips-card">
              <h3>Profile Tips 💡</h3>

              <div className="tip-item">
                <div className="tip-icon">👤</div>
                <div className="tip-content">
                  <h4>Add a professional bio</h4>
                  <p>
                    Write a compelling bio about yourself and your expertise.
                  </p>
                </div>
              </div>

              <div className="tip-item">
                <div className="tip-icon">⚡</div>
                <div className="tip-content">
                  <h4>Include relevant skills</h4>
                  <p>
                    Add skills with proficiency levels to help learners find
                    you.
                  </p>
                </div>
              </div>

              <div className="tip-item">
                <div className="tip-icon">🔗</div>
                <div className="tip-content">
                  <h4>Share your GitHub and LinkedIn</h4>
                  <p>
                    Links help learners verify your experience and portfolio.
                  </p>
                </div>
              </div>

              <div className="tip-item">
                <div className="tip-icon">⭐</div>
                <div className="tip-content">
                  <h4>Complete your profile for visibility</h4>
                  <p>Complete profiles are more discoverable to learners.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Form */}
          <div className="profile-setup-form-wrapper">
            {/* Profile Completion Card */}
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

            {/* Main Form Card */}
            <div className="profile-form-card">
              <form className="profile-setup-form" onSubmit={handleSubmit}>
                {/* Basic Information Section */}
                <div className="form-section">
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

                  {form.profileImageUrl && (
                    <div>
                      <label>Profile Picture Preview</label>
                      <div className="profile-image-preview-wrap">
                        <OptimizedImage
                          src={form.profileImageUrl}
                          alt="Profile preview"
                          className="profile-image-preview"
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                      </div>
                    </div>
                  )}

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

                {/* Skills Section */}
                <div className="form-section">
                  <div>
                    <h3 className="form-section-title">Skills & Expertise</h3>
                    <p className="form-section-description">
                      Add skills that learners will search for.
                    </p>
                  </div>

                  <div className="skills-section">
                    <div className="skills-input-group">
                      <input
                        placeholder="Add skill (e.g., React, Python, Design)"
                        value={newSkillName}
                        onChange={(e) => setNewSkillName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addSkillTag();
                          }
                        }}
                      />
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
                      <button
                        type="button"
                        className="skills-add-button"
                        onClick={addSkillTag}
                      >
                        + Add Skill
                      </button>
                    </div>

                    {skillTags.length > 0 ? (
                      <div>
                        <p style={{ fontSize: "13px", marginBottom: "12px" }}>
                          Added skills:
                        </p>
                        <div className="skill-tags-container">
                          {skillTags.map((tag) => (
                            <span key={tag.name} className="skill-tag-chip">
                              {tag.name}
                              <span style={{ fontSize: "11px", opacity: 0.8 }}>
                                ({tag.level})
                              </span>
                              <button
                                type="button"
                                onClick={() => removeSkillTag(tag.name)}
                                aria-label={`Remove ${tag.name}`}
                                title="Remove skill"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="muted">
                        Add at least one skill to make your profile
                        discoverable.
                      </p>
                    )}
                  </div>
                </div>

                {/* Links & Portfolio Section */}
                <div className="form-section">
                  <div>
                    <h3 className="form-section-title">Links & Portfolio</h3>
                    <p className="form-section-description">
                      Share your professional profiles and portfolio.
                    </p>
                  </div>

                  <div className="form-group">
                    <label htmlFor="githubUrl">GitHub Profile URL</label>
                    <input
                      id="githubUrl"
                      name="githubUrl"
                      type="url"
                      placeholder="https://github.com/yourusername"
                      value={form.githubUrl}
                      onChange={handleChange}
                      required
                    />
                    <p className="form-helper-text">
                      Full URL including https://
                    </p>
                  </div>

                  <div className="form-group">
                    <label htmlFor="linkedinUrl">LinkedIn Profile URL</label>
                    <input
                      id="linkedinUrl"
                      name="linkedinUrl"
                      type="url"
                      placeholder="https://linkedin.com/in/yourprofile"
                      value={form.linkedinUrl}
                      onChange={handleChange}
                      required
                    />
                    <p className="form-helper-text">
                      Full URL including https://
                    </p>
                  </div>
                </div>

                {/* Projects Section */}
                <div className="projects-section">
                  <div className="project-section-header">
                    <div>
                      <h3>Projects & Portfolio</h3>
                      <p className="muted">
                        Showcase your best work to learners.
                      </p>
                    </div>
                    {projects.length === 0 && (
                      <button
                        type="button"
                        className="add-project-button"
                        onClick={resetProjectEditor}
                      >
                        + Add Project
                      </button>
                    )}
                  </div>

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
                      rows={3}
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
                        placeholder="Start date"
                        value={projectEditor.startDate}
                        onChange={handleProjectFieldChange}
                      />
                      <input
                        name="endDate"
                        type="date"
                        placeholder="End date"
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
                      />
                      Currently working on this project
                    </label>
                    <div className="project-form-actions">
                      <button
                        type="button"
                        className="submit-btn"
                        onClick={saveProject}
                      >
                        {activeProjectId ? "Update Project" : "Save Project"}
                      </button>
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={resetProjectEditor}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>

                  <div className="project-list">
                    {projects.length === 0 ? (
                      <p className="muted">
                        Add projects to showcase your work and expertise.
                      </p>
                    ) : (
                      projects.map((project) => (
                        <div key={project.id} className="project-card">
                          <div className="project-card-header">
                            <div>
                              <h4>{project.title}</h4>
                              <p className="muted">{project.technologies}</p>
                            </div>
                            <div className="project-card-actions">
                              <button
                                type="button"
                                onClick={() => editProject(project)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="danger-btn"
                                onClick={() => removeProject(project.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          <p>{project.description}</p>
                          <div className="project-card-meta">
                            <span>
                              {project.startDate} →{" "}
                              {project.currentlyWorking
                                ? "Present"
                                : project.endDate || "Ongoing"}
                            </span>
                            {project.githubUrl && (
                              <a
                                href={project.githubUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                GitHub
                              </a>
                            )}
                            {project.liveDemoUrl && (
                              <a
                                href={project.liveDemoUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Live demo
                              </a>
                            )}
                          </div>
                        </div>
                      ))
                    )}
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
          </div>
        </div>

        {/* Role Switcher */}
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
