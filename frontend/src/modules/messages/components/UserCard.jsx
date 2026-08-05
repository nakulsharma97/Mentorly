import Avatar from "./Avatar";
import { highlightMatch, normalizeSkills, roleLabel } from "../utils";

const BUTTONS = {
  idle: { label: "Send Request", icon: "send", disabled: false },
  sending: { label: "Sending…", icon: "", disabled: true, spinner: true },
  sent: { label: "Request Sent", icon: "check", disabled: true },
  "already-sent": { label: "Already Sent", icon: "check", disabled: true },
  open: { label: "Open Chat", icon: "chat", disabled: false },
};

/**
 * Learner card for search results and suggestions. Fixed-height (130px) with
 * avatar, name + role badge, experience, skills and online status on clean
 * rows, plus a stateful Send Request / Open Chat button. Null experience and
 * missing skills render friendly placeholder text — never raw values.
 */
export default function UserCard({
  user,
  onAction,
  state = "idle",
  searchTerm = "",
}) {
  const skills = normalizeSkills(user.skills).slice(0, 4);
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

  return (
    <article className="ms-user" aria-label={`User ${user.name}`}>
      <Avatar
        name={user.name}
        imageUrl={user.profileImageUrl}
        size={48}
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
          <span
            className={`ms-user__role ms-user__role--${role}`}
          >
            {roleLabel(user.role)}
          </span>
        </div>

        <p className="ms-user__exp">
          {q && hasExperience
            ? highlightMatch(experience, q)
            : experience}
        </p>

        {skills.length ? (
          <div className="ms-user__skills">
            {skills.map((skill) => (
              <span className="ms-user__skill" key={skill}>
                {q ? highlightMatch(skill, q) : skill}
              </span>
            ))}
          </div>
        ) : (
          <p className="ms-user__noskills">No skills added yet</p>
        )}

        <p className={`ms-user__status${user.online ? " is-online" : ""}`}>
          <span className="ms-user__status-dot" aria-hidden="true" />
          {statusText}
        </p>
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
