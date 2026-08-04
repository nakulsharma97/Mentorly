import { normalizeSkills } from "../../../../utils/skills";

/**
 * SkillChips — renders normalized skill tags with a "+N more" overflow chip.
 * Always safe: never crashes on strings, arrays, JSON strings or null.
 *
 * @param {*} skills raw skills value from the API
 * @param {number} [limit] max chips to render before the "+N" chip
 */
export default function SkillChips({ skills, limit = 3 }) {
  const all = normalizeSkills(skills);
  const visible = all.slice(0, limit);
  const hiddenCount = all.length - visible.length;

  if (visible.length === 0) {
    return <span className="lqr-chip lqr-chip--empty">No skills listed</span>;
  }

  return (
    <div className="lqr-chips" role="list">
      {visible.map((skill) => (
        <span key={skill} className="lqr-chip" role="listitem">
          {skill}
        </span>
      ))}
      {hiddenCount > 0 && (
        <span className="lqr-chip lqr-chip--more" role="listitem">
          +{hiddenCount} more
        </span>
      )}
    </div>
  );
}
