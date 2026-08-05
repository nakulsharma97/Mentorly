import { useEffect, useState } from "react";
import NotificationCenter from "../components/NotificationCenter";
import Icon from "../modules/common/dashboard/Icon";
import "../modules/admin/ui/admin-ui.css";

export default function AdminNotificationsPage({ notify }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    document.title = "Notifications | SkillSwap Admin";
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 48px" }}>
      {/* ===== Hero ===== */}
      <section className="au-hero">
        <div>
          <div className="au-hero__label">
            <Icon name="notifications_active" />
            ADMIN NOTIFICATIONS
          </div>
          <h1 className="au-hero__title">Notification Center</h1>
          <p className="au-hero__desc">
            Verification requests, new users, bookings, payments, reports and
            platform alerts — delivered in real time.
          </p>
        </div>
      </section>

      {/* ===== Notification Panel ===== */}
      <div
        style={{
          marginTop: 20,
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
