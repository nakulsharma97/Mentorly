/**
 * Search & filter toolbar — one row: search (420px), skill / status /
 * upcoming-session / sort selects and a reset-filters button with an active
 * filter badge.
 */
export default function StudentSearchBar({
  search,
  onSearch,
  skillOptions = [],
  skill,
  onSkill,
  status,
  onStatus,
  upcoming,
  onUpcoming,
  sort,
  onSort,
  activeFilterCount = 0,
  onReset,
}) {
  return (
    <div className="ss-toolbar" role="search" aria-label="Search and filter students">
      <label className="ss-toolbar__search">
        <span className="material-symbols-outlined" aria-hidden="true">search</span>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search student by name, email, skill or roadmap..."
          aria-label="Search students"
        />
      </label>

      <select
        className="ss-toolbar__select"
        value={skill}
        onChange={(e) => onSkill(e.target.value)}
        aria-label="Filter by skill"
      >
        <option value="all">All skills</option>
        {skillOptions.map((k) => (
          <option key={k} value={k}>{k}</option>
        ))}
      </select>

      <select
        className="ss-toolbar__select"
        value={status}
        onChange={(e) => onStatus(e.target.value)}
        aria-label="Filter by status"
      >
        <option value="all">All statuses</option>
        <option value="active">Active</option>
        <option value="pending">Pending</option>
        <option value="completed">Completed</option>
        <option value="inactive">Inactive</option>
      </select>

      <select
        className="ss-toolbar__select"
        value={upcoming}
        onChange={(e) => onUpcoming(e.target.value)}
        aria-label="Filter by upcoming session"
      >
        <option value="all">Upcoming session</option>
        <option value="has">With upcoming</option>
        <option value="none">No upcoming</option>
      </select>

      <select
        className="ss-toolbar__select"
        value={sort}
        onChange={(e) => onSort(e.target.value)}
        aria-label="Sort students"
      >
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="name">Name (A–Z)</option>
        <option value="progress">Progress</option>
        <option value="sessions">Sessions</option>
      </select>

      <button
        type="button"
        className="ss-toolbar__filter"
        onClick={onReset}
        disabled={activeFilterCount === 0}
        title={activeFilterCount ? "Reset all filters" : "No active filters"}
        aria-label="Reset filters"
      >
        <span className="material-symbols-outlined">tune</span>
        {activeFilterCount > 0 && (
          <span className="ss-toolbar__filter-badge">{activeFilterCount}</span>
        )}
      </button>
    </div>
  );
}
