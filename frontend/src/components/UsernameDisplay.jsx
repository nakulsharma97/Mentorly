/**
 * UsernameDisplay — Reusable component to show a user's display name
 * with their @username handle below it.
 *
 * Usage:
 *   <UsernameDisplay name="Pritil" username="pritil9783" size="sm" />
 *   <UsernameDisplay name="Pritil" username="pritil9783" size="md" link={true} profilePath="/mentor/@pritil9783" />
 */
import { Link } from "react-router-dom";

const SIZE_MAP = {
  sm: { name: "0.85rem", username: "0.72rem", gap: "1px" },
  md: { name: "1rem", username: "0.82rem", gap: "2px" },
  lg: { name: "1.25rem", username: "0.95rem", gap: "4px" },
};

export default function UsernameDisplay({
  name,
  username,
  size = "sm",
  link = false,
  profilePath,
  className = "",
  inline = false,
}) {
  const sizes = SIZE_MAP[size] || SIZE_MAP.sm;

  if (inline) {
    return (
      <span className={className} style={{ display: "inline", whiteSpace: "nowrap" }}>
        {link && profilePath ? (
          <Link to={profilePath} style={{ color: "inherit", textDecoration: "none" }}>
            {name} <span style={{ color: "var(--ss-text-muted, #94a3b8)", fontWeight: 500 }}>(@{username})</span>
          </Link>
        ) : (
          <>
            {name} <span style={{ color: "var(--ss-text-muted, #94a3b8)", fontWeight: 500 }}>(@{username})</span>
          </>
        )}
      </span>
    );
  }

  return (
    <div
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: sizes.gap,
        lineHeight: 1.2,
      }}
    >
      {link && profilePath ? (
        <Link
          to={profilePath}
          style={{
            color: "inherit",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: sizes.name,
          }}
        >
          {name}
        </Link>
      ) : (
        <span style={{ fontWeight: 600, fontSize: sizes.name }}>{name}</span>
      )}
      <span
        style={{
          color: "var(--ss-text-muted, #94a3b8)",
          fontSize: sizes.username,
          fontWeight: 500,
        }}
      >
        @{username}
      </span>
    </div>
  );
}
