import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { getErrorFeedback } from "../utils/comingSoon";
import "./MessagesPage.css";

const RECONNECT_MAX_ATTEMPTS = 5;

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
  const [conversations, setConversations] = useState([]);
  const [selectedBookingId, setSelectedBookingId] = useState("");
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
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestTarget, setRequestTarget] = useState(null);
  const [requestSending, setRequestSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const wsRef = useRef(null);
  const isMountedRef = useRef(false);
  const stopReconnectRef = useRef(false);
  const reconnectTimerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingSeenTimeoutsRef = useRef({});
  const searchInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const currentUserId = profile?.id;
  const currentUserEmail = String(profile?.email || "").toLowerCase();
  const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
  const wsBase = useMemo(() => apiBase.replace(/^http/, "ws"), [apiBase]);

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

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const sendReadMessage = useCallback((bookingId) => {
    if (
      !bookingId ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN
    ) {
      return;
    }
    wsRef.current.send(
      JSON.stringify({ type: "READ", bookingId: Number(bookingId) }),
    );
  }, []);

  const connectWebSocket = useCallback(
    (bookingId) => {
      if (!bookingId || stopReconnectRef.current) {
        return;
      }

      clearReconnectTimer();
      closeSocket();
      setWsState(wsReconnectAttempt === 0 ? "connecting" : "reconnecting");

      const socket = new WebSocket(
        `${wsBase}/ws/chat?bookingId=${encodeURIComponent(bookingId)}`,
      );
      wsRef.current = socket;

      socket.onopen = () => {
        if (!isMountedRef.current) {
          return;
        }
        setWsState("connected");
        setWsReconnectAttempt(0);
        sendReadMessage(bookingId);
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

          if (messageType === "TYPING") {
            const typingUserEmail = String(
              incoming?.typingUserEmail || "",
            ).toLowerCase();
            const targetBookingId = String(incoming?.bookingId || "");
            if (
              !typingUserEmail ||
              typingUserEmail === currentUserEmail ||
              !targetBookingId
            ) {
              return;
            }

            setTypingUsers((prev) => ({ ...prev, [targetBookingId]: true }));
            if (typingSeenTimeoutsRef.current[targetBookingId]) {
              clearTimeout(typingSeenTimeoutsRef.current[targetBookingId]);
            }
            typingSeenTimeoutsRef.current[targetBookingId] = setTimeout(() => {
              setTypingUsers((prev) => ({ ...prev, [targetBookingId]: false }));
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
              connectWebSocket(bookingId);
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
      closeSocket();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      Object.values(typingSeenTimeoutsRef.current).forEach((timer) => {
        clearTimeout(timer);
      });
      typingSeenTimeoutsRef.current = {};
    };
  }, [clearReconnectTimer, closeSocket]);

  useEffect(() => {
    if (!profile?.id) {
      setLoadingConversations(false);
      setConversations([]);
      return;
    }

    let cancelled = false;
    const loadConversations = async () => {
      setLoadingConversations(true);
      try {
        const response = await client.get("/api/v1/chat/conversations");
        if (cancelled) {
          return;
        }
        const rows = (response?.data?.data || []).map((conversation) => ({
          bookingId: String(conversation.bookingId),
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
        setConversations(rows);
        if (rows.length > 0) {
          setSelectedBookingId((prev) => prev || rows[0].bookingId);
        }
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

  useEffect(() => {
    if (!selectedBookingId || !profile?.id) {
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
        const response = await client.get(
          `/api/v1/chat/booking/${selectedBookingId}`,
        );
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
    connectWebSocket(selectedBookingId);

    return () => {
      cancelled = true;
      stopReconnectRef.current = true;
      clearReconnectTimer();
      closeSocket();
      setTypingUsers((prev) => ({ ...prev, [selectedBookingId]: false }));
    };
  }, [
    clearReconnectTimer,
    closeSocket,
    connectWebSocket,
    profile?.id,
    selectedBookingId,
  ]);

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
      !selectedBookingId ||
      !wsRef.current ||
      wsRef.current.readyState !== WebSocket.OPEN
    ) {
      return;
    }

    if (typingTimeoutRef.current) {
      return;
    }

    wsRef.current.send(
      JSON.stringify({
        type: "TYPING",
        bookingId: Number(selectedBookingId),
      }),
    );

    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    const content = chatInput.trim();
    if (!content || !selectedBookingId) {
      return;
    }

    try {
      const response = await client.post(
        `/api/v1/chat/booking/${selectedBookingId}`,
        { content },
      );
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

  const handleSearch = async (event) => {
    const next = event.target.value.trim();
    setSearchTerm(next);
    if (!next) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const response = await client.get(
        `/api/v1/users/mentors?skill=${encodeURIComponent(next)}`,
      );
      const mentors = (response?.data?.data || []).filter(
        (user) => String(user.id) !== String(profile?.id),
      );
      setSearchResults(
        mentors.map((mentor) => ({
          id: mentor.id,
          fullName: mentor.fullName || mentor.name || mentor.email || "Mentor",
          role: mentor.role || "MENTOR",
          email: mentor.email,
          rating: mentor.averageRating,
        })),
      );
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSendRequest = async (user) => {
    if (!user?.id || !requestMessage.trim()) {
      return;
    }

    try {
      setRequestSending(true);
      await client.post("/api/message-requests", {
        receiver: Number(user.id),
        firstMessage: requestMessage.trim(),
      });
      setRequestTarget(user);
      setRequestMessage("");
      notify?.({
        type: "success",
        title: "Message request sent",
        message: `Your request was sent to ${user.fullName || user.email || "this user"}.`,
      });
    } catch (err) {
      setErrorText(
        err?.response?.data?.message || "Unable to send the request right now.",
      );
    } finally {
      setRequestSending(false);
    }
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

  const isTyping = Boolean(typingUsers[String(selectedBookingId)]);
  const totalUnread = conversations.reduce(
    (sum, item) => sum + (item.unreadCount || 0),
    0,
  );
  const onlineUsers = conversations.filter((item) => item.online);
  const selectedConversation = conversations.find(
    (item) => item.bookingId === selectedBookingId,
  );
  const showSearchPanel = Boolean(searchTerm);

  const wsStatusBanner =
    wsState === "reconnecting"
      ? "Reconnecting…"
      : wsState === "closed"
        ? "Connection lost. Messages may be delayed."
        : "";

  return (
    <main className="msg-page">
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
              className="msg-btn msg-btn-primary"
              onClick={focusSearch}
            >
              <span className="material-symbols-outlined">edit_square</span>
              New Message
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
              placeholder="Search mentors, learners or skills..."
              aria-label="Search mentors, learners or skills"
            />
            <kbd className="msg-kbd">⌘K</kbd>
            <button
              type="button"
              className="msg-filter-btn"
              onClick={() => notifyComingSoon("Filters")}
            >
              <span className="material-symbols-outlined">tune</span>
              <span className="msg-filter-label">Filters</span>
            </button>
          </div>

          {showSearchPanel && (
            <div className="msg-search-panel" role="listbox">
              {searchLoading ? (
                <div className="msg-search-loading">
                  <span className="msg-spinner" aria-hidden="true" />
                  Searching…
                </div>
              ) : searchResults.length === 0 ? (
                <div className="msg-search-empty">
                  <span className="material-symbols-outlined">person_search</span>
                  No people found for “{searchTerm}”. Try another name or skill.
                </div>
              ) : (
                searchResults.map((user) => (
                  <div className="msg-search-result" key={user.id}>
                    <div className="msg-search-result-head">
                      <Avatar name={user.fullName} size={40} />
                      <div className="msg-search-result-meta">
                        <p className="msg-name">{user.fullName}</p>
                        <p className="msg-role">{roleLabel(user.role)}</p>
                      </div>
                      {user.rating ? (
                        <span className="msg-rating">★ {user.rating}</span>
                      ) : null}
                    </div>
                    <textarea
                      className="msg-intro-input"
                      value={requestTarget?.id === user.id ? requestMessage : ""}
                      onChange={(event) => {
                        setRequestTarget(user);
                        setRequestMessage(event.target.value);
                      }}
                      placeholder={`Send a short intro to ${user.fullName || "this person"}`}
                      rows={2}
                    />
                    <div className="msg-search-result-actions">
                      <button
                        type="button"
                        className="msg-btn msg-btn-primary msg-btn-sm"
                        onClick={() => handleSendRequest(user)}
                        disabled={
                          requestSending ||
                          requestTarget?.id !== user.id ||
                          !requestMessage.trim()
                        }
                      >
                        {requestSending && requestTarget?.id === user.id
                          ? "Sending…"
                          : "Send request"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
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

        {/* ---------- Two-column layout ---------- */}
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
            aria-label="Conversations and requests">
            {/* Pending requests */}
            <section className="msg-card msg-section">
              <div className="msg-section-head">
                <h2 className="msg-section-title">
                  <span className="material-symbols-outlined">schedule</span>
                  Pending Requests
                </h2>
                {messageRequests.length > 0 && (
                  <span className="msg-count-chip">
                    {messageRequests.length}
                  </span>
                )}
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
              ) : messageRequests.length > 0 ? (
                <div className="msg-request-list">
                  {messageRequests.map((request) => {
                    const name =
                      request.sender?.fullName ||
                      request.sender?.email ||
                      "New contact";
                    const busy = requestActioningId === request.id;
                    return (
                      <article className="msg-request-card" key={request.id}>
                        <div className="msg-request-top">
                          <Avatar name={name} size={42} />
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
                            <span className="material-symbols-outlined">
                              check
                            </span>
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
                            <span className="material-symbols-outlined">
                              close
                            </span>
                            Decline
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="msg-empty msg-empty-sm">
                  <div className="msg-empty-icon">
                    <span className="material-symbols-outlined">inbox</span>
                  </div>
                  <p className="msg-empty-title">You're all caught up</p>
                  <p className="msg-empty-desc">
                    New connection requests will show up here.
                  </p>
                  <button
                    type="button"
                    className="msg-btn msg-btn-outline msg-btn-sm"
                    onClick={focusSearch}
                  >
                    Find people
                  </button>
                </div>
              )}
            </section>

            {/* Recent conversations */}
            <section className="msg-card msg-section">
              <div className="msg-section-head">
                <h2 className="msg-section-title">
                  <span className="material-symbols-outlined">forum</span>
                  Recent Conversations
                </h2>
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
              ) : conversations.length > 0 ? (
                <div className="msg-convo-list">
                  {conversations.map((item) => {
                    const active = item.bookingId === selectedBookingId;
                    return (
                      <button
                        key={item.bookingId}
                        type="button"
                        className={`msg-convo${active ? " is-active" : ""}`}
                        onClick={() => {
                          setSelectedBookingId(item.bookingId);
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
                  <div className="msg-empty-icon">
                    <span className="material-symbols-outlined">chat</span>
                  </div>
                  <p className="msg-empty-title">No conversations yet</p>
                  <p className="msg-empty-desc">
                    Accepted requests turn into chats here.
                  </p>
                </div>
              )}
            </section>

            {/* Online users */}
            {onlineUsers.length > 0 && (
              <section className="msg-card msg-section">
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
                      key={item.bookingId}
                      type="button"
                      className="msg-online-user"
                      title={item.title}
                      onClick={() => {
                        setSelectedBookingId(item.bookingId);
                        setSidebarOpen(false);
                      }}
                    >
                      <Avatar name={item.title} online size={40} />
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
            ) : !selectedConversation ? (
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
                      name={selectedConversation.title}
                      online={selectedConversation.online}
                      size={46}
                    />
                    <div className="msg-chat-peer-meta">
                      <p className="msg-name">{selectedConversation.title}</p>
                      <p className="msg-chat-status">
                        <span
                          className={`msg-status-dot${
                            selectedConversation.online ? " is-online" : ""
                          }`}
                        />
                        {selectedConversation.online
                          ? "Online"
                          : selectedConversation.presence}
                        {selectedConversation.role
                          ? ` · ${roleLabel(selectedConversation.role)}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="msg-chat-tools">
                    <button
                      type="button"
                      className="msg-icon-btn"
                      title="Start video call"
                      aria-label="Start video call"
                      onClick={() => notifyComingSoon("Video calls")}
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">
                        videocam
                      </span>
                    </button>
                    <button
                      type="button"
                      className="msg-icon-btn"
                      title="Start voice call"
                      aria-label="Start voice call"
                      onClick={() => notifyComingSoon("Voice calls")}
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">
                        call
                      </span>
                    </button>
                    <button
                      type="button"
                      className="msg-icon-btn"
                      title="More options"
                      aria-label="More options"
                      onClick={() => notifyComingSoon("More options")}
                    >
                      <span className="material-symbols-outlined" aria-hidden="true">
                        more_horiz
                      </span>
                    </button>
                  </div>
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
                  aria-label={`Conversation with ${selectedConversation.title}`}
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
                        {selectedConversation.title}.
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => {
                      const mine =
                        String(msg?.senderId) === String(currentUserId);
                      return (
                        <div
                          key={msg.id}
                          className={`msg-bubble-row${mine ? " mine" : ""}`}
                        >
                          {!mine && (
                            <Avatar
                              name={selectedConversation.title}
                              size={30}
                            />
                          )}
                          <div className="msg-bubble-group">
                            <div className="msg-bubble">{msg.content}</div>
                            <div className="msg-bubble-meta">
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
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {isTyping ? (
                    <div className="msg-bubble-row">
                      <Avatar name={selectedConversation.title} size={30} />
                      <div
                        className="msg-typing"
                        role="status"
                        aria-live="polite"
                        aria-label={`${selectedConversation.title} is typing`}
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
                    <span className="material-symbols-outlined" aria-hidden="true">
                      attach_file
                    </span>
                  </button>
                  <input
                    type="text"
                    className="msg-composer-input"
                    value={chatInput}
                    onChange={handleChatInputChange}
                    placeholder="Write a message…"
                    aria-label="Write a message"
                  />
                  <button
                    type="button"
                    className="msg-icon-btn"
                    title="Add emoji"
                    aria-label="Add emoji"
                    onClick={() => notifyComingSoon("Emoji picker")}
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
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
        </div>
      </div>
    </main>
  );
}
