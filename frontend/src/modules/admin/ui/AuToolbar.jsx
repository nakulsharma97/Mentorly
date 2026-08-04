import { ChevronDown, Download, Search, X } from "lucide-react";

/**
 * AuToolbar — the unified search + filter toolbar. Renders a 420px search
 * box, an array of labeled select dropdowns, and optional action buttons
 * (Export / Reset). `count` shows the total row count on the right.
 */
export default function AuToolbar({
  search,
  onSearchChange,
  placeholder = "Search...",
  selects = [],
  actions = [],
  count,
}) {
  return (
    <section className="au-toolbar" aria-label="Search and filter">
      <div className="au-search">
        <span className="au-search__icon" aria-hidden="true">
          <Search size={19} />
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          aria-label="Search"
          autoComplete="off"
        />
        {search && (
          <button
            type="button"
            className="au-search__clear"
            onClick={() => onSearchChange("")}
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {selects.map((select) => (
        <label key={select.label} className="au-select">
          <span className="sr-only">{select.label}</span>
          <select value={select.value} onChange={(e) => select.onChange(e.target.value)} aria-label={select.label}>
            {select.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown size={16} aria-hidden="true" />
        </label>
      ))}

      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          className="au-btn au-btn--outline"
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.icon === "download" && <Download size={17} aria-hidden="true" />}
          {action.label}
        </button>
      ))}

      {count !== undefined && <span className="au-toolbar__count">{count}</span>}
    </section>
  );
}
