import { CalendarRange, ChevronDown, Download, Search, X } from "lucide-react";
import { PRIORITY_OPTIONS, STATUS_OPTIONS, TARGET_OPTIONS } from "./reportsConfig";

/**
 * ReportsFilters — the search + filter toolbar: search input, status /
 * target / priority dropdowns, a date-range group, an export button
 * (client-side CSV) and a reset button.
 */
export default function ReportsFilters({
  search,
  onSearchChange,
  status,
  onStatusChange,
  targetType,
  onTargetTypeChange,
  priority,
  onPriorityChange,
  fromDate,
  onFromDateChange,
  toDate,
  onToDateChange,
  onExport,
  onReset,
  hasActiveFilters,
  total,
}) {
  return (
    <section className="rpt-filters" aria-label="Search and filter reports">
      <div className="rpt-search">
        <span className="rpt-search__icon" aria-hidden="true">
          <Search size={19} />
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by reporter, reported user, email, reason..."
          aria-label="Search reports"
          autoComplete="off"
        />
        {search && (
          <button
            type="button"
            className="rpt-search__clear"
            onClick={() => onSearchChange("")}
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <FilterSelect label="Filter by status" value={status} onChange={onStatusChange} options={STATUS_OPTIONS} />
      <FilterSelect label="Filter by target" value={targetType} onChange={onTargetTypeChange} options={TARGET_OPTIONS} />
      <FilterSelect label="Filter by priority" value={priority} onChange={onPriorityChange} options={PRIORITY_OPTIONS} />

      <label className="rpt-dates">
        <CalendarRange size={17} aria-hidden="true" />
        <input
          type="date"
          value={fromDate}
          onChange={(e) => onFromDateChange(e.target.value)}
          aria-label="From date"
        />
        <span>to</span>
        <input
          type="date"
          value={toDate}
          onChange={(e) => onToDateChange(e.target.value)}
          aria-label="To date"
        />
      </label>

      <button type="button" className="rpt-export" onClick={onExport} disabled={total === 0}>
        <Download size={17} aria-hidden="true" />
        Export
      </button>

      <button
        type="button"
        className="rpt-reset"
        onClick={onReset}
        disabled={!hasActiveFilters}
      >
        Reset
      </button>

      {total > 0 && <span className="rpt-filters__count">{total} report{total === 1 ? "" : "s"}</span>}
    </section>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="rpt-select">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={16} aria-hidden="true" />
    </label>
  );
}
