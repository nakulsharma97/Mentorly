import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import { getErrorFeedback, showInfoFeedback } from '../utils/comingSoon';

const readToken = () => localStorage.getItem('token') || '';

const formatConversationTime = (value) => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit'
  }).format(date);
};

const formatMessageTime = (value) => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit'
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
  const [selectedBookingId, setSelectedBookingId] = useState('');
  const [showMobileList, setShowMobileList] = useState(true);
  const [messages, setMessages] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [wsState, setWsState] = useState('idle');
  const [conversationReloadKey, setConversationReloadKey] = useState(0);
  const [messageReloadKey, setMessageReloadKey] = useState(0);

  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
  const wsBase = useMemo(() => apiBase.replace(/^http/, 'ws'), [apiBase]);
  const token = readToken();

  useEffect(() => {
    let isMounted = true;

    const loadConversations = async () => {
      setLoadingConversations(true);
      setErrorText('');
      try {
        const response = await client.get('/api/v1/bookings');
        if (!isMounted) {
          return;
        }

        const currentUserId = profile?.id;
        const normalized = (response?.data?.data || [])
          .map((booking) => {
            const counterParty = getCounterParty(booking, currentUserId);
            return {
              bookingId: String(booking.id),
              booking,
              counterParty,
              name: String(counterParty?.fullName || 'SkillSwap Member').trim(),
              subtitle: String(booking?.session?.title || 'Conversation').trim(),
              avatar: String(counterParty?.profileImageUrl || '').trim(),
              lastMessagePreview: 'Open to view messages',
              lastMessageAt: booking?.updatedAt || booking?.createdAt || booking?.session?.startTime || null
            };
          })
          .sort((a, b) => {
            const aTime = new Date(a.lastMessageAt || 0).getTime();
            const bTime = new Date(b.lastMessageAt || 0).getTime();
            return bTime - aTime;
          });

        setConversations(normalized);
        if (normalized.length > 0) {
          setSelectedBookingId((current) => current || normalized[0].bookingId);
        }
      } catch {
        if (isMounted) {
          setErrorText(getErrorFeedback('conversationsLoadFailed').message);
          notify?.({
            type: 'warning',
            title: 'Conversations unavailable',
            message: getErrorFeedback('conversationsLoadHint').message
          });
        }
      } finally {
        if (isMounted) {
          setLoadingConversations(false);
        }
      }
    };

    loadConversations();

    return () => {
      isMounted = false;
    };
  }, [notify, profile?.id, conversationReloadKey]);

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.bookingId === selectedBookingId) || null,
    [conversations, selectedBookingId]
  );

  useEffect(() => {
    if (!selectedBookingId) {
      setShowMobileList(true);
    }
  }, [selectedBookingId]);

  const filteredConversations = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return conversations;
    }
    return conversations.filter((item) => (
      item.name.toLowerCase().includes(query)
      || item.subtitle.toLowerCase().includes(query)
      || item.lastMessagePreview.toLowerCase().includes(query)
    ));
  }, [conversations, searchText]);

  useEffect(() => {
    if (!selectedBookingId || !token) {
      setMessages([]);
      return undefined;
    }

    let isMounted = true;
    let socket;

    const loadMessages = async () => {
      setLoadingMessages(true);
      setErrorText('');
      try {
        const response = await client.get(`/api/v1/chat/booking/${selectedBookingId}`);
        if (!isMounted) {
          return;
        }

        const list = response?.data?.data || [];
        setMessages(list);

        const latest = list[list.length - 1];
        setConversations((prev) => prev.map((item) => (
          item.bookingId === selectedBookingId
            ? {
              ...item,
              lastMessagePreview: String(latest?.content || item.lastMessagePreview || '').slice(0, 80) || 'Open to view messages',
              lastMessageAt: latest?.createdAt || item.lastMessageAt
            }
            : item
        )));
      } catch {
        if (isMounted) {
          setErrorText(getErrorFeedback('chatHistoryLoadFailed').message);
        }
      } finally {
        if (isMounted) {
          setLoadingMessages(false);
        }
      }
    };

    loadMessages();

    try {
      socket = new WebSocket(
        `${wsBase}/ws/chat?token=${encodeURIComponent(token)}&bookingId=${encodeURIComponent(selectedBookingId)}`
      );
      setWsState('connecting');

      socket.onopen = () => {
        if (isMounted) {
          setWsState('connected');
        }
      };

      socket.onmessage = (event) => {
        if (!isMounted) {
          return;
        }

        try {
          const incoming = JSON.parse(event.data);
          setMessages((prev) => {
            if (prev.some((msg) => String(msg.id) === String(incoming.id))) {
              return prev;
            }
            return [...prev, incoming];
          });

          setConversations((prev) => prev.map((item) => (
            item.bookingId === selectedBookingId
              ? {
                ...item,
                lastMessagePreview: String(incoming?.content || '').slice(0, 80) || item.lastMessagePreview,
                lastMessageAt: incoming?.createdAt || item.lastMessageAt
              }
              : item
          )));
        } catch {
          setErrorText(getErrorFeedback('realtimeMessageParseFailed').message);
        }
      };

      socket.onerror = () => {
        if (isMounted) {
          setWsState('error');
          notify?.({
            type: 'warning',
            title: 'Realtime disconnected',
            message: 'Chat is still available via refresh/send, but live updates paused.'
          });
        }
      };

      socket.onclose = () => {
        if (isMounted) {
          setWsState('closed');
        }
      };
    } catch {
      setWsState('error');
    }

    return () => {
      isMounted = false;
      if (socket) {
        socket.close();
      }
    };
  }, [messageReloadKey, notify, selectedBookingId, token, wsBase]);

  const handleSendMessage = async (event) => {
    event.preventDefault();
    const attachmentNote = attachedFiles.length
      ? `\n\nAttachments: ${attachedFiles.map((file) => file.name).join(', ')}`
      : '';
    const content = `${chatInput.trim()}${attachmentNote}`.trim();
    if (!content || !selectedBookingId) {
      return;
    }

    setErrorText('');

    try {
      const response = await client.post(`/api/v1/chat/booking/${selectedBookingId}`, { content });
      const created = response?.data?.data;
      if (created) {
        setMessages((prev) => [...prev, created]);
        setConversations((prev) => prev.map((item) => (
          item.bookingId === selectedBookingId
            ? {
              ...item,
              lastMessagePreview: String(created.content || '').slice(0, 80),
              lastMessageAt: created.createdAt || item.lastMessageAt
            }
            : item
        )));
      }
      setChatInput('');
      setAttachedFiles([]);
      notify?.({ type: 'success', title: 'Message sent', message: 'Your message was delivered.' });
    } catch {
      setErrorText(getErrorFeedback('messageSendFailed').message);
      notify?.({
        type: 'error',
        title: 'Message failed',
        message: getErrorFeedback('messageSendFailedToast').message
      });
    }
  };

  const openMeetingLink = (type) => {
    const meetingLink = selectedConversation?.booking?.session?.meetingLink;
    if (meetingLink) {
      window.open(meetingLink, '_blank', 'noopener,noreferrer');
      return;
    }
    showInfoFeedback({
      key: 'missingMeetingLink',
      notify
    });
    setErrorText(`${type} call needs a meeting link on the booked session.`);
  };

  const addEmoji = () => {
    setChatInput((current) => `${current}${current.endsWith(' ') || !current ? '' : ' '}🙂`);
  };

  const currentUserId = profile?.id;

  return (
    <div className="bg-surface text-on-surface">
      <div className="pt-6 h-screen flex overflow-hidden">
        <div className="flex w-full h-full bg-surface">
          <div className={`w-full md:w-[22rem] md:max-w-96 flex-col bg-surface-container-low border-r border-emerald-500/5 ${showMobileList ? 'flex' : 'hidden md:flex'}`}>
            <div className="p-6 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <h1 className="font-headline text-2xl font-bold text-on-surface tracking-tight">Messages</h1>
                <button type="button" className="p-2 bg-surface-container-lowest rounded-full text-primary hover:bg-primary hover:text-on-primary transition-all material-symbols-outlined" onClick={() => showInfoFeedback({ key: 'composer', notify })}>edit_square</button>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-lg">search</span>
                <input
                  className="w-full bg-surface-container-lowest border-none rounded-xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-slate-400"
                  placeholder="Search conversations..."
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 space-y-1 pb-4">
              {loadingConversations ? (
                <p className="text-sm text-on-surface-variant px-4 py-6">Loading conversations...</p>
              ) : filteredConversations.length === 0 ? (
                <div className="px-4 py-6">
                  <p className="text-sm text-on-surface-variant">No conversations found.</p>
                  <button
                    type="button"
                    className="mt-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                    onClick={() => setConversationReloadKey((prev) => prev + 1)}
                  >
                    Refresh conversations
                  </button>
                </div>
              ) : (
                filteredConversations.map((item) => {
                  const isActive = String(selectedBookingId) === String(item.bookingId);
                  return (
                    <button
                      type="button"
                      key={item.bookingId}
                      onClick={() => {
                        setSelectedBookingId(item.bookingId);
                        setShowMobileList(false);
                      }}
                      className={`w-full text-left flex items-center gap-4 p-4 rounded-2xl transition-all cursor-pointer ${isActive ? 'bg-surface-container-lowest shadow-sm border-l-4 border-primary' : 'hover:bg-surface-container'}`}
                    >
                      <div className="relative">
                        {item.avatar ? (
                          <img alt={item.name} className="w-12 h-12 rounded-full object-cover" src={item.avatar} />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-primary">
                            {String(item.name || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline">
                          <h3 className="font-semibold text-on-surface truncate">{item.name}</h3>
                          <span className="text-[10px] font-medium text-on-surface-variant">{formatConversationTime(item.lastMessageAt)}</span>
                        </div>
                        <p className="text-xs text-on-surface-variant truncate font-medium">
                          {item.lastMessagePreview || item.subtitle}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="p-6 bg-surface-container-high/30">
              <div className="bg-tertiary-fixed p-4 rounded-2xl flex items-center gap-4">
                <span className="material-symbols-outlined text-on-tertiary-fixed" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
                <div>
                  <p className="text-xs font-bold text-on-tertiary-fixed uppercase tracking-wider">Pro Workshop</p>
                  <p className="text-[11px] text-on-tertiary-fixed-variant">Unlock unlimited file sharing</p>
                </div>
              </div>
            </div>
          </div>

          <div className={`flex-1 flex-col bg-surface-container-lowest min-w-0 ${showMobileList ? 'hidden md:flex' : 'flex'}`}>
            <header className="h-20 px-4 md:px-8 flex justify-between items-center border-b border-emerald-500/5">
              <div className="flex items-center gap-4 min-w-0">
                <button
                  type="button"
                  onClick={() => setShowMobileList(true)}
                  className="md:hidden p-2 rounded-lg hover:bg-surface-container-low text-slate-500 material-symbols-outlined"
                >
                  arrow_back
                </button>
                <div className="relative">
                  {selectedConversation?.avatar ? (
                    <img alt={selectedConversation?.name || 'User'} className="w-10 h-10 rounded-full object-cover" src={selectedConversation.avatar} />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-primary">
                      {String(selectedConversation?.name || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-on-surface font-headline truncate">{selectedConversation?.name || 'Select a conversation'}</h2>
                  <p className="text-xs text-emerald-700 font-medium truncate">{selectedConversation?.subtitle || 'No active conversation selected'}</p>
                </div>
              </div>
              <div className="hidden sm:flex gap-2">
                <button type="button" className="p-2.5 rounded-xl hover:bg-surface-container-low text-slate-500 transition-colors material-symbols-outlined" onClick={() => openMeetingLink('Voice')}>call</button>
                <button type="button" className="p-2.5 rounded-xl hover:bg-surface-container-low text-slate-500 transition-colors material-symbols-outlined" onClick={() => openMeetingLink('Video')}>videocam</button>
                <button
                  type="button"
                  className="p-2.5 rounded-xl hover:bg-surface-container-low text-slate-500 transition-colors material-symbols-outlined"
                  onClick={() => showInfoFeedback({
                    key: 'conversationInfo',
                    params: {
                      bookingId: selectedConversation?.booking?.id || '-',
                      memberName: selectedConversation?.name || 'member'
                    },
                    notify
                  })}
                >
                  info
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 flex flex-col">
              {loadingMessages ? (
                <p className="text-sm text-on-surface-variant">Loading messages...</p>
              ) : !selectedBookingId ? (
                <p className="text-sm text-on-surface-variant">Select a conversation to start chatting.</p>
              ) : messages.length === 0 ? (
                <p className="text-sm text-on-surface-variant">No messages yet. Send the first message.</p>
              ) : (
                messages.map((msg) => {
                  const mine = String(msg?.senderId) === String(currentUserId);
                  return mine ? (
                    <div key={msg.id} className="flex flex-col items-end gap-1 self-end max-w-[80%] md:max-w-[70%]">
                      <div className="bg-gradient-to-br from-primary to-primary-container p-4 rounded-2xl rounded-tr-none text-on-primary text-sm shadow-sm leading-relaxed">
                        {msg.content}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-400">{formatMessageTime(msg.createdAt)}</span>
                        <span className="material-symbols-outlined text-primary text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>done_all</span>
                      </div>
                    </div>
                  ) : (
                    <div key={msg.id} className="flex items-start gap-3 max-w-[80%] md:max-w-[70%]">
                      {selectedConversation?.avatar ? (
                        <img alt={selectedConversation.name} className="w-8 h-8 rounded-full object-cover mt-1" src={selectedConversation.avatar} />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-primary mt-1 text-xs">
                          {String(selectedConversation?.name || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="bg-surface-container-low p-4 rounded-2xl rounded-tl-none text-on-surface text-sm leading-relaxed">
                          {msg.content}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 ml-1">{formatMessageTime(msg.createdAt)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 md:p-6 border-t border-emerald-500/5 bg-surface-container-lowest">
              <div className="max-w-4xl mx-auto">
                <form onSubmit={handleSendMessage} className="bg-surface-container-low rounded-2xl p-2 flex items-end gap-2">
                  <label className="p-2.5 rounded-xl text-slate-500 hover:bg-surface-container hover:text-primary transition-all material-symbols-outlined cursor-pointer" title="Attach files">
                    add_circle
                    <input
                      type="file"
                      multiple
                      className="sr-only"
                      onChange={(event) => setAttachedFiles(Array.from(event.target.files || []))}
                    />
                  </label>
                  <label className="p-2.5 rounded-xl text-slate-500 hover:bg-surface-container hover:text-primary transition-all material-symbols-outlined cursor-pointer" title="Attach images">
                    image
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) => setAttachedFiles(Array.from(event.target.files || []))}
                    />
                  </label>
                  <div className="flex-1">
                    <textarea
                      className="w-full bg-transparent border-none focus:ring-0 resize-none py-2.5 text-sm text-on-surface placeholder:text-slate-400"
                      placeholder="Write your message..."
                      rows="1"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      disabled={!selectedBookingId}
                    />
                  </div>
                  <button type="button" className="p-2.5 rounded-xl text-slate-500 hover:bg-surface-container hover:text-primary transition-all material-symbols-outlined" onClick={addEmoji}>sentiment_satisfied</button>
                  <button type="submit" disabled={!selectedBookingId} className="p-3 bg-primary text-on-primary rounded-xl hover:bg-primary-container transition-all flex items-center justify-center disabled:opacity-40">
                    <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
                  </button>
                </form>
                <div className="mt-2 flex flex-col sm:flex-row sm:justify-between px-2 gap-1">
                  <p className="text-[10px] text-slate-400 font-medium">Press Enter to send, Shift + Enter for new line</p>
                  <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-widest">{wsState === 'connected' ? 'Realtime Connected' : 'End-to-End Encrypted'}</p>
                </div>
                {attachedFiles.length > 0 && (
                  <p className="mt-2 px-2 text-[10px] text-slate-500">
                    Attached: {attachedFiles.map((file) => file.name).join(', ')}
                  </p>
                )}
                {errorText && <p className="text-xs text-error mt-2 px-2">{errorText}</p>}
                {errorText && (
                  <div className="mt-2 px-2">
                    <button
                      type="button"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                      onClick={() => setMessageReloadKey((prev) => prev + 1)}
                    >
                      Retry loading chat
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="w-72 bg-surface flex flex-col border-l border-emerald-500/5 hidden lg:flex">
            <div className="p-8 flex flex-col items-center text-center">
              {selectedConversation?.avatar ? (
                <img alt={selectedConversation?.name || 'User'} className="w-24 h-24 rounded-3xl object-cover mb-4 shadow-lg" src={selectedConversation.avatar} />
              ) : (
                <div className="w-24 h-24 rounded-3xl bg-surface-container-high flex items-center justify-center mb-4 shadow-lg text-3xl font-bold text-primary">
                  {String(selectedConversation?.name || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <h2 className="font-headline font-bold text-lg text-on-surface">{selectedConversation?.name || 'No Contact Selected'}</h2>
              <p className="text-sm text-on-surface-variant mb-6">{selectedConversation?.subtitle || 'Choose a conversation from the list'}</p>
              <div className="w-full space-y-4">
                <div className="bg-surface-container-low p-4 rounded-2xl text-left">
                  <p className="text-[10px] font-bold text-on-tertiary-fixed-variant uppercase tracking-widest mb-2">Current Booking</p>
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-lg">event</span>
                    <div>
                      <p className="text-xs font-semibold text-on-surface">#{selectedConversation?.booking?.id || '-'}</p>
                      <p className="text-[10px] text-on-surface-variant">{selectedConversation?.booking?.bookingStatus || 'Unknown status'}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-surface-container-low p-3 rounded-2xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Messages</p>
                    <p className="text-sm font-bold text-emerald-900">{messages.length}</p>
                  </div>
                  <div className="bg-surface-container-low p-3 rounded-2xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                    <p className="text-sm font-bold text-emerald-900">{wsState === 'connected' ? 'Live' : 'Sync'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
