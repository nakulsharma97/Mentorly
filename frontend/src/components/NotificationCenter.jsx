import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import client from "../api/client";
import useUnreadNotifications from "../hooks/useUnreadNotifications";
import useNotificationList from "../hooks/useNotificationList";
import "./NotificationCenter.css";

/* ──────────────────────────────────────────────────────────────────────────
   Notification type config — maps type to icon, color, and category label.
   Covers mentor/learner flows AND admin operational notifications
   (verifications, reports, payments, withdrawals, platform alerts).
   ────────────────────────────────────────────────────────────────────────── */

const NOTIF_TYPE_CONFIG = {
  // ── Session requests & bookings ──
  SESSION_REQUEST_RECEIVED: { icon: "person_add", color: "#0f766e", label: "Session Request" },
  SESSION_REQUEST_ACCEPTED: { icon: "check_circle", color: "#16a34a", label: "Request Accepted" },
  SESSION_REQUEST_DECLINED: { icon: "cancel", color: "#dc2626", label: "Request Declined" },
  SESSION_REQUEST_CANCELLED: { icon: "cancel", color: "#f59e0b", label: "Request Cancelled" },
  SESSION_REQUEST_REPLIED: { icon: "reply", color: "#7c3aed", label: "Learner Reply" },
  SESSION_CREATED: { icon: "video_camera_front", color: "#0f766e", label: "Session Ready" },
  SESSION_COMPLETED: { icon: "task_alt", color: "#16a34a", label: "Session Completed" },
  SESSION_CANCELLED: { icon: "event_busy", color: "#ef4444", label: "Session Cancelled" },
  BOOKING_CREATED: { icon: "calendar_month", color: "#0891b2", label: "New Booking" },
  BOOKING_ACCEPTED: { icon: "check_circle", color: "#16a34a", label: "Booking Accepted" },
  BOOKING_DECLINED: { icon: "cancel", color: "#dc2626", label: "Booking Declined" },
  BOOKING_CANCELLED: { icon: "event_busy", color: "#f59e0b", label: "Booking Cancelled" },
  BOOKING_STATUS: { icon: "info", color: "#6366f1", label: "Booking Update" },
  NEW_SESSION: { icon: "event", color: "#0f766e", label: "New Session" },

  // ── Reviews / certifications ──
  REVIEW_SUBMITTED: { icon: "star", color: "#f59e0b", label: "New Review" },
  NEW_REVIEW: { icon: "star", color: "#f59e0b", label: "New Review" },
  CERTIFICATION_EARNED: { icon: "workspace_premium", color: "#8b5cf6", label: "Certification" },

  // ── Account / role / messages ──
  ROLE_SWITCHED: { icon: "swap_horiz", color: "#6366f1", label: "Role Change" },
  WAITLIST_PROMOTION: { icon: "celebration", color: "#0f766e", label: "Promotion" },
  MESSAGE_REQUEST_RECEIVED: { icon: "mark_email_unread", color: "#0891b2", label: "Message Request" },
  MESSAGE_REQUEST_ACCEPTED: { icon: "mark_email_read", color: "#16a34a", label: "Request Accepted" },
  MESSAGE_REQUEST_DECLINED: { icon: "mail", color: "#6b7280", label: "Request Declined" },

  // ── Admin operations ──
  MENTOR_VERIFICATION: { icon: "verified", color: "#7c3aed", label: "Mentor Verification" },
  MENTOR_VERIFICATION_REQUEST: { icon: "verified_user", color: "#7c3aed", label: "Verification Request" },
  VERIFICATION_APPROVED: { icon: "verified", color: "#16a34a", label: "Verification Approved" },
  VERIFICATION_REJECTED: { icon: "cancel", color: "#dc2626", label: "Verification Rejected" },
  VERIFICATION_MORE_INFO: { icon: "edit_note", color: "#f59e0b", label: "Additional Info Required" },
  PAYMENT_RECEIVED: { icon: "payments", color: "#16a34a", label: "Payment Received" },
  PAYMENT_UPDATE: { icon: "payments", color: "#0891b2", label: "Payment Update" },
  PAYOUT_RELEASED: { icon: "account_balance_wallet", color: "#16a34a", label: "Payout Released" },
  WITHDRAWAL_REQUEST: { icon: "account_balance", color: "#f59e0b", label: "Withdrawal Request" },
  USER_REPORTED: { icon: "flag", color: "#ef4444", label: "User Reported" },
  MENTOR_REPORTED: { icon: "flag", color: "#ef4444", label: "Mentor Reported" },
  COMPLAINT_SUBMITTED: { icon: "feedback", color: "#f59e0b", label: "Complaint" },
  MODERATION_WARNING: { icon: "gavel", color: "#f59e0b", label: "Moderation Warning" },
  ACCOUNT_SUSPENDED: { icon: "block", color: "#ef4444", label: "Account Suspended" },
  SAFETY_UPDATE: { icon: "shield", color: "#0f766e", label: "Safety Update" },
  NEW_USER_REGISTERED: { icon: "person_add", color: "#2563eb", label: "New User" },

  // ── Platform-wide ──
  ANNOUNCEMENT: { icon: "campaign", color: "#dc2626", label: "Announcement" },
  MAINTENANCE: { icon: "build", color: "#b45309", label: "Maintenance" },
  PLATFORM_UPDATE: { icon: "rocket_launch", color: "#6d28d9", label: "Platform Update" },
  PLATFORM_ALERT: { icon: "warning", color: "#ef4444", label: "Platform Alert" },
  SYSTEM_WARNING: { icon: "report", color: "#f59e0b", label: "System Warning" },
};

const DEFAULT_TYPE_CONFIG = { icon: "notifications", color: "#6b7280", label: "Notification" };

function getTypeConfig(type) {
  return NOTIF_TYPE_CONFIG[type] || DEFAULT_TYPE_CONFIG;
}

/* ──────────────────────────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────────────────────────── */

function relativeTime(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return "Just now";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/** Groups notifications by calendar day: Today / Yesterday / Earlier. */
function dayGroup(dateStr) {
  if (!dateStr) return "Earlier";
  const d = new Date(dateStr);
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startToday - startDay) / 86400000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return "Earlier";
}

const GROUP_ORDER = ["Today", "Yesterday", "Earlier"];

function groupNotifications(items) {
  const groups = new Map();
  for (const item of items) {
    const key = dayGroup(item.createdAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return GROUP_ORDER.filter((key) => groups.has(key)).map((key) => ({
    label: key,
    items: groups.get(key),
  }));
}

/* ──────────────────────────────────────────────────────────────────────────
   Notification Card
   ────────────────────────────────────────────────────────────────────────── */

function NotificationCard({ notification, onMarkRead, onNavigate, index = 0 }) {
  const config = getTypeConfig(notification.type);
  const isUnread = !notification.read;

  const handleClick = () => {
    if (isUnread && onMarkRead) onMarkRead(notification.id);
    if (onNavigate) onNavigate(notification.type, notification.referenceId);
  };

  return (
    <motion.div
      className={`notif-card${isUnread ? " notif-card--unread" : ""}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleClick();
      }}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay: Math.min(index * 0.03, 0.3), ease: [0.16, 1, 0.3, 1] }}
      aria-label={isUnread ? `Unread: ${notification.title}` : notification.title}
    >
      {/* Type icon — 48px circular */}
      <div
        className="notif-card__icon"
        style={{ background: `${config.color}1a`, color: config.color }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 22 }}>{config.icon}</span>
      </div>

      {/* Content */}
      <div className="notif-card__content">
        <div className="notif-card__header">
          <div className="notif-card__title-row">
            <span className="notif-card__title">{notification.title}</span>
            <span className="notif-card__time">{relativeTime(notification.createdAt)}</span>
          </div>
          <span className="notif-card__type-badge" style={{ background: `${config.color}10`, color: config.color }}>
            {config.label}
          </span>
        </div>
        <p className="notif-card__desc">{notification.message}</p>
      </div>
    </motion.div>
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

function NotificationEmpty({ filter, searching }) {
  return (
    <div className="notif-empty">
      <div className="notif-empty__icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </div>
      <h3 className="notif-empty__title">
        {searching
          ? "No matching notifications"
          : filter === "unread"
            ? "No unread notifications"
            : "You're all caught up!"}
      </h3>
      <p className="notif-empty__desc">
        {searching
          ? "Try a different search keyword."
          : filter === "unread"
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
  const [unreadCount, setUnreadCount] = useState(externalUnreadCount || 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState("all"); // "all" | "unread"
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const isAdmin = notificationsPath.startsWith("/admin");

  // Shared notification list — multiple NotificationCenter instances
  // (dropdown + fullPage) share a single fetch cache via this hook.
  const {
    notifications,
    totalCount,
    loading,
    error,
    fetchNotifications: fetchList,
  } = useNotificationList({ fullPage, filter });

  /* ────────────────────────────────────────────── Data fetching ── */

  // Unified fetch wrapper that manages page/hasMore state.
  const fetchNotifications = useCallback(async (silent = false, pageNum = 0, append = false) => {
    const result = await fetchList({
      page: pageNum,
      size: 20,
      unreadOnly: filter === "unread",
      append,
    });
    setPage(pageNum);
    setHasMore((result?.items?.length || 0) >= 20);
  }, [fetchList, filter]);

  // Use shared unread-count hook instead of independent polling
  const { unreadCount: sharedUnreadCount, refresh: refreshUnread } = useUnreadNotifications();
  const fetchUnreadCount = useCallback(async () => {
    await refreshUnread();
  }, [refreshUnread]);

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
          // The shared notification list is managed by useNotificationList;
          // we can't directly update it here. Instead bump the unread count
          // so the badge reflects the new message. The full list will refresh
          // on the next 30s poll or when the user opens the panel.
          setUnreadCount((prev) => {
            const newCount = prev + 1;
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

  // Sync external unread count + shared hook count
  useEffect(() => {
    setUnreadCount(externalUnreadCount || 0);
  }, [externalUnreadCount]);

  useEffect(() => {
    setUnreadCount(sharedUnreadCount);
    if (onUnreadCountChange) onUnreadCountChange(sharedUnreadCount);
  }, [sharedUnreadCount, onUnreadCountChange]);

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

  // Close dropdown on Escape
  useEffect(() => {
    if (fullPage || !isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullPage, isOpen]);

  // 30s polling fallback — only polls notifications list (unread-count
  // is handled by the shared useUnreadNotifications hook).
  // The shared useNotificationList hook caches at module level, so
  // multiple NotificationCenter instances won't fire duplicate requests.
  useEffect(() => {
    if (!isOpen && !fullPage) return;

    const interval = setInterval(() => {
      fetchNotifications(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [isOpen, fullPage, fetchNotifications])

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

  const handleLoadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      await fetchNotifications(false, page + 1, true);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchNotifications, page]);

  /**
   * Route each notification type to the relevant page. Admin notifications
   * navigate to the matching admin workspace page; mentor/learner keep their
   * existing routes. Never falls back to a dashboard redirect.
   */
  const handleNavigate = useCallback(
    (type, referenceId) => {
      setIsOpen(false);

      const isMentor = notificationsPath.startsWith("/mentor");

      const adminRoutes = {
        // ── Verifications ──
        MENTOR_VERIFICATION: "/admin/verifications",
        MENTOR_VERIFICATION_REQUEST: "/admin/verifications",
        VERIFICATION_APPROVED: "/admin/verifications",
        VERIFICATION_REJECTED: "/admin/verifications",
        VERIFICATION_MORE_INFO: "/admin/verifications",

        // ── Sessions / Bookings ──
        SESSION_REQUEST_RECEIVED: "/admin/sessions",
        SESSION_REQUEST_ACCEPTED: "/admin/sessions",
        SESSION_REQUEST_DECLINED: "/admin/sessions",
        SESSION_REQUEST_CANCELLED: "/admin/sessions",
        SESSION_CREATED: "/admin/sessions",
        SESSION_COMPLETED: "/admin/sessions",
        SESSION_CANCELLED: "/admin/sessions",
        BOOKING_CREATED: "/admin/sessions",
        BOOKING_ACCEPTED: "/admin/sessions",
        BOOKING_DECLINED: "/admin/sessions",
        BOOKING_CANCELLED: "/admin/sessions",
        BOOKING_STATUS: "/admin/sessions",
        NEW_SESSION: "/admin/sessions",

        // ── Payments / Payouts / Withdrawals ──
        PAYMENT_RECEIVED: "/admin/payments",
        PAYMENT_UPDATE: "/admin/payments",
        PAYOUT_RELEASED: "/admin/payments",
        WITHDRAWAL_REQUEST: "/admin/payments",

        // ── Reports / Moderation ──
        USER_REPORTED: "/admin/reports",
        MENTOR_REPORTED: "/admin/reports",
        COMPLAINT_SUBMITTED: "/admin/reports",
        MODERATION_WARNING: "/admin/flagged-content",

        // ── Users / Safety ──
        NEW_USER_REGISTERED: "/admin/users",
        ACCOUNT_SUSPENDED: "/admin/users",
        SAFETY_UPDATE: "/admin/users",

        // ── Platform / Alerts ──
        PLATFORM_ALERT: "/admin/analytics",
        SYSTEM_WARNING: "/admin/health",
        ANNOUNCEMENT: "/admin/notification-center",
        MAINTENANCE: "/admin/health",
        PLATFORM_UPDATE: "/admin/notification-center",
      };

      const knownRoutes = isAdmin
        ? adminRoutes
        : {
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

            // ── Mentor Verification ──
            MENTOR_VERIFICATION: isMentor
              ? "/mentor/dashboard"
              : null,
            MENTOR_VERIFICATION_REQUEST: isMentor
              ? "/mentor/dashboard"
              : null,
            VERIFICATION_APPROVED: isMentor
              ? "/mentor/dashboard"
              : null,
            VERIFICATION_REJECTED: isMentor
              ? "/mentor/dashboard"
              : null,
            VERIFICATION_MORE_INFO: isMentor
              ? "/mentor/dashboard"
              : null,

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
    [navigate, notificationsPath, isAdmin],
  );

  const toggleOpen = () => setIsOpen((v) => !v);

  /* ──────────────────────────────────────────────────── Derived ── */

  const displayedNotifications = useMemo(() => {
    const unreadOnly = filter === "unread"
      ? notifications.filter((n) => !n.read)
      : notifications;

    const q = searchQuery.trim().toLowerCase();
    if (!q) return unreadOnly;

    return unreadOnly.filter((n) => {
      const haystack = [
        n.title,
        n.message,
        getTypeConfig(n.type).label,
        n.type,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [notifications, filter, searchQuery]);

  const grouped = useMemo(
    () => groupNotifications(displayedNotifications),
    [displayedNotifications],
  );

  const searching = searchQuery.trim().length > 0;

  /* ──────────────────────────────────────────────────── Render ── */

  // ── Bell button ──
  const bellButton = (
    <button
      type="button"
      className={`notif-bell${isOpen ? " notif-bell--open" : ""}`}
      onClick={toggleOpen}
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      aria-expanded={isOpen}
      aria-haspopup="dialog"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
      {unreadCount > 0 && (
        <span className="notif-bell__badge" aria-label={`${unreadCount} unread notifications`}>
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
          <div className="notif-panel__header-actions">
            {unreadCount > 0 && (
              <button
                type="button"
                className="notif-panel__mark-all"
                onClick={handleMarkAllRead}
                title="Mark all as read"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 11 12 14 22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                Mark all read
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="notif-panel__search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notifications..."
            aria-label="Search notifications"
            autoComplete="off"
          />
          {searchQuery && (
            <button
              type="button"
              className="notif-panel__search-clear"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
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
            <NotificationEmpty filter={filter} searching={searching} />
          ) : (
            <div className="notif-group-list">
              {grouped.map((group) => (
                <div className="notif-group" key={group.label}>
                  <div className="notif-group__label">{group.label}</div>
                  {group.items.map((notification, index) => (
                    <NotificationCard
                      key={notification.id}
                      notification={notification}
                      onMarkRead={handleMarkRead}
                      onNavigate={handleNavigate}
                      index={index}
                    />
                  ))}
                </div>
              ))}
              {hasMore && !searching && (
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
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="notif-panel__footer">
          <button
            type="button"
            className="notif-panel__view-all-footer"
            onClick={() => {
              setIsOpen(false);
              navigate(notificationsPath);
            }}
          >
            View All Notifications
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
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
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="notif-dropdown"
            role="region"
            aria-label="Notifications panel"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="notif-dropdown__arrow" />
            {renderPanel()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
