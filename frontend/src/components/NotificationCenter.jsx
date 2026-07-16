import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import "./NotificationCenter.css";

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────────────── */

function unwrap(payload) {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    "message" in payload
  ) {
    return payload.data;
  }
  return payload;
}

function relativeTime(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return "just now";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/* ──────────────────────────────────────────────────────────────────────────
   Type → icon / colour / human label maps
   ────────────────────────────────────────────────────────────────────────── */

const TYPE_ICON = {
  BOOKING_CREATED: "event",
  BOOKING_CONFIRMED: "event_available",
  BOOKING_CANCELLED: "event_busy",
  BOOKING_REMINDER: "alarm",
  BOOKING_STATUS: "event",
  MESSAGE: "chat",
  PAYMENT: "payments",
  PAYOUT: "account_balance_wallet",
  REFUND: "currency_exchange",
  REVIEW: "star",
  NEW_REVIEW: "star",
  CERTIFICATION: "workspace_premium",
  CERTIFICATION_EARNED: "workspace_premium",
  BADGE: "verified",
  ACHIEVEMENT: "emoji_events",
  SECURITY: "security",
  VERIFICATION: "verified_user",
  VERIFIED: "verified_user",
  ANNOUNCEMENT: "campaign",
  ADMIN: "admin_panel_settings",
  WAITLIST: "notifications",
  SESSION_REMINDER: "notifications_active",
  SYSTEM: "info",
  MENTION: "alternate_email",
  WARNING: "warning",
  REPORT: "flag",
  DISPUTE: "gavel",
  ROLE_SWITCHED: "swap_horiz",
  NEW_SESSION: "video_call",
  WAITLIST_PROMOTION: "notifications",
};

const TYPE_LABEL = {
  BOOKING_CREATED: "Booking",
  BOOKING_CONFIRMED: "Confirmed",
  BOOKING_CANCELLED: "Cancelled",
  BOOKING_REMINDER: "Reminder",
  BOOKING_STATUS: "Booking",
  MESSAGE: "Message",
  PAYMENT: "Payment",
  PAYOUT: "Payout",
  REFUND: "Refund",
  REVIEW: "Review",
  NEW_REVIEW: "Review",
  CERTIFICATION: "Certificate",
  CERTIFICATION_EARNED: "Certificate",
  BADGE: "Badge",
  ACHIEVEMENT: "Achievement",
  SECURITY: "Security",
  VERIFICATION: "Verification",
  VERIFIED: "Verified",
  ANNOUNCEMENT: "Announcement",
  ADMIN: "Admin",
  WAITLIST: "Waitlist",
  SESSION_REMINDER: "Reminder",
  SYSTEM: "System",
  MENTION: "Mention",
  WARNING: "Warning",
  REPORT: "Report",
  DISPUTE: "Dispute",
  ROLE_SWITCHED: "Role",
  NEW_SESSION: "Session",
  WAITLIST_PROMOTION: "Promotion",
};

function typeIcon(type) {
  return TYPE_ICON[type] || "notifications";
}

function typeLabel(type) {
  return TYPE_LABEL[type] || (type ? type.replace(/_/g, " ") : "Update");
}

function typeColor(type) {
  if (!type) return "var(--nc-info)";
  if (type.startsWith("BOOKING") || type === "NEW_SESSION") return "var(--nc-accent)";
  if (type.startsWith("PAY") || type === "REFUND" || type === "PAYOUT") return "var(--nc-payment)";
  if (type.startsWith("REVIEW") || type === "RATING") return "var(--nc-review)";
  if (type === "MESSAGE" || type === "MENTION") return "var(--nc-message)";
  if (type.includes("CERTIFICATION") || type === "BADGE" || type === "ACHIEVEMENT") return "var(--nc-cert)";
  if (type === "SECURITY" || type === "WARNING") return "var(--nc-danger)";
  if (type === "VERIFICATION" || type === "VERIFIED") return "var(--nc-verified)";
  if (type === "ANNOUNCEMENT" || type === "ADMIN") return "var(--nc-announce)";
  return "var(--nc-info)";
}

/* ──────────────────────────────────────────────────────────────────────────
   Tabs
   ────────────────────────────────────────────────────────────────────────── */

const TABS = [
  { key: "all", label: "All", icon: "notifications" },
  { key: "unread", label: "Unread", icon: "mark_chat_unread" },
  { key: "mentions", label: "Mentions", icon: "alternate_email" },
  { key: "system", label: "System", icon: "info" },
  { key: "payments", label: "Payments", icon: "payments" },
  { key: "sessions", label: "Sessions", icon: "event" },
  { key: "messages", label: "Messages", icon: "chat" },
];

function tabFilter(type, tab) {
  if (tab === "all") return true;
  if (tab === "unread") return true;
  if (tab === "mentions") return type === "MENTION";
  if (tab === "system") return ["SYSTEM", "ANNOUNCEMENT", "ADMIN", "SECURITY", "VERIFICATION", "VERIFIED"].includes(type);
  if (tab === "payments") return type === "PAYMENT" || type === "PAYOUT" || type === "REFUND";
  if (tab === "sessions") return type?.startsWith("BOOKING") || type === "SESSION_REMINDER" || type === "WAITLIST" || type === "NEW_SESSION";
  if (tab === "messages") return type === "MESSAGE";
  return true;
}

/* ──────────────────────────────────────────────────────────────────────────
   NotificationCard
   ────────────────────────────────────────────────────────────────────────── */

function NotificationCard({
  notification,
  onMarkRead,
  onDelete,
}) {
  const isUnread = !notification.read;
  const icon = typeIcon(notification.type);
  const color = typeColor(notification.type);

  const handleClick = () => {
    if (!notification.read) {
      onMarkRead(notification.id);
    }
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete(notification.id);
  };

  return (
    <div
      className={`nc-card${isUnread ? " nc-card--unread" : ""}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleClick(); }}
    >
      <div className="nc-card__indicator" style={{ backgroundColor: isUnread ? color : "transparent" }} />
      <div className="nc-card__icon" style={{ color }}>
        <Icon name={icon} />
      </div>
      <div className="nc-card__body">
        <div className="nc-card__head">
          <span className="nc-card__title">{notification.title}</span>
          <span className="nc-card__time">{relativeTime(notification.createdAt)}</span>
        </div>
        <p className="nc-card__message">{notification.message}</p>
        <div className="nc-card__meta">
          {isUnread && <span className="nc-card__unread-dot" style={{ backgroundColor: color }} />}
          <span className="nc-card__type-badge" style={{ backgroundColor: `${color}18`, color }}>
            {typeLabel(notification.type)}
          </span>
        </div>
      </div>
      <div className="nc-card__actions">
        {!notification.read && (
          <button
            type="button"
            className="nc-card__action-btn"
            onClick={(e) => { e.stopPropagation(); onMarkRead(notification.id); }}
            aria-label="Mark as read"
            title="Mark as read"
          >
            <Icon name="done" />
          </button>
        )}
        <button
          type="button"
          className="nc-card__action-btn nc-card__action-btn--delete"
          onClick={handleDelete}
          aria-label="Delete notification"
          title="Delete"
        >
          <Icon name="close" />
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Skeleton loader
   ────────────────────────────────────────────────────────────────────────── */

function NotificationSkeleton() {
  return (
    <div className="nc-skeleton">
      <div className="nc-skeleton__indicator" />
      <div className="nc-skeleton__icon nc-skeleton__pulse" />
      <div className="nc-skeleton__body">
        <div className="nc-skeleton__line nc-skeleton__line--60 nc-skeleton__pulse" />
        <div className="nc-skeleton__line nc-skeleton__line--90 nc-skeleton__pulse" />
        <div className="nc-skeleton__line nc-skeleton__line--40 nc-skeleton__pulse" />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Empty state
   ────────────────────────────────────────────────────────────────────────── */

function NotificationEmpty({ icon, title, desc }) {
  return (
    <div className="nc-empty">
      <div className="nc-empty__icon">
        <Icon name={icon} />
      </div>
      <h3 className="nc-empty__title">{title}</h3>
      {desc && <p className="nc-empty__desc">{desc}</p>}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Main NotificationCenter Component
   ────────────────────────────────────────────────────────────────────────── */

export default function NotificationCenter({
  unreadNotifications: externalUnreadCount,
  onUnreadCountChange,
  fullPage = false,
  onClose,
}) {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const scrollRef = useRef(null);
  const sentinelRef = useRef(null);
  const searchRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [unreadCount, setUnreadCount] = useState(externalUnreadCount || 0);
  const [searchQuery, setSearchQuery] = useState("");
  const [fetchedOnce, setFetchedOnce] = useState(false);

  /* ────────────────────────────────────────────────────── Data fetching ── */

  const fetchNotifications = useCallback(async (pageNum = 0, append = false) => {
    if (pageNum === 0) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      const params = { page: pageNum, size: 20 };
      const response = await client.get("/api/v1/notifications", { params });
      const result = unwrap(response.data);
      const items = result?.content || result || [];

      if (append) {
        setNotifications((prev) => [...prev, ...items]);
      } else {
        setNotifications(items);
      }

      setHasMore(items.length === 20);
      setPage(pageNum);
      if (pageNum === 0) setFetchedOnce(true);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await client.get("/api/v1/notifications/unread-count");
      const count = Number(unwrap(response.data) || 0);
      setUnreadCount(count);
      if (onUnreadCountChange) onUnreadCountChange(count);
    } catch {
      // ignore
    }
  }, [onUnreadCountChange]);

  /* ──────────────────────────────────────────────────────────── Effects ── */

  // Open dropdown triggers initial fetch (only on first open, then skip)
  useEffect(() => {
    if ((isOpen || fullPage) && !fetchedOnce) {
      fetchNotifications(0);
      fetchUnreadCount();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, fullPage]);

  // Re-fetch when explicitly told to via externalUnreadCount changing (polling from App)
  useEffect(() => {
    if (fetchedOnce && (isOpen || fullPage)) {
      // Background refresh when we detect external count changed
      fetchNotifications(0);
      fetchUnreadCount();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalUnreadCount]);

  // Sync external unread count
  useEffect(() => {
    setUnreadCount(externalUnreadCount || 0);
  }, [externalUnreadCount]);

  // Close dropdown on outside click
  useEffect(() => {
    if (fullPage) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [fullPage]);

  // Infinite scroll via IntersectionObserver (dropdown mode)
  useEffect(() => {
    if (!sentinelRef.current || !hasMore || loading || loadingMore || fullPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          fetchNotifications(page + 1, true);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, page, fetchNotifications, fullPage]);

  // Scroll-based load more (full page mode)
  useEffect(() => {
    if (!fullPage || !scrollRef.current || !hasMore || loading || loadingMore) return;
    const el = scrollRef.current;
    const handler = () => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 300 && hasMore && !loadingMore) {
        fetchNotifications(page + 1, true);
      }
    };
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, [fullPage, hasMore, loading, loadingMore, page, fetchNotifications]);

  /* ──────────────────────────────────────────────────────────── Actions ── */

  const handleMarkRead = useCallback(async (id) => {
    try {
      await client.patch(`/api/v1/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      fetchUnreadCount();
    } catch {
      // ignore
    }
  }, [fetchUnreadCount]);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await client.patch("/api/v1/notifications/read-all");
      // Set all existing items as read in local state (no need for allRead flag)
      // because setNotifications sets read: true on every item.
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      if (onUnreadCountChange) onUnreadCountChange(0);
    } catch {
      // ignore
    }
  }, [onUnreadCountChange]);

  const handleDelete = useCallback(async (id) => {
    try {
      await client.delete(`/api/v1/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      fetchUnreadCount();
    } catch {
      // ignore
    }
  }, [fetchUnreadCount]);

  const toggleOpen = () => {
    setIsOpen((v) => !v);
  };

  /* ──────────────────────────────────────────────────────── Filtering ── */

  const filtered = useMemo(() => {
    let list = notifications;

    // Tab filter
    if (activeTab !== "all" && activeTab !== "unread") {
      list = list.filter((n) => tabFilter(n.type, activeTab));
    }

    // Unread filter
    if (activeTab === "unread") {
      list = list.filter((n) => !n.read);
    }

    // Text search (across title + message + type)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (n) =>
          (n.title || "").toLowerCase().includes(q) ||
          (n.message || "").toLowerCase().includes(q) ||
          typeLabel(n.type).toLowerCase().includes(q),
      );
    }

    // Sort: unread first, then by time
    return [...list].sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
  }, [notifications, activeTab, searchQuery]);

  /* ──────────────────────────────────────────────────────── Render ── */

  // ── Bell button ──
  const bellButton = (
    <button
      type="button"
      className={`nc-bell${isOpen ? " nc-bell--open" : ""}`}
      onClick={toggleOpen}
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
    >
      <Icon name="notifications" />
      {unreadCount > 0 && (
        <span className="nc-bell__badge">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );

  // ── Panel content ──
  const renderPanel = () => {
    const tabCounts = {};
    TABS.forEach((t) => {
      if (t.key === "all") tabCounts.all = notifications.length;
      else if (t.key === "unread") tabCounts.unread = unreadCount;
      else tabCounts[t.key] = notifications.filter((n) => tabFilter(n.type, t.key)).length;
    });

    return (
      <div className={`nc-panel${fullPage ? " nc-panel--full" : ""}`}>
        {/* Header */}
        <div className="nc-panel__header">
          <div className="nc-panel__header-left">
            <h2 className="nc-panel__title">Notifications</h2>
            {unreadCount > 0 && (
              <span className="nc-panel__unread-count">{unreadCount} new</span>
            )}
          </div>
          <div className="nc-panel__header-actions">
            {unreadCount > 0 && (
              <button
                type="button"
                className="nc-panel__action-btn"
                onClick={handleMarkAllRead}
                title="Mark all as read"
              >
                <Icon name="done_all" />
                <span>Mark all read</span>
              </button>
            )}
            {fullPage ? (
              <Link to="/learner/settings" className="nc-panel__action-btn">
                <Icon name="settings" />
                <span>Settings</span>
              </Link>
            ) : (
              <button
                type="button"
                className="nc-panel__action-btn"
                onClick={() => navigate("/learner/notifications")}
                title="View all"
              >
                <Icon name="open_in_new" />
                <span>View all</span>
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="nc-panel__search">
          <Icon name="search" />
          <input
            ref={searchRef}
            type="text"
            className="nc-search-input"
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search notifications"
          />
          {searchQuery && (
            <button
              type="button"
              className="nc-search-clear"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              <Icon name="close" />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="nc-panel__tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`nc-tab${activeTab === tab.key ? " nc-tab--active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon name={tab.icon} />
              <span>{tab.label}</span>
              {tabCounts[tab.key] > 0 && (
                <span className="nc-tab__count">{tabCounts[tab.key]}</span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        <div className={`nc-panel__list${fullPage ? " nc-panel__list--full" : ""}`} ref={scrollRef}>
          {loading ? (
            <div className="nc-panel__skeletons">
              {[1, 2, 3, 4, 5].map((k) => (
                <NotificationSkeleton key={k} />
              ))}
            </div>
          ) : error ? (
            <NotificationEmpty
              icon="error"
              title="Could not load notifications"
              desc={error}
            />
          ) : filtered.length === 0 ? (
            <NotificationEmpty
              icon={searchQuery ? "search_off" : activeTab === "unread" ? "mark_chat_unread" : "notifications_off"}
              title={
                searchQuery
                  ? "No matching notifications"
                  : activeTab === "unread"
                    ? "No unread notifications"
                    : "You're all caught up 🎉"
              }
              desc={
                searchQuery
                  ? `No notifications match "${searchQuery}".`
                  : activeTab === "unread"
                    ? "You've read everything. Check back later for updates."
                    : "We'll notify you whenever something important happens."
              }
            />
          ) : (
            <>
              {filtered.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  onMarkRead={handleMarkRead}
                  onDelete={handleDelete}
                />
              ))}
              {loadingMore && (
                <div className="nc-panel__skeletons">
                  {[1, 2].map((k) => (
                    <NotificationSkeleton key={`more-${k}`} />
                  ))}
                </div>
              )}
              {hasMore && !fullPage && (
                <div ref={sentinelRef} className="nc-sentinel" />
              )}
              {!hasMore && filtered.length > 0 && (
                <div className="nc-panel__end">
                  <span className="nc-panel__end-line" />
                  <span className="nc-panel__end-text">All caught up</span>
                  <span className="nc-panel__end-line" />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  // ── Full page mode ──
  if (fullPage) {
    return (
      <div className="nc-full-page">
        <div className="nc-full-page__header">
          <h1 className="nc-full-page__title">Notifications</h1>
          {onClose && (
            <button
              type="button"
              className="nc-full-page__close"
              onClick={onClose}
              aria-label="Close notifications"
            >
              <Icon name="arrow_back" />
            </button>
          )}
        </div>
        {renderPanel()}
      </div>
    );
  }

  // ── Dropdown mode ──
  return (
    <div className="nc-wrapper" ref={dropdownRef}>
      {bellButton}
      {isOpen && (
        <div className="nc-dropdown">
          <div className="nc-dropdown__arrow" />
          {renderPanel()}
        </div>
      )}
    </div>
  );
}
