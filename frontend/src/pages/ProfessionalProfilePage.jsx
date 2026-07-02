import { Link, useLocation } from "react-router-dom";
import { useMemo } from "react";
import MentorCertificationsManager from "../components/mentor/MentorCertificationsManager";
import "./ProfessionalProfilePage.css";

function VerificationStatusPanel({ profile }) {
  const isVerified = Boolean(
    profile?.mentorVerified ||
    profile?.verified ||
    profile?.verificationStatus === "VERIFIED",
  );
  const statusLabel = isVerified ? "Verified" : "Pending review";
  const badgeClass = isVerified
    ? "pp-badge pp-badge--verified"
    : "pp-badge pp-badge--pending";

  return (
    <Panel
      title="Verification Status"
      subtitle="Build trust with learners before they book."
    >
      <div className="pp-verification-card">
        <div className="pp-verification-card__content">
          <div
            className={`pp-badge ${isVerified ? "pp-badge--verified" : "pp-badge--pending"}`}
          >
            {statusLabel}
          </div>
          <p className="pp-muted">
            {isVerified
              ? "Your mentor verification is active, which helps learners feel more confident booking with you."
              : "Complete your profile and verification steps so learners can trust your expertise and book with confidence."}
          </p>
        </div>
        <Link to="/profile-setup" className="pp-btn pp-btn-primary">
          {isVerified ? "Update Profile" : "Complete Verification"}
        </Link>
      </div>
    </Panel>
  );
}

const tabs = [
  {
    key: "personal-information",
    label: "Personal",
    icon: "person",
    path: "/professional-profile",
  },
  {
    key: "skills",
    label: "Skills",
    icon: "auto_awesome",
    path: "/professional-profile/skills",
  },
  {
    key: "experience",
    label: "Experience",
    icon: "work",
    path: "/professional-profile/experience",
  },
  {
    key: "education",
    label: "Education",
    icon: "school",
    path: "/professional-profile/education",
  },
  {
    key: "certifications",
    label: "Certifications",
    icon: "workspace_premium",
    path: "/professional-profile/certifications",
  },
  {
    key: "portfolio",
    label: "Portfolio",
    icon: "folder_open",
    path: "/professional-profile/portfolio",
  },
];

// Presentational-only completion estimate derived from the fields we already
// hold on the profile object. No backend/API call is involved.
const completionChecklist = [
  { key: "fullName", label: "Full name" },
  { key: "aboutMe", label: "About you" },
  { key: "skills", label: "Skills" },
  { key: "githubUrl", label: "GitHub" },
  { key: "linkedinUrl", label: "LinkedIn" },
  { key: "profileImageUrl", label: "Profile photo" },
];

function computeCompletion(profile) {
  if (!profile) {
    return {
      percent: 0,
      missing: completionChecklist.map((item) => item.label),
    };
  }
  const missing = completionChecklist.filter(
    (item) => !String(profile[item.key] || "").trim(),
  );
  const filled = completionChecklist.length - missing.length;
  const percent = Math.round((filled / completionChecklist.length) * 100);
  return { percent, missing: missing.map((item) => item.label) };
}

function Panel({ title, subtitle, children }) {
  return (
    <section className="pp-card">
      <header className="pp-card-head">
        <h3 className="pp-card-title">{title}</h3>
        {subtitle && <p className="pp-card-subtitle">{subtitle}</p>}
      </header>
      <div className="pp-card-body">{children}</div>
    </section>
  );
}

export default function ProfessionalProfilePage({ profile, notify }) {
  const location = useLocation();
  const pathname = location.pathname.replace(/\/+$/, "");

  const activeTab =
    pathname === "/professional-profile/certifications"
      ? "certifications"
      : pathname === "/professional-profile/skills"
        ? "skills"
        : pathname === "/professional-profile/experience"
          ? "experience"
          : pathname === "/professional-profile/education"
            ? "education"
            : pathname === "/professional-profile/portfolio"
              ? "portfolio"
              : "personal-information";

  const completion = useMemo(() => computeCompletion(profile), [profile]);
  const completionMessage =
    completion.percent >= 100
      ? "Your profile is complete — you're ready to attract more learners."
      : completion.missing.length
        ? `Add your ${completion.missing
            .slice(0, 2)
            .join(" and ")
            .toLowerCase()} to attract more learners.`
        : "Complete your certifications and portfolio to attract more learners.";

  return (
    <main className="pp-page">
      <div className="pp-container">
        <header className="pp-header">
          <h1 className="pp-title">Professional Profile</h1>
          <p className="pp-subtitle">
            Manage your mentor profile and build learner trust.
          </p>
        </header>

        <section className="pp-completion" aria-label="Profile completion">
          <div className="pp-completion-glow" aria-hidden="true" />
          <div className="pp-completion-main">
            <div className="pp-completion-icon" aria-hidden="true">
              <span className="material-symbols-outlined">account_circle</span>
            </div>
            <div className="pp-completion-text">
              <p className="pp-completion-label">Profile Completion</p>
              <p className="pp-completion-percent">
                {completion.percent}%
                <span className="pp-completion-percent-word"> Complete</span>
              </p>
            </div>
            <Link to="/profile-setup" className="pp-btn pp-btn-primary">
              Continue Editing
            </Link>
          </div>

          <div
            className="pp-progress"
            role="progressbar"
            aria-valuenow={completion.percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <span
              className="pp-progress-fill"
              style={{ width: `${completion.percent}%` }}
            />
          </div>

          <p className="pp-completion-hint">{completionMessage}</p>
        </section>

        <nav className="pp-tabs" aria-label="Profile sections">
          <div className="pp-tabs-track">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <Link
                  key={tab.key}
                  to={tab.path}
                  className={`pp-tab${isActive ? " pp-tab-active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span className="material-symbols-outlined pp-tab-icon">
                    {tab.icon}
                  </span>
                  <span className="pp-tab-label">{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="pp-panel" key={activeTab}>
          {activeTab === "personal-information" && (
            <div className="pp-stack">
              <Panel
                title="Personal Information"
                subtitle="The basics learners see first."
              >
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
                    <dt>About</dt>
                    <dd>
                      {profile?.aboutMe ||
                        "Add a short introduction to your profile."}
                    </dd>
                  </div>
                </dl>
              </Panel>
              <VerificationStatusPanel profile={profile} />
              <Panel
                title="Profile Summary"
                subtitle="How to make the most of this space."
              >
                <p className="pp-muted">
                  Use the tabs above to manage your professional details,
                  skills, experience, education, certifications, and portfolio.
                </p>
              </Panel>
            </div>
          )}

          {activeTab === "skills" && (
            <Panel
              title="Skills"
              subtitle="Help learners discover your expertise."
            >
              <p className="pp-muted">
                {profile?.skills ||
                  "Add your key skills so learners can discover your expertise."}
              </p>
            </Panel>
          )}

          {activeTab === "experience" && (
            <Panel title="Experience" subtitle="Your professional background.">
              <p className="pp-muted">
                Add your professional experience and session history here.
              </p>
            </Panel>
          )}

          {activeTab === "education" && (
            <Panel
              title="Education"
              subtitle="Academic background and training."
            >
              <p className="pp-muted">
                Add your academic background and training here.
              </p>
            </Panel>
          )}

          {activeTab === "certifications" && (
            <MentorCertificationsManager
              mentorId={profile?.id}
              notify={notify}
            />
          )}

          {activeTab === "portfolio" && (
            <Panel title="Portfolio" subtitle="Show learners your best work.">
              <p className="pp-muted">
                Share your best work links and examples here.
              </p>
            </Panel>
          )}
        </div>
      </div>
    </main>
  );
}
