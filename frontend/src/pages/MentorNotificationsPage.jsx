import { useEffect, useState } from "react";
import NotificationCenter from "../components/NotificationCenter";
import Icon from "../modules/common/dashboard/Icon";
import "../modules/mentor/mentor-pages.css";

export default function MentorNotificationsPage({ notify }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    document.title = "Notifications | SkillSwap";
  }, []);

  return (
    <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 48px" }}>
      {/* ===== Premium Hero ===== */}
      <section className="mp-hero">
        <div className="mp-hero__watermark">
          <span className="material-symbols-outlined" style={{ fontSize: 78 }}>notifications</span>
        </div>
        <div className="mp-hero__content">
          <div className="mp-hero__eyebrow">
            <Icon name="notifications_active" />
            NOTIFICATIONS
          </div>
          <h1>Notification Center</h1>
          <p className="mp-hero__sub">
            Stay up to date with booking requests, session reminders, reviews, earnings, and more — delivered in real time.
          </p>
        </div>
      </section>

      {/* ===== Notification Panel ===== */}
      <div className="md-card" style={{ marginTop: 20, overflow: "hidden", padding: 0, borderRadius: "var(--mp-radius-xl, 12px)" }}>
        <NotificationCenter
          fullPage
          hideFullPageHeader
          notificationsPath="/mentor/notifications"
          unreadNotifications={unreadCount}
          onUnreadCountChange={setUnreadCount}
          onNotify={notify}
        />
      </div>
    </div>
  );
}
