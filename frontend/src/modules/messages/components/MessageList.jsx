import { useEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import { ThreadSkeleton } from "./LoadingSkeleton";
import EmptyConversation from "./EmptyConversation";
import Avatar from "./Avatar";
import { formatMessageTime, groupMessagesForThread } from "../utils";

/**
 * The scrollable message thread: date dividers, grouped sender runs,
 * typing indicator, scroll-to-bottom affordance.
 */
export default function MessageList({
  messages,
  loading,
  currentUserId,
  peerName,
  peerAvatarUrl,
  isTyping,
  onCopy,
  onDelete,
  onReact,
}) {
  const threadRef = useRef(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const firstRender = useRef(true);

  useEffect(() => {
    const el = threadRef.current;
    if (el && (firstRender.current || !showScrollDown)) {
      el.scrollTop = el.scrollHeight;
      firstRender.current = false;
    }
  }, [messages, loading, isTyping, showScrollDown]);

  const onScroll = () => {
    const el = threadRef.current;
    if (!el) return;
    setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 220);
  };

  const scrollToBottom = () => {
    const el = threadRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  const days = groupMessagesForThread(messages, currentUserId);

  return (
    <div className="ms-thread" ref={threadRef} onScroll={onScroll} role="log" aria-live="polite" aria-relevant="additions">
      {loading ? (
        <ThreadSkeleton />
      ) : days.length === 0 ? (
        <EmptyConversation
          icon="waving_hand"
          title="Say hello 👋"
          description={`This is the beginning of your conversation with ${peerName}.`}
        />
      ) : (
        days.map((day) => (
          <div className="ms-day" key={day.label}>
            <div className="ms-day__divider">
              <span>{day.label}</span>
            </div>
            {day.runs.map((run, runIdx) => {
              const mine = run.mine;
              return (
                <div key={`${day.label}-${runIdx}`} className={`ms-run${mine ? " is-me" : ""}`}>
                  {!mine && <Avatar name={peerName} imageUrl={peerAvatarUrl} size={30} showStatus={false} />}
                  <div className="ms-run__stack">
                    {run.messages.map((msg, msgIdx) => (
                      <MessageBubble
                        key={msg.id ?? `${runIdx}-${msgIdx}`}
                        msg={msg}
                        isLast={msgIdx === run.messages.length - 1}
                        mine={mine}
                        formatTime={formatMessageTime}
                        onCopy={onCopy}
                        onDelete={onDelete}
                        onReact={onReact}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}

      {isTyping && (
        <div className="ms-run">
          <Avatar name={peerName} imageUrl={peerAvatarUrl} size={30} showStatus={false} />
          <TypingIndicator name={peerName} />
        </div>
      )}

      {showScrollDown && (
        <button type="button" className="ms-scroll-down" onClick={scrollToBottom} aria-label="Scroll to latest message">
          <span className="material-symbols-outlined">keyboard_arrow_down</span>
        </button>
      )}
    </div>
  );
}
