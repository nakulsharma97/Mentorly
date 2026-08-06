import Avatar from "./Avatar";
import { highlightMatch, normalizeSkills, roleLabel } from "../utils";

const BUTTONS = {
  idle: { label: "Send Request", icon: "send", disabled: false },
  sending: { label: "Sending…", icon: "", disabled: true, spinner: true },
  sent: { label: "Request Sent", icon: "check", disabled: true },
  "already-sent": { label: "Already Sent", icon: "check", disabled: true },
  open: { label: "Open Chat", icon: "chat", disabled: false },
};

const MAX_SKILLS = 4;

/**
 * Learner/user card for search results and suggestions. Premium card with a
 * 56px avatar + online dot, name + username + role badge, skill pills (max 4,
 * "+N more" overflow), experience, rating, short bio and a stateful
 * Send Request / Open Chat button. Skills are ALWAYS parsed into readable
 * names — never raw JSON. Null experience and missing skills render friendly
 * placeholders.
 */
export default function UserCard({
  user,
  onAction,
  state = "idle",
  searchTerm = "",
}) {
  const allSkills = normalizeSkills(user.skills);
  const skills = allSkills.slice(0, MAX_SKILLS);
  const moreCount = Math.max(0, allSkills.length - MAX_SKILLS);
  const q = String(searchTerm || "").trim();
  const role = String(user.role || "LEARNER").toLowerCase();

  // Number(null) === 0, so guard null/undefined/empty explicitly — never
  // render raw null values or "null+ yrs".
  const exp = Number(user.experience);
  const hasExperience =
    user.experienceText ||
    (user.experience != null &&
    String(user.experience).trim() !== "" &&
    Number.isFinite(exp)
      ? `${user.experience}+ yrs`
      : "");
  const experience = hasExperience || "Experience not added";

  const statusText = user.online
    ? "Online now"
    : user.availability || "Offline";

  const btn = BUTTONS[state] || BUTTONS.idle;

  const username = user.username ? `@${user.username}` : "";

  return (
    <article className="ms-user" aria-label={`User ${user.name}`}>
      <Avatar
        name={user.name}
        imageUrl={user.profileImageUrl}
        size={56}
        online={Boolean(user.online)}
      />

      <div className="ms-user__main">
        <div className="ms-user__head">
          <strong className="ms-user__name">
            {q ? highlightMatch(user.name, q) : user.name}
            {user.mentorVerified ? (
              <span className="ms-user__verified" title="Verified mentor">
                <span className="material-symbols-outlined">verified</span>
              </span>
            ) : null}
          </strong>
        </div>

        {username && <p className="ms-user__username">{username}</p>}

        {/* Role badge sits on its own line below the username — never overlaps. */}
        <span className={`ms-user__role ms-user__role--${role}`}>
          {roleLabel(user.role)}
        </span>

        <p className="ms-user__exp">
          {q && hasExperience ? highlightMatch(experience, q) : experience}
        </p>

        {skills.length ? (
          <div className="ms-user__skills">
            {skills.map((skill) => (
              <span className="ms-user__skill" key={skill}>
                {q ? highlightMatch(skill, q) : skill}
              </span>
            ))}
            {moreCount > 0 && (
              <span className="ms-user__skill ms-user__skill--more">
                +{moreCount} more
              </span>
            )}
          </div>
        ) : (
          <p className="ms-user__noskills">No skills added yet</p>
        )}

        <div className="ms-user__meta">
          {typeof user.rating === "number" && user.rating > 0 ? (
            <span className="ms-user__rating">
              <span className="material-symbols-outlined">star</span>
              {user.rating.toFixed(1)}
            </span>
          ) : null}
          <p className={`ms-user__status${user.online ? " is-online" : ""}`}>
            <span className="ms-user__status-dot" aria-hidden="true" />
            {statusText}
          </p>
        </div>

        {user.headline ? (
          <p className="ms-user__bio">
            {q ? highlightMatch(user.headline, q) : user.headline}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        className={`ms-user__start${btn.spinner ? " is-loading" : ""}`}
        data-state={state}
        disabled={btn.disabled}
        onClick={() => onAction?.(user)}
      >
        {btn.spinner ? (
          <span className="ms-btn-spinner" aria-hidden="true" />
        ) : btn.icon ? (
          <span className="material-symbols-outlined">{btn.icon}</span>
        ) : null}
        {btn.label}
      </button>
    </article>
  );
}
