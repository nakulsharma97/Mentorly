import { useEffect, useRef, useState } from "react";
import AttachmentPreview from "./AttachmentPreview";
import { isAttachmentMessage, parseReactions, splitAttachment } from "../utils";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉", "🔥", "👏"];

/**
 * One message bubble: attachment-aware content, per-message actions
 * (copy/delete), reactions with live counts, timestamps and read receipts.
 */
export default function MessageBubble({ msg, isLast, mine, formatTime, onCopy, onDelete, onReact }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen && !reactOpen) return undefined;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
        setReactOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen, reactOpen]);

  const attachment = isAttachmentMessage(msg.content) ? splitAttachment(msg.content) : null;
  const reactions = parseReactions(msg.reactions);
  const reactionEntries = Object.entries(reactions);

  return (
    <div className={`ms-bubble${mine ? " is-me" : ""}${menuOpen ? " is-menu-open" : ""}`} ref={menuRef}>
      <div className="ms-bubble__content">
        {attachment ? (
          <AttachmentPreview attachment={attachment} content={msg.content} />
        ) : (
          <span className="ms-bubble__text">{msg.content}</span>
        )}
        <button
          type="button"
          className="ms-bubble__more"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((p) => !p);
            setReactOpen(false);
          }}
          aria-label="Message actions"
          title="More actions"
        >
          <span className="material-symbols-outlined">more_horiz</span>
        </button>
        {menuOpen && (
          <div className="ms-bubble__menu" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="ms-bubble__menu-item"
              onClick={() => {
                onCopy?.(msg.content);
                setMenuOpen(false);
              }}
            >
              <span className="material-symbols-outlined">content_copy</span>
              Copy
            </button>
            <button
              type="button"
              className="ms-bubble__menu-item"
              onClick={() => {
                setMenuOpen(false);
                setReactOpen(true);
              }}
            >
              <span className="material-symbols-outlined">sentiment_satisfied</span>
              React
            </button>
            {mine && (
              <button
                type="button"
                className="ms-bubble__menu-item ms-bubble__menu-item--danger"
                onClick={() => {
                  onDelete?.(msg);
                  setMenuOpen(false);
                }}
              >
                <span className="material-symbols-outlined">delete</span>
                Delete
              </button>
            )}
          </div>
        )}
        {reactOpen && (
          <div className="ms-bubble__react" onClick={(e) => e.stopPropagation()}>
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="ms-bubble__react-btn"
                onClick={() => {
                  onReact?.(emoji);
                  setReactOpen(false);
                }}
                aria-label={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {reactionEntries.length > 0 && (
        <div className="ms-bubble__reactions" aria-label="Reactions">
          {reactionEntries.map(([emoji, userIds]) => (
            <span className="ms-bubble__reaction" key={emoji}>
              {emoji} <span className="ms-bubble__reaction-count">{userIds.length}</span>
            </span>
          ))}
        </div>
      )}

      {isLast ? (
        <span className="ms-bubble__meta">
          {formatTime(msg.createdAt)}
          {mine && msg.readByRecipient && (
            <span className="ms-bubble__read" title="Read" aria-label="Read">
              <span className="material-symbols-outlined">done_all</span>
            </span>
          )}
        </span>
      ) : null}
    </div>
  );
}
