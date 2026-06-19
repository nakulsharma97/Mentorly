import { useEffect, useState } from 'react';
import './SearchFilters.css';
import { trackAnalyticsEvent } from '../utils/analyticsEvents';

export default function SearchFilters({ value = '', onSearch, onFilterChange }) {
  const PRESET_STORAGE_KEY = 'skillswap.search.filterPresets';
  const initialFilters = {
    level: [],
    priceMin: 0,
    priceMax: 500,
    availability: [],
    rating: 0,
  };
  const [search, setSearch] = useState(value);
  const [filters, setFilters] = useState(initialFilters);
  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) || '[]');
      if (Array.isArray(stored)) setPresets(stored);
    } catch { setPresets([]); }
  }, []);

  useEffect(() => { setSearch(value); }, [value]);

  const handleSearchChange = (val) => { setSearch(val); onSearch?.(val); };

  const handleLevelToggle = (level) => {
    setFilters(prev => {
      const newLevels = prev.level.includes(level)
        ? prev.level.filter(l => l !== level)
        : [...prev.level, level];
      const updated = { ...prev, level: newLevels };
      onFilterChange?.(updated);
      return updated;
    });
  };

  const handleAvailabilityToggle = (avail) => {
    setFilters(prev => {
      const newAvail = prev.availability.includes(avail)
        ? prev.availability.filter(a => a !== avail)
        : [...prev.availability, avail];
      const updated = { ...prev, availability: newAvail };
      onFilterChange?.(updated);
      return updated;
    });
  };

  const handlePriceChange = (type, val) => {
    setFilters(prev => {
      const updated = { ...prev, [type]: val };
      onFilterChange?.(updated);
      return updated;
    });
  };

  const handleRatingChange = (val) => {
    setFilters(prev => {
      const updated = { ...prev, rating: val };
      onFilterChange?.(updated);
      return updated;
    });
  };

  const resetFilters = () => {
    setSearch('');
    setFilters(initialFilters);
    onSearch?.('');
    onFilterChange?.(initialFilters);
  };

  const savePreset = () => {
    const normalizedName = presetName.trim();
    if (!normalizedName) return;
    const next = [
      ...presets.filter(p => p.name.toLowerCase() !== normalizedName.toLowerCase()),
      { name: normalizedName, search, filters }
    ].slice(-8);
    setPresets(next);
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(next));
    setPresetName('');
    trackAnalyticsEvent('search_preset_saved', {
      name: normalizedName,
      activeFilters: { levelCount: filters.level.length, availabilityCount: filters.availability.length, rating: filters.rating, priceMax: filters.priceMax }
    });
  };

  const applyPreset = (preset) => {
    const nextSearch = String(preset.search || '');
    const nextFilters = { ...initialFilters, ...(preset.filters || {}) };
    setSearch(nextSearch);
    setFilters(nextFilters);
    onSearch?.(nextSearch);
    onFilterChange?.(nextFilters);
    trackAnalyticsEvent('search_preset_applied', { name: preset.name, hasQuery: Boolean(nextSearch.trim()) });
  };

  const deletePreset = (name) => {
    const next = presets.filter(p => p.name !== name);
    setPresets(next);
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(next));
  };

  const levelLabels = { BEGINNER: '🌱 Beginner', INTERMEDIATE: '🌿 Intermediate', EXPERT: '🚀 Expert' };
  const availLabels = { thisWeek: '📅 This Week', thisMonth: '📆 This Month', flexible: '⏰ Flexible' };

  const activeBadges = [
    ...filters.level.map(l => ({ key: `level-${l}`, label: levelLabels[l] || l, remove: () => handleLevelToggle(l) })),
    ...filters.availability.map(a => ({ key: `avail-${a}`, label: availLabels[a] || a, remove: () => handleAvailabilityToggle(a) })),
    ...(filters.rating > 0 ? [{ key: 'rating', label: `⭐ ${filters.rating}+`, remove: () => handleRatingChange(0) }] : []),
    ...(filters.priceMax < 500 ? [{ key: 'price', label: `≤ ₹${filters.priceMax}`, remove: () => handlePriceChange('priceMax', 500) }] : []),
  ];

  return (
    <div className="search-filters-container">
      {/* Search Bar */}
      <div className="search-input-wrapper">
        <span className="search-icon material-symbols-outlined">search</span>
        <input
          type="text"
          placeholder="Find mentors or skills..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="search-input"
          aria-label="Search mentors"
        />
        {search && (
          <button className="clear-search" onClick={() => handleSearchChange('')} aria-label="Clear search" type="button">✕</button>
        )}
      </div>

      {/* Active Filter Badges */}
      {activeBadges.length > 0 && (
        <div className="active-filter-bar" aria-label="Active filters">
          {activeBadges.map(badge => (
            <span key={badge.key} className="active-filter-badge">
              {badge.label}
              <button type="button" onClick={badge.remove} aria-label={`Remove ${badge.label} filter`}>✕</button>
            </span>
          ))}
          <button
            type="button"
            className="reset-filters-btn"
            onClick={resetFilters}
            style={{ padding: '3px 10px', fontSize: '0.72rem' }}
          >
            Clear all
          </button>
        </div>
      )}

      {/* Presets Row */}
      <div className="search-presets-row">
        <input
          type="text"
          className="search-preset-input"
          placeholder="Name this filter set..."
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && savePreset()}
          aria-label="Preset name"
        />
        <button type="button" className="save-preset-btn" onClick={savePreset} disabled={!presetName.trim()}>
          Save preset
        </button>
      </div>

      {presets.length > 0 && (
        <div className="search-presets-list" aria-label="Saved search presets">
          {presets.map(preset => (
            <div key={preset.name} className="search-preset-chip">
              <button type="button" className="search-preset-apply" onClick={() => applyPreset(preset)}>{preset.name}</button>
              <button type="button" className="search-preset-delete" onClick={() => deletePreset(preset.name)} aria-label={`Delete ${preset.name}`}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Filter Groups */}
      <div className="filters-wrapper">
        {/* Expertise Level */}
        <div className="filter-group">
          <h4 className="filter-title">Expertise Level</h4>
          <div className="filter-options">
            {['BEGINNER', 'INTERMEDIATE', 'EXPERT'].map(level => (
              <label key={level} className={`filter-checkbox${filters.level.includes(level) ? ' is-checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={filters.level.includes(level)}
                  onChange={() => handleLevelToggle(level)}
                />
                <span>{levelLabels[level]}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Price Range */}
        <div className="filter-group">
          <h4 className="filter-title">Price Range</h4>
          <p className="price-range-label">Up to ₹{filters.priceMax}</p>
          <input
            type="range"
            min="0"
            max="500"
            step="10"
            value={filters.priceMax}
            onChange={(e) => handlePriceChange('priceMax', Number(e.target.value))}
            className="price-slider"
            aria-label="Max price slider"
          />
          <div className="price-inputs">
            <div className="price-input-group">
              <label htmlFor="price-min">Min ₹</label>
              <input
                id="price-min"
                type="number"
                min="0"
                max="500"
                value={filters.priceMin}
                onChange={(e) => handlePriceChange('priceMin', Number(e.target.value))}
                placeholder="0"
              />
            </div>
            <span className="price-separator">–</span>
            <div className="price-input-group">
              <label htmlFor="price-max">Max ₹</label>
              <input
                id="price-max"
                type="number"
                min="0"
                max="500"
                value={filters.priceMax}
                onChange={(e) => handlePriceChange('priceMax', Number(e.target.value))}
                placeholder="500"
              />
            </div>
          </div>
        </div>

        {/* Availability */}
        <div className="filter-group">
          <h4 className="filter-title">Availability</h4>
          <div className="filter-options">
            {[
              { value: 'thisWeek', label: '📅 This Week' },
              { value: 'thisMonth', label: '📆 This Month' },
              { value: 'flexible', label: '⏰ Flexible' },
            ].map(opt => (
              <label key={opt.value} className={`filter-checkbox${filters.availability.includes(opt.value) ? ' is-checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={filters.availability.includes(opt.value)}
                  onChange={() => handleAvailabilityToggle(opt.value)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Minimum Rating */}
        <div className="filter-group">
          <h4 className="filter-title">Minimum Rating</h4>
          <div className="rating-filter">
            {[0, 3, 3.5, 4, 4.5].map(rating => (
              <button
                key={rating}
                type="button"
                className={`rating-btn${filters.rating === rating ? ' active' : ''}`}
                onClick={() => handleRatingChange(rating)}
                aria-label={rating === 0 ? 'Any rating' : `${rating}+ stars`}
                aria-pressed={filters.rating === rating}
              >
                {rating === 0 ? 'Any' : `${rating}+ ⭐`}
              </button>
            ))}
          </div>
        </div>

        {/* Reset — only shown without active badges (badges show inline clear) */}
        {activeBadges.length === 0 && (
          <div className="filter-group" style={{ justifyContent: 'flex-end' }}>
            <span />
          </div>
        )}
      </div>
    </div>
  );
}
