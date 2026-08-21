import { useState } from "react";
import HeroSection from "../components/HeroSection";
import { useDocumentTitle, useLearnerLearningData } from "./learner-utils";
import "../modules/mentor/mentor-pages.css";

export default function LearnerAchievementsPage() {
  useDocumentTitle("Achievements");
  const [refreshKey, setRefreshKey] = useState(0);
  const { loading, data, error } = useLearnerLearningData(refreshKey);

  if (loading) {
    return (
      <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div className="mp-settings-loading">
          <div className="mp-spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
          <p className="mp-settings-loading__text">Loading achievements…</p>
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
          <h3 className="md-empty__title">Could not load achievements</h3>
          <p className="md-empty__desc">{error}</p>
          <button type="button" className="mp-btn mp-btn--primary" onClick={() => setRefreshKey((v) => v + 1)}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const {
    certifications,
    savedMentors,
    savedSkills,
    bookings,
    profile,
  } = data;
  const completedBookings = bookings.filter(
    (booking) => String(booking?.bookingStatus || "").toUpperCase() === "COMPLETED",
  );

  const items = [
    { title: "Completed sessions", detail: `${completedBookings.length} completed bookings`, icon: "task_alt" },
    { title: "Certificates", detail: `${certifications.length} issued certificates`, icon: "workspace_premium" },
    { title: "Saved mentors", detail: `${savedMentors.length} mentors saved in watchlist`, icon: "bookmark" },
    { title: "Saved skills", detail: `${savedSkills.length} skills added to watchlist`, icon: "school" },
    { title: "Profile completion", detail: `${profile?.profileCompletionPercent || 0}% complete`, icon: "person" },
    { title: "Sessions scheduled", detail: `${bookings.length} total bookings`, icon: "event" },
  ];

  return (
    <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
      <HeroSection
        className="hero-section--compact"
        badge={
          <>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>military_tech</span>
            Achievements
          </>
        }
        title="Your Achievements"
        subtitle="Track your completed sessions, certificates, saved mentors, and overall progress across the platform."
        illustration={
          <div className="hero-section__watermark" aria-hidden="true">
            <span className="material-symbols-outlined">military_tech</span>
          </div>
        }
      />

      <div className="mp-stats" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginTop: 20 }}>
        <div className="mp-stat">
          <div className="mp-stat__top">
            <div className="mp-stat__icon">
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>workspace_premium</span>
            </div>
          </div>
          <p className="mp-stat__value">{certifications.length}</p>
          <p className="mp-stat__label">Certificates</p>
          <p className="mp-stat__desc">Backend issued</p>
        </div>
        <div className="mp-stat">
          <div className="mp-stat__top">
            <div className="mp-stat__icon">
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>bookmark</span>
            </div>
          </div>
          <p className="mp-stat__value">{savedMentors.length}</p>
          <p className="mp-stat__label">Saved mentors</p>
          <p className="mp-stat__desc">Mentor watchlist</p>
        </div>
        <div className="mp-stat">
          <div className="mp-stat__top">
            <div className="mp-stat__icon">
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>school</span>
            </div>
          </div>
          <p className="mp-stat__value">{savedSkills.length}</p>
          <p className="mp-stat__label">Saved skills</p>
          <p className="mp-stat__desc">Skill watchlist</p>
        </div>
        <div className="mp-stat">
          <div className="mp-stat__top">
            <div className="mp-stat__icon">
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>task_alt</span>
            </div>
          </div>
          <p className="mp-stat__value">{completedBookings.length}</p>
          <p className="mp-stat__label">Completed</p>
          <p className="mp-stat__desc">Closed sessions</p>
        </div>
      </div>

      <div className="mp-card" style={{ marginTop: 18 }}>
        <div className="mp-section__head">
          <div className="mp-section__title">
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: "var(--mp-primary)" }}>military_tech</span>
            Achievement List
          </div>
        </div>
        <p style={{ margin: "-8px 0 18px", fontSize: "0.88rem", color: "var(--mp-text-secondary)", lineHeight: 1.6 }}>
          All visible achievements are derived from backend records and live learner activity.
        </p>
        <div className="mp-animate-stagger">
          {items.map((item) => (
            <div key={item.title} className="mp-setting-row" style={{ cursor: "default" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, width: "100%" }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "var(--mp-radius)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "var(--mp-primary-light)", color: "var(--mp-primary)",
                  fontSize: "1.2rem", flexShrink: 0
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 22 }}>{item.icon}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--mp-text)", display: "block" }}>{item.title}</strong>
                  <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--mp-text-secondary)" }}>{item.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
