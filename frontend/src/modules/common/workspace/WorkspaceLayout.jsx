import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import WorkspaceSidebar from "./WorkspaceSidebar";
import WorkspaceTopbar from "./WorkspaceTopbar";
import "../dashboard/dashboard.css";
import "./workspace.css";

/**
 * Shared, full-width dashboard shell used by both the Mentor and Learner
 * workspaces. Fixed sidebar + sticky topbar + fluid content (no max-width).
 * Owns sidebar collapse (persisted) and the mobile drawer state.
 */
export default function WorkspaceLayout({
  profile,
  onLogout,
  unreadNotifications,
  onUnreadCountChange,
  onNotify,
  brand,
  groups,
  secondaryLinks,
  pageMeta,
  crumbRoot,
  notificationsTo,
  profileMenu,
  storageKey = "ws_sidebar_collapsed",
}) {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(storageKey) === "1",
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(storageKey, collapsed ? "1" : "0");
  }, [collapsed, storageKey]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <div className={`ws-shell${collapsed ? " is-collapsed" : ""}`}>
      <WorkspaceSidebar
        brand={brand}
        groups={groups}
        secondaryLinks={secondaryLinks}
        profile={profile}
        onLogout={onLogout}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="ws-main">
        <WorkspaceTopbar
          profile={profile}
          onLogout={onLogout}
          unreadNotifications={unreadNotifications}
          onUnreadCountChange={onUnreadCountChange}
          onNotify={onNotify}
          pageMeta={pageMeta}
          crumbRoot={crumbRoot}
          notificationsTo={notificationsTo}
          profileMenu={profileMenu}
          onToggleSidebar={() => setCollapsed((v) => !v)}
          onOpenMobileNav={() => setMobileOpen(true)}
        />
        <main className="ws-main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
