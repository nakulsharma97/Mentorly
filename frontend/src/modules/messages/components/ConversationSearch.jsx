export default function ConversationSearch({ value, onChange, onClear }) {
  return (
    <div className="ms-sidebar__search-wrap">
      <label className="ms-search-input-v2" aria-label="Search conversations">
        <span className="material-symbols-outlined">search</span>
        <input
          value={value || ""}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder="Search conversations..."
        />
        {value ? (
          <button
            type="button"
            className="ms-search-clear-v2"
            onClick={onClear}
            aria-label="Clear search"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        ) : null}
      </label>
    </div>
  );
}
