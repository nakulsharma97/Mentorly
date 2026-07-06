/**
 * Single icon primitive so every dashboard surface uses the same library
 * (Material Symbols), the same stroke weight and the same sizing hooks.
 */
export default function Icon({ name, className = "", style }) {
  return (
    <span
      className={`material-symbols-outlined md__icon ${className}`.trim()}
      style={style}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
