import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
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
  if (diff < 0) return "Just now";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/* ──────────────────────────────────────────────────────────────────────────
   Notification Card
   ────────────────────────────────────────────────────────────────────────── */

function NotificationCard({ notification, onMarkRead }) {
  const handleClick = () => {
    onMarkRead(notification.id);
  };

  const userName = notification.user?.fullName || notification.user?.name || "";
  const avatarUrl = notification.user?.profileImageUrl || "";

  return (
    <div
      className="notif-card"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleClick();
      }}
    >
      {/* Unread indicator dot */}
      <span className="notif-card__dot" />

      {/* Avatar */}
      <div className="notif-card__avatar">
        {avatarUrl ? (
          <img src={avatarUrl} alt={userName} className="notif-card__avatar-img" />
        ) : (
          <span className="notif-card__avatar-initials">{getInitials(userName || notification.title)}</span>
        )}
      </div>

      {/* Content */}
      <div className="notif-card__content">
        <div className="notif-card__header">
          <span className="notif-card__title">{notification.title}</span>
          <span className="notif-card__time">{relativeTime(notification.createdAt)}</span>
        </div>
        <p className="notif-card__desc">{notification.message}</p>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Skeleton
   ────────────────────────────────────────────────────────────────────────── */

function NotificationSkeleton() {
  return (
    <div className="notif-skeleton">
      <span className="notif-skeleton__dot" />
      <div className="notif-skeleton__avatar" />
      <div className="notif-skeleton__body">
        <div className="notif-skeleton__line notif-skeleton__line--60" />
        <div className="notif-skeleton__line notif-skeleton__line--90" />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Empty State
   ────────────────────────────────────────────────────────────────────────── */

function NotificationEmpty() {
  return (
    <div className="notif-empty">
      <div className="notif-empty__icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </div>
      <h3 className="notif-empty__title">You're all caught up!</h3>
      <p className="notif-empty__desc">
        No new notifications. We'll notify you when something important happens.
      </p>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Error State
   ────────────────────────────────────────────────────────────────────────── */

function NotificationError({ message, onRetry }) {
  return (
    <div className="notif-error">
      <div className="notif-error__icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h3 className="notif-error__title">Could not load notifications</h3>
      <p className="notif-error__desc">{message}</p>
      <button type="button" className="notif-error__retry" onClick={onRetry}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
        Retry
      </button>
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
  notificationsPath = "/learner/notifications",
}) {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const panelRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [unreadCount, setUnreadCount] = useState(externalUnreadCount || 0);
  const [fetchedOnce, setFetchedOnce] = useState(false);

  /* ────────────────────────────────────────────────────── Data fetching ── */

  const fetchNotifications = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }

    try {
      const response = await client.get("/api/v1/notifications", {
        params: { page: 0, size: 50, unreadOnly: true },
      });
      const result = unwrap(response.data);
      const items = result?.content || result || [];
      setNotifications(items);
      setFetchedOnce(true);
    } catch (err) {
      if (!silent) {
        const errorMsg =
          err?.response?.data?.message ||
          err?.message ||
          "Something went wrong while fetching notifications.";
        setError(errorMsg);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await client.get("/api/v1/notifications/unread-count");
      const count = Number(unwrap(response.data) || 0);
      setUnreadCount(count);
      if (onUnreadCountChange) onUnreadCountChange(count);
    } catch {
      // silently fail for background polling
    }
  }, [onUnreadCountChange]);

  /* ──────────────────────────────────────────────────────────── Effects ── */

  const fetchNotifsRef = useRef(fetchNotifications);
  const fetchUnreadRef = useRef(fetchUnreadCount);
  // Keep refs in sync with latest callbacks
  useEffect(() => {
    fetchNotifsRef.current = fetchNotifications;
    fetchUnreadRef.current = fetchUnreadCount;
  }, [fetchNotifications, fetchUnreadCount]);

  // Open triggers fetch (only on first open)
  useEffect(() => {
    if ((isOpen || fullPage) && !fetchedOnce) {
      fetchNotifsRef.current?.();
      fetchUnreadRef.current?.();
    }
  }, [isOpen, fullPage, fetchedOnce]);

  // Background refresh when external count changes
  useEffect(() => {
    if (fetchedOnce && (isOpen || fullPage)) {
      fetchNotifsRef.current?.();
      fetchUnreadRef.current?.();
    }
  }, [externalUnreadCount, fetchedOnce, isOpen, fullPage]);

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
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [fullPage]);

  // 15s polling while the panel is open (silent background refresh)
  useEffect(() => {
    if (!isOpen && !fullPage) return;

    const poll = () => {
      fetchNotifications(true);
      fetchUnreadCount();
    };

    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, [isOpen, fullPage, fetchNotifications, fetchUnreadCount]);

  /* ──────────────────────────────────────────────────────────── Actions ── */

  const handleMarkRead = useCallback(
    async (id) => {
      // Optimistically remove notification from the list
      setNotifications((prev) => prev.filter((n) => n.id !== id));

      // Functional update avoids stale closure for the count
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        await client.patch(`/api/v1/notifications/${id}/read`);
      } catch {
        // On failure, silently refetch to restore consistency — never show error UI
        fetchNotifications(true);
        fetchUnreadCount();
      }
    },
    [fetchNotifications, fetchUnreadCount],
  );

  const toggleOpen = () => {
    setIsOpen((v) => !v);
  };

  /* ──────────────────────────────────────────────────────── Render ── */

  // ── Bell button ──
  const bellButton = (
    <button
      type="button"
      className={`notif-bell${isOpen ? " notif-bell--open" : ""}`}
      onClick={toggleOpen}
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {unreadCount > 0 && (
        <span className="notif-bell__badge">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );

  // ── Panel ──
  const renderPanel = () => {
    return (
      <div className={`notif-panel${fullPage ? " notif-panel--full" : ""}`}>
        {/* Header */}
        <div className="notif-panel__header">
          <h2 className="notif-panel__title">Notifications</h2>
          <button
            type="button"
            className="notif-panel__view-all"
            onClick={() => {
              setIsOpen(false);
              navigate(notificationsPath);
            }}
          >
            View All
          </button>
        </div>

        {/* List */}
        <div className="notif-panel__list" ref={panelRef}>
          {loading ? (
            <div className="notif-panel__skeletons">
              {[1, 2, 3, 4, 5].map((k) => (
                <NotificationSkeleton key={k} />
              ))}
            </div>
          ) : error ? (
            <NotificationError message={error} onRetry={fetchNotifications} />
          ) : notifications.length === 0 ? (
            <NotificationEmpty />
          ) : (
            <>
              {notifications.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  onMarkRead={handleMarkRead}
                />
              ))}
            </>
          )}
        </div>
      </div>
    );
  };

  // ── Full page mode ──
  if (fullPage) {
    return (
      <div className="notif-full-page">
        <div className="notif-full-page__header">
          <h1 className="notif-full-page__title">Notifications</h1>
          {onClose && (
            <button
              type="button"
              className="notif-full-page__close"
              onClick={onClose}
              aria-label="Close notifications"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
          )}
        </div>
        {renderPanel()}
      </div>
    );
  }

  // ── Dropdown mode ──
  return (
    <div className="notif-wrapper" ref={dropdownRef}>
      {bellButton}
      {isOpen && (
        <div className="notif-dropdown">
          <div className="notif-dropdown__arrow" />
          {renderPanel()}
        </div>
      )}
    </div>
  );
}
