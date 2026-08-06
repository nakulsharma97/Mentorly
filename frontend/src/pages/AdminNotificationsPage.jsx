import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import NotificationCenter from "../components/NotificationCenter";
import AuHero from "../modules/admin/ui/AuHero";
import "../modules/admin/ui/admin-ui.css";

export default function AdminNotificationsPage({ notify }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    document.title = "Notifications | SkillSwap Admin";
  }, []);

  return (
    <div className="admin-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* ===== Hero (unified design system) ===== */}
      <AuHero
        label="ADMIN NOTIFICATIONS"
        title="Notification Center"
        description="Verification requests, new users, bookings, payments, reports and platform alerts — delivered in real time."
        Icon={BellRing}
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
