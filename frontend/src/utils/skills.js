/**
 * Shared skill-normalization utilities.
 *
 * The backend stores mentor skills as a comma-separated string
 * (e.g. `"Java, Spring Boot, React"`) on `users.skills`, and sometimes as a
 * JSON array string (`["Java","Spring Boot"]` or `[{"name":"Java"}]`). API
 * responses may therefore carry skills as a string, an array, an object, or
 * null — depending on which endpoint/entity produced them.
 *
 * Every consumer must go through {@link normalizeSkills} before calling
 * `.map()`, `.slice()`, `.filter()` or `.length`. NEVER call array methods on
 * `mentor.skills` / `session.skills` directly.
 */

const CSV_DELIMITERS = /[,\n;|]+/;

const cleanEntry = (value) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    // [{ name: "Java" }] or [{ label: "Java" }] shape
    const named = value?.name ?? value?.label;
    if (named !== undefined && named !== null) return String(named).trim();
    return String(value).trim();
  }
  return String(value).trim();
};

const uniqueStrings = (list) => {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const clean = cleanEntry(item);
    if (!clean) continue;
    if (seen.has(clean.toLowerCase())) continue;
    seen.add(clean.toLowerCase());
    out.push(clean);
  }
  return out;
};

/**
 * Normalize any raw skills value into a clean, deduplicated array of strings.
 * Never throws — bad data yields an empty array.
 *
 * Accepts: arrays (including nested arrays and object arrays like
 * `[{name:"Java"}]`), comma/;/|/newline-separated CSV strings, and JSON array
 * strings. The default limit is generous (100) so callers that previously had
 * no cap keep their full list; chip-rendering call sites pass explicit
 * smaller limits (e.g. `{ limit: 4 }`).
 *
 * @param {*} skills raw value from the API
 * @param {{ limit?: number }} [options] optional `limit` to cap the result
 * @returns {string[]} always an array (possibly empty)
 */
export function normalizeSkills(skills, options = {}) {
  const { limit = 100 } = options || {};

  // Already an array — flatten nested arrays, then validate + dedupe each
  // entry (arrays may contain nulls, objects, or further arrays)
  if (Array.isArray(skills)) {
    return uniqueStrings(skills.flat(Infinity)).slice(0, limit);
  }

  if (typeof skills === "string") {
    const value = skills.trim();
    if (!value) return [];

    // JSON array string: ["Java","Spring Boot"] or [{"name":"Java"}]
    if (value.startsWith("[")) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return uniqueStrings(parsed).slice(0, limit);
        }
      } catch {
        // Not valid JSON — fall through to CSV splitting.
      }
    }

    return uniqueStrings(value.split(CSV_DELIMITERS)).slice(0, limit);
  }

  // null, undefined, numbers, objects, anything else → safe empty array
  return [];
}

/**
 * True when any of the normalized skills matches the query (case-insensitive
 * substring). Safe for empty/invalid input.
 */
export function skillsMatchQuery(skills, query) {
  if (!query) return true;
  const q = String(query).trim().toLowerCase();
  if (!q) return true;
  return normalizeSkills(skills).some((skill) => skill.toLowerCase().includes(q));
}

/**
 * First skill, humanized ("Java") — or a fallback when no skills exist.
 * Used for empty-skill states so the UI says "No skills available" instead of
 * rendering nothing or crashing.
 */
export function firstSkill(skills, fallback = "") {
  const [first] = normalizeSkills(skills);
  return first || fallback;
}

export default normalizeSkills;
