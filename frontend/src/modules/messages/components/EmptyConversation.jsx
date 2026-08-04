/**
 * Shared empty-state with icon, title, description and optional actions.
 */
export default function EmptyConversation({
  icon = "forum",
  title,
  description,
  actions,
  compact = false,
  hero = false,
}) {
  return (
    <div className={`ms-empty${compact ? " ms-empty--compact" : ""}${hero ? " ms-empty--hero" : ""}`}>
      <div className="ms-empty__icon" aria-hidden="true">
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <h3 className="ms-empty__title">{title}</h3>
      {description && <p className="ms-empty__desc">{description}</p>}
      {actions && <div className="ms-empty__actions">{actions}</div>}
    </div>
  );
}
