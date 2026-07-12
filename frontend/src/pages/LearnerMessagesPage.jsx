import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import "./LearnerPages.css";

/* ───────────── helpers ───────────── */

const RECONNECT_MAX_ATTEMPTS = 5;

function unwrap(payload) {
  if (payload && typeof payload === "object" && "data" in payload && "message" in payload) return payload.data;
  return payload;
}
async function apiGet(path, cfg) { const r = await client.get(path, cfg); return unwrap(r.data); }
async function apiPost(path, body, cfg) { const r = await client.post(path, body, cfg); return unwrap(r.data); }
async function apiPut(path, cfg) { const r = await client.put(path, cfg); return unwrap(r.data); }

function fmtTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function fmtDay(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const s = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (t === s) return "Today";
  if (t === s - 86400000) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "2-digit" });
}

function groupMessages(msgs) {
  const days = [];
  let cd = null, cr = null;
  msgs.forEach((m) => {
    const dl = fmtDay(m.createdAt);
    if (!cd || cd.label !== dl) { cd = { label: dl, runs: [] }; days.push(cd); cr = null; }
    const sk = String(m.senderRole || "").toUpperCase();
    if (!cr || cr.sk !== sk) { cr = { sk, msgs: [] }; cd.runs.push(cr); }
    cr.msgs.push(m);
  });
  return days;
}

function initials(val) {
  return String(val || "?")
    .split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

/* ───────────── Normalize conversations ───────────── */

function normalizeBookingConv(c) {
  return {
    id: `booking-${c.bookingId}`,
    kind: "booking",
    bookingId: c.bookingId,
    participantName: c.participantName || "Mentor",
    participantAvatarUrl: c.participantProfileImageUrl || c.participantAvatarUrl,
    participantOnline: Boolean(c.participantOnline),
    participantPresenceText: c.participantPresenceText || "Offline",
    participantId: c.participantId,
    sessionTitle: c.sessionTitle || "",
    lastMessagePreview: c.lastMessagePreview || "",
    lastMessageTime: c.lastMessageAt || "",
    unreadCount: Number(c.unreadCount || 0),
  };
}

function normalizeDirectConv(c) {
  return {
    id: `direct-${c.conversationId}`,
    kind: "direct",
    conversationId: c.conversationId,
    bookingId: c.conversationId,
    participantName: c.participantName || "Mentor",
    participantAvatarUrl: c.participantProfileImageUrl || c.participantAvatarUrl,
    participantOnline: Boolean(c.participantOnline),
    participantPresenceText: c.participantPresenceText || "Offline",
    participantId: c.participantId,
    sessionTitle: "",
    lastMessagePreview: c.lastMessagePreview || "",
    lastMessageTime: c.lastMessageAt || "",
    unreadCount: Number(c.unreadCount || 0),
  };
}

/* ───────────── main ───────────── */

export default function LearnerMessagesPage({ profile }) {
  const location = useLocation();
  const { conversationId: urlConversationId } = useParams();
  const navState = location.state || {};
  const navigate = useNavigate();

  const [refreshKey, setRefreshKey] = useState(0);
  const [selId, setSelId] = useState(null);
  const [selKind, setSelKind] = useState(null); // "booking" | "direct"
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState("all");
  const [sending, setSending] = useState(false);
  const [pending, setPending] = useState([]);
  const [showProfile, setShowProfile] = useState(true);
  const [mobileView, setMobileView] = useState("list");
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bookingConvs, setBookingConvs] = useState([]);
  const [directConvs, setDirectConvs] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [wsState, setWsState] = useState("idle");
  const [fetchingDirectConv, setFetchingDirectConv] = useState(false);
  const threadRef = useRef(null);
  const wsRef = useRef(null);
  const stopReconnectRef = useRef(false);
  const reconnectTimerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingSeenTimeoutsRef = useRef({});
  const isMountedRef = useRef(false);

  const currentUserEmail = String(profile?.email || "").toLowerCase();
  const apiBase = import.meta.env.VITE_API_BASE_URL || "";
  const wsBase = useMemo(() => {
    if (apiBase) return apiBase.replace(/^http/, "ws");
    return `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
  }, [apiBase]);

  // ── WebSocket ──
  const closeSocket = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch { /* no-op */ }
      wsRef.current = null;
    }
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const connectWebSocket = useCallback((convId, kind, attempt = 0) => {
    if (!convId || stopReconnectRef.current) return;
    clearReconnectTimer();
    closeSocket();
    setWsState(attempt === 0 ? "connecting" : "reconnecting");

    const wsUrl = kind === "direct"
      ? `${wsBase}/ws/chat/direct?conversationId=${encodeURIComponent(convId)}`
      : `${wsBase}/ws/chat?bookingId=${encodeURIComponent(convId)}`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      if (!isMountedRef.current) return;
      setWsState("connected");
      // Send READ to mark messages as read and notify the other user in real-time
      wsRef.current.send(
        kind === "direct"
          ? JSON.stringify({ type: "READ", conversationId: Number(convId) })
          : JSON.stringify({ type: "READ", bookingId: Number(convId) })
      );
    };

    socket.onmessage = (event) => {
      if (!isMountedRef.current) return;
      try {
        const incoming = JSON.parse(event.data);
        const messageType = String(incoming?.type || "TEXT").toUpperCase();

        if (messageType === "TEXT") {
          const payload = incoming?.message || incoming;
          setThreadData((prev) => {
            if (prev.some((m) => String(m.id) === String(payload.id))) return prev;
            return [...prev, payload];
          });
          return;
        }

        if (messageType === "READ_ACK") {
          const readByEmail = String(incoming?.readByEmail || "").toLowerCase();
          if (readByEmail) {
            setThreadData((prev) =>
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
          if (!typingUserEmail || typingUserEmail === currentUserEmail) return;
          const targetId = String(incoming?.conversationId || incoming?.bookingId || "");
          if (!targetId) return;
          setTypingUsers((prev) => ({ ...prev, [targetId]: true }));
          if (typingSeenTimeoutsRef.current[targetId]) clearTimeout(typingSeenTimeoutsRef.current[targetId]);
          typingSeenTimeoutsRef.current[targetId] = setTimeout(() => {
            setTypingUsers((prev) => ({ ...prev, [targetId]: false }));
          }, 3000);
        }
      } catch { /* ignore parse errors */ }
    };

    socket.onerror = () => {
      if (!isMountedRef.current) return;
      setWsState("error");
    };

    socket.onclose = () => {
      if (!isMountedRef.current || stopReconnectRef.current) return;
      if (attempt >= RECONNECT_MAX_ATTEMPTS) {
        setWsState("closed");
        return;
      }
      setWsState("reconnecting");
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
      reconnectTimerRef.current = setTimeout(() => {
        if (!stopReconnectRef.current) connectWebSocket(convId, kind, attempt + 1);
      }, delay);
    };
  }, [clearReconnectTimer, closeSocket, currentUserEmail, wsBase]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopReconnectRef.current = true;
      clearReconnectTimer();
      closeSocket();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      Object.values(typingSeenTimeoutsRef.current).forEach((t) => clearTimeout(t));
      typingSeenTimeoutsRef.current = {};
    };
  }, [clearReconnectTimer, closeSocket]);  // ── fetch a single direct conversation by ID (for URL-based navigation) ──
  const fetchDirectConversation = useCallback(async (convId) => {
    if (!convId) return;
    setFetchingDirectConv(true);
    try {
      const detail = await apiGet(`/api/v1/chat/direct/${convId}`).catch(() => null);
      if (!detail) return;
      // Convert to our normalized format and prepend to conversations
      const normalized = normalizeDirectConv({
        conversationId: detail.conversationId,
        participantId: detail.participantId,
        participantName: detail.participantName,
        participantRole: detail.participantRole,
        participantSkills: detail.participantSkills,
        participantProfileImageUrl: detail.participantProfileImageUrl,
        participantVerified: detail.participantVerified,
        participantOnline: detail.participantOnline,
        participantPresenceText: detail.participantPresenceText,
        lastMessagePreview: "",
        lastMessageAt: null,
        unreadCount: 0,
      });
      // Add to directConvs so it appears in allConvs for selConv lookup
      setDirectConvs((prev) => {
        const exists = prev.some((c) => c.conversationId === detail.conversationId);
        return exists ? prev : [normalized, ...prev];
      });
      // Set conversation directly
      setSelId(normalized.id);
      setSelKind(normalized.kind);
      setMobileView("thread");
      // Also load messages directly from the detail
      if (detail.messages) {
        setThreadData(detail.messages);
      }
    } catch (e) {
      // Conversation fetch failed — show empty state
      console.debug("Could not fetch direct conversation:", e);
    } finally {
      setFetchingDirectConv(false);
    }
  }, []);

  // ── fetch both conversation types ──
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      apiGet("/api/v1/chat/conversations").catch(() => []),
      apiGet("/api/v1/chat/direct/conversations").catch(() => []),
    ])
      .then(([bookings, directs]) => {
        if (!active) return;
        setBookingConvs(bookings || []);
        setDirectConvs(directs || []);
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        setError(e?.message || "Failed to load conversations");
        setLoading(false);
      });
    return () => { active = false; };
  }, [refreshKey]);

  // ── merge both types into a unified list ──
  const allConvs = useMemo(() => {
    const list = [
      ...bookingConvs.map(normalizeBookingConv),
      ...directConvs.map(normalizeDirectConv),
    ];
    list.sort((a, b) => new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0));
    return list;
  }, [bookingConvs, directConvs]);

  // ── derive current selection (must be after allConvs) ──
  const selConv = useMemo(() => {
    if (!selId) return null;
    return allConvs.find((c) => c.id === selId) || null;
  }, [selId, allConvs]);

  // ── auto-select: URL param > nav state > first conv ──
  useEffect(() => {
    if (selId) return;
    
    // Priority 1: URL param (most reliable, survives refresh)
    if (urlConversationId) {
      const parsedId = Number(urlConversationId);
      if (!Number.isNaN(parsedId)) {
        const found = allConvs.find(
          (c) => c.kind === "direct" && c.conversationId === parsedId
        );
        if (found) {
          setSelId(found.id);
          setSelKind(found.kind);
          setMobileView("thread");
          return;
        }
        // Conversation not loaded yet — check if we need to fetch it directly
        fetchDirectConversation(parsedId);
        return;
      }
    }
    
    // Priority 2: location state (legacy support)
    if (navState.directConversationId) {
      const found = allConvs.find(
        (c) => c.kind === "direct" && c.conversationId === navState.directConversationId
      );
      if (found) {
        setSelId(found.id);
        setSelKind(found.kind);
        setMobileView("thread");
        return;
      }
    }
    
    // Priority 3: first conversation
    if (allConvs.length) {
      setSelId(allConvs[0].id);
      setSelKind(allConvs[0].kind);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allConvs.length, urlConversationId, navState.directConversationId]);

  const filteredConvs = useMemo(() => {
    let list = allConvs;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.participantName?.toLowerCase().includes(q));
    }
    if (filterMode === "unread") list = list.filter((c) => c.unreadCount > 0);
    return list;
  }, [allConvs, search, filterMode]);

  const totalUnread = useMemo(() => allConvs.reduce((s, c) => s + c.unreadCount, 0), [allConvs]);

  // ── fetch thread ──
  const [threadData, setThreadData] = useState([]);
  const [threadLoading, setThreadLoading] = useState(false);

  useEffect(() => {
    if (!selConv) { setThreadData([]); return; }
    let active = true;
    setThreadLoading(true);
    setThreadData([]);
    stopReconnectRef.current = false;

    const loadThread = async () => {
      if (selConv.kind === "booking") {
        await apiPut(`/api/v1/chat/booking/${selConv.bookingId}/read`).catch(() => null);
        const msgs = await apiGet(`/api/v1/chat/booking/${selConv.bookingId}`).catch(() => []);
        if (!active) return;
        setThreadData(msgs || []);
      } else {
        const msgs = await apiGet(`/api/v1/chat/direct/${selConv.conversationId}/messages`).catch(() => []);
        if (!active) return;
        setThreadData(msgs || []);
      }
      if (active) setThreadLoading(false);
    };

    loadThread();

    // Connect WebSocket for real-time
    const convId = selConv.kind === "direct" ? selConv.conversationId : selConv.bookingId;
    connectWebSocket(convId, selConv.kind);

    return () => {
      active = false;
      stopReconnectRef.current = true;
      clearReconnectTimer();
      closeSocket();
      setTypingUsers((prev) => ({ ...prev, [convId]: false }));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId, refreshKey]);

  const allMessages = useMemo(() => {
    const opt = pending.filter((p) => p.bookingId === selId);
    return [...(threadData || []), ...opt];
  }, [threadData, pending, selId]);

  const messageDays = useMemo(() => groupMessages(allMessages), [allMessages]);

  const isTyping = Boolean(selConv && typingUsers[String(
    selConv.kind === "direct" ? selConv.conversationId : selConv.bookingId
  )]);

  // ── scroll ──
  const scrollDown = useCallback(() => {
    const el = threadRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (messageDays.length) scrollDown();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageDays.length, selId]);

  function onThreadScroll() {
    const el = threadRef.current;
    if (!el) return;
    setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 200);
  }

  // ── send ──
  async function sendMsg(e) {
    e.preventDefault();
    const content = draft.trim();
    if (!selConv || !content || sending) return;
    const tid = `p-${selId}-${allMessages.length}`;
    setPending((l) => [...l, { id: tid, bookingId: selId, content, senderRole: "LEARNER", createdAt: new Date().toISOString(), pending: true }]);
    setDraft("");
    setSending(true);
    setTimeout(() => scrollDown(), 50);
    try {
      if (selConv.kind === "booking") {
        await apiPost(`/api/v1/chat/booking/${selConv.bookingId}`, { content });
      } else {
        await apiPost(`/api/v1/chat/direct/${selConv.conversationId}/messages`, { content });
      }
      setPending((l) => l.filter((p) => p.id !== tid));
      setRefreshKey((k) => k + 1);
    } catch { setPending((l) => l.map((p) => (p.id === tid ? { ...p, failed: true, pending: false } : p))); }
    finally { setSending(false); }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(e); }
    // Send WebSocket typing indicator
    if (!selConv || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (typingTimeoutRef.current) return;
    const convId = selConv.kind === "direct" ? selConv.conversationId : selConv.bookingId;
    if (!convId) return;
    const typingPayload = selConv.kind === "direct"
      ? { type: "TYPING", conversationId: Number(convId), typingUserEmail: currentUserEmail }
      : { type: "TYPING", bookingId: Number(convId), typingUserEmail: currentUserEmail };
    wsRef.current.send(JSON.stringify(typingPayload));
    typingTimeoutRef.current = setTimeout(() => { typingTimeoutRef.current = null; }, 2000);
  }

  function selectConv(conv) {
    setSelId(conv.id);
    setSelKind(conv.kind);
    setMobileView("thread");
    if (conv.kind === "direct") {
      navigate(`/learner/messages/${conv.conversationId}`, { replace: true });
    }
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="ms-shell">
        <div className="ms-skel">
          <div className="ms-skel-panel">
            {[1,2,3,4].map((k) => <div key={k} className="ms-skel-row"><div className="ms-skel-av" /><div className="ms-skel-lines"><div className="ms-skel-l" /><div className="ms-skel-l ms-skel-l--60" /></div></div>)}
          </div>
          <div className="ms-skel-panel ms-skel-panel--chat">
            <div className="ms-skel-hdr"><div className="ms-skel-av" /><div className="ms-skel-l ms-skel-l--40" /></div>
            <div className="ms-skel-body">{[1,2,3].map((k) => <div key={k} className="ms-skel-bubble" />)}</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ms-shell">
        <div className="ms-error">
          <span className="ms-error__icon"><Icon name="error" /></span>
          <h3>Messages could not be loaded</h3>
          <p>{error}</p>
          <button type="button" className="ms-btn ms-btn--primary" onClick={() => setRefreshKey((k) => k + 1)}>
            <Icon name="refresh" /> Retry
          </button>
        </div>
      </div>
    );
  }

  /* ── Empty state (only if no URL param and no conversations) ── */
  if (!allConvs.length && !urlConversationId && !fetchingDirectConv) {
    return (
      <div className="ms-shell">
        <div className="ms-empty">
          <div className="ms-empty__icon">
            <Icon name="forum" />
          </div>
          <h2 className="ms-empty__title">Start your first conversation</h2>
          <p className="ms-empty__desc">
            Choose a mentor and send your first message to get started.
          </p>
          <div className="ms-empty__actions">
            <Link to="/learner/mentors" className="ms-btn ms-btn--primary">
              <Icon name="person_search" /> Browse Mentors
            </Link>
            <Link to="/learner/skills" className="ms-btn ms-btn--outline">
              <Icon name="auto_stories" /> Explore Skills
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ms-shell">
      <div className={`ms-layout ms-mobile-${mobileView}`}>
        {/* ═══ LEFT: Conversation List ═══ */}
        <aside className="ms-list">
          <div className="ms-list__head">
            <div className="ms-list__top">
              <h2 className="ms-list__title">Messages</h2>
              {totalUnread > 0 && <span className="ms-badge">{totalUnread}</span>}
            </div>
            <label className="ms-search">
              <Icon name="search" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations…" />
              {search && <button type="button" className="ms-search__clr" onClick={() => setSearch("")}><Icon name="close" /></button>}
            </label>
            <div className="ms-list__pills">
              <button type="button" className={`ms-list__pill${filterMode === "all" ? " is-active" : ""}`} onClick={() => setFilterMode("all")}>
                All {!!allConvs.length && <span>{allConvs.length}</span>}
              </button>
              <button type="button" className={`ms-list__pill${filterMode === "unread" ? " is-active" : ""}`} onClick={() => setFilterMode("unread")}>
                Unread {totalUnread > 0 && <span>{totalUnread}</span>}
              </button>
            </div>
          </div>
          <div className="ms-list__items">
            {filteredConvs.length > 0 ? filteredConvs.map((c) => (
              <button key={c.id} type="button" className={`ms-conv${selId === c.id ? " is-active" : ""}${c.unreadCount ? " has-unread" : ""}`} onClick={() => selectConv(c)}>
                <div className="ms-conv__av-wrap">
                  {c.participantAvatarUrl ? <img className="ms-conv__av" src={c.participantAvatarUrl} alt={c.participantName} /> : <span className="ms-conv__av ms-conv__av--fallback">{initials(c.participantName)}</span>}
                  <span className={`ms-conv__dot${c.participantOnline ? " is-online" : ""}`} />
                </div>
                <div className="ms-conv__body">
                  <div className="ms-conv__top">
                    <strong>{c.participantName}</strong>
                    <span className="ms-conv__time">{c.lastMessageTime ? fmtTime(c.lastMessageTime) : ""}</span>
                  </div>
                  <div className="ms-conv__bottom">
                    <span className="ms-conv__preview">{c.lastMessagePreview || (c.kind === "direct" ? "Direct conversation" : c.sessionTitle) || "No messages yet"}</span>
                    {c.unreadCount > 0 && <span className="ms-conv__unread">{c.unreadCount}</span>}
                  </div>
                  {c.kind !== "direct" && c.sessionTitle && <span className="ms-conv__topic">{c.sessionTitle}</span>}
                </div>
              </button>
            )) : (
              <div className="ms-list__empty">
                <Icon name="search_off" />
                <p>{search ? `No conversations match "${search}"` : "No unread conversations"}</p>
              </div>
            )}
          </div>
        </aside>

        {/* ═══ CENTER: Chat Thread ═══ */}
        <main className="ms-chat">
          {selConv ? (
            <>
              {/* Header */}
              <div className="ms-chat__hdr">
                <button type="button" className="ms-chat__back" onClick={() => setMobileView("list")}>
                  <Icon name="arrow_back" />
                </button>
                <div className="ms-chat__hdr-avatar">
                  {selConv.participantAvatarUrl ? <img src={selConv.participantAvatarUrl} alt={selConv.participantName} /> : <span>{initials(selConv.participantName)}</span>}
                  <span className={`ms-chat__hdr-dot${selConv.participantOnline ? " is-online" : ""}`} />
                </div>
                <div className="ms-chat__hdr-info">
                  <strong>{selConv.participantName}</strong>
                  <span>
                    {wsState === "reconnecting" ? "Reconnecting…" :
                     wsState === "closed" ? "Connection lost" :
                     selConv.participantOnline ? "Online now" :
                     selConv.participantPresenceText || "Offline"}
                  </span>
                </div>
                <div className="ms-chat__hdr-actions">
                  <button type="button" className="ms-icon-btn" title="Video call"><Icon name="videocam" /></button>
                  <button type="button" className="ms-icon-btn" title="Voice call"><Icon name="call" /></button>
                  <button type="button" className={`ms-icon-btn${showProfile ? " is-active" : ""}`} title="Info" onClick={() => setShowProfile((v) => !v)}>
                    <Icon name="info" />
                  </button>
                </div>
              </div>

              {/* Thread */}
              <div className="ms-chat__thread" ref={threadRef} onScroll={onThreadScroll}>
                {messageDays.length > 0 ? messageDays.map((day) => (
                  <div key={day.label} className="ms-chat__day">
                    <div className="ms-chat__divider"><span>{day.label}</span></div>
                    {day.runs.map((run, ri) => {
                      const fromMe = run.sk === "LEARNER";
                      return (
                        <div key={ri} className={`ms-chat__run${fromMe ? " is-me" : ""}`}>
                          {!fromMe && (
                            <span className="ms-chat__run-av">
                              {selConv.participantAvatarUrl ? <img src={selConv.participantAvatarUrl} alt="" /> : initials(selConv.participantName)}
                            </span>
                          )}
                          <div className="ms-chat__stack">
                            {run.msgs.map((m, mi) => (
                              <div key={m.id || mi} className={`ms-msg${fromMe ? " is-me" : ""}${m.pending ? " is-pending" : ""}${m.failed ? " is-failed" : ""}`}>
                                <p>{m.content}</p>
                                {mi === run.msgs.length - 1 && (
                                  <span className="ms-msg__meta">
                                    {m.failed ? <span className="ms-msg__fail"><Icon name="error" /> Not sent</span> : (
                                      <>{fmtTime(m.createdAt)}{fromMe && <Icon name={m.pending ? "schedule" : "done_all"} />}</>
                                    )}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )) : (
                  !threadLoading && (
                    <div className="ms-chat__empty-state">
                      <Icon name="chat" />
                      <p>Say hello to start the conversation 👋</p>
                    </div>
                  )
                )}
                {isTyping && (
                  <div className="ms-chat__run">
                    <span className="ms-chat__run-av">
                      {selConv.participantAvatarUrl ? <img src={selConv.participantAvatarUrl} alt="" /> : initials(selConv.participantName)}
                    </span>
                    <div className="ms-typing" role="status" aria-live="polite" aria-label={`${selConv.participantName} is typing`}>
                      <span /><span /><span />
                    </div>
                  </div>
                )}
                {showScrollDown && <button type="button" className="ms-scroll-down" onClick={scrollDown}><Icon name="keyboard_arrow_down" /></button>}
              </div>

              {/* Composer */}
              <form className="ms-composer" onSubmit={sendMsg}>
                <button type="button" className="ms-icon-btn" title="Attach"><Icon name="attach_file" /></button>
                <div className="ms-composer__input-wrap">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Write a message…"
                  />
                </div>
                <button type="button" className="ms-icon-btn" title="Emoji"><Icon name="mood" /></button>
                {draft.trim() ? (
                  <button type="submit" className="ms-btn ms-btn--primary ms-btn--sm" disabled={sending}>
                    <Icon name="send" /> {sending ? "Sending…" : "Send"}
                  </button>
                ) : (
                  <button type="button" className="ms-icon-btn" title="Voice"><Icon name="mic" /></button>
                )}
              </form>
            </>
          ) : (
            <div className="ms-chat__placeholder">
              <Icon name="forum" />
              <h3>Select a conversation</h3>
              <p>Choose a conversation from the left panel to start chatting.</p>
            </div>
          )}
        </main>

        {/* ═══ RIGHT: Info Panel ═══ */}
        {showProfile && selConv && (
          <aside className="ms-profile">
            <div className="ms-profile__card">
              <div className="ms-profile__avatar">
                {selConv.participantAvatarUrl ? <img src={selConv.participantAvatarUrl} alt={selConv.participantName} /> : <span>{initials(selConv.participantName)}</span>}
                <span className={`ms-profile__dot${selConv.participantOnline ? " is-online" : ""}`} />
              </div>
              <h3>{selConv.participantName}</h3>
              <span className="ms-profile__status">{selConv.participantOnline ? "Online" : "Offline"}</span>
              {selConv.participantId && (
                <Link to={`/mentors/${selConv.participantId}`} className="ms-btn ms-btn--outline ms-btn--sm" style={{ width: "100%" }}>
                  <Icon name="person" /> View Profile
                </Link>
              )}
            </div>
            <div className="ms-profile__section">
              <h4><Icon name="calendar_month" /> Sessions</h4>
              <p className="ms-profile__empty">{selConv.kind === "direct" ? "Direct conversation — no sessions yet." : "Upcoming sessions will appear here."}</p>
            </div>
            <div className="ms-profile__section">
              <h4><Icon name="folder" /> Shared Files</h4>
              <p className="ms-profile__empty">No files shared yet.</p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
