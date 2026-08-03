import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import "./NotificationCenter.css";

/* ──────────────────────────────────────────────────────────────────────────
   Notification type config — maps type to icon, color, and category label
   ────────────────────────────────────────────────────────────────────────── */

const NOTIF_TYPE_CONFIG = {
  SESSION_REQUEST_RECEIVED: { icon: "person_add", color: "#0f766e", label: "Session Request" },
  SESSION_REQUEST_ACCEPTED: { icon: "check_circle", color: "#16a34a", label: "Request Accepted" },
  SESSION_REQUEST_DECLINED: { icon: "cancel", color: "#dc2626", label: "Request Declined" },
  SESSION_REQUEST_CANCELLED: { icon: "cancel", color: "#f59e0b", label: "Request Cancelled" },
  SESSION_REQUEST_REPLIED: { icon: "reply", color: "#7c3aed", label: "Learner Reply" },
  SESSION_CREATED: { icon: "video_camera_front", color: "#0f766e", label: "Session Ready" },
  BOOKING_CREATED: { icon: "calendar_month", color: "#0891b2", label: "New Booking" },
  BOOKING_ACCEPTED: { icon: "check_circle", color: "#16a34a", label: "Booking Accepted" },
  BOOKING_DECLINED: { icon: "cancel", color: "#dc2626", label: "Booking Declined" },
  BOOKING_STATUS: { icon: "info", color: "#6366f1", label: "Booking Update" },
  NEW_SESSION: { icon: "event", color: "#0f766e", label: "New Session" },
  REVIEW_SUBMITTED: { icon: "star", color: "#f59e0b", label: "New Review" },
  NEW_REVIEW: { icon: "star", color: "#f59e0b", label: "New Review" },
  CERTIFICATION_EARNED: { icon: "workspace_premium", color: "#8b5cf6", label: "Certification" },
  ROLE_SWITCHED: { icon: "swap_horiz", color: "#6366f1", label: "Role Change" },
  WAITLIST_PROMOTION: { icon: "celebration", color: "#0f766e", label: "Promotion" },
  ANNOUNCEMENT: { icon: "campaign", color: "#dc2626", label: "Announcement" },
  MAINTENANCE: { icon: "build", color: "#b45309", label: "Maintenance" },
  PLATFORM_UPDATE: { icon: "rocket_launch", color: "#6d28d9", label: "Platform Update" },
};

const DEFAULT_TYPE_CONFIG = { icon: "notifications", color: "#6b7280", label: "Notification" };

function getTypeConfig(type) {
  return NOTIF_TYPE_CONFIG[type] || DEFAULT_TYPE_CONFIG;
}

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────────────── */

function unwrap(payload) {
  if (payload && typeof payload === "object" && "data" in payload && "message" in payload) {
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

/* ──────────────────────────────────────────────────────────────────────────
   Notification Card
   ────────────────────────────────────────────────────────────────────────── */

function NotificationCard({ notification, onMarkRead, onNavigate }) {
  const config = getTypeConfig(notification.type);
  const isUnread = !notification.read;
  
  const handleClick = () => {
    if (isUnread && onMarkRead) onMarkRead(notification.id);
    if (onNavigate) onNavigate(notification.type, notification.referenceId);
  };

  return (
    <div
      className={`notif-card${isUnread ? " notif-card--unread" : ""}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleClick();
      }}
    >
      {/* Type icon */}
      <div className="notif-card__icon" style={{ background: `${config.color}14`, color: config.color }}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{config.icon}</span>
      </div>

      {/* Content */}
      <div className="notif-card__content">
        <div className="notif-card__header">
          <div className="notif-card__title-row">
            <span className="notif-card__type-badge" style={{ background: `${config.color}10`, color: config.color }}>
              {config.label}
            </span>
            <span className="notif-card__time">{relativeTime(notification.createdAt)}</span>
          </div>
          <span className="notif-card__title">{notification.title}</span>
        </div>
        <p className="notif-card__desc">{notification.message}</p>
      </div>

      {/* Unread indicator */}
      {isUnread && <span className="notif-card__dot" />}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Skeleton
   ────────────────────────────────────────────────────────────────────────── */

function NotificationSkeleton() {
  return (
    <div className="notif-skeleton">
      <div className="notif-skeleton__avatar" />
      <div className="notif-skeleton__body">
        <div className="notif-skeleton__line notif-skeleton__line--60" />
        <div className="notif-skeleton__line notif-skeleton__line--40" />
        <div className="notif-skeleton__line notif-skeleton__line--90" />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Empty State
   ────────────────────────────────────────────────────────────────────────── */

function NotificationEmpty({ filter }) {
  return (
    <div className="notif-empty">
      <div className="notif-empty__icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </div>
      <h3 className="notif-empty__title">
        {filter === "unread" ? "No unread notifications" : "You're all caught up!"}
      </h3>
      <p className="notif-empty__desc">
        {filter === "unread"
          ? "You have read all your notifications. New ones will appear here in real time."
          : "We'll notify you when something important happens."}
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
  hideFullPageHeader = false,
  onClose,
  onNotify,
  notificationsPath = "/learner/notifications",
}) {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const panelRef = useRef(null);
  const wsRef = useRef(null);
  const pendingReadsRef = useRef(new Set());

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [unreadCount, setUnreadCount] = useState(externalUnreadCount || 0);
  const [fetchedOnce, setFetchedOnce] = useState(false);
  const [filter, setFilter] = useState("all"); // "all" | "unread"
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  /* ────────────────────────────────────────────── Data fetching ── */

  const fetchNotifications = useCallback(async (silent = false, pageNum = 0, append = false) => {
    if (!silent && !append) {
      setLoading(true);
      setError(null);
    }
    if (append) {
      setLoadingMore(true);
    }

    try {
      const response = await client.get("/api/v1/notifications", {
        params: {
          page: pageNum,
          size: 20,
          unreadOnly: filter === "unread",
        },
      });
      const result = unwrap(response.data);
      const items = result?.content || result || [];
      setTotalCount(result?.totalElements || items.length);

      if (append) {
        setNotifications((prev) => [...prev, ...items]);
      } else {
        setNotifications(items);
      }
      setPage(pageNum);
      setHasMore(items.length >= 20);
      setFetchedOnce(true);
    } catch (err) {
      if (!silent) {
        setError(
          err?.response?.data?.message ||
          err?.message ||
          "Something went wrong while fetching notifications."
        );
      }
    } finally {
      if (!silent) setLoading(false);
      if (append) setLoadingMore(false);
    }
  }, [filter]);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await client.get("/api/v1/notifications/unread-count");
      const raw = response?.data?.data;
      const count = Number(raw) || 0;
      if (count > 0 && count < 1000) {
        setUnreadCount(count);
        if (onUnreadCountChange) onUnreadCountChange(count);
      } else {
        setUnreadCount(0);
        if (onUnreadCountChange) onUnreadCountChange(0);
      }
    } catch {
      // silently fail for background polling
    }
  }, [onUnreadCountChange]);

  /* ─────────────────────────────────────── WebSocket (real-time) ── */

  const connectWebSocket = useCallback(() => {
    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    // SECURITY: authenticate via the httpOnly access_token cookie attached to
    // the same-origin WebSocket handshake. The JWT is NEVER appended to the URL
    // as a query parameter — it would leak into proxy access logs, browser
    // history and referrer headers.
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/notifications`;

    try {
      const socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        // console.log("Notification WS connected");
      };

      socket.onmessage = (event) => {
        try {
          const newNotif = JSON.parse(event.data);
          setNotifications((prev) => {
            // Deduplicate by ID — skip if already present
            if (prev.some((n) => n.id === newNotif.id)) return prev;
            return [newNotif, ...prev];
          });
          // Use functional update to avoid stale closure
          setUnreadCount((prev) => {
            const newCount = prev + 1;
            // Also call the external handler with the new value
            if (onUnreadCountChangeRef.current) {
              onUnreadCountChangeRef.current(newCount);
            }
            return newCount;
          });
        } catch {
          // ignore parse errors
        }
      };

      socket.onclose = () => {
        // Reconnect after 5s
        setTimeout(() => {
          connectWebSocket();
        }, 5000);
      };

      socket.onerror = () => {
        socket.close();
      };

      wsRef.current = socket;
    } catch {
      // WebSocket not available - fall back to polling
    }
  }, []); // Intentionally empty — no dependencies to avoid reconnection cycles

  /* ──────────────────────────────────────────────────── Effects ── */

  const fetchNotifsRef = useRef(fetchNotifications);
  const fetchUnreadRef = useRef(fetchUnreadCount);
  const onUnreadCountChangeRef = useRef(onUnreadCountChange);
  const onNotifyRef = useRef(onNotify);

  useEffect(() => {
    fetchNotifsRef.current = fetchNotifications;
    fetchUnreadRef.current = fetchUnreadCount;
    onUnreadCountChangeRef.current = onUnreadCountChange;
    onNotifyRef.current = onNotify;
  }, [fetchNotifications, fetchUnreadCount, onUnreadCountChange, onNotify]);

  // Connect WebSocket on mount
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch on open filter change — reset and refetch when filter changes
  useEffect(() => {
    if ((isOpen || fullPage) && !fetchedOnce) {
      fetchNotifsRef.current();
      fetchUnreadRef.current();
    } else if (fetchedOnce) {
      // Refetch for filter change (page is reset inside fetchNotifications is not needed here)
      // If filter just changed, we need the fetch to use the new filter value
      fetchNotifsRef.current();
      // Reset pagination state for the new filter
      setPage(0);
      setHasMore(true);
    }
  }, [isOpen, fullPage, fetchedOnce, filter]);

  // Background refresh when external count changes
  useEffect(() => {
    if (fetchedOnce && (isOpen || fullPage)) {
      fetchNotifsRef.current();
      fetchUnreadRef.current();
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

  // 30s polling fallback (only when WebSocket not available)
  useEffect(() => {
    if (!isOpen && !fullPage) return;

    const interval = setInterval(() => {
      fetchNotifications(true);
      fetchUnreadCount();
    }, 30000);
    return () => clearInterval(interval);
  }, [isOpen, fullPage, fetchNotifications, fetchUnreadCount]);

  /* ──────────────────────────────────────────────────── Actions ── */

  const handleMarkRead = useCallback(
    async (id) => {
      // Prevent duplicate concurrent requests for the same notification ID
      if (pendingReadsRef.current.has(id)) return;
      pendingReadsRef.current.add(id);

      // Optimistically update local state
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );

      // Decrement local unread count AND propagate to parent (Navbar badge)
      setUnreadCount((prev) => {
        const newCount = Math.max(0, prev - 1);
        if (onUnreadCountChangeRef.current) {
          onUnreadCountChangeRef.current(newCount);
        }
        return newCount;
      });

      try {
        await client.patch(`/api/v1/notifications/${id}/read`);
      } catch (err) {
        // Rollback on failure: refetch from backend
        fetchNotifsRef.current(true);
        fetchUnreadRef.current();
        if (onNotifyRef.current) {
          onNotifyRef.current({
            type: "error",
            title: "Failed to mark as read",
            message: err?.response?.data?.message || "Could not mark notification as read.",
          });
        }
      } finally {
        pendingReadsRef.current.delete(id);
      }
    },
    [], // Intentionally empty — all dependencies use Ref.current
  );

  const handleMarkAllRead = useCallback(async () => {
    // Optimistic update: mark all as read instantly
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    if (onUnreadCountChangeRef.current) onUnreadCountChangeRef.current(0);

    try {
      await client.patch("/api/v1/notifications/read-all");
    } catch (err) {
      // Rollback on failure: refetch from backend to restore real state
      fetchNotifsRef.current(true);
      fetchUnreadRef.current();
      if (onNotifyRef.current) {
        onNotifyRef.current({
          type: "error",
          title: "Mark all read failed",
          message: err?.response?.data?.message || "Could not mark all notifications as read.",
        });
      }
    }
  }, []); // Intentionally empty — all dependencies use Ref.current

  const handleLoadMore = useCallback(() => {
    fetchNotifications(false, page + 1, true);
  }, [fetchNotifications, page]);

  const handleNavigate = useCallback(
    (type, referenceId) => {
      setIsOpen(false);

      const isMentor = notificationsPath.startsWith("/mentor");

      // Map each notification type to the correct route
      const knownRoutes = {
        // ── Session Requests ──
        SESSION_REQUEST_RECEIVED: isMentor
          ? (referenceId ? `/mentor/teach?requestId=${referenceId}` : "/mentor/teach")
          : null,
        SESSION_REQUEST_ACCEPTED: isMentor
          ? "/mentor/students"
          : (referenceId ? `/learner/sessions?sessionId=${referenceId}` : "/learner/sessions"),
        SESSION_REQUEST_DECLINED: isMentor
          ? "/mentor/teach"
          : (referenceId ? `/learner/requests?requestId=${referenceId}` : "/learner/requests"),
        SESSION_REQUEST_CANCELLED: isMentor
          ? "/mentor/teach"
          : "/learner/requests",
        SESSION_REQUEST_REPLIED: isMentor
          ? `/mentor/messages`
          : `/learner/messages`,

        // ── Sessions / Bookings ──
        SESSION_CREATED: isMentor
          ? "/mentor/students"
          : "/learner/sessions",
        BOOKING_CREATED: isMentor
          ? "/mentor/students"
          : "/learner/sessions",
        BOOKING_ACCEPTED: isMentor
          ? "/mentor/students"
          : "/learner/sessions",
        BOOKING_DECLINED: isMentor
          ? "/mentor/students"
          : "/learner/sessions",
        BOOKING_STATUS: isMentor
          ? "/mentor/students"
          : "/learner/sessions",
        NEW_SESSION: isMentor
          ? "/mentor/students"
          : "/learner/sessions",

        // ── Reviews ──
        REVIEW_SUBMITTED: "/mentor/reviews",
        NEW_REVIEW: "/mentor/reviews",

        // ── Certifications ──
        CERTIFICATION_EARNED: isMentor
          ? "/mentor/dashboard"
          : "/learner/certificates",

        // ── Role / Account ──
        ROLE_SWITCHED: isMentor
          ? "/mentor/dashboard"
          : "/learner/dashboard",

        // ── Promotions ──
        WAITLIST_PROMOTION: isMentor
          ? "/mentor/teach"
          : "/learner/sessions",

        // ── Announcements ──
        ANNOUNCEMENT: isMentor
          ? "/mentor/notifications"
          : "/learner/notifications",
        MAINTENANCE: isMentor
          ? "/mentor/notifications"
          : "/learner/notifications",
        PLATFORM_UPDATE: isMentor
          ? "/mentor/notifications"
          : "/learner/notifications",
      };

      const route = knownRoutes[type] || notificationsPath;

      // Same-page detection: if the route base path matches the current page,
      // avoid unnecessary navigation. Just close the dropdown (already done above).
      // For routes with query params (e.g. /mentor/teach?requestId=123),
      // always navigate to ensure the URL has the correct params.
      const containsQueryParam = route.includes("?");
      if (!containsQueryParam) {
        const currentPath = window.location.pathname;
        const routeBase = route.split("?")[0];
        if (currentPath === routeBase) {
          // Already on the destination page — no navigation needed
          return;
        }
      }

      navigate(route);
    },
    [navigate, notificationsPath],
  );

  const toggleOpen = () => setIsOpen((v) => !v);

  /* ──────────────────────────────────────────────────── Derived ── */

  const displayedNotifications = filter === "unread"
    ? notifications.filter((n) => !n.read)
    : notifications;

  /* ──────────────────────────────────────────────────── Render ── */

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
          <div className="notif-panel__header-top">
            <h2 className="notif-panel__title">Notifications</h2>
            <div className="notif-panel__header-actions">
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="notif-panel__mark-all"
                  onClick={handleMarkAllRead}
                  title="Mark all as read"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 11 12 14 22 4" />
                    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                  Mark all read
                </button>
              )}
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
          </div>

          {/* Filter tabs */}
          <div className="notif-panel__filters">
            <button
              type="button"
              className={`notif-panel__filter${filter === "all" ? " notif-panel__filter--active" : ""}`}
              onClick={() => setFilter("all")}
            >
              All
              <span className="notif-panel__filter-count">{totalCount || ""}</span>
            </button>
            <button
              type="button"
              className={`notif-panel__filter${filter === "unread" ? " notif-panel__filter--active" : ""}`}
              onClick={() => setFilter("unread")}
            >
              Unread
              {unreadCount > 0 && (
                <span className="notif-panel__filter-count">{unreadCount}</span>
              )}
            </button>
          </div>
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
            <NotificationError message={error} onRetry={() => fetchNotifications()} />
          ) : displayedNotifications.length === 0 ? (
            <NotificationEmpty filter={filter} />
          ) : (
            <>
              {displayedNotifications.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  onMarkRead={handleMarkRead}
                  onNavigate={handleNavigate}
                />
              ))}
              {hasMore && (
                <div className="notif-panel__load-more">
                  <button
                    type="button"
                    className="notif-panel__load-more-btn"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? "Loading..." : "Load More"}
                  </button>
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
      <div className="notif-full-page">
        {!hideFullPageHeader && (
          <div className="notif-full-page__header">
            <h1 className="notif-full-page__title">Notifications</h1>
            {onClose && (
              <button type="button" className="notif-full-page__close" onClick={onClose} aria-label="Close">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
              </button>
            )}
          </div>
        )}
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
