import Icon from "../../common/dashboard/Icon";

/**
 * Premium page hero for mentor list pages (Students, Calendar, Reviews),
 * mirroring the learner-side PageHero so both roles feel consistent.
 * Actions render on the right of the copy via {children}.
 */
export default function MentorPageHero({ eyebrow, icon, title, sub, children }) {
  return (
    <div className="mp-hero md-animate">
      {icon ? (
        <span className="mp-hero__watermark" aria-hidden="true">
          <Icon name={icon} />
        </span>
      ) : null}
      <div className="mp-hero__content">
        {eyebrow ? (
          <div className="mp-hero__eyebrow">
            <Icon name={icon} /> {eyebrow}
          </div>
        ) : null}
        <h1>{title}</h1>
        {sub ? <p className="mp-hero__sub">{sub}</p> : null}
        {children ? <div className="mp-hero__actions">{children}</div> : null}
      </div>
    </div>
  );
}
