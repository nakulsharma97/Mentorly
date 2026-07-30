/**
 * User display utilities — consistent user name + @username formatting
 * across the entire application.
 *
 * Usage:
 *   {userDisplay(profile)}          → "John Doe"
 *   {userDisplay(profile, true)}    → "John Doe (@johndoe)"
 *   {userDisplayLine(profile)}      → <span>John Doe<br/>@johndoe</span>
 *   {userDisplayInline(profile)}    → <span>John Doe (@johndoe)</span>
 */

/**
 * Returns a plain string: "Name" or "Name (@username)" if username exists.
 */
export function userDisplay(user, includeUsername = true) {
  if (!user) return "";
  const name = user.fullName || "User";
  if (includeUsername && user.username) {
    return `${name} (@${user.username})`;
  }
  return name;
}

/**
 * Returns JSX with name on top and @username below (two lines).
 * Gracefully falls back to just the name if no username.
 */
export function UserNameDisplay({ user, size = "sm", link, profilePath }) {
  if (!user) return null;
  const name = user.fullName || "User";
  const sizes = {
    sm: { name: "0.85rem", username: "0.72rem", gap: "1px" },
    md: { name: "1rem", username: "0.82rem", gap: "2px" },
    lg: { name: "1.25rem", username: "0.95rem", gap: "4px" },
  };
  const s = sizes[size] || sizes.sm;

  if (!user.username) {
    return link && profilePath ? (
      <a href={profilePath} style={{ color: "inherit", textDecoration: "none", fontWeight: 600, fontSize: s.name }}>
        {name}
      </a>
    ) : (
      <span style={{ fontWeight: 600, fontSize: s.name }}>{name}</span>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: s.gap, lineHeight: 1.2 }}>
      {link && profilePath ? (
        <a href={profilePath} style={{ color: "inherit", textDecoration: "none", fontWeight: 600, fontSize: s.name }}>
          {name}
        </a>
      ) : (
        <span style={{ fontWeight: 600, fontSize: s.name }}>{name}</span>
      )}
      <span style={{ color: "var(--ss-text-muted, #94a3b8)", fontSize: s.username, fontWeight: 500 }}>
        @{user.username}
      </span>
    </div>
  );
}

/**
 * Returns inline JSX: "Name (@username)"
 */
export function UserInline({ user, link, profilePath }) {
  if (!user) return null;
  const name = user.fullName || "User";

  const content = user.username ? (
    <span style={{ whiteSpace: "nowrap" }}>
      {name} <span style={{ color: "var(--ss-text-muted, #94a3b8)", fontWeight: 500 }}>(@{user.username})</span>
    </span>
  ) : (
    <span>{name}</span>
  );

  if (link && profilePath) {
    return <a href={profilePath} style={{ color: "inherit", textDecoration: "none" }}>{content}</a>;
  }
  return content;
}
