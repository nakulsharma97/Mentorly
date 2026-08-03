import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import "./LearnerPages.css";
import "../modules/mentor/mentor-pages.css";

/* ───────────── helpers ───────────── */

const RECONNECT_MAX_ATTEMPTS = 5;

// Empty WebVTT captions track for user-uploaded voice/audio clips (no transcript
// is available). Minimal valid WebVTT signature — satisfies the media-has-caption
// a11y requirement without inventing content.
const EMPTY_CAPTIONS_TRACK = "data:text/vtt,WEBVTT%0A";

function unwrap(payload) {
  if (payload && typeof payload === "object" && "data" in payload && "message" in payload) return payload.data;
  return payload;
}
async function apiGet(path, cfg) { const r = await client.get(path, cfg); return unwrap(r.data); }
async function apiPost(path, body, cfg) { const r = await client.post(path, body, cfg); return unwrap(r.data); }
async function apiPut(path, cfg) { const r = await client.put(path, cfg); return unwrap(r.data); }

function fmtTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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

function groupMessages(msgs, currentUserId) {
  const days = [];
  let cd = null, cr = null;
  msgs.forEach((m) => {
    const dl = fmtDay(m.createdAt);
    if (!cd || cd.label !== dl) { cd = { label: dl, runs: [] }; days.push(cd); cr = null; }
    const mine = String(m.senderId) === String(currentUserId);
    const rk = mine ? "me" : `peer-${m.senderId ?? "?"}`;
    if (!cr || cr.rk !== rk) { cr = { rk, mine, msgs: [] }; cd.runs.push(cr); }
    cr.msgs.push(m);
  });
  return days;
}

function initials(val) {
  return String(val || "?")
    .split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
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
    participantEmail: c.participantEmail || "",
    sessionTitle: "",
    lastMessagePreview: c.lastMessagePreview || "",
    lastMessageTime: c.lastMessageAt || "",
    unreadCount: Number(c.unreadCount || 0),
  };
}

/* ── Copy/Delete message bubble ── */
function MessageContent({ content }) {
  if (!content) return null;
  // Check if this is a file message: "📎 filename\nurl"
  if (content.startsWith('📎 ')) {
    const lines = content.split('\n');
    const filename = lines[0].replace('📎 ', '');
    const fileUrl = lines.slice(1).join('\n').trim();
    if (fileUrl) {
      const isAudio = /voice|audio|\.(webm|mp3|wav|ogg|m4a)/i.test(filename);
      const isImage = /\.(jpg|jpeg|png|gif|svg|webp|bmp)/i.test(filename) || /image/i.test(filename);
      return (
        <div className="ms-msg-file">
          <span className="ms-msg-file-icon"><Icon name={isAudio ? "mic" : isImage ? "image" : "attach_file"} /></span>
          <div className="ms-msg-file-info">
            <strong>{filename}</strong>
            {isAudio && (
              <audio controls src={fileUrl} style={{ width: '100%', maxWidth: 240, height: 40, marginTop: 4 }} preload="none">
                <track kind="captions" srcLang="en" src={EMPTY_CAPTIONS_TRACK} />
                Your browser does not support audio.
              </audio>
            )}
            {isImage && <img src={fileUrl} alt={filename} style={{ maxWidth: 200, maxHeight: 200, borderRadius: 8, marginTop: 4, display: 'block' }} />}
            <a href={fileUrl} target="_blank" rel="noreferrer" className="ms-msg-file-link" download={!isAudio && !isImage}>{isAudio || isImage ? 'Open' : 'Download'} <Icon name="open_in_new" /></a>
          </div>
        </div>
      );
    }
  }
  // Check if this is a voice message: "🎤 Voice message\nurl"
  if (content.startsWith('🎤 ')) {
    const lines = content.split('\n');
    const fileUrl = lines.slice(1).join('\n').trim();
    if (fileUrl) {
      return (
        <div className="ms-msg-file">
          <span className="ms-msg-file-icon"><Icon name="mic" /></span>
          <div className="ms-msg-file-info">
            <strong>Voice message</strong>
            <audio controls src={fileUrl} style={{ width: '100%', maxWidth: 240, height: 40 }} preload="none">
              <track kind="captions" srcLang="en" src={EMPTY_CAPTIONS_TRACK} />
              Your browser does not support audio.
            </audio>
          </div>
        </div>
      );
    }
  }
  // Default: plain text
  return <p>{content}</p>;
}

function MessageBubbleInline({ msg, mine, isLast, pending, failed, fmtTime, onCopy, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    <div className={`ms-msg${mine ? " is-me" : ""}${pending ? " is-pending" : ""}${failed ? " is-failed" : ""}${menuOpen ? " is-menu-open" : ""}`}>
      <div className="ms-msg__content">
        <MessageContent content={msg.content} />
        <button
          type="button"
          className="ms-msg__actions-btn"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((prev) => !prev);
          }}
          aria-label="Message actions"
          title="More actions"
        >
          <Icon name="more_horiz" />
        </button>
        {menuOpen && (
          <div className="ms-msg__menu" ref={menuRef} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="ms-msg__menu-item"
              onClick={() => {
                onCopy(msg.content);
                setMenuOpen(false);
              }}
            >
              <Icon name="content_copy" />
              Copy
            </button>
            {mine && !pending && !failed && (
              <button
                type="button"
                className="ms-msg__menu-item ms-msg__menu-item--danger"
                onClick={() => {
                  onDelete(msg);
                  setMenuOpen(false);
                }}
              >
                <Icon name="delete" />
                Delete
              </button>
            )}
          </div>
        )}
      </div>
      {isLast && (
        <span className="ms-msg__meta">
          {failed ? <span className="ms-msg__fail"><Icon name="error" /> Not sent</span> : (
            <>{fmtTime(msg.createdAt)}{mine && <Icon name={pending ? "schedule" : "done_all"} />}</>
          )}
        </span>
      )}
    </div>
  );
}


/* ───────────── main ───────────── */

export default function LearnerMessagesPage({ profile }) {
  const location = useLocation();
  const { conversationId: urlConversationId } = useParams();
  const navState = location.state || {};
  const navigate = useNavigate();

  const [refreshKey, setRefreshKey] = useState(0);
  const [selId, setSelId] = useState(null);
  const [, setSelKind] = useState(null);
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
  const [bookingsPage, setBookingsPage] = useState(0);
  const [directPage, setDirectPage] = useState(0);
  const [hasMoreBookings, setHasMoreBookings] = useState(true);
  const [hasMoreDirect, setHasMoreDirect] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const bookingConvsRef = useRef([]);
  const directConvsRef = useRef([]);
  const [bookingConvs, setBookingConvs] = useState([]);
  const [directConvs, setDirectConvs] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [wsState, setWsState] = useState("idle");
  const [fetchingDirectConv, setFetchingDirectConv] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [mentorSearch, setMentorSearch] = useState("");
  const [mentors, setMentors] = useState([]);
  const [mentorsLoading, setMentorsLoading] = useState(false);
  const [selectedMentor, setSelectedMentor] = useState(null);
  const [creatingConv, setCreatingConv] = useState(false);
  const [createError, setCreateError] = useState(null);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileError, setFileError] = useState(null);
  // Voice recording state
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordingError, setRecordingError] = useState(null);

  const threadRef = useRef(null);
  const wsRef = useRef(null);
  const stopReconnectRef = useRef(false);
  const reconnectTimerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const typingSeenTimeoutsRef = useRef({});
  const isMountedRef = useRef(false);
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const recordingChunksRef = useRef([]);

  const COMMON_EMOJIS = ['😀','😁','😂','🤣','😊','😍','🥰','😎','🤩','😢','😤','😡','🥺','🤔','🙄','👍','👎','👏','🙌','🔥','💯','💪','🎉','❤️','💔','💀','✅','❌','⭐','🌈','🍕','☕','🚀','✨','💡','📚','🎯','🏆','💼','🤝'];

  const currentUserEmail = String(profile?.email || "").toLowerCase();
  const currentUserId = profile?.id;
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
  }, [clearReconnectTimer, closeSocket]);

  // ── Load conversations with pagination ──
  function loadConversations(page) {
    const params = { page, size: 30, sort: 'lastMessageAt,desc' };
    return Promise.all([
      apiGet("/api/v1/chat/conversations", { params }).catch(() => []),
      apiGet("/api/v1/chat/direct/conversations", { params }).catch(() => []),
    ]);
  }

  // ── fetch both conversation types ──
  useEffect(() => {
    let active = true;
    setError(null);
    setLoading(true);
    // Reset pagination on full refresh
    bookingConvsRef.current = [];
    directConvsRef.current = [];
    setBookingsPage(0);
    setDirectPage(0);
    setHasMoreBookings(true);
    setHasMoreDirect(true);

    loadConversations(0)
      .then(([bookings, directs]) => {
        if (!active) return;
        const bookingList = Array.isArray(bookings) ? bookings : (bookings?.content || []);
        const directList = Array.isArray(directs) ? directs : (directs?.content || []);
        bookingConvsRef.current = bookingList;
        directConvsRef.current = directList;
        setBookingConvs(bookingList);
        setDirectConvs(directList);
        setHasMoreBookings(bookingList.length >= 30);
        setHasMoreDirect(directList.length >= 30);
        setLoading(false);
      })
      .catch((e) => {
        if (!active) return;
        setError(e?.message || "Failed to load conversations");
        setLoading(false);
      });
    return () => { active = false; };
  }, [refreshKey]);

  // ── Load more conversations ──
  async function loadMoreConversations() {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = Math.max(bookingsPage, directPage) + 1;
      const [bookings, directs] = await loadConversations(nextPage);
      const bookingList = Array.isArray(bookings) ? bookings : (bookings?.content || []);
      const directList = Array.isArray(directs) ? directs : (directs?.content || []);

      const allBookings = [...bookingConvsRef.current, ...bookingList];
      const allDirects = [...directConvsRef.current, ...directList];
      bookingConvsRef.current = allBookings;
      directConvsRef.current = allDirects;
      setBookingConvs(allBookings);
      setDirectConvs(allDirects);
      setBookingsPage(nextPage);
      setDirectPage(nextPage);
      setHasMoreBookings(bookingList.length >= 30);
      setHasMoreDirect(directList.length >= 30);
    } catch (e) {
      console.error('Failed to load more conversations:', e);
    } finally {
      setLoadingMore(false);
    }
  }

  // ── merge both types into a unified list ──
  const allConvs = useMemo(() => {
    const list = [
      ...bookingConvs.map((c) => ({
        id: `booking-${c.bookingId}`,
        kind: "booking",
        conversationId: c.bookingId,
        bookingId: c.bookingId,
        participantName: c.participantName || "Mentor",
        participantAvatarUrl: c.participantProfileImageUrl || c.participantAvatarUrl,
        participantOnline: Boolean(c.participantOnline),
        participantPresenceText: c.participantPresenceText || "Offline",
        participantId: c.participantId,
        participantEmail: c.participantEmail || "",
        sessionTitle: c.sessionTitle || "",
        lastMessagePreview: c.lastMessagePreview || "",
        lastMessageTime: c.lastMessageAt || "",
        unreadCount: Number(c.unreadCount || 0),
      })),
      ...directConvs.map(normalizeDirectConv),
    ];
    list.sort((a, b) => new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0));
    return list;
  }, [bookingConvs, directConvs]);

  // ── derive current selection ──
  const selConv = useMemo(() => {
    if (!selId) return null;
    return allConvs.find((c) => c.id === selId) || null;
  }, [selId, allConvs]);

  // ── fetch a single direct conversation by ID (for URL-based navigation) ──
  const fetchDirectConversationById = useCallback(async (convId) => {
    if (!convId) return null;
    setFetchingDirectConv(true);
    setFetchError(null);
    try {
      const detail = await apiGet(`/api/v1/chat/direct/${convId}`);
      if (!detail) return null;

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

      setDirectConvs((prev) => {
        const exists = prev.some((c) => c.conversationId === detail.conversationId);
        return exists ? prev : [normalized, ...prev];
      });

      setSelId(normalized.id);
      setSelKind(normalized.kind);
      setMobileView("thread");

      if (detail.messages) {
        setThreadData(detail.messages);
      }

      return normalized;
    } catch (e) {
      const status = e?.response?.status;
      const errMsg = e?.response?.data?.message || e?.message || "Unknown error";
      console.error("[Messages] Failed to fetch conversation:", convId, "Status:", status, "Error:", errMsg, e);
      setFetchError(`Mentor unavailable. Could not load this conversation. (${status || "network error"}: ${errMsg})`);
      return null;
    } finally {
      setFetchingDirectConv(false);
    }
  }, []);

  // ── auto-select: URL param > nav state > first conv ──
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') console.log("[Messages] auto-select effect: selId=%s urlConv=%s convs=%d", selId, urlConversationId, allConvs.length);

    // Priority 1: URL param — always process regardless of existing selection
    if (urlConversationId) {
      const parsedId = Number(urlConversationId);
      if (!Number.isNaN(parsedId)) {
        const found = allConvs.find(
          (c) => c.kind === "direct" && c.conversationId === parsedId
        );
        if (found) {
          if (process.env.NODE_ENV === 'development') console.log("[Messages] Found conversation in list, selecting:", found.id);
          setSelId(found.id);
          setSelKind(found.kind);
          setMobileView("thread");
          return;
        }
        // Conversation not loaded yet — fetch directly
        if (!fetchingDirectConv) {
          if (process.env.NODE_ENV === 'development') console.log("[Messages] Conversation not in list, fetching by ID:", parsedId);
          fetchDirectConversationById(parsedId);
        }
        return;
      }
    }

    // Don't override existing selId for lower priority cases
    if (selId) {
      if (process.env.NODE_ENV === 'development') console.log("[Messages] selId already set, skipping lower priority cases");
      return;
    }

    // Priority 2: location state
    if (navState.directConversationId) {
      const found = allConvs.find(
        (c) => c.kind === "direct" && c.conversationId === navState.directConversationId
      );
      if (found) {
        if (process.env.NODE_ENV === 'development') console.log("[Messages] Selecting from nav state:", found.id);
        setSelId(found.id);
        setSelKind(found.kind);
        setMobileView("thread");
        return;
      }
    }

    // Priority 3: first conversation
    if (allConvs.length) {
      if (process.env.NODE_ENV === 'development') console.log("[Messages] Auto-selecting first conversation:", allConvs[0].id);
      setSelId(allConvs[0].id);
      setSelKind(allConvs[0].kind);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allConvs.length, urlConversationId, navState.directConversationId]);

  // ── search & filter conversations ──
  const filteredConvs = useMemo(() => {
    let list = allConvs;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) => {
        const name = (c.participantName || "").toLowerCase();
        const email = (c.participantEmail || "").toLowerCase();
        const preview = (c.lastMessagePreview || "").toLowerCase();
        const title = (c.sessionTitle || "").toLowerCase();
        return name.includes(q) || email.includes(q) || preview.includes(q) || title.includes(q);
      });
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

    const convId = selConv.kind === "direct" ? selConv.conversationId : selConv.bookingId;

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
    const opt = pending.filter((p) => {
      if (selConv?.kind === "direct") return p.conversationId === selConv?.conversationId;
      return p.bookingId === selConv?.bookingId;
    });
    return [...(threadData || []), ...opt];
  }, [threadData, pending, selConv]);

  const messageDays = useMemo(() => groupMessages(allMessages, currentUserId), [allMessages, currentUserId]);

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

  // ── Emoji picker outside click ──
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmojiPicker]);

  // ── File upload ──
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selConv) return;
    if (file.size > 10 * 1024 * 1024) {
      setFileError('File size must be under 10 MB');
      setTimeout(() => setFileError(null), 3000);
      return;
    }
    setUploadingFile(file);
    setUploadProgress(0);
    setFileError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      // Tie the attachment to this conversation so the recipient (booking
      // learner/mentor or direct-chat participant) is authorized to view it.
      formData.append('contextType', selConv.kind === 'booking' ? 'BOOKING_CHAT' : 'DIRECT_CHAT');
      formData.append('contextId', selConv.kind === 'booking' ? selConv.bookingId : selConv.conversationId);
      const uploadRes = await apiPost('/api/v1/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (p) => {
          if (p.total) setUploadProgress(Math.round((p.loaded * 100) / p.total));
        },
      });
      const fileUrl = uploadRes?.url || '';
      if (fileUrl) {
        const endpoint = selConv.kind === 'booking'
          ? `/api/v1/chat/booking/${selConv.bookingId}`
          : `/api/v1/chat/direct/${selConv.conversationId}/messages`;
        await apiPost(endpoint, { content: `📎 ${file.name}\n${fileUrl}` });
        setRefreshKey((k) => k + 1);
      } else {
        setFileError('File upload failed: no URL returned');
        setTimeout(() => setFileError(null), 3000);
      }
    } catch (err) {
      setFileError(err?.message || 'File upload failed');
      setTimeout(() => setFileError(null), 3000);
    } finally {
      setUploadingFile(null);
      setUploadProgress(0);
      if (e.target) e.target.value = '';
    }
  };

  // ── Voice recording ──
  function startRecording() {
    setRecordingError(null);
    setRecordedBlob(null);
    setRecordingTime(0);
    recordingChunksRef.current = [];
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordingChunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
          setRecordedBlob(blob);
        };
        recorder.onerror = () => {
          setRecordingError('Recording failed. Please try again.');
          setRecording(false);
          stream.getTracks().forEach((t) => t.stop());
        };
        recorder.start(250);
        setRecording(true);
        let sec = 0;
        recordingTimerRef.current = setInterval(() => {
          sec += 1;
          setRecordingTime(sec);
          if (sec >= 300) stopRecording(); // 5 min max
        }, 1000);
      })
      .catch((err) => {
        const msg = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'Microphone access denied. Please allow microphone permissions.'
          : 'Microphone not available. Please check your device.';
        setRecordingError(msg);
        setTimeout(() => setRecordingError(null), 4000);
      });
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setRecording(false);
  }

  function cancelRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setRecording(false);
    setRecordedBlob(null);
    setRecordingTime(0);
    recordingChunksRef.current = [];
  }

  async function sendVoiceMessage() {
    if (!recordedBlob || !selConv) return;
    setSending(true);
    try {
      const formData = new FormData();
      const fileName = `voice-${Date.now()}.webm`;
      formData.append('file', recordedBlob, fileName);
      // Tie the voice clip to this conversation for recipient authorization.
      formData.append('contextType', selConv.kind === 'booking' ? 'BOOKING_CHAT' : 'DIRECT_CHAT');
      formData.append('contextId', selConv.kind === 'booking' ? selConv.bookingId : selConv.conversationId);
      const uploadRes = await apiPost('/api/v1/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const fileUrl = uploadRes?.url || '';
      if (fileUrl) {
        const endpoint = selConv.kind === 'booking'
          ? `/api/v1/chat/booking/${selConv.bookingId}`
          : `/api/v1/chat/direct/${selConv.conversationId}/messages`;
        await apiPost(endpoint, { content: `🎤 Voice message\n${fileUrl}` });
        setRefreshKey((k) => k + 1);
      }
    } catch {
      setRecordingError('Could not send voice message. Please try again.');
      setTimeout(() => setRecordingError(null), 3000);
    } finally {
      setSending(false);
      setRecordedBlob(null);
      setRecordingTime(0);
      recordingChunksRef.current = [];
    }
  }

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ── send ──
  async function sendMsg(e) {
    e.preventDefault();
    const content = draft.trim();
    if (!selConv || !content || sending) return;
    const tid = `p-${selId}-${Date.now()}`;
    setPending((l) => [...l, {
      id: tid,
      content,
      senderId: currentUserId,
      senderEmail: currentUserEmail,
      senderRole: "LEARNER",
      createdAt: new Date().toISOString(),
      pending: true,
      conversationId: selConv.conversationId,
      bookingId: selConv.bookingId,
    }]);
    setDraft("");
    setSending(true);
    setTimeout(() => scrollDown(), 50);
    try {
      let created = null;
      if (selConv.kind === "booking") {
        const r = await apiPost(`/api/v1/chat/booking/${selConv.bookingId}`, { content });
        created = r?.data || r;
      } else {
        const r = await apiPost(`/api/v1/chat/direct/${selConv.conversationId}/messages`, { content });
        created = r?.data || r;
      }
      // Remove the optimistic pending message
      setPending((l) => l.filter((p) => p.id !== tid));
      // Add the server-confirmed message directly to threadData so it
      // appears immediately. Don't use setRefreshKey — it re-fetches
      // ALL conversations and causes a hard re-mount (white flash).
      if (created && created.id) {
        setThreadData((prev) => {
          if (prev.some((m) => String(m.id) === String(created.id))) return prev;
          return [...prev, created];
        });
      }
    } catch {
      setPending((l) => l.map((p) => (p.id === tid ? { ...p, failed: true, pending: false } : p)));
    } finally {
      setSending(false);
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!recording && !recordedBlob) sendMsg(e); }
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
    // Don't navigate here — URL changes with key={routeTransitionKey} in App.jsx
    // cause the entire lazy-loaded component to unmount/remount (white flash).
    // The conversationId from useParams is only used for the initial page load.
  }

  // ── New Chat: mentor search ──
  useEffect(() => {
    if (!showNewChat) return;
    let active = true;
    setMentorsLoading(true);
    const q = mentorSearch.trim();
    apiGet("/api/v1/search/mentors", { params: q ? { q, size: 20 } : { size: 20 } })
      .then((results) => {
        if (!active) return;
        setMentors(results || []);
        setMentorsLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setMentors([]);
        setMentorsLoading(false);
      });
    return () => { active = false; };
  }, [showNewChat, mentorSearch]);

  async function handleStartConversation() {
    if (!selectedMentor) {
      // No mentor selected for new chat
      setCreateError("Please select a mentor to start a conversation.");
      return;
    }
    const mentorId = selectedMentor.mentorId || selectedMentor.id;
    if (process.env.NODE_ENV === 'development') console.log("[NewChat] Starting conversation with mentor ID:", mentorId, selectedMentor);
    setCreatingConv(true);
    setCreateError(null);
    try {
      const res = await apiPost(`/api/v1/chat/direct/${mentorId}`);
      if (process.env.NODE_ENV === 'development') console.log("[NewChat] API response:", res);
      if (res?.conversationId) {
        const newConvId = res.conversationId;
        if (process.env.NODE_ENV === 'development') console.log("[NewChat] Success! conversationId:", newConvId);
        setShowNewChat(false);
        setSelectedMentor(null);
        setMentorSearch("");
        // Reset selId so the navigation effect can pick up the new URL param
        setSelId(null);
        setSelKind(null);
        // Clear any cached thread data from previous conversation
        setThreadData([]);
        // Force refresh conversation list
        setRefreshKey((k) => k + 1);if (process.env.NODE_ENV === 'development') console.log("[NewChat] Navigating to /learner/messages/"+newConvId);
        // Navigate to the new conversation
        navigate(`/learner/messages/${newConvId}`, { replace: true });
      } else {
        console.error("[NewChat] No conversationId in response:", JSON.stringify(res));
        setCreateError("Unable to start conversation. No conversation ID returned.");
      }
    } catch (err) {
      const status = err?.response?.status;
      const errBody = err?.response?.data;
      const msg = errBody?.message || errBody?.data?.message || errBody?.data?.error || err?.message || "Unable to start conversation.";
      console.error("[NewChat] API error. Status:", status, "Body:", JSON.stringify(errBody), "Message:", err?.message);
      setCreateError(msg);
    } finally {
      setCreatingConv(false);
    }
  }

  // ── Retry loading page ──
  function handleRetry() {
    setError(null);
    setFetchError(null);
    setRefreshKey((k) => k + 1);
  }

  // ── New Chat Modal renderer ──
  function renderNewChatModal() {
    if (!showNewChat) return null;
    return (
      <div className="ms-modal-overlay" onClick={() => {
        setShowNewChat(false);
        setSelectedMentor(null);
        setMentorSearch("");
        setCreateError(null);
      }}>
        <div className="ms-modal" onClick={(e) => e.stopPropagation()}>
          <div className="ms-modal__header">
            <h3><Icon name="add_comment" /> New Conversation</h3>
            <button
              type="button"
              className="ms-modal__close"
              onClick={() => {
                setShowNewChat(false);
                setSelectedMentor(null);
                setMentorSearch("");
                setCreateError(null);
              }}
            >
              <Icon name="close" />
            </button>
          </div>
          <div className="ms-modal__body">
            <label className="ms-modal__search">
              <Icon name="search" />
              <input
                value={mentorSearch}
                onChange={(e) => setMentorSearch(e.target.value)}
                placeholder="Search mentors by name or skill…"
                ref={(el) => { if (el) el.focus(); }}
              />
              {mentorSearch && (
                <button type="button" className="ms-modal__search-clear" onClick={() => setMentorSearch("")}>
                  <Icon name="close" />
                </button>
              )}
            </label>

            {createError && (
              <div className="ms-modal__error">
                <Icon name="error" /> {createError}
              </div>
            )}

            <div className="ms-modal__mentors">
              {mentorsLoading ? (
                <div className="ms-modal__loading">
                  <span className="ms-spinner" aria-hidden="true" />
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
                      className={`ms-modal__mentor${isSelected ? " is-selected" : ""}`}
                      onClick={() => setSelectedMentor(mentor)}
                    >
                      <div className="ms-modal__mentor-av">
                        {mentor.profileImageUrl ? (
                          <img src={mentor.profileImageUrl} alt={mentorName} />
                        ) : (
                          <span>{initials(mentorName)}</span>
                        )}
                      </div>
                      <div className="ms-modal__mentor-info">
                        <strong>{mentorName}</strong>
                        <span>{mentor.mentorRole || "Mentor"}</span>
                        {(Array.isArray(mentorSkills) ? mentorSkills : String(mentorSkills || '').split(',').map(s => s.trim()).filter(Boolean)).slice(0, 3).length > 0 && (
                          <div className="ms-modal__mentor-skills">
                            {(Array.isArray(mentorSkills) ? mentorSkills : String(mentorSkills || '').split(',').map(s => s.trim()).filter(Boolean)).slice(0, 3).map((s) => (
                              <span key={s} className="ms-mini-chip">{typeof s === "string" ? s : s.name || s}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      {isSelected && <Icon name="check_circle" className="ms-modal__check" />}
                    </button>
                  );
                })
              ) : (
                <div className="ms-modal__empty">
                  <Icon name="search_off" />
                  <p>{mentorSearch ? `No mentors match "${mentorSearch}"` : "No mentors available"}</p>
                </div>
              )}
            </div>
          </div>
          <div className="ms-modal__footer">
            <button
              type="button"
              className="ms-btn ms-btn--outline"
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
              className="ms-btn ms-btn--primary"
              disabled={!selectedMentor || creatingConv}
              onClick={handleStartConversation}
            >
              {creatingConv ? "Starting…" : "Start Conversation"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 48px" }}>
        <div className="mp-settings-loading">
          <div className="mp-spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
          <p className="mp-settings-loading__text">Loading messages…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 48px" }}>
        <div className="md-empty" style={{ margin: "48px auto", maxWidth: 420 }}>
          <div className="md-empty__icon">
            <span className="material-symbols-outlined">error_outline</span>
          </div>
          <h3 className="md-empty__title">Messages could not be loaded</h3>
          <p className="md-empty__desc">{error}</p>
          <button type="button" className="mp-btn mp-btn--primary" onClick={handleRetry}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>
            Retry
          </button>
        </div>
      </div>
    );
  }

  /* ── Empty state ── */
  if (!allConvs.length && !urlConversationId && !fetchingDirectConv) {
    return (
      <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 48px" }}>
        {/* ===== Premium Hero ===== */}
        <section className="mp-hero">
          <div className="mp-hero__watermark">
            <span className="material-symbols-outlined" style={{ fontSize: 78 }}>forum</span>
          </div>
          <div className="mp-hero__content">
            <div className="mp-hero__eyebrow">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chat</span>
              MESSAGES
            </div>
            <h1>Your Messages</h1>
            <p className="mp-hero__sub">
              Connect with your mentors through direct messaging. Start a conversation and get the guidance you need.
            </p>
            <div className="mp-hero__actions">
              <button type="button" className="mp-btn mp-btn--primary" onClick={() => setShowNewChat(true)}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add_comment</span>
                New Chat
              </button>
              <Link to="/learner/mentors" className="mp-btn mp-btn--outline">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>person_search</span>
                Browse Mentors
              </Link>
            </div>
          </div>
        </section>

        {/* New Chat Modal (empty state) */}
        {renderNewChatModal()}
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
              <button
                type="button"
                className="ms-btn ms-btn--primary ms-btn--sm ms-new-chat-btn"
                onClick={() => setShowNewChat(true)}
                title="New Chat"
              >
                <Icon name="add_comment" /> New
              </button>
            </div>
            <label className="ms-search">
              <Icon name="search" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations by name, email, or message…"
              />
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
            {fetchError ? (
              <div className="ms-list__empty">
                <Icon name="error_outline" />
                <p>{fetchError}</p>
                <button type="button" className="ms-btn ms-btn--outline ms-btn--sm" onClick={handleRetry}>
                  <Icon name="refresh" /> Retry
                </button>
              </div>
                ) : filteredConvs.length > 0 ? (
                  <>
                    {filteredConvs.map((c) => (
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
                            <span className="ms-conv__preview">{c.lastMessagePreview || (c.kind === "direct" ? "No messages yet" : c.sessionTitle) || "No messages yet"}</span>
                            {c.unreadCount > 0 && <span className="ms-conv__unread">{c.unreadCount}</span>}
                          </div>
                          {c.kind !== "direct" && c.sessionTitle && <span className="ms-conv__topic">{c.sessionTitle}</span>}
                        </div>
                      </button>
                    ))}
                    {(hasMoreBookings || hasMoreDirect) && (
                      <div className="ms-list__load-more">
                        <button
                          type="button"
                          className="ms-btn ms-btn--outline ms-btn--sm"
                          onClick={loadMoreConversations}
                          disabled={loadingMore}
                        >
                          <Icon name="expand_more" />
                          {loadingMore ? "Loading..." : "Load More"}
                        </button>
                      </div>
                    )}
                  </>
                ) : (
              <div className="ms-list__empty">
                <Icon name="search_off" />
                <p>{search ? `No conversations match "${search}"` : "No conversations yet"}</p>
                {search && (
                  <button type="button" className="ms-btn ms-btn--outline ms-btn--sm" onClick={() => setSearch("")}>
                    Clear search
                  </button>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* ═══ CENTER: Chat Thread ═══ */}
        <main className="ms-chat">
          {fetchError && !selConv ? (
            <div className="ms-chat__placeholder">
              <Icon name="error_outline" />
              <h3>Could not open conversation</h3>
              <p>{fetchError}</p>
              <button type="button" className="ms-btn ms-btn--outline ms-btn--sm" onClick={handleRetry}>
                <Icon name="refresh" /> Retry
              </button>
            </div>
          ) : fetchingDirectConv ? (
            <div className="ms-chat__placeholder">
              <span className="ms-spinner" aria-hidden="true" />
              <h3>Loading conversation…</h3>
            </div>
          ) : selConv ? (
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
                    {selConv.kind !== "direct" && selConv.sessionTitle ? ` ${selConv.sessionTitle} · ` : ""}
                    {wsState === "reconnecting" ? "Reconnecting…" :
                     wsState === "closed" ? "Connection lost" :
                     selConv.participantOnline ? "Online now" :
                     selConv.participantPresenceText || "Offline"}
                  </span>
                </div>
                <div className="ms-chat__hdr-actions">
                  <button type="button" className={`ms-icon-btn${showProfile ? " is-active" : ""}`} title="Info" onClick={() => setShowProfile((v) => !v)}>
                    <Icon name="info" />
                  </button>
                </div>
              </div>

              {/* Thread */}
              <div className="ms-chat__thread" ref={threadRef} onScroll={onThreadScroll}>
                {threadLoading ? (
                  <div className="ms-chat__loading">
                    <span className="ms-spinner" aria-hidden="true" />
                    <p>Loading messages…</p>
                  </div>
                ) : messageDays.length > 0 ? messageDays.map((day) => (
                  <div key={day.label} className="ms-chat__day">
                    <div className="ms-chat__divider"><span>{day.label}</span></div>
                    {day.runs.map((run, ri) => (
                      <div key={ri} className={`ms-chat__run${run.mine ? " is-me" : ""}`}>
                        {!run.mine && (
                          <span className="ms-chat__run-av">
                            {selConv.participantAvatarUrl ? <img src={selConv.participantAvatarUrl} alt="" /> : initials(selConv.participantName)}
                          </span>
                        )}
                        <div className="ms-chat__stack">
                          {run.msgs.map((m, mi) => (
                            <MessageBubbleInline
                              key={m.id || mi}
                              msg={m}
                              mine={run.mine}
                              isLast={mi === run.msgs.length - 1}
                              fmtTime={fmtTime}
                              pending={m.pending}
                              failed={m.failed}
                              onCopy={(text) => {
                                navigator.clipboard.writeText(text).catch(() => {});
                              }}
                              onDelete={(msgObj) => {
                                // Optimistically remove from local state
                                setThreadData((prev) =>
                                  prev.filter((x) => String(x.id) !== String(msgObj.id))
                                );
                                // Attempt backend delete
                                const convId = selConv?.kind === 'direct'
                                  ? selConv.conversationId
                                  : selConv?.bookingId;
                                if (convId) {
                                  const endpoint = selConv.kind === 'direct'
                                    ? `/api/v1/chat/direct/${convId}/messages/${msgObj.id}`
                                    : `/api/v1/chat/booking/${convId}/messages/${msgObj.id}`;
                                  client.delete(endpoint).catch(() => {
                                    // Silently ignore — message reappears on reload
                                  });
                                }
                              }}
                          />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )) : (
                  <div className="ms-chat__empty-state">
                    <Icon name="chat" />
                    <p>Say hello to start the conversation 👋</p>
                  </div>
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
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  className="ms-icon-btn"
                  title="Attach file"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!!uploadingFile || recording}
                >
                  <Icon name="attach_file" />
                </button>
                <div className="ms-composer__input-wrap">
                  {recording ? (
                    <div className="ms-recording-bar">
                      <span className="ms-recording-dot" />
                      <span className="ms-recording-time">{formatTime(recordingTime)}</span>
                      <span className="ms-recording-label">Recording…</span>
                    </div>
                  ) : recordedBlob ? (
                    <div className="ms-recording-bar">
                      <Icon name="mic" />
                      <span className="ms-recording-time">{formatTime(recordingTime)}</span>
                      <button type="button" className="ms-recording-btn" onClick={sendVoiceMessage} disabled={sending}>
                        <Icon name="send" /> Send
                      </button>
                      <button type="button" className="ms-recording-btn ms-recording-btn--cancel" onClick={cancelRecording}>
                        <Icon name="close" /> Discard
                      </button>
                    </div>
                  ) : (
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={handleKey}
                      placeholder="Write a message…"
                    />
                  )}
                </div>
                <div style={{ position: 'relative' }} ref={emojiPickerRef}>
                  <button
                    type="button"
                    className={`ms-icon-btn${showEmojiPicker ? ' is-active' : ''}`}
                    title="Emoji"
                    onClick={() => setShowEmojiPicker((p) => !p)}
                    disabled={recording}
                  >
                    <Icon name="mood" />
                  </button>
                  {showEmojiPicker && (
                    <div className="ms-emoji-picker">
                      {COMMON_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className="ms-emoji-btn"
                          onClick={() => {
                            setDraft((prev) => prev + emoji);
                            setShowEmojiPicker(false);
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {draft.trim() && !recording && !recordedBlob ? (
                  <button type="submit" className="ms-btn ms-btn--primary ms-btn--sm" disabled={sending || !!uploadingFile}>
                    <Icon name="send" /> {sending ? "Sending…" : "Send"}
                  </button>
                ) : !recording && !recordedBlob ? (
                  <button
                    type="button"
                    className="ms-icon-btn"
                    title="Voice"
                    onClick={startRecording}
                    disabled={!!uploadingFile}
                  >
                    <Icon name="mic" />
                  </button>
                ) : null}
              </form>
              {uploadingFile && (
                <div className="ms-upload-progress">
                  <span>📎 {uploadingFile.name}</span>
                  <span className="ms-upload-bar">
                    <span className="ms-upload-fill" style={{ width: `${uploadProgress}%` }} />
                  </span>
                  <span className="ms-upload-pct">{uploadProgress}%</span>
                </div>
              )}
              {fileError && <div className="ms-composer-error">{fileError}</div>}
              {recordingError && <div className="ms-composer-error">{recordingError}</div>}
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

      {/* ═══ New Chat Modal ═══ */}
      {renderNewChatModal()}
    </div>
  );

}
