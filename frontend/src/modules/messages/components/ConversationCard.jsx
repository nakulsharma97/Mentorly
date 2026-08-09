import Avatar from "./Avatar";
import { formatConversationTime, highlightMatch } from "../utils";

export default function ConversationCard({
  conversation,
  selected,
  onSelect,
  typing,
  searchTerm,
}) {
  const { title, subtitle, role, time, unreadCount, online, pinned, kind } = conversation;

  return (
    <button
      type="button"
      className={`ms-conv-card-v2 ${selected ? "is-selected" : ""} ${
        unreadCount > 0 ? "has-unread" : ""
      }`}
      onClick={() => onSelect?.(conversation)}
      aria-current={selected ? "true" : undefined}
    >
      <div className="ms-conv-card-v2__avatar-container">
        <Avatar name={title} online={online} size={56} showStatus={online} />
      </div>

      <span className="ms-conv-card-v2__body">
        <span className="ms-conv-card-v2__row">
          <span className="ms-conv-card-v2__name">
            {searchTerm ? highlightMatch(title, searchTerm) : title}
            {pinned && (
              <span
                className="ms-conv__pin"
                title="Pinned"
                aria-label="Pinned conversation"
                style={{ marginLeft: "4px" }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
                  push_pin
                </span>
              </span>
            )}
          </span>
          {time ? (
            <span className="ms-conv-card-v2__time">
              {formatConversationTime(time)}
            </span>
          ) : null}
        </span>

        <span className="ms-conv-card-v2__row">
          {typing ? (
            <span
              className="ms-conv__typing"
              style={{ fontSize: "0.78rem", fontStyle: "italic", color: "var(--ms-primary-dark)" }}
              aria-label={`${title} is typing`}
            >
              typing…
            </span>
          ) : (
            <span className="ms-conv-card-v2__msg">
              {kind === "booking" && conversation.sessionTitle ? (
                <span className="ms-conv__topic">{conversation.sessionTitle}</span>
              ) : null}
              {searchTerm
                ? highlightMatch(subtitle || role || "No messages yet", searchTerm)
                : subtitle || role || "No messages yet"}
            </span>
          )}

          {Number(conversation.sessionCount || 0) > 1 && (
            <span className="ms-conv__sessions">
              {conversation.sessionCount} sessions
            </span>
          )}

          {unreadCount > 0 && (
            <span className="ms-conv-card-v2__badge">{unreadCount}</span>
          )}
        </span>
      </span>
    </button>
  );
}
