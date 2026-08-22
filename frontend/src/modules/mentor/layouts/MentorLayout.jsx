import WorkspaceLayout from "../../common/workspace/WorkspaceLayout";

const BRAND = { title: "Mentorly", subtitle: "Mentor Workspace" };

const GROUPS = [
  {
    label: "Workspace",
    links: [
      {
        to: "/mentor/dashboard",
        label: "Dashboard",
        icon: "grid_view",
        end: true,
      },
      {
        to: "/mentor/teach",
        label: "Manage Sessions",
        icon: "video_camera_front",
      },
      { to: "/mentor/students", label: "Students", icon: "groups" },
      { to: "/mentor/calendar", label: "Calendar", icon: "calendar_month" },
      { to: "/mentor/messages", label: "Messages", icon: "chat" },
      { to: "/mentor/analytics", label: "Analytics", icon: "insights" },
      { to: "/mentor/wallet", label: "Earnings", icon: "payments" },
      { to: "/mentor/reviews", label: "Reviews", icon: "star_rate" },
    ],
  },
];

const SECONDARY = [
  { to: "/mentor/professional-profile", label: "Profile", icon: "person" },
  { to: "/mentor/settings", label: "Settings", icon: "settings" },
];

const PAGE_META = {
  dashboard: { title: "Dashboard", search: "Search sessions, students..." },
  teach: { title: "Manage Sessions", search: "Search sessions..." },
  sessions: { title: "Manage Sessions", search: "Search sessions..." },
  students: { title: "Students", search: "Search students..." },
  calendar: { title: "Calendar", search: "Search schedule..." },
  messages: { title: "Messages", search: "Search conversations..." },
  analytics: { title: "Analytics", search: "Search analytics..." },
  earnings: { title: "Earnings", search: "Search transactions..." },
  wallet: { title: "Earnings", search: "Search transactions..." },
  reviews: { title: "Reviews", search: "Search reviews..." },
  "professional-profile": { title: "Profile", search: "Search..." },
  settings: { title: "Settings", search: "Search notification preferences..." },
};

const PROFILE_MENU = [
  { to: "/mentor/professional-profile", label: "Profile", icon: "person" },
  { to: "/mentor/settings", label: "Settings", icon: "settings" },
  { to: "/mentor/wallet", label: "Earnings", icon: "payments" },
];

export default function MentorLayout({
  profile,
  onLogout,
  unreadNotifications,
  onUnreadCountChange,
  notify,
}) {
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
      crumbRoot="Mentor"
      profileMenu={PROFILE_MENU}
      storageKey="mentor_sidebar_collapsed"
    />
  );
}
