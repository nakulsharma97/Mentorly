/**
 * AuTable — the unified data-table shell. Wraps a plain <table> in the
 * rounded card with a scrollable viewport and optional busy (refetch) dimming.
 */
export default function AuTable({ columns, children, busy = false, minWidth }) {
  return (
    <section className={`au-table-card${busy ? " au-table--busy" : ""}`} aria-busy={busy || undefined}>
      <div className="au-table-wrap">
        <table className="au-table" style={minWidth ? { minWidth } : undefined}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} style={col.style || undefined}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </section>
  );
}
