import NotificationCenter from "../components/NotificationCenter";
import "../modules/mentor/mentor-pages.css";

export default function MentorNotificationsPage() {
  return (
    <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 48px" }}>
      {/* ===== Premium Hero ===== */}
      <section className="mp-hero">
        <div className="mp-hero__watermark">
          <span className="material-symbols-outlined" style={{ fontSize: 78 }}>notifications</span>
        </div>
        <div className="mp-hero__content">
          <div className="mp-hero__eyebrow">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>campaign</span>
            NOTIFICATIONS
          </div>
          <h1>Notification Center</h1>
          <p className="mp-hero__sub">
            Stay up to date with booking requests, session reminders, reviews, and more.
          </p>
        </div>
      </section>

      {/* ===== Notification Panel ===== */}
      <div className="mp-card" style={{ marginTop: 20, overflow: "hidden", padding: 0 }}>
        <NotificationCenter
          fullPage
          hideFullPageHeader
          notificationsPath="/mentor/notifications"
        />
      </div>
    </div>
  );
}
