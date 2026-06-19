import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import client from "../api/client";
import { getErrorFeedback } from "../utils/comingSoon";

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

const getCounterParty = (booking, currentUserId) => {
  const mentor = booking?.session?.mentor;
  const learner = booking?.learner;
  if (mentor?.id === currentUserId) {
    return learner || null;
  }
  return mentor || learner || null;
};

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
  const [typingUsers, setTypingUsers] = useState({});

  const wsRef = useRef(null);
  const isMountedRef = useRef(false);
  const stopReconnectRef = useRef(false);
  const reconnectTimerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingSeenTimeoutsRef = useRef({});

  const currentUserId = profile?.id;
  const currentUserEmail = String(profile?.email || "").toLowerCase();
  const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";
  const wsBase = useMemo(() => apiBase.replace(/^http/, "ws"), [apiBase]);

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.bookingId === selectedBookingId) || null,
    [conversations, selectedBookingId],
  );

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
    if (!bookingId || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }
    wsRef.current.send(
      JSON.stringify({
        type: "READ",
        bookingId: Number(bookingId),
      }),
    );
  }, []);

  const connectWebSocket = useCallback((bookingId) => {
    if (!bookingId || stopReconnectRef.current) {
      return;
    }

    clearReconnectTimer();
    closeSocket();
    setWsState(wsReconnectAttempt === 0 ? "connecting" : "reconnecting");

    const socket = new WebSocket(`${wsBase}/ws/chat?bookingId=${encodeURIComponent(bookingId)}`);
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
          const readByEmail = String(incoming?.readByEmail || "").toLowerCase();
          if (readByEmail) {
            setMessages((prev) =>
              prev.map((msg) => {
                const mine = String(msg?.senderEmail || "").toLowerCase() === currentUserEmail;
                return mine ? { ...msg, readByRecipient: true } : msg;
              }),
            );
          }
          return;
        }

        if (messageType === "TYPING") {
          const typingUserEmail = String(incoming?.typingUserEmail || "").toLowerCase();
          const targetBookingId = String(incoming?.bookingId || "");
          if (!typingUserEmail || typingUserEmail === currentUserEmail || !targetBookingId) {
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
  }, [clearReconnectTimer, closeSocket, currentUserEmail, sendReadMessage, wsBase, wsReconnectAttempt]);

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
    let cancelled = false;
    const loadConversations = async () => {
      setLoadingConversations(true);
      try {
        const response = await client.get("/api/v1/bookings");
        if (cancelled) {
          return;
        }
        const rows = (response?.data?.data || []).map((booking) => {
          const counterParty = getCounterParty(booking, currentUserId);
          return {
            bookingId: String(booking.id),
            booking,
            counterParty,
            title: String(counterParty?.fullName || "SkillSwap Member"),
          };
        });
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
  }, [currentUserId]);

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
        const response = await client.get(`/api/v1/chat/booking/${selectedBookingId}`);
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
  }, [clearReconnectTimer, closeSocket, connectWebSocket, profile?.id, selectedBookingId]);

  const handleChatInputChange = (event) => {
    const nextValue = event.target.value;
    setChatInput(nextValue);

    if (!selectedBookingId || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
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
      const response = await client.post(`/api/v1/chat/booking/${selectedBookingId}`, { content });
      const created = response?.data?.data;
      if (created) {
        setMessages((prev) => [...prev, created]);
      }
      setChatInput("");
      notify?.({ type: "success", title: "Message sent", message: "Your message was delivered." });
    } catch {
      setErrorText(getErrorFeedback("messageSendFailed").message);
    }
  };

  const isTyping = Boolean(typingUsers[String(selectedBookingId)]);

  return (
    <div className="messages-page">
      <div className="messages-layout" style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>
        <aside>
          <h2>Conversations</h2>
          {loadingConversations ? (
            <p>Loading conversations...</p>
          ) : conversations.length === 0 ? (
            <p>No conversations found.</p>
          ) : (
            conversations.map((item) => (
              <button
                key={item.bookingId}
                type="button"
                onClick={() => setSelectedBookingId(item.bookingId)}
                style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 8 }}
              >
                {item.title}
              </button>
            ))
          )}
        </aside>

        <section>
          {wsState === "reconnecting" && (
            <div style={{ marginBottom: 8, padding: 8, background: "#fff7d1", border: "1px solid #f0d98c" }}>
              <span style={{ marginRight: 8 }} className="material-symbols-outlined">progress_activity</span>
              Reconnecting...
            </div>
          )}

          {!selectedBookingId ? (
            <p>Select a conversation to start chatting.</p>
          ) : (
            <>
              <div style={{ minHeight: 320, maxHeight: 420, overflowY: "auto", border: "1px solid #e2e8f0", padding: 12 }}>
                {loadingMessages ? (
                  <p>Loading messages...</p>
                ) : messages.length === 0 ? (
                  <p>No messages yet.</p>
                ) : (
                  messages.map((msg) => {
                    const mine = String(msg?.senderId) === String(currentUserId);
                    return (
                      <div key={msg.id} style={{ marginBottom: 10, textAlign: mine ? "right" : "left" }}>
                        <div style={{ display: "inline-block", padding: 8, background: mine ? "#d1fae5" : "#f1f5f9", borderRadius: 8 }}>
                          {msg.content}
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                          {formatMessageTime(msg.createdAt)}
                          {mine && msg.readByRecipient ? <span style={{ marginLeft: 6 }}>✓✓</span> : null}
                        </div>
                      </div>
                    );
                  })
                )}

                {isTyping ? (
                  <p style={{ fontSize: 12, color: "#64748b", marginTop: 8 }}>... is typing</p>
                ) : null}
              </div>

              <form onSubmit={handleSendMessage} style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={handleChatInputChange}
                  placeholder="Write a message"
                  style={{ flex: 1, padding: 8 }}
                />
                <button type="submit">Send</button>
              </form>
            </>
          )}

          {errorText ? <p style={{ color: "#dc2626", marginTop: 8 }}>{errorText}</p> : null}
        </section>
      </div>
    </div>
  );
}
