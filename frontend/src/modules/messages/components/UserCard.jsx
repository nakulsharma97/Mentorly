import Avatar from "./Avatar";
import { highlightMatch, normalizeSkills, roleLabel } from "../utils";

/**
 * Premium learner card — used for both search results and suggestions.
 * Shows photo, name, role, skills, learning goal (headline), rating and
 * availability, with a primary "Start Chat" action. Search matches are
 * highlighted across every text field.
 */
export default function UserCard({ user, onAction, busy, searchTerm = "" }) {
  const skills = normalizeSkills(user.skills).slice(0, 4);
  const q = String(searchTerm || "").trim();

  return (
    <article className="ms-user" aria-label={`User ${user.name}`}>
      <div className="ms-user__top">
        <Avatar
          name={user.name}
          imageUrl={user.profileImageUrl}
          size={48}
          online={Boolean(user.online)}
        />
        <div className="ms-user__body">
          <strong className="ms-user__name">
            {q ? highlightMatch(user.name, q) : user.name}
            {user.mentorVerified ? (
              <span className="ms-user__verified" title="Verified mentor">
                <span className="material-symbols-outlined">verified</span>
              </span>
            ) : null}
          </strong>
          <span className="ms-user__meta">
            <span className={`ms-user__role ms-user__role--${String(user.role || "LEARNER").toLowerCase()}`}>
              {roleLabel(user.role)}
            </span>
            {user.experienceText ? (
              <span className="ms-user__meta-chip">{user.experienceText}</span>
            ) : null}
            {typeof user.rating === "number" ? (
              <span className="ms-user__rating" title="Average rating">
                <span className="material-symbols-outlined">star</span>
                {Number(user.rating).toFixed(1)}
              </span>
            ) : null}
          </span>
        </div>
        <button
          type="button"
          className="ms-user__start"
          disabled={busy}
          onClick={() => onAction?.(user)}
        >
          {busy ? (
            <>
              <span className="ms-btn-spinner" aria-hidden="true" />
              Working…
            </>
          ) : (
            <>
              <span className="material-symbols-outlined">
                {user.canStartDirect ? "chat" : "send"}
              </span>
              {user.canStartDirect ? "Start Chat" : "Send Request"}
            </>
          )}
        </button>
      </div>

      {user.headline ? (
        <p className="ms-user__goal">
          <span className="material-symbols-outlined">flag</span>
          <span>
            <em>Learning goal — </em>
            {q ? highlightMatch(user.headline, q) : user.headline}
          </span>
        </p>
      ) : null}

      {skills.length ? (
        <div className="ms-user__skills">
          {skills.map((skill) => (
            <span className="ms-user__skill" key={skill}>
              {q ? highlightMatch(skill, q) : skill}
            </span>
          ))}
        </div>
      ) : (
        <p className="ms-user__noskills">No skills listed yet</p>
      )}

      {user.availability ? (
        <p className="ms-user__availability">
          <span className="material-symbols-outlined">schedule</span>
          {user.availability}
        </p>
      ) : null}
    </article>
  );
}
