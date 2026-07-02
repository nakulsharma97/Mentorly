import SectionCard, { EmptyState } from "../../../common/dashboard/SectionCard";
import Icon from "../../../common/dashboard/Icon";

/** Earned certificates list. */
export default function Certificates({ certificates = [] }) {
  return (
    <SectionCard
      title="Certificates"
      icon="workspace_premium"
      action="View all"
      actionTo="/learner/certificates"
    >
      {certificates.length === 0 ? (
        <EmptyState
          icon="verified"
          title="No certificates yet"
          description="Complete sessions and milestones to earn credibility badges."
        />
      ) : (
        <div className="md-rows" style={{ gap: 10 }}>
          {certificates.slice(0, 4).map((c) => (
            <div key={c.id} className="ld-cert">
              <span className="ld-cert__icon">
                <Icon name="workspace_premium" />
              </span>
              <div className="md-row__main">
                <p className="md-row__title">{c.title || "Certificate"}</p>
                {c.description && (
                  <p className="md-row__meta" style={{ margin: 0 }}>
                    {c.description}
                  </p>
                )}
              </div>
              <Icon name="verified" style={{ color: "var(--brand)" }} />
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
