import { ChevronLeft, ChevronRight } from "lucide-react";

/** Compact window of page numbers with ellipsis. */
function pageWindow(page, totalPages) {
  const current = Math.min(page, totalPages - 1);
  const out = new Set([0, totalPages - 1, current - 1, current, current + 1]);
  const sorted = [...out].filter((p) => p >= 0 && p < totalPages).sort((a, b) => a - b);
  const result = [];
  let prev = -1;
  for (const p of sorted) {
    if (prev >= 0 && p - prev > 1) result.push("…");
    result.push(p);
    prev = p;
  }
  return result;
}

/**
 * AuPagination — shared 40px numbered pagination with prev/next controls,
 * ellipsis window, and a "Showing x–y of z" info line.
 */
export default function AuPagination({ page, totalPages, totalElements, pageSize, onChange, loading }) {
  if (totalPages <= 1 && totalElements <= pageSize) {
    return (
      <div className="au-pagination">
        <span className="au-pagination__info">
          {totalElements === 0 ? "0 results" : `Showing 1–${totalElements} of ${totalElements}`}
        </span>
      </div>
    );
  }

  const pages = pageWindow(page, totalPages);

  return (
    <div className="au-pagination">
      <span className="au-pagination__info">
        {totalElements === 0
          ? "0 results"
          : `Showing ${page * pageSize + 1}–${Math.min((page + 1) * pageSize, totalElements)} of ${totalElements}`}
      </span>

      <nav className="au-pagination__controls" aria-label="Pagination">
        <button
          type="button"
          className="au-page-btn"
          disabled={page === 0 || loading}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={18} />
        </button>

        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`e-${i}`} className="au-pagination__ellipsis" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className={`au-page-btn${p === page ? " is-active" : ""}`}
              aria-label={`Page ${p + 1}`}
              aria-current={p === page ? "page" : undefined}
              onClick={() => onChange(p)}
              disabled={loading}
            >
              {p + 1}
            </button>
          ),
        )}

        <button
          type="button"
          className="au-page-btn"
          disabled={page + 1 >= totalPages || loading}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={18} />
        </button>
      </nav>
    </div>
  );
}
