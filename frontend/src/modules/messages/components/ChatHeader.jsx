import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import Avatar from "./Avatar";
import { roleLabel, bookingStatusLabel } from "../utils";

/**
 * Chat header — peer identity (avatar, name, role badge), presence line
 * (online / last seen) and current session line (booking status + title),
 * each on its own row so nothing ever overlaps. Actions are limited to the
 * three-dot menu (View Profile, View Booking, View Learning Path, Remove,
 * Report). No voice/video calling.
 */
export default function ChatHeader({
  conversation,
  variant,
  onBack,
  onAction,
}) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const c = conversation?.conversation || conversation || {};
  const online = Boolean(conversation?.online);
  const booking = conversation?.kind === "booking";
  const participantId = c.participantId;
  const sessionsPath =
    variant === "MENTOR" ? "/mentor/teach" : "/learner/sessions";
  const learningPath =
    variant === "MENTOR" ? "/mentor/dashboard" : "/learner/path";

  const go = (path) => {
    setMenuOpen(false);
    navigate(path);
  };

  const act = (action) => {
    setMenuOpen(false);
    onAction?.(action, conversation);
  };

  const sessionTitle =
    c.sessionTitle || conversation?.sessionTitle || conversation?.title || "";
  // Backend presence text already reads "Last seen X min ago" or "Offline".
  const presence = online ? "Online" : conversation?.presence || "Offline";

  return (
    <header className="ms-chat__header">
      {onBack && (
        <button
          type="button"
          className="ms-chat__back"
          onClick={onBack}
          aria-label="Back to conversations"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
      )}

      <div
        className="ms-chat__peer"
        title={conversation?.title}
      >
        <Avatar
          name={conversation?.title}
          online={online}
          size={44}
          showStatus={online}
        />
        <span className="ms-chat__peer-meta">
          <span className="ms-chat__peer-name">
            <span className="ms-chat__peer-username">
              {conversation?.title}
            </span>
            {conversation?.role ? (
              <span className="ms-chat__peer-role">
                {roleLabel(conversation.role)}
              </span>
            ) : null}
          </span>

          <span
            className={`ms-chat__presence-v2${online ? " is-online" : ""}`}
          >
            {presence}
          </span>

          {booking && (
            <span className="ms-chat__session-badge">
              <span
                className="ms-booking-pill"
                data-status={String(c.bookingStatus || "PENDING").toUpperCase()}
              >
                {bookingStatusLabel(c.bookingStatus)}
              </span>
              <span className="ms-chat__session-title" title={sessionTitle}>
                {sessionTitle || "Session"}
              </span>
            </span>
          )}
        </span>
      </div>

      <div className="ms-chat__actions">
        <div className="ms-menu" ref={menuRef}>
          <button
            type="button"
            className={`ms-icon-btn ${menuOpen ? "is-active" : ""}`}
            title="More options"
            aria-label="More options"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((p) => !p)}
          >
            <span className="material-symbols-outlined">more_vert</span>
          </button>
          {menuOpen && (
            <div className="ms-menu__dropdown" role="menu">
              {String(c.participantRole || "").toUpperCase() === "MENTOR" &&
                participantId && (
                  <button
                    type="button"
                    role="menuitem"
                    className="ms-menu__item"
                    onClick={() => go(`/mentors/${participantId}`)}
                  >
                    <span className="material-symbols-outlined">person</span>
                    <span>View Profile</span>
                  </button>
                )}
              <button
                type="button"
                role="menuitem"
                className="ms-menu__item"
                onClick={() => go(sessionsPath)}
              >
                <span className="material-symbols-outlined">receipt_long</span>
                <span>View Booking</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className="ms-menu__item"
                onClick={() => go(learningPath)}
              >
                <span className="material-symbols-outlined">map</span>
                <span>View Learning Path</span>
              </button>
              {conversation?.kind === "direct" && (
                <button
                  type="button"
                  role="menuitem"
                  className="ms-menu__item"
                  onClick={() => act("remove")}
                >
                  <span className="material-symbols-outlined">archive</span>
                  <span>Remove</span>
                </button>
              )}
              <div className="ms-menu__sep" role="separator" />
              <button
                type="button"
                role="menuitem"
                className="ms-menu__item ms-menu__item--danger"
                onClick={() => act("report")}
              >
                <span className="material-symbols-outlined">flag</span>
                <span>Report</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
