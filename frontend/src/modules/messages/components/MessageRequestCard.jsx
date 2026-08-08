import Avatar from "./Avatar";
import { normalizeSkills, roleLabel } from "../utils";

/**
 * A pending connection request: who wants to chat (name, username, skills),
 * their intro, and accept / decline actions.
 */
export default function MessageRequestCard({ request, busy, onAccept, onDecline }) {
  const name = request.sender?.fullName || request.sender?.email || "New contact";
  const role = request.sender?.role;
  const username = request.sender?.username ? `@${request.sender.username}` : "";
  const skills = normalizeSkills(request.sender?.skills).slice(0, 3);
  const moreSkills = Math.max(0, normalizeSkills(request.sender?.skills).length - 3);
  return (
    <article className="ms-req">
      <div className="ms-req__top">
        <Avatar
          name={name}
          imageUrl={request.sender?.profileImageUrl}
          size={40}
          online={Boolean(request.sender?.lastActiveAt)}
        />
        <div className="ms-req__meta">
          <strong className="ms-req__name">{name}</strong>
          {username && <span className="ms-req__username">{username}</span>}
          <span className="ms-req__role">{roleLabel(role)}</span>
        </div>
      </div>
      {skills.length > 0 && (
        <div className="ms-req__skills">
          {skills.map((skill) => (
            <span className="ms-req__skill" key={skill}>
              {skill}
            </span>
          ))}
          {moreSkills > 0 && <span className="ms-req__skill">+{moreSkills} more</span>}
        </div>
      )}
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
