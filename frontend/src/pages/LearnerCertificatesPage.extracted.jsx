import { useState } from "react";
import HeroSection from "../components/HeroSection";
import { useDocumentTitle, apiGet, apiPost, useResource, formatDate } from "./learner-utils";
import { pageContent } from "../utils/pagination";
import "../modules/mentor/mentor-pages.css";

/* Certificate card component */
function CertificateCard({ certificate }) {
  return (
    <div className="mp-card mp-animate" style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: "var(--mp-radius)",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "var(--mp-primary-light)", color: "var(--mp-primary)"
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 24 }}>workspace_premium</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <strong style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--mp-text)", display: "block" }}>
            {certificate.title || "Certificate"}
          </strong>
          <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--mp-text-secondary)" }}>
            {formatDate(certificate.issuedAt)}
          </p>
        </div>
      </div>
      {certificate.description && (
        <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--mp-text-secondary)", lineHeight: 1.5 }}>
          {certificate.description}
        </p>
      )}
      {certificate.code && (
        <div style={{
          marginTop: 10, padding: "6px 12px", borderRadius: 8,
          background: "var(--mp-primary-light)", fontSize: "0.78rem",
          fontFamily: "monospace", fontWeight: 700, color: "var(--mp-primary)"
        }}>
          {certificate.code}
        </div>
      )}
    </div>
  );
}

export default function LearnerCertificatesPage() {
  useDocumentTitle("Certificates");
  const [refreshKey, setRefreshKey] = useState(0);
  const { loading, data, error } = useResource(
    () => apiGet("/api/v1/certifications/me"),
    [refreshKey],
  );
  const certificates = pageContent(data);

  async function refreshCertificates() {
    try {
      await apiPost("/api/v1/certifications/evaluate");
      setRefreshKey((value) => value + 1);
    } catch (refreshError) {
      window.console.error(refreshError);
    }
  }

  if (loading) {
    return (
      <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div className="mp-settings-loading">
          <div className="mp-spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
          <p className="mp-settings-loading__text">Loading certificates…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div className="md-empty" style={{ margin: "48px auto", maxWidth: 420 }}>
          <div className="md-empty__icon">
            <span className="material-symbols-outlined">error_outline</span>
          </div>
          <h3 className="md-empty__title">Could not load certificates</h3>
          <p className="md-empty__desc">{error}</p>
          <button type="button" className="mp-btn mp-btn--primary" onClick={() => setRefreshKey((v) => v + 1)}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
      <HeroSection
        className="hero-section--compact"
        badge={
          <>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>verified</span>
            Certificates
          </>
        }
        title="Your Certificates"
        subtitle="View and manage certificates issued for completed sessions and achievements."
        primaryButton={
          <button
            type="button"
            className="hero-section__btn hero-section__btn--primary"
            onClick={refreshCertificates}
          >
            <span className="material-symbols-outlined">refresh</span>
            Re-evaluate
          </button>
        }
        illustration={
          <div className="hero-section__watermark" aria-hidden="true">
            <span className="material-symbols-outlined">workspace_premium</span>
          </div>
        }
      />

      <div className="mp-stats" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginTop: 20 }}>
        <div className="mp-stat">
          <div className="mp-stat__top">
            <div className="mp-stat__icon">
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>workspace_premium</span>
            </div>
          </div>
          <p className="mp-stat__value">{certificates.length}</p>
          <p className="mp-stat__label">Certificates</p>
          <p className="mp-stat__desc">Issued on your account</p>
        </div>
        <div className="mp-stat">
          <div className="mp-stat__top">
            <div className="mp-stat__icon">
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>verified</span>
            </div>
          </div>
          <p className="mp-stat__value">{certificates.length ? "Yes" : "No"}</p>
          <p className="mp-stat__label">Ready</p>
          <p className="mp-stat__desc">Backend evaluation status</p>
        </div>
        <div className="mp-stat">
          <div className="mp-stat__top">
            <div className="mp-stat__icon">
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>calendar_month</span>
            </div>
          </div>
          <p className="mp-stat__value">{certificates[0] ? formatDate(certificates[0].issuedAt) : "TBD"}</p>
          <p className="mp-stat__label">Latest</p>
          <p className="mp-stat__desc">Most recent issuance</p>
        </div>
        <div className="mp-stat">
          <div className="mp-stat__top">
            <div className="mp-stat__icon">
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>badge</span>
            </div>
          </div>
          <p className="mp-stat__value">{certificates[0]?.code ? 1 : 0}</p>
          <p className="mp-stat__label">Codes</p>
          <p className="mp-stat__desc">Certificate codes present</p>
        </div>
      </div>

      <div className="mp-card" style={{ marginTop: 18 }}>
        <div className="mp-section__head">
          <div className="mp-section__title">
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: "var(--mp-primary)" }}>workspace_premium</span>
            Certificate Gallery
          </div>
        </div>
        {certificates.length ? (
          <div className="mp-animate-stagger lp-grid lp-grid--certificates" style={{ margin: 0, padding: 0 }}>
            {certificates.map((certificate) => (
              <CertificateCard key={certificate.id} certificate={certificate} />
            ))}
          </div>
        ) : (
          <div className="md-empty" style={{ border: "none", padding: "32px 0" }}>
            <div className="md-empty__icon">
              <span className="material-symbols-outlined">workspace_premium</span>
            </div>
            <h3 className="md-empty__title">No certificates yet</h3>
            <p className="md-empty__desc">
              Complete mentor sessions to earn certificates. Use the Re-evaluate button above to check for new eligible certificates.
            </p>
            <button
              type="button"
              className="mp-btn mp-btn--primary mp-btn--sm"
              onClick={refreshCertificates}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
              Re-evaluate
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
