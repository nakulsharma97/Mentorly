import { useCallback, useEffect, useState } from "react";
import { Outlet } from "react-router";
import WorkspaceSidebar from "./WorkspaceSidebar";
import WorkspaceTopbar from "./WorkspaceTopbar";
import { formatTabTitle } from "../../messages/unreadMessagesStore";
import { useUnreadMessageCount } from "./useUnreadMessages";
import { ChatProvider } from "../../../context/ChatContext";
import "../dashboard/dashboard.css";
import "./workspace.css";

const DESKTOP_QUERY = "(min-width: 1280px)";

/**
 * Shared, full-width dashboard shell used by the Mentor, Learner and Admin
 * workspaces. Fixed sidebar + sticky topbar + fluid content.
 *
 * Navigation model (premium burger UX):
 *  - Desktop  (>=1280px): sidebar is a collapsible rail (260px <-> 88px),
 *    state persisted in localStorage.
 *  - Tablet   (768-1279px): sidebar hidden; burger opens a 300px slide-in
 *    drawer over an overlay.
 *  - Mobile   (<768px):     same drawer, near-full width.
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
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia(DESKTOP_QUERY).matches,
  );

  // Backend-driven unread message count (sidebar badge + tab title).
  // Polling is now handled inside ChatProvider (see ChatContext.jsx).
  const unreadMessages = useUnreadMessageCount();

  // Browser tab title: "(N) <page title>" while unread messages exist.
  // Page-level effects set document.title on navigation; this observes those
  // changes and re-applies the count prefix so the badge stays live.
  //
  // IMPORTANT: apply() must only write document.title when the value would
  // actually change. Writing it unconditionally from inside a MutationObserver
  // that observes the <title> element creates a self-sustaining mutation loop
  // that starves the main thread and freezes the whole workspace (identical
  // writes still record a mutation in Chromium).
  useEffect(() => {
    const apply = () => {
      const next = formatTabTitle(document.title, unreadMessages);
      if (document.title !== next) {
        document.title = next;
      }
    };
    apply();
    const titleEl = document.head?.querySelector("title");
    if (!titleEl) return undefined;
    const observer = new MutationObserver(apply);
    observer.observe(titleEl, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [unreadMessages]);

  // Track viewport crossing the desktop threshold.
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Persist desktop collapse preference.
  useEffect(() => {
    localStorage.setItem(storageKey, collapsed ? "1" : "0");
  }, [collapsed, storageKey]);

  // The drawer only exists below desktop.
  const drawerOpen = mobileOpen && !isDesktop;

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  // Close the drawer when resizing into the desktop breakpoint, and keep
  // the collapsed state consistent on the desktop shell.
  useEffect(() => {
    if (isDesktop) setMobileOpen(false);
  }, [isDesktop]);

  // ESC closes the drawer (tablet/mobile).
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const toggleNav = useCallback(() => {
    if (isDesktop) {
      setCollapsed((v) => !v);
    } else {
      setMobileOpen((v) => !v);
    }
  }, [isDesktop]);

  const navOpen = isDesktop ? collapsed : mobileOpen;
  // Semantic "is the controlled sidebar expanded" — on desktop the rail is
  // expanded when NOT collapsed; below desktop it tracks the drawer.
  const navExpanded = isDesktop ? !collapsed : mobileOpen;

  return (
    <ChatProvider profile={profile}>
      <div className={`ws-shell${collapsed && isDesktop ? " is-collapsed" : ""}`}>
        <WorkspaceSidebar
          brand={brand}
          groups={groups}
          secondaryLinks={secondaryLinks}
          profile={profile}
          onLogout={onLogout}
          collapsed={collapsed}
          isDesktop={isDesktop}
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
            navOpen={navOpen}
            navExpanded={navExpanded}
            onToggleNav={toggleNav}
          />
          <main className="ws-main-content">
            <Outlet />
          </main>
        </div>
      </div>
    </ChatProvider>
  );
}
