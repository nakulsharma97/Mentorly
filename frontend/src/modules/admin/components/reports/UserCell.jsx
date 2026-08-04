import { ShieldAlert } from "lucide-react";
import { initialsOf } from "./reportsConfig";

/**
 * UserCell — avatar (40px) + name + email for table cells and the drawer.
 * `tone` picks the avatar gradient; `suspended` adds a warning line.
 */
export default function UserCell({ name, email, tone = "default", suspended = false }) {
  const display = name || "Unknown";
  return (
    <div className="rpt-user">
      <span className={`rpt-avatar${tone === "gray" ? " rpt-avatar--gray" : ""}${tone === "red" ? " rpt-avatar--red" : ""}`} aria-hidden="true">
        {initialsOf(display)}
      </span>
      <div style={{ minWidth: 0 }}>
        <p className="rpt-user__name" title={display}>{display}</p>
        <p className="rpt-user__email" title={email}>{email}</p>
        {suspended && (
          <span className="rpt-user__suspended">
            <ShieldAlert size={12} aria-hidden="true" /> Suspended
          </span>
        )}
      </div>
    </div>
  );
}
