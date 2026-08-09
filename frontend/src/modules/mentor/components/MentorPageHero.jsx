import Icon from "../../common/dashboard/Icon";
import HeroSection from "../../../components/HeroSection";

/**
 * MentorPageHero — hero for mentor list pages (Calendar, Sessions, Skills,
 * Settings, Notifications, Saved Mentors, …). Delegates to the shared
 * <HeroSection /> so every page renders the same unified gradient / radius /
 * buttons. Actions render after the copy via {children}.
 */
// Mentor Workspace heroes are standardized on the compact variant so every
// page (Dashboard, Manage Sessions, Students, Calendar, Messages, Wallet,
// Settings, …) shares the SAME height/padding/type via one class.
export default function MentorPageHero({ eyebrow, icon, title, sub, children }) {
  return (
    <HeroSection
      className="hero-section--compact"
      badge={eyebrow ? (
        <>
          {icon ? <Icon name={icon} /> : null} {eyebrow}
        </>
      ) : undefined}
      title={title}
      subtitle={sub}
      ariaLabel={title}
      illustration={
        icon ? (
          <div className="mp-hero__watermark mp-hero__watermark--shared" aria-hidden="true">
            <Icon name={icon} />
          </div>
        ) : undefined
      }
    >
      {children}
    </HeroSection>
  );
}
