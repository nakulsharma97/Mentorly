import { Link } from "react-router";
import Icon from "../../../common/dashboard/Icon";
import { formatDate } from "./data";
import { EmptyState, Reveal, SectionHeader } from "./ui";

const GRADIENT = "linear-gradient(135deg,#0f766e 0%,#14b8a6 60%,#34d399 120%)";

function EarnedCard({ cert }) {
  const shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
    typeof window !== "undefined" ? window.location.origin + "/learner/certificates" : "https://skillswap.app",
  )}&title=${encodeURIComponent(`${cert.title} — earned on SkillSwap`)}`;
  return (
    <article className="lp-cert">
      <div className="lp-cert__banner" style={{ background: GRADIENT }}>
        <span className="lp-cert__seal"><Icon name="workspace_premium" /></span>
        <span className="lp-cert__shine" />
      </div>
      <div className="lp-cert__body">
        <span className="lp-cert__status is-earned"><Icon name="verified" /> Earned</span>
        <h3>{cert.title}</h3>
        <p className="lp-cert__meta">
          Issued {formatDate(cert.issuedAt)} · {cert.issuedBy}
        </p>
        <p className="lp-cert__id">ID: {cert.certificateId || "—"}</p>
        <div className="lp-cert__actions">
          <Link to="/learner/certificates" className="lp-btn lp-btn--outline lp-btn--sm">
            <Icon name="download" /> Download
          </Link>
          <a href={shareUrl} target="_blank" rel="noreferrer" className="lp-btn lp-btn--outline lp-btn--sm">
            <Icon name="linked_camera" /> LinkedIn
          </a>
          <Link to="/learner/certificates" className="lp-btn lp-btn--ghost lp-btn--sm">
            <Icon name="visibility" /> Preview
          </Link>
        </div>
      </div>
    </article>
  );
}

function LockedCard({ cert }) {
  const upcoming = cert.status === "upcoming";
  return (
    <article className="lp-cert is-locked">
      <div className="lp-cert__banner lp-cert__banner--muted">
        <span className="lp-cert__seal">{upcoming ? "🎯" : <Icon name="lock" />}</span>
      </div>
      <div className="lp-cert__body">
        <span className={`lp-cert__status ${upcoming ? "is-upcoming" : "is-locked"}`}>
          {upcoming ? "Up next" : "Locked"}
        </span>
        <h3>{cert.title}</h3>
        <p className="lp-cert__meta">
          {upcoming
            ? "Finish the current milestone to earn this certificate."
            : "Complete this roadmap milestone to unlock."}
        </p>
        <div className="lp-cert__actions">
          <Link to="/learner/path" className="lp-btn lp-btn--primary lp-btn--sm">
            <Icon name="route" /> View Roadmap
          </Link>
        </div>
      </div>
    </article>
  );
}

/** Earned + upcoming + locked certificates. */
export default function CertificatesSection({ certificates }) {
  const { earned, upcoming, locked } = certificates;
  const hasAny = earned.length || upcoming.length || locked.length;

  return (
    <section className="lp-section" aria-label="Certificates">
      <Reveal>
        <SectionHeader
          icon="workspace_premium"
          title="Certificates"
          subtitle="Your verified proof of learning — earn one per completed milestone"
        />
      </Reveal>

      {!hasAny ? (
        <Reveal delay={0.05}>
          <EmptyState
            icon="workspace_premium"
            title="Your first certificate is waiting"
            description="Complete a roadmap milestone to earn a shareable, verifiable SkillSwap certificate."
            actions={
              <Link to="/learner/path" className="lp-btn lp-btn--primary">
                <Icon name="route" /> View Roadmap
              </Link>
            }
          />
        </Reveal>
      ) : (
        <Reveal delay={0.05}>
          <div className="lp-cert-grid">
            {earned.map((c) => (
              <EarnedCard key={c.id || c.title} cert={c} />
            ))}
            {upcoming.map((c) => (
              <LockedCard key={`up-${c.title}`} cert={c} />
            ))}
            {locked.map((c) => (
              <LockedCard key={`lk-${c.title}`} cert={c} />
            ))}
          </div>
        </Reveal>
      )}
    </section>
  );
}
