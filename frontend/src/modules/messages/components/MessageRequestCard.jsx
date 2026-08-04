import Avatar from "./Avatar";
import { roleLabel } from "../utils";

/**
 * A pending connection request: who wants to chat, their intro, and
 * accept / decline actions.
 */
export default function MessageRequestCard({ request, busy, onAccept, onDecline }) {
  const name = request.sender?.fullName || request.sender?.email || "New contact";
  const role = request.sender?.role;
  return (
    <article className="ms-req">
      <div className="ms-req__top">
        <Avatar name={name} size={40} online={Boolean(request.sender?.lastActiveAt)} />
        <div className="ms-req__meta">
          <strong className="ms-req__name">{name}</strong>
          <span className="ms-req__role">{roleLabel(role)}</span>
        </div>
      </div>
      <p className="ms-req__message">{request.firstMessage || "Would like to connect."}</p>
      <div className="ms-req__actions">
        <button
          type="button"
          className="ms-btn ms-btn--primary ms-btn--sm"
          onClick={() => onAccept?.(request)}
          disabled={busy}
        >
          {busy ? "…" : "Accept"}
        </button>
        <button
          type="button"
          className="ms-btn ms-btn--outline ms-btn--sm"
          onClick={() => onDecline?.(request)}
          disabled={busy}
        >
          Decline
        </button>
      </div>
    </article>
  );
}
