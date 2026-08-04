import { initialsOf } from "../utils";

/**
 * Avatar with graceful initials fallback and an online/presence indicator.
 */
export default function Avatar({ name, imageUrl, online, size = 44, showStatus = true }) {
  return (
    <span className="ms-avatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {imageUrl ? (
        <img src={imageUrl} alt="" className="ms-avatar__img" />
      ) : (
        <span className="ms-avatar__initials">{initialsOf(name)}</span>
      )}
      {showStatus && (
        <span
          className={`ms-avatar__dot${online ? " is-online" : ""}`}
          style={size <= 40 ? { width: 10, height: 10 } : undefined}
          aria-hidden="true"
        />
      )}
    </span>
  );
}
