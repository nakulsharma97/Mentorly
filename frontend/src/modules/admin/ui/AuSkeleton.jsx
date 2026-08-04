/**
 * AuSkeleton — shimmer loading rows used while any admin list loads.
 * `rows` controls the number of skeleton rows.
 */
export default function AuSkeleton({ rows = 4, label = "Loading" }) {
  return (
    <section className="au-table-card" aria-busy="true" aria-label={label}>
      <div className="au-skeleton" style={{ padding: 8 }}>
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="au-skel__row">
            <span className="au-skel au-skel__avatar" />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="au-skel au-skel__line" style={{ width: "22%", height: 16 }} />
              <span className="au-skel au-skel__line" style={{ width: "34%" }} />
            </div>
            <span className="au-skel au-skel__line" style={{ width: "12%" }} />
            <span className="au-skel au-skel__line" style={{ width: "16%" }} />
            <span className="au-skel au-skel__line" style={{ width: "20%" }} />
          </div>
        ))}
      </div>
    </section>
  );
}
