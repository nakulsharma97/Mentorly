import "./MentorCertifications.css";

const formatDate = (value) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
};

/**
 * Read-only display of a mentor's professional certifications.
 * Renders nothing when there are no certifications so the section
 * only appears when backed by real data.
 */
export default function MentorCertifications({ certifications = [] }) {
  if (!Array.isArray(certifications) || certifications.length === 0) {
    return null;
  }

  return (
    <section className="dashboard-card mentor-section-card">
      <div className="cert-section-header">
        <div>
          <h3>Professional Certifications</h3>
          <p className="cert-section-copy">
            Verified credentials this mentor has earned.
          </p>
        </div>
      </div>

      <div className="cert-grid">
        {certifications.map((cert) => {
          const issued = formatDate(cert.issueDate);
          return (
            <article className="cert-card" key={cert.id}>
              <div className="cert-card-top">
                {cert.certificateImage ? (
                  <img
                    className="cert-logo"
                    src={cert.certificateImage}
                    alt={`${cert.issuingOrganization || "Certification"} logo`}
                    loading="lazy"
                  />
                ) : (
                  <span className="cert-logo-fallback" aria-hidden="true">
                    <span className="material-symbols-outlined">
                      workspace_premium
                    </span>
                  </span>
                )}
                <div className="cert-card-heading">
                  <p className="cert-name">{cert.certificationName}</p>
                  {cert.issuingOrganization && (
                    <p className="cert-org">{cert.issuingOrganization}</p>
                  )}
                </div>
              </div>

              <div className="cert-meta">
                {issued && <span>Issued {issued}</span>}
                {cert.verificationUrl && (
                  <a
                    className="cert-badge-verified"
                    href={cert.verificationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <span className="material-symbols-outlined">verified</span>
                    Verified
                  </a>
                )}
              </div>

              {cert.description && <p className="cert-desc">{cert.description}</p>}

              {cert.certificateUrl && (
                <div className="cert-links">
                  <a
                    className="cert-link"
                    href={cert.certificateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View certificate
                  </a>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
