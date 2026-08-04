/**
 * AuAvatar — unified user avatar (initials or image). `tone` picks the
 * gradient (default teal / gray / red); `size` is sm | md | lg.
 */
export default function AuAvatar({ name, src, tone = "default", size = "md", alt }) {
  const initials = (name || "?")
    .split(/\s+/)
    .map((p) => p?.[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const cls = [
    "au-avatar",
    tone === "gray" ? "au-avatar--gray" : "",
    tone === "red" ? "au-avatar--red" : "",
    size === "sm" ? "au-avatar--sm" : "",
    size === "lg" ? "au-avatar--lg" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (src) {
    return <img className={cls} src={src} alt={alt || name || "avatar"} style={{ objectFit: "cover" }} />;
  }
  return (
    <span className={cls} aria-hidden={!alt}>
      {initials}
    </span>
  );
}
