import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import RoleSwitcher from '../components/RoleSwitcher';
import OptimizedImage from '../components/OptimizedImage';
import {
  getProfileQualityScore,
  parseSkillTags,
  serializeSkillTags,
  SKILL_LEVELS
} from '../utils/profileSkills';
import { getErrorFeedback } from '../utils/comingSoon';
import { trackAnalyticsEvent } from '../utils/analyticsEvents';

const emptyForm = {
  skills: '',
  aboutMe: '',
  githubUrl: '',
  linkedinUrl: '',
  profileImageUrl: ''
};

export default function ProfileSetup({ initialProfile, onCompleted, onLogout, onProfileUpdated, notify }) {
  const [form, setForm] = useState(emptyForm);
  const [skillTags, setSkillTags] = useState([]);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillLevel, setNewSkillLevel] = useState('Intermediate');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const qualityScore = useMemo(
    () => getProfileQualityScore({ ...form, skills: serializeSkillTags(skillTags) }),
    [form, skillTags]
  );

  useEffect(() => {
    const parsedTags = parseSkillTags(initialProfile?.skills);
    setForm({
      skills: initialProfile?.skills || '',
      aboutMe: initialProfile?.aboutMe || '',
      githubUrl: initialProfile?.githubUrl || '',
      linkedinUrl: initialProfile?.linkedinUrl || '',
      profileImageUrl: initialProfile?.profileImageUrl || ''
    });
    setSkillTags(parsedTags);
  }, [initialProfile]);

  const addSkillTag = () => {
    const cleaned = newSkillName.trim();
    if (!cleaned) {
      return false;
    }

    const exists = skillTags.some((tag) => tag.name.toLowerCase() === cleaned.toLowerCase());
    if (exists) {
      return true;
    }

    setSkillTags((prev) => [...prev, { name: cleaned, level: newSkillLevel }]);
    setNewSkillName('');
    setNewSkillLevel('Intermediate');
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
    setError('');
    setSaving(true);

    try {
      let finalSkillTags = skillTags;
      const pendingSkill = newSkillName.trim();
      if (pendingSkill) {
        const alreadyExists = finalSkillTags.some((tag) => tag.name.toLowerCase() === pendingSkill.toLowerCase());
        if (!alreadyExists) {
          finalSkillTags = [...finalSkillTags, { name: pendingSkill, level: newSkillLevel }];
          setSkillTags(finalSkillTags);
        }
      }

      if (finalSkillTags.length === 0) {
        setError(getErrorFeedback('profileSetupMissingSkills').message);
        notify?.({
          type: 'warning',
          title: getErrorFeedback('profileSetupMissingSkills').title,
          message: 'Add at least one skill tag so mentors/learners can discover your profile.'
        });
        setSaving(false);
        return;
      }

      const hasValidGithub = /^https?:\/\//i.test(String(form.githubUrl || '').trim());
      const hasValidLinkedin = /^https?:\/\//i.test(String(form.linkedinUrl || '').trim());
      if (!hasValidGithub || !hasValidLinkedin) {
        setError(getErrorFeedback('profileSetupInvalidLinks').message);
        notify?.({
          type: 'warning',
          title: getErrorFeedback('profileSetupInvalidLinks').title,
          message: 'Use full URLs including https:// for GitHub and LinkedIn.'
        });
        setSaving(false);
        return;
      }

      const serializedSkills = serializeSkillTags(finalSkillTags);
      const response = await client.put('/api/v1/users/me/profile', {
        skills: serializedSkills,
        aboutMe: form.aboutMe,
        githubUrl: form.githubUrl,
        linkedinUrl: form.linkedinUrl,
        profileImageUrl: form.profileImageUrl
      });
      notify?.({
        type: 'success',
        title: 'Profile saved',
        message: 'Your profile was updated successfully.'
      });
      trackAnalyticsEvent('profile_setup_completed', {
        qualityScore,
        skillTagCount: finalSkillTags.length
      });
      onCompleted(response.data.data);
    } catch (err) {
      const backendError = err?.response?.data?.data?.error || getErrorFeedback('profileSetupSaveFailed').message;
      setError(backendError);
      notify?.({
        type: 'error',
        title: getErrorFeedback('profileSetupSaveFailed').title,
        message: backendError
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main>
      <div className="profile-setup-card">
        <div className="onboarding-stepper">
          <div className="onboarding-stepper-header">
            <span className="onboarding-stepper-pill">Step 2 of 3</span>
            <div>
              <p className="onboarding-stepper-title">Complete your profile</p>
              <p className="onboarding-stepper-subtitle">Unlock better mentor matches with a polished profile.</p>
            </div>
          </div>
          <div className="onboarding-stepper-track">
            <div className="onboarding-stepper-progress" style={{ width: '66%' }} />
          </div>
          <div className="onboarding-stepper-steps">
            <span className="onboarding-stepper-step is-complete">Create account</span>
            <span className="onboarding-stepper-step is-active">Profile details</span>
            <span className="onboarding-stepper-step">Start matching</span>
          </div>
        </div>
        <h2>Complete your profile</h2>
        <p className="muted">
          Add your core skills, a short bio, and your GitHub and LinkedIn links to continue.
        </p>

        <form className="profile-setup-form" onSubmit={handleSubmit}>
          <div className="profile-quality-meter">
            <div className="profile-quality-header">
              <strong>Profile quality:</strong>
              <span>{qualityScore}%</span>
            </div>
            <div className="profile-quality-track">
              <div className="profile-quality-fill" style={{ width: `${qualityScore}%` }} />
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
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSkillTag();
                  }
                }}
              />
              <select value={newSkillLevel} onChange={(e) => setNewSkillLevel(e.target.value)}>
                {SKILL_LEVELS.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
              <button type="button" onClick={addSkillTag}>Add</button>
            </div>
            {skillTags.length > 0 ? (
              <div className="skill-tag-list">
                {skillTags.map((tag) => (
                  <span key={tag.name} className="skill-tag-chip">
                    {tag.name} ({tag.level})
                    <button type="button" onClick={() => removeSkillTag(tag.name)} aria-label={`Remove ${tag.name}`}>
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
                  event.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}

          <input
            type="hidden"
            name="skills"
            value={serializeSkillTags(skillTags)}
            readOnly
          />

          {error && <p className="error">{error}</p>}

          <div className="profile-setup-actions">
            <button type="submit" className="submit-btn" disabled={saving}>
              {saving ? 'Saving...' : 'Save and Continue'}
            </button>
            <button type="button" onClick={onLogout}>Logout</button>
          </div>
        </form>

        {initialProfile && (
          <div style={{ marginTop: '24px' }}>
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
