import { useEffect, useRef } from "react";
import { NavLink } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import SsIcon from "../../../components/ui/SsIcon";
import { initials } from "../dashboard/dashboardUtils";
import { formatUnreadCount } from "../../messages/unreadMessagesStore";
import { useUnreadMessageCount } from "./useUnreadMessages";

const DRAWER_TRANSITION = { duration: 0.3, ease: "easeInOut" };

/**
 * SkillSwap Sidebar — Lucide icons via SsIcon.
 * @param brand         { title, subtitle }
 * @param groups        [{ label, links: [{ to, label, icon, end }] }]
 * @param secondaryLinks[{ to, label, icon }]
 *
 * Desktop: static flex rail (260px <-> 88px, CSS-driven width collapse).
 * Tablet/mobile: Framer Motion slide-in drawer (x: -100% -> 0) with overlay.
 */
export default function WorkspaceSidebar({
  brand,
  groups = [],
  secondaryLinks = [],
  profile,
  onLogout,
  collapsed = false,
  isDesktop = true,
  mobileOpen = false,
  onCloseMobile,
}) {
  const unreadMessages = useUnreadMessageCount();
  const fullName = String(profile?.fullName || brand?.title || "User").trim();
  const asideRef = useRef(null);
  const touchStartX = useRef(null);
  const wasOpenRef = useRef(false);

  const drawerVisible = mobileOpen && !isDesktop;

  // Restore focus to the burger trigger when the drawer closes.
  useEffect(() => {
    if (wasOpenRef.current && !drawerVisible) {
      document.querySelector('[aria-controls="ws-sidebar"]')?.focus();
    }
    wasOpenRef.current = drawerVisible;
  }, [drawerVisible]);

  // Focus trap + initial focus when the drawer opens.
  useEffect(() => {
    if (!drawerVisible) return undefined;
    const aside = asideRef.current;
    const focusables = () =>
      Array.from(
        aside?.querySelectorAll(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) || [],
      );
    const first = focusables()[0];
    first?.focus();

    const onKey = (e) => {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerVisible]);

  // Swipe left to close the drawer.
  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx < -60) onCloseMobile?.();
    touchStartX.current = null;
  };

  const renderLink = (item, secondary = false) => {
    const isMessages = item.label.toLowerCase() === "messages";
    return (
      <NavLink
        key={item.label + item.to}
        to={item.to}
        end={item.end}
        onClick={onCloseMobile}
        className={({ isActive }) =>
          `ws-sb__link${isActive ? " is-active" : ""}${secondary ? " ws-sb__link--sm" : ""}`
        }
        title={collapsed ? item.label : undefined}
        aria-label={collapsed ? item.label : undefined}
      >
        <span className="ws-sb__link-rail" />
        <span className="ws-sb__link-icon-wrap">
          <SsIcon name={item.icon} size={20} className="ws-sb__link-icon" />
          {isMessages && unreadMessages > 0 && (
            <span
              key={unreadMessages}
              className="ws-sb__link-badge"
              role="status"
              aria-label={`${unreadMessages} unread message${unreadMessages === 1 ? "" : "s"}`}
            >
              {formatUnreadCount(unreadMessages)}
            </span>
          )}
        </span>
        <span className="ws-sb__link-label">{item.label}</span>
      </NavLink>
    );
  };

  const sidebarInner = (
    <>
      <div className="ws-sb__brand">
        <div className="ws-sb__logo" aria-label={brand?.title || "SkillSwap"}>
          <SsIcon name="zap" size={22} strokeWidth={2.5} />
        </div>
        <div className="ws-sb__brand-copy">
          <p className="ws-sb__brand-title">{brand?.title || "SkillSwap"}</p>
          <p className="ws-sb__brand-sub">{brand?.subtitle}</p>
        </div>
      </div>

      <nav className="ws-sb__nav" aria-label="Workspace sections">
        {groups.map((group) => (
          <div key={group.label}>
            {group.label && <p className="ws-sb__group-label">{group.label}</p>}
            {group.links.map((item) => renderLink(item))}
          </div>
        ))}
      </nav>

      <div className="ws-sb__bottom">
        <div className="ws-sb__divider" />
        {secondaryLinks.length > 0 && (
          <>
            <p className="ws-sb__group-label">Account</p>
            {secondaryLinks.map((item) => renderLink(item, true))}
          </>
        )}
        <button
          type="button"
          className="ws-sb__logout"
          onClick={onLogout}
          title={collapsed ? "Logout" : undefined}
          aria-label="Logout"
        >
          <span className="ws-sb__link-rail" />
          <SsIcon name="logout" size={20} className="ws-sb__link-icon" />
          <span className="ws-sb__link-label">Logout</span>
        </button>

        <div className="ws-sb__user" title={collapsed ? fullName : undefined}>
          <span className="ws-sb__user-avatar">{initials(fullName)}</span>
          <div className="ws-sb__user-copy">
            <strong>{fullName}</strong>
            {profile?.username && (
              <span style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 500, lineHeight: 1.2 }}>
                @{profile.username}
              </span>
            )}
            <span>{profile?.email || brand?.subtitle}</span>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <AnimatePresence>
        {drawerVisible && (
          <motion.div
            className="ws-sb__scrim is-open"
            onClick={onCloseMobile}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={DRAWER_TRANSITION}
          />
        )}
      </AnimatePresence>

      <motion.aside
        ref={asideRef}
        id="ws-sidebar"
        className={`ws-sb${collapsed && isDesktop ? " is-collapsed" : ""}${mobileOpen ? " is-mobile-open" : ""}`}
        initial={false}
        animate={{ x: isDesktop ? 0 : drawerVisible ? 0 : "-100%" }}
        transition={DRAWER_TRANSITION}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        inert={!isDesktop && !drawerVisible}
        aria-label="Sidebar navigation"
      >
        {sidebarInner}
      </motion.aside>
    </>
  );
}
