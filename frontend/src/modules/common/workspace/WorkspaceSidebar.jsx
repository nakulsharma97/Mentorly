import { NavLink } from "react-router-dom";
import SsIcon from "../../../components/ui/SsIcon";
import { initials } from "../dashboard/dashboardUtils";

/**
 * SkillSwap Sidebar — uses Lucide icons via SsIcon.
 * @param brand         { title, subtitle }
 * @param groups        [{ label, links: [{ to, label, icon, end }] }]
 * @param secondaryLinks[{ to, label, icon }]
 */
export default function WorkspaceSidebar({
  brand,
  groups = [],
  secondaryLinks = [],
  profile,
  onLogout,
  collapsed = false,
  mobileOpen = false,
  onCloseMobile,
}) {
  const fullName = String(profile?.fullName || brand?.title || "User").trim();
  const isRoleMentor = brand?.title === "SkillSwap";

  const renderLink = (item, secondary = false) => (
    <NavLink
      key={item.label + item.to}
      to={item.to}
      end={item.end}
      onClick={onCloseMobile}
      className={({ isActive }) =>
        `ws-sb__link${isActive ? " is-active" : ""}${secondary ? " ws-sb__link--sm" : ""}`
      }
      title={collapsed ? item.label : undefined}
    >
      <span className="ws-sb__link-rail" />
      <SsIcon name={item.icon} size={20} className="ws-sb__link-icon" />
      <span className="ws-sb__link-label">{item.label}</span>
    </NavLink>
  );

  return (
    <>
      <div
        className={`ws-sb__scrim${mobileOpen ? " is-open" : ""}`}
        onClick={onCloseMobile}
        aria-hidden="true"
      />
      <aside
        className={`ws-sb${collapsed ? " is-collapsed" : ""}${mobileOpen ? " is-mobile-open" : ""}`}
      >
        <div className="ws-sb__brand">
          <div className="ws-sb__logo" aria-label="SkillSwap">
            <SsIcon name="zap" size={22} strokeWidth={2.5} />
          </div>
          <div className="ws-sb__brand-copy">
            <p className="ws-sb__brand-title">{brand?.title || "SkillSwap"}</p>
            <p className="ws-sb__brand-sub">{brand?.subtitle}</p>
          </div>
        </div>

        <nav className="ws-sb__nav" aria-label="Workspace sections">
          {groups.map((group) => (
            <div key={group.label}>
              {group.label && <p className="ws-sb__group-label">{group.label}</p>}
              {group.links.map((item) => renderLink(item))}
            </div>
          ))}
        </nav>

        <div className="ws-sb__bottom">
          <div className="ws-sb__divider" />
          {secondaryLinks.length > 0 && (
            <>
              <p className="ws-sb__group-label">Account</p>
              {secondaryLinks.map((item) => renderLink(item, true))}
            </>
          )}
          <button type="button" className="ws-sb__logout" onClick={onLogout} title="Logout">
            <span className="ws-sb__link-rail" />
            <SsIcon name="logout" size={20} className="ws-sb__link-icon" />
            <span className="ws-sb__link-label">Logout</span>
          </button>

          <div className="ws-sb__user">
            <span className="ws-sb__user-avatar">{initials(fullName)}</span>
            <div className="ws-sb__user-copy">
              <strong>{fullName}</strong>
              <span>{profile?.email || brand?.subtitle}</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
