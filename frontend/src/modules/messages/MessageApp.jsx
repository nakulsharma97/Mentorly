import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import client from "../../api/client";
import useChatSocket from "./hooks/useChatSocket";
import useSearch from "./hooks/useSearch";
import { useChatContext } from "../../context/ChatContext";
import MessageLayout from "./components/MessageLayout";
import ConversationSidebar from "./components/ConversationSidebar";
import ChatHeader from "./components/ChatHeader";
import MessageList from "./components/MessageList";
import MessageInput from "./components/MessageInput";
import QuickReplies from "./components/QuickReplies";
import NewConversation from "./components/NewConversation";
import EmptyConversation from "./components/EmptyConversation";
import { unwrap } from "./utils";

const apiBase = import.meta.env.VITE_API_BASE_URL || "";
const wsBase = apiBase
  ? apiBase.replace(/^http/, "ws")
  : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;

export default function MessageApp({
  profile,
  notify,
  variant = "LEARNER",
  initialConversationId,
}) {
  const currentUserId = profile?.id;
  const currentUserEmail = String(profile?.email || "").toLowerCase();

  // Browser tab title — matches the per-page convention used across the
  // workspaces ("Messages | Mentorly Mentor" / "Messages | Mentorly").
  // WorkspaceLayout observes <title> and re-applies the unread-count prefix.
  useEffect(() => {
    document.title =
      variant === "MENTOR"
        ? "Messages | Mentorly Mentor"
        : "Messages | Mentorly";
  }, [variant]);

  const { conversations, loading, error, load, filterConversations, patchDirect } =
    useChatContext();
  const search = useSearch();

  const [selectedId, setSelectedId] = useState(null);
  const [selKind, setSelKind] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);

  const [tabFilter, setTabFilter] = useState("all");
  const [quickFilter, setQuickFilter] = useState("");
  const [sort, setSort] = useState("recent");

  // The right panel defaults to the "Start New Conversation" experience —
  // search users, suggested users and search results — so a visitor can
  // immediately discover who to message. Selecting a chat swaps it in.
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [messageRequests, setMessageRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestActioningId, setRequestActioningId] = useState(null);

  const [uploading, setUploading] = useState(null);
  const [composerError, setComposerError] = useState(null);
  const typingTimeoutRef = useRef(null);

  const [blockedUserIds, setBlockedUserIds] = useState([]);

  const selConv = useMemo(
    () =>
      conversations.find((c) => String(c.id) === String(selectedId)) || null,
    [conversations, selectedId],
  );
  const convId = selConv?.convId;
  // Stable identity for the open thread (kind + conversation id). The message
  // loader keys on this, NOT the row object, so refetching the conversation
  // list (e.g. right after sending) never blanks or reloads the open chat.
  const selKey = selConv ? `${selConv.kind}:${selConv.convId}` : null;
  const selConvRef = useRef(null);
  selConvRef.current = selConv;

  const { sendTyping, typingConversationId, socket } = useChatSocket({
    conversationId: convId,
    kind: selKind,
    currentUserEmail,
    wsBase,
  });

  const filtered = useMemo(() => {
    const base = search.results
      ? search.results
      : filterConversations(tabFilter, sort);

    let rows = [...base];

    if (quickFilter === "read")
      rows = rows.filter((c) => Number(c.unreadCount || 0) === 0);
    if (quickFilter === "pinned") rows = rows.filter((c) => Boolean(c.pinned));
    if (quickFilter === "active-session") {
      rows = rows.filter((c) => {
        const status = String(
          c?.conversation?.bookingStatus || "",
        ).toUpperCase();
        return (
          c.kind === "booking" &&
          ["ACCEPTED", "CONFIRMED", "IN_PROGRESS"].includes(status)
        );
      });
    }
    if (quickFilter === "blocked") {
      rows = rows.filter((c) =>
        blockedUserIds.includes(Number(c?.conversation?.participantId)),
      );
    }

    return rows;
  }, [
    search.results,
    filterConversations,
    tabFilter,
    sort,
    quickFilter,
    blockedUserIds,
  ]);

  useEffect(() => {
    if (initialConversationId && !selectedId) {
      const found = conversations.find(
        (c) =>
          c.kind === "direct" &&
          String(c.convId) === String(initialConversationId),
      );
      if (found) {
        setSelectedId(found.id);
        setSelKind("direct");
        return;
      }
    }
    if (!selectedId && conversations.length > 0) {
      setSelectedId(conversations[0].id);
      setSelKind(conversations[0].kind);
    }
  }, [conversations, initialConversationId, selectedId]);

  useEffect(() => {
    const conv = selConvRef.current;
    if (!conv || !currentUserId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    const loadMessages = async () => {
      setLoadingMessages(true);
      try {
        const endpoint =
          conv.kind === "booking"
            ? `/api/v1/chat/booking/${conv.convId}`
            : `/api/v1/chat/direct/${conv.convId}/messages`;
        const res = await client.get(endpoint);
        if (!cancelled) setMessages(unwrap(res.data) || []);
      } catch {
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    };
    loadMessages();
    return () => {
      cancelled = true;
    };
  }, [selKey, currentUserId]);

  // A conversation row may represent several threads (one direct chat plus the
  // booking chats for that person). Opening it marks the OPEN thread read via
  // the socket READ frame; mark every other booking thread read too, so a
  // session-chat message can never leave a permanent unread badge on the row.
  useEffect(() => {
    const conv = selConvRef.current;
    if (!conv || !currentUserId || !Array.isArray(conv.threads)) return;
    const opened = `${conv.kind}:${conv.convId}`;
    for (const t of conv.threads) {
      if (t?.kind !== "booking") continue;
      if (`booking:${t.convId}` === opened) continue; // socket READ handles it
      client.put(`/api/v1/chat/booking/${t.convId}/read`).catch(() => {});
    }
  }, [selKey, currentUserId]);

  const loadRequests = useCallback(async () => {
    if (!currentUserId) {
      setRequestsLoading(false);
      return;
    }
    setRequestsLoading(true);
    try {
      const res = await client.get("/api/message-requests");
      setMessageRequests(unwrap(res.data) || []);
    } catch {
      setMessageRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  }, [currentUserId]);

  const loadBlockedUsers = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const res = await client.get("/api/v1/safety/blocked");
      const rows = unwrap(res.data) || [];
      setBlockedUserIds(
        rows.map((row) => Number(row?.blocked?.id)).filter(Number.isFinite),
      );
    } catch {
      setBlockedUserIds([]);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadRequests();
    loadBlockedUsers();
  }, [loadRequests, loadBlockedUsers]);

  useEffect(() => {
    const onIncoming = (e) => {
      const detail = e?.detail || {};
      const msg = detail.message;
      if (!msg?.id) return;
      const isCurrentConv = String(detail.conversationId) === String(convId);
      setMessages((prev) => {
        if (prev.some((m) => String(m.id) === String(msg.id))) return prev;
        return isCurrentConv ? [...prev, msg] : prev;
      });
      // A message landing in the open chat is read immediately — tell the
      // backend so the unread badge clears, then refresh the list shortly
      // after so the server-side mark-as-read has landed first.
      if (isCurrentConv && convId) {
        socket.send(
          selKind === "direct"
            ? { type: "READ", conversationId: Number(convId) }
            : { type: "READ", bookingId: Number(convId) },
        );
        window.setTimeout(() => load({ silent: true }), 800);
      } else {
        load({ silent: true });
      }
    };

    const onReadAck = (e) => {
      const detail = e?.detail || {};
      if (String(detail.conversationId) !== String(convId)) return;
      setMessages((prev) =>
        prev.map((m) =>
          String(m?.senderEmail || "").toLowerCase() === currentUserEmail
            ? { ...m, readByRecipient: true }
            : m,
        ),
      );
    };

    const onReaction = (e) => {
      const detail = e?.detail || {};
      const msg = detail.message;
      if (!msg?.id) return;
      setMessages((prev) =>
        prev.map((m) =>
          String(m.id) === String(msg.id) ? { ...m, ...msg } : m,
        ),
      );
    };

    window.addEventListener("msg:incoming", onIncoming);
    window.addEventListener("msg:readack", onReadAck);
    window.addEventListener("msg:reaction", onReaction);
    return () => {
      window.removeEventListener("msg:incoming", onIncoming);
      window.removeEventListener("msg:readack", onReadAck);
      window.removeEventListener("msg:reaction", onReaction);
    };
  }, [convId, currentUserEmail, load, selKind, socket]);

  const selectConversation = (conv) => {
    setSelectedId(conv.id);
    setSelKind(conv.kind);
    setNewChatOpen(false);
    search.clear();
  };

  // Refresh the list shortly after a conversation is opened (manual select or
  // first-load auto-select) so unread indicators clear once the backend has
  // processed the socket READ frame. Silent: the sidebar must NOT flash or
  // swap to the skeleton when the user merely switches conversations.
  useEffect(() => {
    if (!selectedId) return undefined;
    const t = window.setTimeout(() => load({ silent: true }), 800);
    return () => window.clearTimeout(t);
  }, [selectedId, load]);

  const openNewChat = () => setNewChatOpen(true);
  const closeNewChat = () => setNewChatOpen(false);

  /**
   * Opens (or creates) a direct conversation and selects it immediately.
   * The conversation row is optimistically added to the sidebar list so the
   * chat opens instantly — no blank screen while the list refetches.
   * The backend never creates duplicates (it reuses existing conversations).
   */
  const startConversation = (data) => {
    const convId = String(data?.conversationId ?? data?.id ?? "");
    if (!convId) {
      load();
      return;
    }
    const row = {
      id: `direct-${convId}`,
      kind: "direct",
      convId,
      conversation: {
        conversationId: data.conversationId ?? data.id,
        participantId: data.participantId,
        participantName: data.participantName ?? data.name,
        participantRole: data.participantRole ?? data.role,
        participantSkills: data.participantSkills ?? data.skills ?? "",
        participantProfileImageUrl: data.participantProfileImageUrl ?? data.profileImageUrl ?? "",
        participantOnline: Boolean(data.participantOnline ?? data.online),
        participantPresenceText: data.participantPresenceText ?? "Offline",
        participantEmail: data.participantEmail ?? data.email ?? "",
        lastMessagePreview: data.lastMessagePreview ?? "",
        lastMessageAt: data.lastMessageAt ?? new Date().toISOString(),
        unreadCount: 0,
        pinned: false,
        archived: false,
      },
      title: data.participantName ?? data.name ?? "Mentorly Member",
      subtitle: data.lastMessagePreview ?? "Say hello",
      role: data.participantRole ?? data.role ?? "",
      email: data.participantEmail ?? data.email ?? "",
      time: data.lastMessageAt ?? new Date().toISOString(),
      unreadCount: 0,
      online: Boolean(data.participantOnline ?? data.online),
      presence: data.participantPresenceText ?? "Offline",
      pinned: false,
      archived: false,
      sessionTitle: "",
    };
    patchDirect((prev) => [
      row.conversation,
      ...(prev || []).filter(
        (c) => String(c.conversationId) !== String(convId),
      ),
    ]);
    setSelectedId(row.id);
    setSelKind("direct");
    setNewChatOpen(false);
    setChatInput("");
    // Row is already patched into the list optimistically — keep the follow-up
    // sync silent so the sidebar never flashes.
    load({ silent: true });
  };

  const handleSend = useCallback(
    async (content) => {
      if (!selConv || !content?.trim()) return;
      setSending(true);
      try {
        const endpoint =
          selConv.kind === "booking"
            ? `/api/v1/chat/booking/${selConv.convId}`
            : `/api/v1/chat/direct/${selConv.convId}/messages`;
        const res = await client.post(endpoint, { content: content.trim() });
        const created = unwrap(res.data);
        if (created?.id) {
          setMessages((prev) =>
            prev.some((m) => String(m.id) === String(created.id))
              ? prev
              : [...prev, created],
          );
        }
        setChatInput("");
        // Refresh previews/order in the sidebar silently — the thread loader
        // is keyed on the conversation id, so this never blanks the open chat,
        // and the list stays mounted (no skeleton flash).
        load({ silent: true });
      } catch {
        // Keep the typed text so the user can retry; never reload or navigate.
        notify?.({
          type: "error",
          title: "Message not sent",
          message: "Please try again.",
        });
      } finally {
        setSending(false);
      }
    },
    [load, notify, selConv],
  );

  const handleFile = useCallback(
    async (file) => {
      if (
        !selConv ||
        (typeof file === "object" && !file?.error && !(file instanceof File))
      )
        return;
      if (file?.error) {
        setComposerError(file.error);
        return;
      }
      setUploading(file.name || "Uploading...");
      setComposerError(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append(
          "contextType",
          selConv.kind === "booking" ? "BOOKING_CHAT" : "DIRECT_CHAT",
        );
        formData.append("contextId", selConv.convId);
        const res = await client.post("/api/v1/files/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const url = res?.data?.data?.url;
        if (!url) throw new Error("Upload failed");
        await handleSend(`📎 ${file.name}\n${url}`);
      } catch {
        setComposerError(
          "File upload failed. Try a smaller file or a different format.",
        );
      } finally {
        setUploading(null);
      }
    },
    [handleSend, selConv],
  );

  const handleReact = useCallback(
    async (emoji) => {
      if (!selConv?.convId) return;
      const last = messages[messages.length - 1];
      if (!last?.id) return;
      try {
        const res = await client.post(
          `/api/v1/chat/direct/${selConv.convId}/messages/${last.id}/reactions`,
          { emoji },
        );
        const updated = unwrap(res.data);
        if (updated?.id) {
          setMessages((prev) =>
            prev.map((m) =>
              String(m.id) === String(updated.id) ? updated : m,
            ),
          );
        }
      } catch {
        // non-fatal
      }
    },
    [messages, selConv],
  );

  const handleDelete = useCallback(
    async (msg) => {
      if (!selConv?.convId || !msg?.id) return;
      setMessages((prev) =>
        prev.filter((m) => String(m.id) !== String(msg.id)),
      );
      try {
        const endpoint =
          selConv.kind === "booking"
            ? `/api/v1/chat/booking/${selConv.convId}/messages/${msg.id}`
            : `/api/v1/chat/direct/${selConv.convId}/messages/${msg.id}`;
        await client.delete(endpoint);
      } catch {
        // message syncs on next refresh
      }
    },
    [selConv],
  );

  const handleRequestAction = useCallback(
    async (requestId, action) => {
      setRequestActioningId(requestId);
      try {
        await client.put(`/api/message-requests/${requestId}/${action}`);
        setMessageRequests((prev) =>
          prev.filter((r) => String(r.id) !== String(requestId)),
        );
        notify?.({
          type: "success",
          title: action === "accept" ? "Request accepted" : "Request declined",
          message:
            action === "accept"
              ? "Conversation moved to inbox."
              : "Request declined.",
        });
        if (action === "accept") load();
      } catch {
        notify?.({
          type: "error",
          title: "Action failed",
          message: "Could not update this request.",
        });
      } finally {
        setRequestActioningId(null);
      }
    },
    [load, notify],
  );

  const handleChatAction = (action) => {
    if (action === "reply") {
      document.querySelector(".ms-composer__input")?.focus();
      return;
    }
    if (action === "schedule") {
      window.location.assign(
        variant === "MENTOR" ? "/mentor/teach" : "/learner/sessions",
      );
      return;
    }
    if (action === "clear-chat") {
      // eslint-disable-next-line no-alert
      if (window.confirm("Clear messages from this local view?")) {
        setMessages([]);
      }
      return;
    }
    if ((action === "remove" || action === "archive") && selConv?.kind === "direct") {
      client
        .put(`/api/v1/chat/direct/${selConv.convId}/archive`, {
          archived: true,
        })
        .then(() => {
          notify?.({
            type: "success",
            title: "Conversation removed",
            message: "Moved to your archived conversations.",
          });
          load();
        })
        .catch(() => {
          notify?.({
            type: "error",
            title: "Unable to remove",
            message: "Please try again.",
          });
        });
      return;
    }
    if (action === "complete" && selConv?.kind === "booking") {
      client
        .post(`/api/v1/bookings/${selConv.convId}/complete`)
        .then(() => {
          notify?.({
            type: "success",
            title: "Session completed",
            message: "Booking has been marked as complete.",
          });
          load();
        })
        .catch(() => {
          notify?.({
            type: "error",
            title: "Unable to complete",
            message: "Please try again.",
          });
        });
      return;
    }
    if (action === "block" && selConv?.conversation?.participantId) {
      client
        .post(`/api/v1/safety/block/${selConv.conversation.participantId}`)
        .then(() => loadBlockedUsers());
      return;
    }
    if (action === "report" && selConv?.conversation?.participantId) {
      // eslint-disable-next-line no-alert
      const reason = window.prompt(
        "Please add report details",
        "Inappropriate communication",
      );
      if (reason === null) return;
      client
        .post("/api/v1/safety/report", {
          targetType:
            selConv.conversation?.participantRole === "MENTOR"
              ? "MENTOR"
              : "LEARNER",
          reportedUserId: selConv.conversation.participantId,
          reason: reason.trim() || "Reported from messaging",
        })
        .then(() => {
          notify?.({
            type: "success",
            title: "Report submitted",
            message: "Our team will review this report.",
          });
        })
        .catch(() => {
          notify?.({
            type: "error",
            title: "Report failed",
            message: "Could not submit your report.",
          });
        });
      return;
    }
    notify?.({
      type: "info",
      title: "Action received",
      message: "This action is being processed.",
    });
  };

  const handleCopy = (text) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    notify?.({
      type: "success",
      title: "Copied",
      message: "Message copied to clipboard.",
    });
  };

  const isTyping = Boolean(selConv && typingConversationId === String(convId));
  // NOTE: unread-count publication to the shared store is now handled by
  // ChatProvider (context/ChatContext.jsx) — no need to duplicate it here.

  return (
    <MessageLayout
      sidebar={
        <ConversationSidebar
          loading={loading}
          conversations={filtered}
          selectedId={selectedId}
          onSelect={selectConversation}
          filter={tabFilter}
          onFilterChange={setTabFilter}
          quickFilter={quickFilter}
          onQuickFilterChange={setQuickFilter}
          sort={sort}
          onSortChange={setSort}
          searchTerm={search.term}
          onSearchChange={search.setTerm}
          searchResults={search.results}
          searching={search.searching}
          searchError={search.searchError}
          onClearSearch={search.clear}
          messageRequests={messageRequests}
          requestActioningId={requestActioningId}
          onRequestAction={handleRequestAction}
          requestsLoading={requestsLoading}
          typingByConv={typingConversationId ? { [String(convId)]: true } : {}}
          onNewChat={openNewChat}
        />
      }
      chat={
        newChatOpen || !selConv ? (
          <NewConversation
            profile={profile}
            notify={notify}
            onClose={closeNewChat}
            onStart={startConversation}
            variant={variant}
          />
        ) : error ? (
          <EmptyConversation
            icon="error_outline"
            title="Conversations could not be loaded"
            description={error}
            actions={
              <button
                type="button"
                className="ms-btn ms-btn--primary ms-btn--sm"
                onClick={load}
              >
                Retry
              </button>
            }
          />
        ) : (
          <>
            <ChatHeader
              conversation={selConv}
              variant={variant}
              onAction={handleChatAction}
            />
            <MessageList
              messages={messages}
              loading={loadingMessages}
              currentUserId={currentUserId}
              peerName={selConv.title}
              peerAvatarUrl={selConv.conversation?.participantProfileImageUrl}
              peerOnline={selConv.online}
              isTyping={isTyping}
              onCopy={handleCopy}
              onDelete={handleDelete}
              onReact={handleReact}
            />
            <QuickReplies onSend={handleSend} disabled={!selConv} />
            {composerError ? (
              <div className="ms-composer-error" role="alert">
                <span className="material-symbols-outlined">error</span>
                {composerError}
              </div>
            ) : null}
            <MessageInput
              value={chatInput}
              onChange={setChatInput}
              onSend={() => handleSend(chatInput)}
              onTyping={() => {
                if (!typingTimeoutRef.current) {
                  sendTyping();
                  typingTimeoutRef.current = setTimeout(() => {
                    typingTimeoutRef.current = null;
                  }, 2000);
                }
              }}
              onFile={handleFile}
              sending={sending}
              uploading={uploading}
            />
          </>
        )
      }
    />
  );
}
