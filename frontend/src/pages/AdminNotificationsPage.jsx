import { useEffect, useState } from "react";
import NotificationCenter from "../components/NotificationCenter";
import HeroSection from "../components/HeroSection";
import "../modules/admin/ui/admin-ui.css";

export default function AdminNotificationsPage({ notify }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    document.title = "Notifications | SkillSwap Admin";
  }, []);

  return (
    <div className="admin-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* ===== Hero (unified design system) ===== */}
      <HeroSection
      className="hero-section--compact"
        badge="NOTIFICATIONS"
        title="Notification Center"
        subtitle="Verification requests, new users, bookings, payments, reports and platform alerts — delivered in real time."
        illustration={
          <div className="hero-section__watermark" aria-hidden="true">
            <span className="material-symbols-outlined">notifications_active</span>
          </div>
        }
      />

      {/* ===== Notification Panel ===== */}
      <div
        style={{
          overflow: "hidden",
          padding: 0,
          borderRadius: 20,
          background: "var(--au-surface, #ffffff)",
          border: "1px solid var(--au-border, #e6edf3)",
          boxShadow: "0 8px 30px rgba(15,23,42,.06)",
        }}
      >
        <NotificationCenter
          fullPage
          hideFullPageHeader
          notificationsPath="/admin/notification-center"
          unreadNotifications={unreadCount}
          onUnreadCountChange={setUnreadCount}
          onNotify={notify}
        />
      </div>
    </div>
  );
}
