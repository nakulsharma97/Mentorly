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
    <main>
      <div className="profile-setup-card">
        <div className="onboarding-stepper">
          <div className="onboarding-stepper-header">
            <span className="onboarding-stepper-pill">Step 2 of 3</span>
            <div>
              <p className="onboarding-stepper-title">Complete your profile</p>
              <p className="onboarding-stepper-subtitle">
                Unlock better mentor matches with a polished profile.
              </p>
            </div>
          </div>
          <div className="onboarding-stepper-track">
            <div
              className="onboarding-stepper-progress"
              style={{ width: "66%" }}
            />
          </div>
          <div className="onboarding-stepper-steps">
            <span className="onboarding-stepper-step is-complete">
              Create account
            </span>
            <span className="onboarding-stepper-step is-active">
              Profile details
            </span>
            <span className="onboarding-stepper-step">Start matching</span>
          </div>
        </div>
        <h2>Complete your profile</h2>
        <p className="muted">
          Add your core skills, a short bio, and your GitHub and LinkedIn links
          to continue.
        </p>

        <form className="profile-setup-form" onSubmit={handleSubmit}>
          <div className="profile-quality-meter">
            <div className="profile-quality-header">
              <strong>Profile quality:</strong>
              <span>{qualityScore}%</span>
            </div>
            <div className="profile-quality-track">
              <div
                className="profile-quality-fill"
                style={{ width: `${qualityScore}%` }}
              />
            </div>
          </div>

          <div className="skill-tags-editor">
            <label>Skill tags with level</label>
            <div className="skill-tags-input-row">
              <input
                placeholder="Add skill (for example: React)"
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
              <button type="button" onClick={addSkillTag}>
                Add
              </button>
            </div>
            {skillTags.length > 0 ? (
              <div className="skill-tag-list">
                {skillTags.map((tag) => (
                  <span key={tag.name} className="skill-tag-chip">
                    {tag.name} ({tag.level})
                    <button
                      type="button"
                      onClick={() => removeSkillTag(tag.name)}
                      aria-label={`Remove ${tag.name}`}
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="muted">Add at least one skill tag.</p>
            )}
          </div>

          <textarea
            name="aboutMe"
            placeholder="Tell others about yourself"
            value={form.aboutMe}
            onChange={handleChange}
            rows={5}
            required
          />

          <input
            name="githubUrl"
            type="url"
            placeholder="GitHub profile URL"
            value={form.githubUrl}
            onChange={handleChange}
            required
          />

          <input
            name="linkedinUrl"
            type="url"
            placeholder="LinkedIn profile URL"
            value={form.linkedinUrl}
            onChange={handleChange}
            required
          />

          <input
            name="profileImageUrl"
            type="url"
            placeholder="Profile picture URL (https://...)"
            value={form.profileImageUrl}
            onChange={handleChange}
          />

          {form.profileImageUrl && (
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
          )}

          <section className="project-section">
            <div className="project-section-header">
              <div>
                <h3>Projects</h3>
                <p className="muted">
                  Showcase your work with required title, description,
                  technologies, and dates.
                </p>
              </div>
              <button
                type="button"
                className="secondary-btn"
                onClick={resetProjectEditor}
              >
                Add Project
              </button>
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
                  No projects added yet. Add a project to showcase your work.
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
          </section>

          <input
            type="hidden"
            name="skills"
            value={serializeSkillTags(skillTags)}
            readOnly
          />

          {error && <p className="error">{error}</p>}

          <div className="profile-setup-actions">
            <button type="submit" className="submit-btn" disabled={saving}>
              {saving ? "Saving..." : "Save and Continue"}
            </button>
            <button type="button" onClick={onLogout}>
              Logout
            </button>
          </div>
        </form>

        {initialProfile && (
          <div style={{ marginTop: "24px" }}>
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
