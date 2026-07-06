import Icon from "./Icon";

/**
 * Premium metric card: icon, title, large number, growth delta and a
 * one-line description. `delta` is a number (percent) or null to hide.
 */
export default function StatsCard({ icon, label, value, delta, description }) {
  const hasDelta = delta !== null && delta !== undefined;
  const positive = Number(delta) >= 0;
  const deltaClass = !hasDelta
    ? "md-stat__delta--flat"
    : positive
      ? "md-stat__delta--pos"
      : "md-stat__delta--neg";

  return (
    <div className="md-stat">
      <div className="md-stat__top">
        <span className="md-stat__icon">
          <Icon name={icon} />
        </span>
        {hasDelta && (
          <span className={`md-stat__delta ${deltaClass}`}>
            <Icon name={positive ? "trending_up" : "trending_down"} />
            {positive ? "+" : ""}
            {delta}%
          </span>
        )}
      </div>
      <p className="md-stat__value">{value}</p>
      <p className="md-stat__label">{label}</p>
      {description && <p className="md-stat__desc">{description}</p>}
    </div>
  );
}
