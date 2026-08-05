/**
 * Compact assignment card — icon, title, status chip and a download button.
 * status: "reviewed" | "pending" | "progress" | "done"
 */
export default function AssignmentCard({ title, sub, status = "pending", onDownload }) {
  const chip = {
    reviewed: ["ss-chip--reviewed", "Reviewed"],
    pending: ["ss-chip--pending", "Pending"],
    progress: ["ss-chip--progress", "In progress"],
    done: ["ss-chip--done", "Completed"],
  }[status] || ["ss-chip--pending", "Pending"];

  return (
    <div className="ss-assignment">
      <span className="ss-assignment__icon">
        <span className="material-symbols-outlined">assignment</span>
      </span>
      <div className="ss-assignment__body">
        <p className="ss-assignment__title">{title}</p>
        {sub ? <p className="ss-assignment__sub">{sub}</p> : null}
      </div>
      <span className={`ss-chip ${chip[0]}`}>{chip[1]}</span>
      {onDownload && (
        <button
          type="button"
          className="ss-assignment__btn"
          title="Download report"
          aria-label={`Download ${title}`}
          onClick={onDownload}
        >
          <span className="material-symbols-outlined">download</span>
        </button>
      )}
    </div>
  );
}
