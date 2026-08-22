import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useTheme } from "../../../context/ThemeContext";
import client from "../../../api/client";
import SsIcon from "../../../components/ui/SsIcon";
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
  navOpen = false,
  navExpanded = navOpen,
  onToggleNav,
  pageMeta = {},
  crumbRoot = "Workspace",
  notificationsTo,
  profileMenu = [],
  onUnreadCountChange,
  onNotify,
}) {
  const { isDark, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);
  const searchDropdownRef = useRef(null);
  const searchDebounceRef = useRef(null);

  const isMentor = profile?.role === "MENTOR";

  const segment = location.pathname.split("/").filter(Boolean)[1] || "dashboard";
  const meta = pageMeta[segment] || { title: "Dashboard", search: "Search..." };
  const fullName = profile?.fullName || "User";
  // The admin workspace points the bell's notification destination at its own
  // notification-center page; everyone else uses /{role}/notifications.
  const notificationsPath =
    notificationsTo || `/${crumbRoot.toLowerCase()}/notifications`;

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  // Sticky shadow on scroll
  useEffect(() => {
    const onScroll = () => {
      const mainContent = document.querySelector('.ws-main-content');
      if (mainContent) {
        setScrolled(mainContent.scrollTop > 8);
      }
    };
    const mainContent = document.querySelector('.ws-main-content');
    if (mainContent) {
      mainContent.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
    return () => {
      if (mainContent) {
        mainContent.removeEventListener('scroll', onScroll);
      }
    };
  }, []);

  // Close search dropdown on click outside
  useEffect(() => {
    const onClick = (e) => {
      if (
        searchDropdownRef.current &&
        !searchDropdownRef.current.contains(e.target) &&
        searchInputRef.current &&
        !searchInputRef.current.closest(".ws-top__search")?.contains(e.target)
      ) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Debounced search API call
  const runSearch = useCallback(async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }
    setSearchLoading(true);
    try {
      const response = await client.get("/api/v1/search/users", {
        params: { q: query.trim(), size: 10 },
      });
      const users = response?.data?.data || [];
      // Filter by role: mentors see all, learners see mentors only
      const filtered = isMentor
        ? users
        : users.filter((u) => u.role === "MENTOR");
      setSearchResults(filtered);
      setShowSearchDropdown(filtered.length > 0 || query.trim().length >= 2);
    } catch {
      setSearchResults([]);
      setShowSearchDropdown(true); // show empty state
    } finally {
      setSearchLoading(false);
    }
  }, [isMentor]);

  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearchValue(value);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (value.trim().length >= 2) {
      searchDebounceRef.current = setTimeout(() => {
        runSearch(value);
      }, 300);
    } else {
      setSearchResults([]);
      setShowSearchDropdown(false);
    }
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
      setShowSearchDropdown(false);
      searchInputRef.current?.blur();
    }
    if (event.key === "Escape") {
      setShowSearchDropdown(false);
      searchInputRef.current?.blur();
    }
  };

  const handleSearchResultClick = (user) => {
    setShowSearchDropdown(false);
    setSearchValue("");
    setSearchResults([]);
    // Navigate to the appropriate page based on role
    if (user.role === "MENTOR") {
      navigate(`/mentors/${user.userId}`);
    } else {
      // Navigate to learner profile or messages
      navigate(`/learner/messages`);
    }
  };

  const handleSearchFocus = () => {
    if (searchResults.length > 0 || (searchValue.trim().length >= 2 && !searchLoading)) {
      setShowSearchDropdown(true);
    }
  };

  return (
    <header className={`ws-top${scrolled ? " ws-top--scrolled" : ""}`}>
      <div className="ws-top__left">
        {/* Premium animated burger — collapses the rail on desktop, opens the
            slide-in drawer on tablet/mobile. Morphs into an X when open. */}
        <button
          type="button"
          className={`ws-top__burger${navOpen ? " is-open" : ""}`}
          onClick={onToggleNav}
          aria-label={navOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={navExpanded}
          aria-controls="ws-sidebar"
        >
          <span className="ws-top__burger-line" aria-hidden="true" />
          <span className="ws-top__burger-line" aria-hidden="true" />
          <span className="ws-top__burger-line" aria-hidden="true" />
        </button>
        <div className="ws-top__titles">
          <nav className="ws-top__crumb" aria-label="Breadcrumb">
            <span>{crumbRoot}</span>
            <SsIcon name="chevron-right" size={16} />
            <span className="ws-top__crumb-current">{meta.title}</span>
          </nav>
          <h1 className="ws-top__title">{meta.title}</h1>
        </div>
      </div>

      {meta.search && (
      <div className="ws-top__search-wrap" ref={searchDropdownRef}>
        <label className="ws-top__search" htmlFor="ws-search">
          <SsIcon name="search" size={20} />
          <input
            ref={searchInputRef}
            id="ws-search"
            type="search"
            value={searchValue}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            onFocus={handleSearchFocus}
            placeholder={meta.search}
            aria-label="Search"
            autoComplete="off"
          />
          {searchLoading && (
            <span className="ws-top__search-spinner" aria-label="Searching">
              <SsIcon name="loader" size={16} />
            </span>
          )}
          <kbd className="ws-top__kbd">/</kbd>
        </label>

        {/* Search Results Dropdown */}
        {showSearchDropdown && (
          <div className="ws-top__search-dropdown" role="listbox" aria-label="Search results">
            {searchLoading ? (
              <div className="ws-top__search-dropdown-item ws-top__search-dropdown-item--empty">
                <SsIcon name="loader" size={18} />
                <span>Searching...</span>
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((user) => (
                <button
                  key={user.userId}
                  type="button"
                  className="ws-top__search-dropdown-item"
                  role="option"
                  aria-selected={false}
                  onClick={() => handleSearchResultClick(user)}
                >
                  <span className="ws-top__search-avatar">
                    {user.profileImageUrl ? (
                      <img src={user.profileImageUrl} alt={user.fullName} />
                    ) : (
                      initials(user.fullName || "U")
                    )}
                  </span>
                  <span className="ws-top__search-name">{user.fullName}</span>
                  <span className={`ws-top__search-role ws-top__search-role--${user.role.toLowerCase()}`}>
                    {user.role === "MENTOR" ? "Mentor" : "Learner"}
                  </span>
                </button>
              ))
            ) : (
              <div className="ws-top__search-dropdown-item ws-top__search-dropdown-item--empty">
                <SsIcon name="search" size={18} />
                <span>No users found for &ldquo;{searchValue}&rdquo;</span>
              </div>
            )}
          </div>
        )}
      </div>
      )}

      <div className="ws-top__right">
        <NotificationCenter
          unreadNotifications={unreadNotifications}
          onUnreadCountChange={onUnreadCountChange}
          onNotify={onNotify}
          notificationsPath={notificationsPath}
        />

        <button type="button" className="ws-top__icon-btn" onClick={toggle} aria-label="Toggle theme">
          <SsIcon name={isDark ? "sun" : "moon"} size={22} />
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
              {profile?.username && (
                <span style={{ fontSize: "0.72rem", color: "var(--muted)", fontWeight: 500, lineHeight: 1.2 }}>
                  @{profile.username}
                </span>
              )}
              <span className="ws-top__status">
                <i className="ws-top__dot" /> Online
              </span>
            </span>
            {/* Inline SVG chevron — more reliable than Material Symbols font */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ws-top__chevron" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
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
                    <SsIcon name={item.icon} size={20} /> {item.label}
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
                <SsIcon name="logout" size={20} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
