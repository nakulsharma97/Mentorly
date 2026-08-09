import WorkspaceLayout from "../../common/workspace/WorkspaceLayout";

const BRAND = { title: "SkillSwap", subtitle: "Learner Workspace" };

const GROUPS = [
  {
    label: "Learn",
    links: [
      { to: "/learner/dashboard", label: "Dashboard", icon: "grid_view", end: true },
      { to: "/learner/mentors", label: "Find Mentors", icon: "person_search" },
      { to: "/learner/saved", label: "Favorite Mentors", icon: "favorite" },
      { to: "/learner/skills", label: "Explore Skills", icon: "auto_stories" },
      { to: "/learner/learning", label: "My Learning", icon: "school" },
      { to: "/learner/tasks", label: "Daily Tasks", icon: "task_alt" },
      { to: "/learner/sessions", label: "Booked Sessions", icon: "calendar_month" },
      { to: "/learner/requests", label: "My Requests", icon: "handshake" },
      { to: "/learner/messages", label: "Messages", icon: "chat" },
    ],
  },
];

const SECONDARY = [
  { to: "/learner/profile", label: "Profile", icon: "person" },
  { to: "/learner/settings", label: "Settings", icon: "settings" },
];

const PAGE_META = {
  dashboard: { title: "Dashboard", search: "Search mentors, skills..." },
  mentors: { title: "Find Mentors", search: "Search mentors..." },
  skills: { title: "Explore Skills", search: "Search skills..." },
  learning: { title: "My Learning", search: "Search your learning..." },
  tasks: { title: "Daily Tasks", search: "Search tasks..." },
  sessions: { title: "Booked Sessions", search: "Search sessions..." },
  requests: { title: "My Requests", search: "Search requests..." },
  certificates: { title: "Certificates", search: "Search certificates..." },
  messages: { title: "Messages", search: "Search conversations..." },
  saved: { title: "Saved Mentors", search: "Search saved mentors..." },
  path: { title: "Learning Path", search: "Search your path..." },
  achievements: { title: "Achievements", search: "Search achievements..." },
  wallet: { title: "Wallet", search: "Search transactions..." },
  profile: { title: "Profile", search: "Search..." },
  settings: { title: "Settings", search: "Search..." },
};

const PROFILE_MENU = [
  { to: "/learner/profile", label: "Profile", icon: "person" },
  { to: "/learner/settings", label: "Settings", icon: "settings" },
  { to: "/learner/certificates", label: "Certificates", icon: "workspace_premium" },
];

export default function LearnerLayout({ profile, onLogout, unreadNotifications, onUnreadCountChange, notify }) {
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
      crumbRoot="Learner"
      profileMenu={PROFILE_MENU}
      storageKey="learner_sidebar_collapsed"
    />
  );
}
