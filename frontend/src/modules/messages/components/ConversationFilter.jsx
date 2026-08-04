import { useState, useRef, useEffect } from "react";

const TABS = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "students", label: "Students" },
  { value: "mentors", label: "Mentors" },
  { value: "archived", label: "Archived" },
];

const DROPDOWN_FILTERS = [
  { value: "read", label: "Read" },
  { value: "pinned", label: "Pinned" },
  { value: "active-session", label: "Active Session" },
  { value: "blocked", label: "Blocked" },
];

export default function ConversationFilter({
  tab,
  onTab,
  quickFilter,
  onQuickFilter,
  sort,
  onSort,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeDropdownLabel = DROPDOWN_FILTERS.find(
    (f) => f.value === quickFilter
  )?.label || "Filter";

  return (
    <div className="ms-filtering-v2" aria-label="Conversation filters">
      <div className="ms-tabs-v2" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={tab === item.value}
            className={`ms-tab-v2__btn ${tab === item.value ? "is-active" : ""}`}
            onClick={() => onTab?.(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="ms-filter-controls-v2">
        {/* Advanced Dropdown Filter */}
        <div className="ms-dropdown-v2" ref={dropdownRef}>
          <button
            type="button"
            className={`ms-dropdown-v2__trigger ${
              quickFilter ? "has-active-filter" : ""
            }`}
            onClick={() => setDropdownOpen((prev) => !prev)}
            aria-haspopup="true"
            aria-expanded={dropdownOpen}
          >
            <span className="material-symbols-outlined dropdown-icon-left">filter_list</span>
            <span>{activeDropdownLabel}</span>
            <span className="material-symbols-outlined dropdown-icon-right">expand_more</span>
          </button>

          {dropdownOpen && (
            <div className="ms-dropdown-v2__menu" role="menu">
              {DROPDOWN_FILTERS.map((f) => {
                const isActive = quickFilter === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    role="menuitem"
                    className={`ms-dropdown-v2__item ${
                      isActive ? "is-active" : ""
                    }`}
                    onClick={() => {
                      onQuickFilter?.(isActive ? "" : f.value);
                      setDropdownOpen(false);
                    }}
                  >
                    <span className="material-symbols-outlined checkbox-icon">
                      {isActive ? "check_box" : "check_box_outline_blank"}
                    </span>
                    <span>{f.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Sort selector */}
        <div className="ms-sort-v2">
          <span className="material-symbols-outlined">sort</span>
          <select
            value={sort}
            onChange={(e) => onSort?.(e.target.value)}
            aria-label="Sort conversations"
          >
            <option value="recent">Recent</option>
            <option value="oldest">Oldest</option>
          </select>
        </div>
      </div>
    </div>
  );
}
