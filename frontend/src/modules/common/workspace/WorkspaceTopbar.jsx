import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../../../context/ThemeContext";
import Icon from "../dashboard/Icon";
import { initials } from "../dashboard/dashboardUtils";
import NotificationCenter from "../../../components/NotificationCenter";

/**
 * Role-agnostic sticky topbar: breadcrumb + page title, centered search,
 * notifications, theme toggle and a profile dropdown.
 * @param pageMeta      map keyed by 2nd path segment -> { title, search }
 * @param crumbRoot     breadcrumb root label (e.g. "Mentor" / "Learner")
 * @param profileMenu   [{ to, label, icon, danger }]
 */
export default function WorkspaceTopbar({
  profile,
  onLogout,
  unreadNotifications = 0,
  onToggleSidebar,
  onOpenMobileNav,
  pageMeta = {},
  crumbRoot = "Workspace",
  profileMenu = [],
  onUnreadCountChange,
}) {
  const { isDark, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);

  const segment = location.pathname.split("/").filter(Boolean)[1] || "dashboard";
  const meta = pageMeta[segment] || { title: "Dashboard", search: "Search..." };
  const fullName = profile?.fullName || "User";

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  // Global keyboard shortcut: press / to focus search
  useEffect(() => {
    const onKey = (event) => {
      if (
        event.key === "/" &&
        !event.metaKey &&
        !event.ctrlKey &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleSearchChange = (event) => {
    setSearchValue(event.target.value);
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === "Enter" && searchValue.trim()) {
      event.preventDefault();
      const q = encodeURIComponent(searchValue.trim());
      // Navigate to the messages page with the search query
      if (location.pathname.startsWith("/mentor")) {
        navigate(`/mentor/messages?q=${q}`);
      } else if (location.pathname.startsWith("/learner")) {
        navigate(`/learner/messages?q=${q}`);
      }
      searchInputRef.current?.blur();
    }
  };

  return (
    <header className="ws-top">
      <div className="ws-top__left">
        <button
          type="button"
          className="ws-top__icon-btn ws-top__menu-btn"
          onClick={onOpenMobileNav}
          aria-label="Open navigation"
        >
          <Icon name="menu" />
        </button>
        <button
          type="button"
          className="ws-top__icon-btn ws-top__collapse"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <Icon name="menu_open" />
        </button>
        <div className="ws-top__titles">
          <nav className="ws-top__crumb" aria-label="Breadcrumb">
            <span>{crumbRoot}</span>
            <Icon name="chevron_right" />
            <span className="ws-top__crumb-current">{meta.title}</span>
          </nav>
          <h1 className="ws-top__title">{meta.title}</h1>
        </div>
      </div>

      <label className="ws-top__search" htmlFor="ws-search">
        <Icon name="search" />
        <input
          ref={searchInputRef}
          id="ws-search"
          type="search"
          value={searchValue}
          onChange={handleSearchChange}
          onKeyDown={handleSearchKeyDown}
          placeholder={meta.search}
          aria-label="Search"
        />
        <kbd className="ws-top__kbd">/</kbd>
      </label>

      <div className="ws-top__right">
        <NotificationCenter
          profile={profile}
          unreadNotifications={unreadNotifications}
          onUnreadCountChange={onUnreadCountChange}
        />

        <button type="button" className="ws-top__icon-btn" onClick={toggle} aria-label="Toggle theme">
          <Icon name={isDark ? "light_mode" : "dark_mode"} />
        </button>

        <div className="ws-top__profile" ref={menuRef}>
          <button
            type="button"
            className="ws-top__profile-btn"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <span className="ws-top__avatar">
              {profile?.profileImageUrl ? (
                <img src={profile.profileImageUrl} alt={fullName} />
              ) : (
                initials(fullName)
              )}
            </span>
            <span className="ws-top__profile-copy">
              <strong>{fullName}</strong>
              <span className="ws-top__status">
                <i className="ws-top__dot" /> Online
              </span>
            </span>
            <Icon name="expand_more" className="ws-top__chevron" />
          </button>

          {menuOpen && (
            <div className="ws-top__menu" role="menu">
              {profileMenu.map((item, i) =>
                item.sep ? (
                  <div key={`sep-${i}`} className="ws-top__menu-sep" />
                ) : (
                  <Link
                    key={item.label}
                    to={item.to}
                    className="ws-top__menu-item"
                    role="menuitem"
                  >
                    <Icon name={item.icon} /> {item.label}
                  </Link>
                ),
              )}
              <div className="ws-top__menu-sep" />
              <button
                type="button"
                className="ws-top__menu-item ws-top__menu-item--danger"
                onClick={onLogout}
                role="menuitem"
              >
                <Icon name="logout" /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
