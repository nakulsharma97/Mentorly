import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  CheckCircle2,
  Eye,
  Flag,
  MoreVertical,
  Scale,
  Search,
  StickyNote,
  Trash2,
  UserCheck,
  UserX,
  Zap,
} from "lucide-react";
import StatusBadge from "./StatusBadge";
import PriorityBadge from "./PriorityBadge";
import UserCell from "./UserCell";
import { TARGET_LABELS, formatDay } from "./reportsConfig";

/**
 * ReportsTable — the reports queue. Each row shows reporter / reported user,
 * target, reason, status, priority, date and actions (View Details + a
 * three-dot quick-action menu).
 */
export default function ReportsTable({
  reports,
  sortBy,
  sortDir,
  selectedId,
  loading = false,
  onSort,
  onView,
  onQuickAction,
}) {
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (openMenuId === null) return undefined;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenuId(null);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpenMenuId(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenuId]);

  return (
    <section className={`rpt-table-card${loading ? " is-refreshing" : ""}`} aria-label="Reports queue" aria-busy={loading}>
      <div className="rpt-table-wrap">
        <table className="rpt-table">
          <thead>
            <tr>
              <th>{sortHeader("Report", "id", sortBy, sortDir, onSort)}</th>
              <th>Reported By</th>
              <th>Reported User</th>
              <th>Target Type</th>
              <th>Reason</th>
              <th>{sortHeader("Status", "status", sortBy, sortDir, onSort)}</th>
              <th>{sortHeader("Priority", "priority", sortBy, sortDir, onSort)}</th>
              <th>{sortHeader("Reported On", "createdAt", sortBy, sortDir, onSort)}</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => {
              const isSelected = report.id === selectedId;
              const hasUser = Boolean(report.reportedUserId);
              const isActive = report.status === "OPEN" || report.status === "IN_REVIEW";
              return (
                <tr key={report.id} className={isSelected ? "is-selected" : ""}>
                  <td>
                    <button type="button" className="rpt-id" onClick={() => onView(report)}>
                      #{report.id}
                    </button>
                  </td>
                  <td>
                    <UserCell name={report.reporterName} email={report.reporterEmail} />
                  </td>
                  <td>
                    {hasUser ? (
                      <UserCell
                        name={report.reportedName}
                        email={report.reportedEmail}
                        tone="gray"
                        suspended={report.reportedEnabled === false}
                      />
                    ) : (
                      <span className="rpt-muted">—</span>
                    )}
                  </td>
                  <td>
                    <div>
                      <span className="rpt-target">
                        <Flag size={12} aria-hidden="true" />
                        {TARGET_LABELS[report.targetType] || report.targetType || "User"}
                      </span>
                      {report.targetLabel && <em className="rpt-target__label">{report.targetLabel}</em>}
                    </div>
                  </td>
                  <td>
                    <p className="rpt-reason" title={report.reason}>{report.reason}</p>
                  </td>
                  <td>
                    <StatusBadge status={report.status} />
                  </td>
                  <td>
                    <PriorityBadge priority={report.priority} />
                  </td>
                  <td>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--rpt-text-2)", whiteSpace: "nowrap" }}>
                      {formatDay(report.createdAt)}
                    </span>
                  </td>
                  <td>
                    <div className="rpt-row-actions">
                      <button
                        type="button"
                        className="rpt-view-btn"
                        onClick={() => onView(report)}
                        aria-label={`View details for report ${report.id}`}
                      >
                        <Eye size={15} aria-hidden="true" />
                        View Details
                      </button>
                      <div className="rpt-menu-wrap" ref={openMenuId === report.id ? menuRef : undefined}>
                        <button
                          type="button"
                          className="rpt-menu-btn"
                          onClick={() => setOpenMenuId((v) => (v === report.id ? null : report.id))}
                          aria-label={`Actions for report ${report.id}`}
                          aria-haspopup="menu"
                          aria-expanded={openMenuId === report.id}
                        >
                          <MoreVertical size={18} />
                        </button>
                        {openMenuId === report.id && (
                          <MenuItems
                            report={report}
                            hasUser={hasUser}
                            isActive={isActive}
                            onAction={onQuickAction}
                            onClose={() => setOpenMenuId(null)}
                          />
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function sortHeader(label, column, sortBy, sortDir, onSort) {
  const active = sortBy === column;
  const Icon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      type="button"
      className={`rpt-th-sort${active ? " is-active" : ""}`}
      onClick={() => onSort(column)}
      aria-label={`Sort by ${label}`}
    >
      {label}
      <Icon size={13} aria-hidden="true" />
    </button>
  );
}

/** Builds the quick-action list for the three-dot menu. */
function MenuItems({ report, hasUser, isActive, onAction, onClose }) {
  const items = [
    // Assignment only makes sense for reports still in the workflow.
    ...(isActive ? [{ key: "ASSIGN", label: "Assign to me", icon: UserCheck }] : []),
    ...(report.status === "OPEN"
      ? [{ key: "IN_REVIEW", label: "Start investigation", icon: Search }]
      : []),
    ...(isActive
      ? [
          { key: "RESOLVED", label: "Resolve report", icon: CheckCircle2 },
          { key: "REJECTED", label: "Reject report", icon: Ban },
        ]
      : []),
    { key: "PRIORITY", label: "Set priority", icon: Zap },
    { key: "NOTE", label: "Add note", icon: StickyNote },
  ];

  if (hasUser) {
    items.push(
      report.reportedEnabled === false
        ? { key: "RESTORE", label: "Restore account", icon: UserCheck }
        : { key: "SUSPEND", label: "Suspend user", icon: UserX },
    );
  }
  if (isActive) {
    items.push({ key: "DELETE", label: "Delete spam", icon: Trash2, danger: true });
  }

  return (
    <motion.div
      className="rpt-menu"
      role="menu"
      aria-label={`Actions for report ${report.id}`}
      initial={{ opacity: 0, scale: 0.95, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.15 }}
    >
      <p className="rpt-menu__label">
        <Scale size={11} /> Report #{report.id}
      </p>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          className={`rpt-menu__item${item.danger ? " rpt-menu__item--danger" : ""}`}
          onClick={() => {
            onClose?.();
            onAction(report, item.key);
          }}
        >
          <item.icon size={16} aria-hidden="true" />
          {item.label}
        </button>
      ))}
    </motion.div>
  );
}
