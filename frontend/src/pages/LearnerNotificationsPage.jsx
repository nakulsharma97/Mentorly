import { useEffect } from "react";
import NotificationCenter from "../components/NotificationCenter";
import useUnreadNotifications from "../hooks/useUnreadNotifications";
import MentorPageHero from "../modules/mentor/components/MentorPageHero";
import "../modules/mentor/mentor-pages.css";

export default function LearnerNotificationsPage({ notify }) {
  const { unreadCount, refresh } = useUnreadNotifications();

  useEffect(() => {
    document.title = "Notifications | Mentorly";
  }, []);

  return (
    <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* ===== Premium Hero (unified design system) ===== */}
      <MentorPageHero
        compact
        eyebrow="NOTIFICATIONS"
        icon="notifications"
        title="Notification Center"
        sub="Stay up to date with session updates, mentor messages, achievements, and platform announcements — delivered in real time."
      />

      {/* ===== Notification Panel ===== */}
      <div className="md-card" style={{ overflow: "hidden", padding: 0, borderRadius: "var(--mp-radius-xl, 12px)" }}>
        <NotificationCenter
          fullPage
          hideFullPageHeader
          notificationsPath="/learner/notifications"
          unreadNotifications={unreadCount}
          onUnreadCountChange={() => refresh()}
          onNotify={notify}
        />
      </div>
    </div>
  );
}
