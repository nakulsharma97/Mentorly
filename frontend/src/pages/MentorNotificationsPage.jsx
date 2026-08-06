import { useEffect, useState } from "react";
import NotificationCenter from "../components/NotificationCenter";
import MentorPageHero from "../modules/mentor/components/MentorPageHero";
import "../modules/mentor/mentor-pages.css";

export default function MentorNotificationsPage({ notify }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    document.title = "Notifications | SkillSwap";
  }, []);

  return (
    <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* ===== Premium Hero (unified design system) ===== */}
      <MentorPageHero
        eyebrow="NOTIFICATIONS"
        icon="notifications"
        title="Notification Center"
        sub="Stay up to date with booking requests, session reminders, reviews, earnings, and more — delivered in real time."
      />

      {/* ===== Notification Panel ===== */}
      <div className="md-card" style={{ overflow: "hidden", padding: 0, borderRadius: "var(--mp-radius-xl, 12px)" }}>
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
