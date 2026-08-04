import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const RECONNECT_MAX_ATTEMPTS = 5;
const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 10000;

/**
 * Realtime chat socket for a booking or direct conversation.
 *
 * Exposes `wsState` ("idle"|"connecting"|"connected"|"reconnecting"|"closed"|"error")
 * and a stable `socket` object (readyState + send) so callers can push
 * TYPING / READ frames and receive TEXT / READ_ACK / TYPING / REACTION events.
 *
 * The socket is (re)created whenever `conversationId` / `kind` changes and
 * reconnects with exponential backoff until RECONNECT_MAX_ATTEMPTS.
 */
export default function useChatSocket({ conversationId, kind, currentUserEmail, wsBase }) {
  const socketRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const heartbeatTimeoutRef = useRef(null);
  const typingSeenTimersRef = useRef({});
  const mountedRef = useRef(false);

  const [wsState, setWsState] = useState("idle");
  const [typingConversationId, setTypingConversationId] = useState(null);

  const key = kind === "direct" ? `direct-${conversationId}` : `booking-${conversationId}`;

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

  const close = useCallback(() => {
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch {
        // no-op
      }
      socketRef.current = null;
    }
    stopHeartbeat();
  }, [stopHeartbeat]);

  const connect = useCallback(() => {
    if (!conversationId || !mountedRef.current) {
      return;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    close();

    const attempt = reconnectAttemptRef.current;
    setWsState(attempt === 0 ? "connecting" : "reconnecting");

    const wsUrl =
      kind === "direct"
        ? `${wsBase}/ws/chat/direct?conversationId=${encodeURIComponent(conversationId)}`
        : `${wsBase}/ws/chat?bookingId=${encodeURIComponent(conversationId)}`;

    let socket;
    try {
      socket = new WebSocket(wsUrl);
    } catch {
      setWsState("error");
      return;
    }
    socketRef.current = socket;

    socket.onopen = () => {
      if (!mountedRef.current) return;
      setWsState("connected");
      reconnectAttemptRef.current = 0;
      stopHeartbeat();
      heartbeatIntervalRef.current = setInterval(() => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ type: "PING" }));
          if (heartbeatTimeoutRef.current) clearTimeout(heartbeatTimeoutRef.current);
          heartbeatTimeoutRef.current = setTimeout(() => {
            if (socketRef.current && mountedRef.current) {
              socketRef.current.close();
            }
          }, HEARTBEAT_TIMEOUT);
        }
      }, HEARTBEAT_INTERVAL);

      // Mark existing messages as read once connected.
      const readFrame =
        kind === "direct"
          ? { type: "READ", conversationId: Number(conversationId) }
          : { type: "READ", bookingId: Number(conversationId) };
      socket.send(JSON.stringify(readFrame));
    };

    socket.onmessage = (event) => {
      if (!mountedRef.current) return;
      let incoming;
      try {
        incoming = JSON.parse(event.data);
      } catch {
        return;
      }
      const type = String(incoming?.type || "").toUpperCase();
      if (type === "PONG") {
        if (heartbeatTimeoutRef.current) {
          clearTimeout(heartbeatTimeoutRef.current);
          heartbeatTimeoutRef.current = null;
        }
        return;
      }
      if (type === "TEXT") {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("msg:incoming", {
              detail: { message: incoming?.message || incoming, conversationId: Number(conversationId) },
            }),
          );
        }
        return;
      }
      if (type === "READ_ACK") {
        const readByEmail = String(incoming?.readByEmail || "").toLowerCase();
        if (readByEmail && readByEmail !== String(currentUserEmail || "").toLowerCase()) {
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("msg:readack", {
                detail: { readByEmail, conversationId: Number(conversationId) },
              }),
            );
          }
        }
        return;
      }
      if (type === "TYPING") {
        const typingEmail = String(incoming?.typingUserEmail || "").toLowerCase();
        if (!typingEmail || typingEmail === String(currentUserEmail || "").toLowerCase()) return;
        const targetId = String(incoming?.conversationId || incoming?.bookingId || "");
        if (!targetId) return;
        setTypingConversationId(targetId);
        if (typingSeenTimersRef.current[targetId]) clearTimeout(typingSeenTimersRef.current[targetId]);
        typingSeenTimersRef.current[targetId] = setTimeout(() => {
          setTypingConversationId((prev) => (prev === targetId ? null : prev));
        }, 3000);
        return;
      }
      if (type === "REACTION") {
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("msg:reaction", {
              detail: { message: incoming?.message || incoming, conversationId: Number(conversationId) },
            }),
          );
        }
      }
    };

    socket.onerror = () => {
      if (mountedRef.current) setWsState("error");
    };

    socket.onclose = () => {
      stopHeartbeat();
      if (!mountedRef.current) return;
      if (reconnectAttemptRef.current >= RECONNECT_MAX_ATTEMPTS) {
        setWsState("closed");
        return;
      }
      setWsState("reconnecting");
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000);
      reconnectAttemptRef.current += 1;
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connect();
      }, delay);
    };
  }, [close, conversationId, currentUserEmail, kind, stopHeartbeat, wsBase]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      Object.values(typingSeenTimersRef.current).forEach((t) => clearTimeout(t));
      typingSeenTimersRef.current = {};
      close();
    };
  }, [close]);

  useEffect(() => {
    reconnectAttemptRef.current = 0;
    setWsState("idle");
    if (conversationId) connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const sendTyping = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN || !conversationId) return;
    const frame =
      kind === "direct"
        ? { type: "TYPING", conversationId: Number(conversationId), typingUserEmail: currentUserEmail }
        : { type: "TYPING", bookingId: Number(conversationId), typingUserEmail: currentUserEmail };
    socket.send(JSON.stringify(frame));
  }, [conversationId, currentUserEmail, kind]);

  const socket = useMemo(
    () => ({
      get readyState() {
        return socketRef.current ? socketRef.current.readyState : WebSocket.CLOSED;
      },
      send: (payload) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(typeof payload === "string" ? payload : JSON.stringify(payload));
        }
      },
    }),
    [],
  );

  return { wsState, socket, sendTyping, typingConversationId };
}
