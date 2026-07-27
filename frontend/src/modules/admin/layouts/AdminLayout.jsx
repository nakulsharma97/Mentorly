import WorkspaceLayout from "../../common/workspace/WorkspaceLayout";

const BRAND = { title: "SkillSwap", subtitle: "Admin Console" };

const GROUPS = [
  {
    label: "Operations",
    links: [
      { to: "/admin/dashboard", label: "Dashboard", icon: "dashboard", end: true },
      { to: "/admin/users", label: "Users", icon: "people" },
      { to: "/admin/sessions", label: "Sessions", icon: "calendar_month" },
      { to: "/admin/payments", label: "Payments", icon: "payments" },
      { to: "/admin/conversations", label: "Conversations", icon: "forum" },
    ],
  },
  {
    label: "Moderation",
    links: [
      { to: "/admin/reports", label: "Reports", icon: "flag" },
      { to: "/admin/flagged-content", label: "Flagged Content", icon: "reports" },
      { to: "/admin/verifications", label: "Verifications", icon: "verified" },
    ],
  },
  {
    label: "Tools",
    links: [
      { to: "/admin/analytics", label: "Analytics", icon: "insights" },
      { to: "/admin/health", label: "Health", icon: "monitor_heart" },
      { to: "/admin/notifications", label: "Broadcast", icon: "campaign" },
      { to: "/admin/audit-log", label: "Timeline", icon: "history" },
      { to: "/admin/api-docs", label: "API Docs", icon: "api" },
      { to: "/admin/settings", label: "Settings", icon: "settings" },
    ],
  },
];

const SECONDARY = [
  { to: "/admin/settings", label: "Settings", icon: "settings" },
];

const PAGE_META = {
  dashboard: { title: "Dashboard", search: "Search..." },
  users: { title: "Users", search: "Search users..." },
  sessions: { title: "Sessions", search: "Search sessions..." },
  payments: { title: "Payments", search: "Search payments..." },
  conversations: { title: "Conversations", search: "Search conversations..." },
  reports: { title: "Reports", search: "Search reports..." },
  "flagged-content": { title: "Flagged Content", search: "Search..." },
  verifications: { title: "Verifications", search: "Search..." },
  analytics: { title: "Analytics", search: "Search..." },
  notifications: { title: "Broadcast Notification", search: "" },
  "audit-log": { title: "Activity Timeline", search: "Search logs..." },
  health: { title: "Platform Health", search: "" },
  "api-docs": { title: "API Documentation", search: "" },
  settings: { title: "Settings", search: "" },
};

const PROFILE_MENU = [
  { to: "/admin/dashboard", label: "Dashboard", icon: "dashboard" },
  { to: "/admin/settings", label: "Settings", icon: "settings" },
];

export default function AdminLayout({ profile, onLogout, unreadNotifications, onUnreadCountChange, notify }) {
  return (
    <WorkspaceLayout
      profile={profile}
      onLogout={onLogout}
      unreadNotifications={unreadNotifications}
      onUnreadCountChange={onUnreadCountChange}
      onNotify={notify}
      brand={BRAND}
      groups={GROUPS}
      secondaryLinks={SECONDARY}
      pageMeta={PAGE_META}
      crumbRoot="Admin"
      notificationsTo="/admin/dashboard"
      profileMenu={PROFILE_MENU}
      storageKey="admin_sidebar_collapsed"
    />
  );
}
