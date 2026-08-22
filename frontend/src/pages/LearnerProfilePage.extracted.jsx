import { useState } from "react";
import SectionCard, { EmptyState } from "../modules/common/dashboard/SectionCard";
import StatsCard from "../modules/common/dashboard/StatsCard";
import HeroSection from "../components/HeroSection";
import { normalizeSkills } from "../utils/skills";
import { useDocumentTitle, useLearnerLearningData, formatDate } from "./learner-utils";
import "../modules/mentor/mentor-pages.css";

/* Detail card */
function DetailCard({ title, icon, children }) {
  return (
    <div className="mp-card mp-animate">
      <div className="mp-section__head">
        <div className="mp-section__title">
          <span className="material-symbols-outlined" style={{ fontSize: 22, color: "var(--mp-primary)" }}>{icon}</span>
          {title}
        </div>
      </div>
      {children}
    </div>
  );
}

/* Certificate card */
function CertificateCard({ certificate }) {
  return (
    <div className="mp-card mp-animate" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: "var(--mp-radius)",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "var(--mp-primary-light)", color: "var(--mp-primary)"
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 24 }}>workspace_premium</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--mp-text)", display: "block" }}>
            {certificate.title || "Certificate"}
          </strong>
          <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--mp-text-secondary)" }}>
            {formatDate(certificate.issuedAt)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LearnerProfilePage() {
  useDocumentTitle("Profile");
  const [refreshKey, setRefreshKey] = useState(0);
  const { loading, data, error } = useLearnerLearningData(refreshKey);

  if (loading) {
    return (
      <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div className="mp-settings-loading">
          <div className="mp-spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
          <p className="mp-settings-loading__text">Loading profile…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div className="md-empty" style={{ margin: "48px auto", maxWidth: 420 }}>
          <div className="md-empty__icon">
            <span className="material-symbols-outlined">error_outline</span>
          </div>
          <h3 className="md-empty__title">Profile could not be loaded</h3>
          <p className="md-empty__desc">{error}</p>
          <button type="button" className="mp-btn mp-btn--primary" onClick={() => setRefreshKey((value) => value + 1)}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { profile, certifications, savedMentors, savedSkills } = data;

  return (
    <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
      <HeroSection
        className="hero-section--compact"
        badge={
          <>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person</span>
            Profile
          </>
        }
        title="Profile"
        subtitle="Your live learner profile and saved backend records."
        illustration={
          <div className="hero-section__watermark" aria-hidden="true">
            <span className="material-symbols-outlined">badge</span>
          </div>
        }
      />
      <div className="ld-stats md-animate">
        <StatsCard icon="person" label="Completion" value={`${profile?.profileCompletionPercent || 0}%`} description="From backend profile data" />
        <StatsCard icon="bookmark" label="Saved mentors" value={savedMentors.length} description="Mentor bookmarks" />
        <StatsCard icon="school" label="Saved skills" value={savedSkills.length} description="Skill watchlist" />
        <StatsCard icon="workspace_premium" label="Certificates" value={certifications.length} description="Issued certificates" />
      </div>
      <div className="ld-row md-animate">
        <div className="ld-c8">
          <DetailCard title="Account details" icon="badge">
            <div className="lp-detail-stack">
              <div><span>Name</span><strong>{profile?.fullName || "Learner"}</strong></div>
              <div><span>Email</span><strong>{profile?.email || "Unavailable"}</strong></div>
              <div><span>Skills</span><strong>{normalizeSkills(profile?.skills).join(", ") || "No skills added"}</strong></div>
              <div><span>About</span><strong>{profile?.aboutMe || "No about section provided"}</strong></div>
            </div>
          </DetailCard>
        </div>
        <div className="ld-c4">
          <DetailCard title="Learning profile" icon="school">
            <div className="lp-detail-stack">
              <div><span>Saved mentors</span><strong>{savedMentors.length}</strong></div>
              <div><span>Saved skills</span><strong>{savedSkills.length}</strong></div>
              <div><span>Certificates</span><strong>{certifications.length}</strong></div>
            </div>
          </DetailCard>
        </div>
      </div>
      <SectionCard title="Learning progress" icon="timeline">
        <div className="lp-detail-stack">
          <div><span>Profile completion</span><strong>{profile?.profileCompletionPercent || 0}%</strong></div>
          <div><span>Certificates earned</span><strong>{certifications.length}</strong></div>
          <div><span>Saved mentors</span><strong>{savedMentors.length}</strong></div>
        </div>
      </SectionCard>
      <SectionCard title="Certificates" icon="workspace_premium">
        {certifications.length ? (
          <div className="lp-grid lp-grid--certificates">
            {certifications.map((certificate) => (
              <CertificateCard key={certificate.id} certificate={certificate} />
            ))}
          </div>
        ) : (
          <EmptyState icon="workspace_premium" title="No certificates yet" description="Your issued certificates will appear here." />
        )}
      </SectionCard>
    </div>
  );
}
