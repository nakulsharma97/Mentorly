import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { getErrorFeedback } from "../utils/comingSoon";
import { filterConversationsBySearch } from "../utils/messagesPage";
import "./MessagesPage.css";

const RECONNECT_MAX_ATTEMPTS = 5;
const HEARTBEAT_INTERVAL = 30000; // Send PING every 30s
const HEARTBEAT_TIMEOUT = 10000;  // Expect PONG within 10s

const formatMessageTime = (value) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const formatDayDivider = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const today = new Date();
  const startToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime();
  const t = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
  if (t === startToday) {
    return "Today";
  }
  if (t === startToday - 86400000) {
    return "Yesterday";
  }
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  }).format(date);
};

/**
 * Group a chronological message list into day buckets, and within each day
 * collapse consecutive same-sender messages into runs so the thread can render
 * a single avatar + timestamp per run (modern chat-app style).
 */
const groupMessagesForThread = (messages, currentUserId) => {
  const days = [];
  let currentDay = null;
  let currentRun = null;
  messages.forEach((msg) => {
    const dayLabel = formatDayDivider(msg.createdAt);
    if (!currentDay || currentDay.label !== dayLabel) {
      currentDay = { label: dayLabel, runs: [] };
      days.push(currentDay);
      currentRun = null;
    }
    const mine = String(msg?.senderId) === String(currentUserId);
    const runKey = mine ? "me" : `peer-${msg?.senderId ?? "?"}`;
    if (!currentRun || currentRun.runKey !== runKey) {
      currentRun = { runKey, mine, messages: [] };
      currentDay.runs.push(currentRun);
    }
    currentRun.messages.push(msg);
  });
  return days;
};

const initialsOf = (name) => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const roleLabel = (role) => {
  const normalized = String(role || "").toUpperCase();
  if (normalized === "MENTOR") {
    return "Mentor";
  }
  if (normalized === "ADMIN") {
    return "Admin";
  }
  if (normalized === "LEARNER") {
    return "Learner";
  }
  return role ? String(role) : "Member";
};

function Avatar({ name, online, size = 44 }) {
  return (
    <span
      className="msg-avatar"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      <span className="msg-avatar-initials">{initialsOf(name)}</span>
      {online != null && (
        <span
          className={`msg-presence-dot${online ? " is-online" : ""}`}
          aria-hidden="true"
        />
      )}
    </span>
  );
}

export default function MessagesPage({ profile, notify }) {
  const [bookingConvs, setBookingConvs] = useState([]);
  const [directConvs, setDirectConvs] = useState([]);
  const [selectedConvId, setSelectedConvId] = useState("");
  const [selKind, setSelKind] = useState(null); // "booking" | "direct" | null
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [errorText, setErrorText] = useState("");
  const [wsState, setWsState] = useState("idle");
  const [wsReconnectAttempt, setWsReconnectAttempt] = useState(0);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [messageRequests, setMessageRequests] = useState([]);
  const [requestActioningId, setRequestActioningId] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [requestFilter, setRequestFilter] = useState("pending");
  const [mentorSearch, setMentorSearch] = useState("");
  const [mentors, setMentors] = useState([]);
  const [mentorsLoading, setMentorsLoading] = useState(false);
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [creatingConv, setCreatingConv] = useState(false);
  const [createError, setCreateError] = useState(null);

  const wsRef = useRef(null);
  const isMountedRef = useRef(false);
  const stopReconnectRef = useRef(false);
  const reconnectTimerRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const heartbeatTimeoutRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingSeenTimeoutsRef = useRef({});
  const searchInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const currentUserId = profile?.id;
  const currentUserEmail = String(profile?.email || "").toLowerCase();
  const apiBase = import.meta.env.VITE_API_BASE_URL || "";
  const wsBase = useMemo(() => {
    if (apiBase) {
      return apiBase.replace(/^http/, "ws");
    }
    return `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
  }, [apiBase]);

  const closeSocket = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        // no-op
      }
      wsRef.current = null;
    }
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const sendReadMessage = useCallback((convId, kind) => {
    if (
      !convId ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN
    ) {
      return;
    }
    if (kind === "direct") {
      wsRef.current.send(
        JSON.stringify({ type: "READ", conversationId: Number(convId) }),
      );
    } else {
      wsRef.current.send(
        JSON.stringify({ type: "READ", bookingId: Number(convId) }),
      );
    }
  }, []);

  const connectWebSocket = useCallback(
    (convId, kind) => {
      if (!convId || stopReconnectRef.current) {
        return;
      }

      clearReconnectTimer();
      closeSocket();
      setWsState(wsReconnectAttempt === 0 ? "connecting" : "reconnecting");

      const wsUrl = kind === "direct"
        ? `${wsBase}/ws/chat/direct?conversationId=${encodeURIComponent(convId)}`
        : `${wsBase}/ws/chat?bookingId=${encodeURIComponent(convId)}`;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      const startHeartbeat = () => {
        stopHeartbeat();
        // Send PING to server every 30s
        heartbeatIntervalRef.current = setInterval(() => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "PING" }));
            // If no PONG received within HEARTBEAT_TIMEOUT, assume stale and reconnect
            if (heartbeatTimeoutRef.current) clearTimeout(heartbeatTimeoutRef.current);
            heartbeatTimeoutRef.current = setTimeout(() => {
              if (wsRef.current && isMountedRef.current) {
                wsRef.current.close();
              }
            }, HEARTBEAT_TIMEOUT);
          }
        }, HEARTBEAT_INTERVAL);
      };

      socket.onopen = () => {
        if (!isMountedRef.current) {
          return;
        }
        setWsState("connected");
        setWsReconnectAttempt(0);
        startHeartbeat();
        if (kind === "direct") {
          sendReadMessage(convId, "direct");
        } else {
          sendReadMessage(convId, "booking");
        }
      };

      socket.onmessage = (event) => {
        if (!isMountedRef.current) {
          return;
        }

        try {
          const incoming = JSON.parse(event.data);
          const messageType = String(incoming?.type || "TEXT").toUpperCase();

          if (messageType === "TEXT") {
            const payload = incoming?.message || incoming;
            setMessages((prev) => {
              if (prev.some((msg) => String(msg.id) === String(payload.id))) {
                return prev;
              }
              return [...prev, payload];
            });
            return;
          }

          if (messageType === "READ_ACK") {
            const readByEmail = String(
              incoming?.readByEmail || "",
            ).toLowerCase();
            if (readByEmail) {
              setMessages((prev) =>
                prev.map((msg) => {
                  const mine =
                    String(msg?.senderEmail || "").toLowerCase() ===
                    currentUserEmail;
                  return mine ? { ...msg, readByRecipient: true } : msg;
                }),
              );
            }
            return;
          }

          if (messageType === "PONG") {
            // Reset heartbeat timeout — backend is alive
            if (heartbeatTimeoutRef.current) {
              clearTimeout(heartbeatTimeoutRef.current);
              heartbeatTimeoutRef.current = null;
            }
            return;
          }

          if (messageType === "TYPING") {
            const typingUserEmail = String(
              incoming?.typingUserEmail || "",
            ).toLowerCase();
            if (!typingUserEmail || typingUserEmail === currentUserEmail) {
              return;
            }
            const targetId = String(incoming?.conversationId || incoming?.bookingId || "");
            if (!targetId) return;

            setTypingUsers((prev) => ({ ...prev, [targetId]: true }));
            if (typingSeenTimeoutsRef.current[targetId]) {
              clearTimeout(typingSeenTimeoutsRef.current[targetId]);
            }
            typingSeenTimeoutsRef.current[targetId] = setTimeout(() => {
              setTypingUsers((prev) => ({ ...prev, [targetId]: false }));
            }, 3000);
          }
        } catch {
          setErrorText(getErrorFeedback("realtimeMessageParseFailed").message);
        }
      };

      socket.onerror = () => {
        if (!isMountedRef.current) {
          return;
        }
        setWsState("error");
      };

      socket.onclose = () => {
        stopHeartbeat();
        if (!isMountedRef.current || stopReconnectRef.current) {
          return;
        }

        setWsState("reconnecting");
        setWsReconnectAttempt((prev) => {
          if (prev >= RECONNECT_MAX_ATTEMPTS) {
            setWsState("closed");
            return prev;
          }

          const delay = Math.min(1000 * Math.pow(2, prev), 30000);
          reconnectTimerRef.current = setTimeout(() => {
            if (!stopReconnectRef.current) {
              connectWebSocket(convId, kind);
            }
          }, delay);

          return prev + 1;
        });
      };
    },
    [
      clearReconnectTimer,
      closeSocket,
      currentUserEmail,
      sendReadMessage,
      stopHeartbeat,
      wsBase,
      wsReconnectAttempt,
    ],
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopReconnectRef.current = true;
      clearReconnectTimer();
      stopHeartbeat();
      closeSocket();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      Object.values(typingSeenTimeoutsRef.current).forEach((timer) => {
        clearTimeout(timer);
      });
      typingSeenTimeoutsRef.current = {};
    };
  }, [clearReconnectTimer, closeSocket, stopHeartbeat]);

  useEffect(() => {
    if (!profile?.id) {
      setLoadingConversations(false);
      setBookingConvs([]);
      setDirectConvs([]);
      return;
    }

    let cancelled = false;
    const loadConversations = async () => {
      setLoadingConversations(true);
      try {
        const [bookingRes, directRes] = await Promise.all([
          client.get("/api/v1/chat/conversations").catch(() => ({ data: { data: [] } })),
          client.get("/api/v1/chat/direct/conversations").catch(() => ({ data: { data: [] } })),
        ]);
        if (cancelled) return;
        setBookingConvs(bookingRes?.data?.data || []);
        setDirectConvs(directRes?.data?.data || []);
      } catch {
        if (!cancelled) {
          setErrorText(getErrorFeedback("conversationsLoadFailed").message);
        }
      } finally {
        if (!cancelled) {
          setLoadingConversations(false);
        }
      }
    };
    loadConversations();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) {
      setLoadingRequests(false);
      setMessageRequests([]);
      return;
    }

    let cancelled = false;
    const loadRequests = async () => {
      setLoadingRequests(true);
      try {
        const response = await client.get("/api/message-requests");
        if (!cancelled) {
          setMessageRequests(response?.data?.data || []);
        }
      } catch {
        if (!cancelled) {
          setErrorText(getErrorFeedback("conversationsLoadFailed").message);
        }
      } finally {
        if (!cancelled) {
          setLoadingRequests(false);
        }
      }
    };

    loadRequests();
    return () => {
      cancelled = true;
    };
  }, [profile?.id]);

  // Build unified conversations list for rendering
  const conversations = useMemo(() => {
    const bookingRows = (bookingConvs || []).map((conversation) => ({
      id: `booking-${conversation.bookingId}`,
      kind: "booking",
      convId: String(conversation.bookingId),
      conversation,
      title: String(
        conversation.participantName ||
          conversation.sessionTitle ||
          "SkillSwap Member",
      ),
      subtitle: String(
        conversation.lastMessagePreview || conversation.sessionTitle || "",
      ),
      role: conversation.participantRole || conversation.role || "",
      time:
        conversation.lastMessageAt ||
        conversation.updatedAt ||
        conversation.lastActivityAt ||
        "",
      unreadCount: Number(conversation.unreadCount || 0),
      online: Boolean(conversation.participantOnline),
      presence: String(conversation.participantPresenceText || "Offline"),
    }));
    const directRows = (directConvs || []).map((c) => ({
      id: `direct-${c.conversationId}`,
      kind: "direct",
      convId: String(c.conversationId),
      conversation: c,
      title: String(c.participantName || "SkillSwap Member"),
      subtitle: String(c.lastMessagePreview || "Direct conversation"),
      role: "LEARNER",
      time: c.lastMessageAt || c.updatedAt || "",
      unreadCount: Number(c.unreadCount || 0),
      online: Boolean(c.participantOnline),
      presence: String(c.participantPresenceText || "Offline"),
    }));
    const all = [...bookingRows, ...directRows];
    all.sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
    return all;
  }, [bookingConvs, directConvs]);

  // Derived current selection (must be after conversations useMemo)
  const selConv = conversations.find((c) => c.id === selectedConvId) || null;

  // Auto-select first conversation on load
  useEffect(() => {
    if (conversations.length > 0 && !selectedConvId) {
      setSelectedConvId(conversations[0].id);
      setSelKind(conversations[0].kind);
    }
  }, [conversations, selectedConvId]);

  // ── Message loading effect ──
  useEffect(() => {
    if (!selectedConvId || !selConv || !profile?.id) {
      setMessages([]);
      stopReconnectRef.current = true;
      clearReconnectTimer();
      closeSocket();
      return;
    }

    stopReconnectRef.current = false;
    let cancelled = false;

    const loadMessages = async () => {
      setLoadingMessages(true);
      try {
        const endpoint =
          selConv.kind === "booking"
            ? `/api/v1/chat/booking/${selConv.convId}`
            : `/api/v1/chat/direct/${selConv.convId}/messages`;
        const response = await client.get(endpoint);
        if (!cancelled) {
          setMessages(response?.data?.data || []);
        }
      } catch {
        if (!cancelled) {
          setErrorText(getErrorFeedback("chatHistoryLoadFailed").message);
        }
      } finally {
        if (!cancelled) {
          setLoadingMessages(false);
        }
      }
    };

    loadMessages();

    // Connect WebSocket for real-time messaging
    connectWebSocket(selConv.convId, selConv.kind);

    return () => {
      cancelled = true;
      stopReconnectRef.current = true;
      clearReconnectTimer();
      closeSocket();
      setTypingUsers((prev) => ({ ...prev, [selConv.convId]: false }));
    };
  }, [
    clearReconnectTimer,
    closeSocket,
    connectWebSocket,
    profile?.id,
    selectedConvId,
    selConv,
  ]);

  // ── New Chat: mentor search ──
  useEffect(() => {
    if (!showNewChat) return;
    let active = true;
    setMentorsLoading(true);
    const q = mentorSearch.trim();
    client.get("/api/v1/search/mentors", { params: q ? { q, size: 20 } : { size: 20 } })
      .then((res) => {
        if (!active) return;
        setMentors(res?.data?.data || []);
        setMentorsLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setMentors([]);
        setMentorsLoading(false);
      });
    return () => { active = false; };
  }, [showNewChat, mentorSearch]);

  const handleStartConversation = async () => {
    if (!selectedMentor) {
      setCreateError("Please select a mentor to start a conversation.");
      return;
    }
    const mentorId = selectedMentor.mentorId || selectedMentor.id;
    setCreatingConv(true);
    setCreateError(null);
    try {
      const response = await client.post(`/api/v1/chat/direct/${mentorId}`);
      const data = response?.data?.data;
      if (data?.conversationId) {
        const newConvId = data.conversationId;
        setDirectConvs((prev) => {
          const exists = prev.some((c) => c.conversationId === newConvId);
          return exists ? prev : [data, ...prev];
        });
        setShowNewChat(false);
        setSelectedMentor(null);
        setMentorSearch("");
        setSelectedConvId(`direct-${newConvId}`);
        setSelKind("direct");
        notify?.({
          type: "success",
          title: "Conversation started",
          message: `You can now message with ${data.participantName}.`,
        });
      } else {
        setCreateError("Unable to start conversation. No conversation ID returned.");
      }
    } catch (err) {
      /* status unused */
      const errBody = err?.response?.data;
      const msg = errBody?.message || errBody?.data?.message || errBody?.data?.error || err?.message || "Unable to start conversation.";
      setCreateError(msg);
    } finally {
      setCreatingConv(false);
    }
  };

  // UI-only: focus the search box with Cmd/Ctrl+K.
  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // UI-only: keep the newest message in view.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, loadingMessages]);

  const handleChatInputChange = (event) => {
    const nextValue = event.target.value;
    setChatInput(nextValue);

    if (
      !selectedConvId ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    if (typingTimeoutRef.current) {
      return;
    }

    const typingPayload =
      selKind === "direct"
        ? { type: "TYPING", conversationId: Number(selConv?.convId), typingUserEmail: currentUserEmail }
        : { type: "TYPING", bookingId: Number(selConv?.convId), typingUserEmail: currentUserEmail };
    wsRef.current.send(JSON.stringify(typingPayload));

    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    const content = chatInput.trim();
    if (!content || !selConv) {
      return;
    }

    try {
      const endpoint =
        selConv.kind === "booking"
          ? `/api/v1/chat/booking/${selConv.convId}`
          : `/api/v1/chat/direct/${selConv.convId}/messages`;
      const response = await client.post(endpoint, { content });
      const created = response?.data?.data;
      if (created) {
        setMessages((prev) => [...prev, created]);
      }
      setChatInput("");
      notify?.({
        type: "success",
        title: "Message sent",
        message: "Your message was delivered.",
      });
    } catch {
      setErrorText(getErrorFeedback("messageSendFailed").message);
    }
  };

  const handleMessageRequestAction = async (requestId, action) => {
    setRequestActioningId(requestId);
    try {
      await client.put(`/api/message-requests/${requestId}/${action}`);
      setMessageRequests((prev) =>
        prev.filter((request) => String(request.id) !== String(requestId)),
      );
      notify?.({
        type: "success",
        title: action === "accept" ? "Request accepted" : "Request declined",
        message:
          action === "accept"
            ? "The conversation is now available in your inbox."
            : "The request was declined and removed from your list.",
      });
    } catch {
      setErrorText("Unable to update that message request right now.");
    } finally {
      setRequestActioningId(null);
    }
  };

  const handleSearch = (event) => {
    setSearchTerm(event.target.value);
  };

  const notifyComingSoon = (feature) =>
    notify?.({
      type: "info",
      title: `${feature} coming soon`,
      message: "We're still polishing this feature — hang tight!",
    });

  const focusSearch = () => {
    setSidebarOpen(true);
    searchInputRef.current?.focus();
  };

  const isTyping = Boolean(selConv && typingUsers[String(selConv.convId)]);
  const totalUnread = conversations.reduce(
    (sum, item) => sum + (item.unreadCount || 0),
    0,
  );
  const onlineUsers = conversations.filter((item) => item.online);
  const filteredConversations = useMemo(() => {
    let next = conversations;
    if (activeFilter === "unread") {
      next = next.filter((item) => (item.unreadCount || 0) > 0);
    } else if (activeFilter === "mentors") {
      next = next.filter(
        (item) => String(item.role || "").toUpperCase() === "MENTOR",
      );
    } else if (activeFilter === "learners") {
      next = next.filter(
        (item) => String(item.role || "").toUpperCase() === "LEARNER",
      );
    } else if (activeFilter === "archived") {
      next = next.filter(
        (item) => Number(item.unreadCount || 0) === 0 && !item.online,
      );
    }
    return filterConversationsBySearch(next, searchTerm);
  }, [activeFilter, conversations, searchTerm]);

  // Filter message requests based on selected filter
  const filteredRequests = useMemo(() => {
    let requests = messageRequests;
    if (requestFilter === "pending") {
      requests = requests.filter((r) => !r.status || r.status === "PENDING");
    } else if (requestFilter === "accepted") {
      requests = requests.filter((r) => r.status === "ACCEPTED");
    } else if (requestFilter === "rejected") {
      requests = requests.filter((r) => r.status === "DECLINED");
    }
    return requests;
  }, [messageRequests, requestFilter]);

  const wsStatusBanner =
    wsState === "reconnecting"
      ? "Reconnecting…"
      : wsState === "closed"
        ? "Connection lost. Messages may be delayed."
        : "";

  return (
    <main className="msg-page md-page">
      <div className="msg-container">
        {/* ---------- Header ---------- */}
        <header className="msg-header">
          <div className="msg-header-text">
            <h1 className="msg-title">Messages</h1>
            <p className="msg-subtitle">
              Connect, collaborate and learn with mentors and learners.
            </p>
          </div>
          <div className="msg-header-actions">
            <span
              className="msg-unread-pill"
              title={`${totalUnread} unread message${totalUnread === 1 ? "" : "s"}`}
              aria-label={`${totalUnread} unread message${totalUnread === 1 ? "" : "s"}`}
              role="status"
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                notifications
              </span>
              {totalUnread > 0 ? (
                <span className="msg-unread-count">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              ) : null}
            </span>
            <button
              type="button"
              className="msg-btn msg-btn-outline msg-btn-sm"
              onClick={() => setShowNewChat(true)}
            >
              <span className="material-symbols-outlined">edit_square</span>
              New Chat
            </button>
          </div>
        </header>

        {/* ---------- Search bar ---------- */}
        <div className="msg-searchbar-wrap">
          <div className="msg-searchbar">
            <span className="material-symbols-outlined msg-search-icon">
              search
            </span>
            <input
              ref={searchInputRef}
              id="message-search"
              className="msg-search-input"
              value={searchTerm}
              onChange={handleSearch}
              placeholder="Search conversations"
              aria-label="Search conversations"
            />
            <kbd className="msg-kbd">⌘K</kbd>
          </div>
        </div>

        {errorText ? (
          <div className="msg-error" role="alert">
            <span className="material-symbols-outlined">error</span>
            {errorText}
            <button
              type="button"
              className="msg-error-dismiss"
              onClick={() => setErrorText("")}
              aria-label="Dismiss error"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        ) : null}

        {/* ---------- Three-column messaging layout ---------- */}
        <div className={`msg-layout${sidebarOpen ? " sidebar-open" : ""}`}>
          <button
            type="button"
            className="msg-sidebar-toggle"
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-expanded={sidebarOpen}
            aria-controls="msg-sidebar"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {sidebarOpen ? "close" : "group"}
            </span>
            {sidebarOpen ? "Close" : "Conversations"}
          </button>

          {/* Drawer backdrop (mobile only) */}
          <button
            type="button"
            className="msg-drawer-backdrop"
            aria-label="Close conversations panel"
            tabIndex={sidebarOpen ? 0 : -1}
            onClick={() => setSidebarOpen(false)}
          />

          {/* Left sidebar */}
          <aside
            id="msg-sidebar"
            className="msg-sidebar"
            aria-label="Conversations and requests"
          >
            <section className="msg-card msg-section msg-section-compact">
              <div className="msg-section-head">
                <h2 className="msg-section-title">
                  <span className="material-symbols-outlined">schedule</span>
                  Message Requests
                </h2>
                {messageRequests.length > 0 && (
                  <span className="msg-count-chip">
                    {messageRequests.length}
                  </span>
                )}
              </div>                <div
                  className="msg-request-chip-row"
                  aria-label="Message request filters"
                >
                  {["pending", "accepted", "rejected"].map((f) => (
                    <button
                      key={f}
                      type="button"
                      className={`msg-filter-pill${requestFilter === f ? " is-active" : ""}`}
                      onClick={() => setRequestFilter(f)}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>

              {loadingRequests ? (
                <div className="msg-skel-list" aria-hidden="true">
                  {[0, 1].map((i) => (
                    <div className="msg-skel-item" key={i}>
                      <span className="msg-skel-avatar" />
                      <div className="msg-skel-lines">
                        <span className="msg-skel-line w-55" />
                        <span className="msg-skel-line w-85" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredRequests.length > 0 ? (
                <div className="msg-request-list">
                  {filteredRequests.slice(0, 5).map((request) => {
                    const name =
                      request.sender?.fullName ||
                      request.sender?.email ||
                      "New contact";
                    const busy = requestActioningId === request.id;
                    return (
                      <article className="msg-request-card" key={request.id}>
                        <div className="msg-request-top">
                          <Avatar name={name} size={36} />
                          <div className="msg-request-meta">
                            <p className="msg-name">{name}</p>
                            <p className="msg-role">
                              {roleLabel(request.sender?.role)}
                            </p>
                          </div>
                        </div>
                        <p className="msg-request-text">
                          {request.firstMessage || "Would like to connect."}
                        </p>
                        <div className="msg-request-actions">
                          <button
                            type="button"
                            className="msg-btn msg-btn-primary msg-btn-sm"
                            onClick={() =>
                              handleMessageRequestAction(request.id, "accept")
                            }
                            disabled={busy}
                          >
                            {busy ? "…" : "Accept"}
                          </button>
                          <button
                            type="button"
                            className="msg-btn msg-btn-outline msg-btn-sm"
                            onClick={() =>
                              handleMessageRequestAction(request.id, "decline")
                            }
                            disabled={busy}
                          >
                            Decline
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="msg-empty msg-empty-sm">
                  <p className="msg-empty-title">You are all caught up</p>
                  <p className="msg-empty-desc">
                    New connection requests appear here first.
                  </p>
                </div>
              )}
            </section>

            <section className="msg-card msg-section msg-section-compact">
              <div className="msg-section-head">
                <h2 className="msg-section-title">
                  <span className="material-symbols-outlined">forum</span>
                  Conversations
                </h2>
              </div>

              <div
                className="msg-filter-row"
                role="tablist"
                aria-label="Conversation filters"
              >
                {[
                  { value: "all", label: "All" },
                  { value: "unread", label: "Unread" },
                  { value: "mentors", label: "Mentors" },
                  { value: "learners", label: "Learners" },
                  { value: "archived", label: "Archived" },
                ].map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    className={`msg-filter-pill${activeFilter === filter.value ? " is-active" : ""}`}
                    onClick={() => setActiveFilter(filter.value)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {loadingConversations ? (
                <div className="msg-skel-list" aria-hidden="true">
                  {[0, 1, 2, 3].map((i) => (
                    <div className="msg-skel-item" key={i}>
                      <span className="msg-skel-avatar" />
                      <div className="msg-skel-lines">
                        <span className="msg-skel-line w-70" />
                        <span className="msg-skel-line w-45" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredConversations.length > 0 ? (
                <div className="msg-convo-list">
                  {filteredConversations.map((item) => {
                    const active = item.id === selectedConvId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`msg-convo${active ? " is-active" : ""}`}
                        onClick={() => {
                          setSelectedConvId(item.id);
                          setSelKind(item.kind);
                          setSidebarOpen(false);
                        }}
                      >
                        <Avatar name={item.title} online={item.online} />
                        <div className="msg-convo-body">
                          <div className="msg-convo-row">
                            <span className="msg-name">{item.title}</span>
                            {item.time ? (
                              <span className="msg-time">
                                {formatMessageTime(item.time)}
                              </span>
                            ) : null}
                          </div>
                          <div className="msg-convo-row">
                            <span className="msg-preview">
                              {item.subtitle || roleLabel(item.role)}
                            </span>
                            {item.unreadCount > 0 ? (
                              <span className="msg-unread-badge">
                                {item.unreadCount}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="msg-empty msg-empty-sm">
                  <p className="msg-empty-title">
                    No conversations match this view
                  </p>
                  <p className="msg-empty-desc">
                    Try another filter or start a new conversation.
                  </p>
                </div>
              )}
            </section>

            {onlineUsers.length > 0 && (
              <section className="msg-card msg-section msg-section-compact">
                <div className="msg-section-head">
                  <h2 className="msg-section-title">
                    <span className="material-symbols-outlined">group</span>
                    Online Now
                  </h2>
                  <span className="msg-count-chip msg-count-chip-green">
                    {onlineUsers.length}
                  </span>
                </div>
                <div className="msg-online-row">
                  {onlineUsers.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="msg-online-user"
                      title={item.title}
                      onClick={() => {
                        setSelectedConvId(item.id);
                        setSelKind(item.kind);
                        setSidebarOpen(false);
                      }}
                    >
                      <Avatar name={item.title} online size={38} />
                      <span className="msg-online-name">
                        {item.title.split(" ")[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </aside>

          {/* Right: chat window */}
          <section className="msg-card msg-chat">
            {loadingConversations ? (
              <div className="msg-chat-loading">
                <span className="msg-spinner" aria-hidden="true" />
                <p>Loading conversations…</p>
              </div>
            ) : !selConv ? (
              <div className="msg-empty msg-empty-hero">
                <div className="msg-empty-illustration" aria-hidden="true">
                  <span className="material-symbols-outlined">forum</span>
                </div>
                <h2 className="msg-empty-hero-title">No Conversations Yet</h2>
                <p className="msg-empty-hero-desc">
                  Start connecting with mentors and learners.
                  <br />
                  Your conversations will appear here.
                </p>
                <div className="msg-empty-hero-actions">
                  <button
                    type="button"
                    className="msg-btn msg-btn-primary"
                    onClick={focusSearch}
                  >
                    <span className="material-symbols-outlined">group_add</span>
                    Find People
                  </button>
                  <Link to="/mentors" className="msg-btn msg-btn-outline">
                    <span className="material-symbols-outlined">explore</span>
                    Browse Mentors
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {/* Chat header */}
                <header className="msg-chat-header">
                  <div className="msg-chat-peer">
                    <Avatar
                      name={selConv.title}
                      online={selConv.online}
                      size={46}
                    />
                    <div className="msg-chat-peer-meta">
                      <p className="msg-name">{selConv.title}</p>
                      <p className="msg-chat-status">
                        <span
                          className={`msg-status-dot${
                            selConv.online ? " is-online" : ""
                          }`}
                        />
                        {selConv.online
                          ? "Online"
                          : selConv.presence}
                        {selConv.role
                          ? ` · ${roleLabel(selConv.role)}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  {/* Action buttons removed — only avatar, name, and status shown */}
                </header>

                {wsStatusBanner ? (
                  <div className="msg-ws-banner">
                    <span className="msg-spinner" aria-hidden="true" />
                    {wsStatusBanner}
                  </div>
                ) : null}

                {/* Messages */}
                <div
                  className="msg-thread"
                  role="log"
                  aria-live="polite"
                  aria-relevant="additions"
                  aria-label={`Conversation with ${selConv.title}`}
                >
                  {loadingMessages ? (
                    <div className="msg-skel-bubbles">
                      <span className="msg-skel-bubble left" />
                      <span className="msg-skel-bubble right" />
                      <span className="msg-skel-bubble left" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="msg-thread-empty">
                      <div className="msg-empty-icon">
                        <span className="material-symbols-outlined">
                          waving_hand
                        </span>
                      </div>
                      <p className="msg-empty-title">Say hello 👋</p>
                      <p className="msg-empty-desc">
                        This is the beginning of your conversation with{" "}
                        {selConv.title}.
                      </p>
                    </div>
                  ) : (
                    groupMessagesForThread(messages, currentUserId).map(
                      (day) => (
                        <div className="msg-day" key={day.label}>
                          <div className="msg-day-divider">
                            <span>{day.label}</span>
                          </div>
                          {day.runs.map((run, runIdx) => {
                            const mine = run.mine;
                            return (
                              <div
                                key={`${day.label}-${runIdx}`}
                                className={`msg-bubble-row${mine ? " mine" : ""}`}
                              >
                                {!mine && (
                                  <Avatar
                                    name={selConv.title}
                                    size={30}
                                  />
                                )}
                                <div className="msg-bubble-group">
                                  {run.messages.map((msg, msgIdx) => {
                                    const isLast =
                                      msgIdx === run.messages.length - 1;
                                    return (
                                      <div key={msg.id} className="msg-bubble">
                                        {msg.content}
                                        {isLast ? (
                                          <span className="msg-bubble-meta">
                                            {formatMessageTime(msg.createdAt)}
                                            {mine && msg.readByRecipient ? (
                                              <span
                                                className="msg-read"
                                                title="Read"
                                                aria-label="Read"
                                              >
                                                <span className="material-symbols-outlined">
                                                  done_all
                                                </span>
                                              </span>
                                            ) : null}
                                          </span>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ),
                    )
                  )}

                  {isTyping ? (
                    <div className="msg-bubble-row">
                      <Avatar name={selConv.title} size={30} />
                      <div
                        className="msg-typing"
                        role="status"
                        aria-live="polite"
                        aria-label={`${selConv.title} is typing`}
                      >
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  ) : null}
                  <div ref={messagesEndRef} />
                </div>

                {/* Composer */}
                <form className="msg-composer" onSubmit={handleSendMessage}>
                  <button
                    type="button"
                    className="msg-icon-btn"
                    title="Attach a file"
                    aria-label="Attach a file"
                    onClick={() => notifyComingSoon("Attachments")}
                  >
                    <span
                      className="material-symbols-outlined"
                      aria-hidden="true"
                    >
                      attach_file
                    </span>
                  </button>
                  <textarea
                    className="msg-composer-input"
                    value={chatInput}
                    onChange={handleChatInputChange}
                    placeholder="Write a message…"
                    aria-label="Write a message"
                    rows={1}
                    onInput={(event) => {
                      event.target.style.height = "auto";
                      event.target.style.height = `${Math.min(event.target.scrollHeight, 120)}px`;
                    }}
                  />
                  <button
                    type="button"
                    className="msg-icon-btn"
                    title="Add emoji"
                    aria-label="Add emoji"
                    onClick={() => notifyComingSoon("Emoji picker")}
                  >
                    <span
                      className="material-symbols-outlined"
                      aria-hidden="true"
                    >
                      mood
                    </span>
                  </button>
                  <button
                    type="submit"
                    className="msg-send-btn"
                    disabled={!chatInput.trim()}
                    aria-label="Send message"
                  >
                    <span className="material-symbols-outlined">send</span>
                  </button>
                </form>
              </>
            )}
          </section>

          <aside className="msg-details" aria-label="Conversation details">
            {selConv ? (
              <div className="msg-card msg-details-card">
                <div className="msg-details-header">
                  <Avatar
                    name={selConv.title}
                    online={selConv.online}
                    size={56}
                  />
                  <div>
                    <p className="msg-name">{selConv.title}</p>
                    <p className="msg-role">
                      {roleLabel(selConv.role)}
                    </p>
                  </div>
                </div>

                {selConv.conversation?.sessionTitle ? (
                  <div className="msg-detail-block">
                    <div className="msg-detail-label">Session</div>
                    <div className="msg-detail-value">
                      {selConv.conversation.sessionTitle}
                    </div>
                  </div>
                ) : null}

                <div className="msg-detail-block">
                  <div className="msg-detail-label">Status</div>
                  <div className="msg-detail-value">
                    {selConv.online ? (
                      <span style={{ color: '#22c55e', fontWeight: 600 }}>● Online</span>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>○ Offline · {selConv.presence}</span>
                    )}
                  </div>
                </div>

                {selConv.kind === "booking" && selConv.conversation?.bookingId ? (
                  <div className="msg-detail-block">
                    <div className="msg-detail-label">Booking ID</div>
                    <div className="msg-detail-value">#{selConv.conversation.bookingId}</div>
                  </div>
                ) : null}

                <div className="msg-detail-block">
                  <div className="msg-detail-label">Quick Actions</div>
                  <div className="msg-detail-actions">
                    <button
                      type="button"
                      className="msg-btn msg-btn-primary msg-btn-sm"
                      onClick={() => {
                        document.querySelector('.msg-composer-input')?.focus();
                      }}
                    >
                      Reply
                    </button>
                    <button
                      type="button"
                      className="msg-btn msg-btn-outline msg-btn-sm"
                      onClick={() => notifyComingSoon("Schedule Session")}
                    >
                      Schedule
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="msg-card msg-details-card msg-details-empty">
                <p className="msg-empty-title">Select a conversation</p>
                <p className="msg-empty-desc">
                  Details and next steps will appear here.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* ═══ New Chat Modal ═══ */}
      {showNewChat && (
        <div className="msg-modal-overlay" onClick={() => {
          setShowNewChat(false);
          setSelectedMentor(null);
          setMentorSearch("");
          setCreateError(null);
        }}>
          <div className="msg-modal" onClick={(e) => e.stopPropagation()}>
            <div className="msg-modal__header">
              <h3><span className="material-symbols-outlined">add_comment</span> New Conversation</h3>
              <button
                type="button"
                className="msg-modal__close"
                onClick={() => {
                  setShowNewChat(false);
                  setSelectedMentor(null);
                  setMentorSearch("");
                  setCreateError(null);
                }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="msg-modal__body">
              <label className="msg-modal__search">
                <span className="material-symbols-outlined">search</span>
                <input
                  value={mentorSearch}
                  onChange={(e) => setMentorSearch(e.target.value)}
                  placeholder="Search mentors by name or skill…"
                  data-auto-focus
                />
                {mentorSearch && (
                  <button type="button" className="msg-modal__search-clear" onClick={() => setMentorSearch("")}>
                    <span className="material-symbols-outlined">close</span>
                  </button>
                )}
              </label>

              {createError && (
                <div className="msg-modal__error">
                  <span className="material-symbols-outlined">error</span>
                  <span>{createError}</span>
                </div>
              )}

              <div className="msg-modal__mentors">
                {mentorsLoading ? (
                  <div className="msg-modal__loading">
                    <span className="msg-spinner" aria-hidden="true" />
                    <p>Loading mentors…</p>
                  </div>
                ) : mentors.length > 0 ? (
                  mentors.map((mentor) => {
                    const mentorId = mentor.mentorId || mentor.id;
                    const mentorName = mentor.mentorName || mentor.fullName || "Mentor";
                    const mentorSkills = mentor.skills || [];
                    const isSelected = selectedMentor && (selectedMentor.mentorId || selectedMentor.id) === mentorId;
                    return (
                      <button
                        key={mentorId}
                        type="button"
                        className={`msg-modal__mentor${isSelected ? " is-selected" : ""}`}
                        onClick={() => setSelectedMentor(mentor)}
                      >
                        <div className="msg-modal__mentor-av">
                          {mentor.profileImageUrl ? (
                            <img src={mentor.profileImageUrl} alt={mentorName} />
                          ) : (
                            <span>{initialsOf(mentorName)}</span>
                          )}
                        </div>
                        <div className="msg-modal__mentor-info">
                          <strong>{mentorName}</strong>
                          {mentor.mentorRole && <span>{mentor.mentorRole}</span>}
                          {(Array.isArray(mentorSkills) ? mentorSkills : String(mentorSkills || '').split(',').map(s => s.trim()).filter(Boolean)).slice(0, 3).length > 0 && (
                            <div className="msg-modal__mentor-skills">
                              {(Array.isArray(mentorSkills) ? mentorSkills : String(mentorSkills || '').split(',').map(s => s.trim()).filter(Boolean)).slice(0, 3).map((s) => (
                                <span key={s} className="msg-mini-chip">{typeof s === "string" ? s : s.name || s}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        {isSelected && <span className="material-symbols-outlined msg-modal__check">check_circle</span>}
                      </button>
                    );
                  })
                ) : (
                  <div className="msg-modal__empty">
                    <span className="material-symbols-outlined">search_off</span>
                    <p>{mentorSearch ? `No mentors match "${mentorSearch}"` : "No mentors available"}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="msg-modal__footer">
              <button
                type="button"
                className="msg-btn msg-btn-outline"
                onClick={() => {
                  setShowNewChat(false);
                  setSelectedMentor(null);
                  setMentorSearch("");
                  setCreateError(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="msg-btn msg-btn-primary"
                disabled={!selectedMentor || creatingConv}
                onClick={handleStartConversation}
              >
                {creatingConv ? "Starting…" : "Start Conversation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
