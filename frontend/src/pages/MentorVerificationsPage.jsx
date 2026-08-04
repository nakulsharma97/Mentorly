import { useCallback, useEffect, useMemo, useState } from "react";
import client from "../api/client";
import { normalizeSkills } from "../utils/skills";
import Icon from "../modules/common/dashboard/Icon";
import "./MentorVerificationsPage.css";
import "./AdminOperationsPage.css";
import "../modules/admin/ui/admin-ui.css";

/* ── Status configuration ─────────────────────────────────── */

const STATUS_META = {
  PENDING: { label: "Pending", icon: "hourglass_top", className: "mv-status--pending" },
  APPROVED: { label: "Approved", icon: "verified", className: "mv-status--approved" },
  REJECTED: { label: "Rejected", icon: "cancel", className: "mv-status--rejected" },
  MORE_INFORMATION_REQUIRED: { label: "More info", icon: "contact_support", className: "mv-status--more-info" },
};

const STATUS_ORDER = ["PENDING", "MORE_INFORMATION_REQUIRED", "APPROVED", "REJECTED"];

/* ── Helpers ──────────────────────────────────────────────── */

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const splitLines = (value) =>
  String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const initials = (name) => String(name || "M").trim().charAt(0).toUpperCase();

const isImage = (value) =>
  !value ? false : /^data:image\//.test(value) || /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(value);

/* ── Small building blocks ────────────────────────────────── */

function MentorAvatar({ mentor, size = 44 }) {
  const name = mentor?.fullName || mentor?.email || "M";
  if (mentor?.profileImageUrl) {
    return (
      <img
        className="mv-avatar"
        style={{ width: size, height: size }}
        src={mentor.profileImageUrl}
        alt={`${name}'s avatar`}
        onError={(e) => { e.currentTarget.style.display = "none"; }}
      />
    );
  }
  return (
    <span className="mv-avatar mv-avatar--fallback" style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {initials(name)}
    </span>
  );
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.PENDING;
  return (
    <span className={`mv-status ${meta.className}`}>
      <Icon name={meta.icon} /> {meta.label}
    </span>
  );
}

function DetailRow({ label, children }) {
  if (children == null || children === "" || children === false) return null;
  return (
    <div className="mv-detail-row">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function EmptyState({ icon, title, message }) {
  return (
    <div className="mv-empty">
      <span className="mv-empty__icon"><Icon name={icon} /></span>
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}

/* ── Section: Certificates ────────────────────────────────── */

function CertificatesSection({ request }) {
  const structured = request?.certifications || [];
  const textCerts = splitLines(request?.mentor?.certificates);

  if (structured.length === 0 && textCerts.length === 0) {
    return (
      <EmptyState
        icon="workspace_premium"
        title="No certificates uploaded"
        message="This mentor has not uploaded any certificates yet."
      />
    );
  }

  return (
    <div className="mv-section">
      <h3 className="mv-section__title">
        <Icon name="workspace_premium" /> Certificates
      </h3>
      {structured.length > 0 && (
        <div className="mv-cert-grid">
          {structured.map((cert) => (
            <article className="mv-cert-card" key={cert.id}>
              <div className="mv-cert-card__media">
                {cert.certificateImage ? (
                  isImage(cert.certificateImage) ? (
                    <img
                      src={cert.certificateImage}
                      alt={cert.certificationName}
                      className="mv-cert-card__img"
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  ) : (
                    <a
                      href={cert.certificateImage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mv-cert-card__file"
                    >
                      <Icon name="picture_as_pdf" />
                      <span>View certificate</span>
                    </a>
                  )
                ) : (
                  <span className="mv-cert-card__file">
                    <Icon name="workspace_premium" />
                    <span>No image</span>
                  </span>
                )}
              </div>
              <div className="mv-cert-card__body">
                <h4>{cert.certificationName}</h4>
                <p className="mv-cert-card__org">{cert.issuingOrganization}</p>
                <p className="mv-cert-card__meta">
                  Issued {formatDate(cert.issueDate)}
                  {cert.doesNotExpire
                    ? " · No expiry"
                    : cert.expirationDate
                      ? ` · Expires ${formatDate(cert.expirationDate)}`
                      : ""}
                </p>
                {cert.credentialId && (
                  <p className="mv-cert-card__meta">Credential ID: {cert.credentialId}</p>
                )}
                {cert.credentialUrl && (
                  <a
                    href={cert.credentialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mv-cert-card__link"
                  >
                    Verify credential <Icon name="open_in_new" />
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {textCerts.length > 0 && (
        <div className="mv-block">
          <p className="mv-block__label">Additional certifications (text)</p>
          <ul className="mv-text-list">
            {textCerts.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ── Section: Resume & Documents ──────────────────────────── */

function ResumeSection({ request }) {
  const mentor = request?.mentor || {};
  const items = [];

  // Prefer the application snapshot (what was actually submitted) over the
  // user's current profile — the profile may have changed since submission.
  const resumeUrl = request?.resumeUrl || mentor.resumeUrl;
  if (resumeUrl) {
    items.push({
      icon: "description",
      title: "Resume",
      hint: "The resume attached with this verification application.",
      href: resumeUrl,
      external: true,
    });
  }
  if (request?.documentUrl) {
    items.push({
      icon: "badge",
      title: request.documentType || "Verification document",
      hint: "Identity or credential document submitted with this request.",
      href: request.documentUrl,
      external: true,
    });
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon="description"
        title="No documents uploaded"
        message="This mentor has not attached a resume or verification document."
      />
    );
  }

  return (
    <div className="mv-section">
      <h3 className="mv-section__title">
        <Icon name="description" /> Resume & Documents
      </h3>
      <div className="mv-doc-list">
        {items.map((item, idx) => (
          <article className="mv-doc-card" key={idx}>
            <span className="mv-doc-card__icon"><Icon name={item.icon} /></span>
            <div className="mv-doc-card__body">
              <h4>{item.title}</h4>
              <p>{item.hint}</p>
            </div>
            <a className="mv-doc-card__action" href={item.href} target="_blank" rel="noopener noreferrer">
              View <Icon name="open_in_new" />
            </a>
          </article>
        ))}
      </div>
    </div>
  );
}

/* ── Section: Experience ──────────────────────────────────── */

function ExperienceSection({ request }) {
  const mentor = request?.mentor || {};
  const teaching = splitLines(mentor.pastTeachingSessions);
  const projects = splitLines(mentor.projects);
  const verifiedSkills = normalizeSkills(mentor.verifiedSkills);

  return (
    <div className="mv-section">
      <h3 className="mv-section__title">
        <Icon name="work" /> Experience
      </h3>

      <div className="mv-stat-grid">
        <div className="mv-stat">
          <strong>{mentor.yearsOfExperience ?? "—"}</strong>
          <span>Years of experience</span>
        </div>
        <div className="mv-stat">
          <strong>{mentor.company || "—"}</strong>
          <span>Company</span>
        </div>
        <div className="mv-stat">
          <strong>{mentor.headline || "—"}</strong>
          <span>Headline</span>
        </div>
      </div>

      {mentor.aboutMe && (
        <div className="mv-block">
          <p className="mv-block__label">About</p>
          <p className="mv-block__text">{mentor.aboutMe}</p>
        </div>
      )}

      {teaching.length > 0 && (
        <div className="mv-block">
          <p className="mv-block__label">Teaching experience & highlights</p>
          <ul className="mv-text-list">
            {teaching.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {projects.length > 0 && (
        <div className="mv-block">
          <p className="mv-block__label">Projects</p>
          <ul className="mv-text-list">
            {projects.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {verifiedSkills.length > 0 && (
        <div className="mv-block">
          <p className="mv-block__label">Verified skills</p>
          <div className="mv-chips">
            {verifiedSkills.map((skill) => (
              <span className="mv-chip" key={skill}>{skill}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Section: Overview ────────────────────────────────────── */

function OverviewSection({ request }) {
  const mentor = request?.mentor || {};
  const skills = normalizeSkills(mentor.skills);

  return (
    <div className="mv-section">
      <h3 className="mv-section__title">
        <Icon name="person" /> Overview
      </h3>

      <div className="mv-detail-list">
        <DetailRow label="Email">
          <a href={`mailto:${mentor.email}`}>{mentor.email}</a>
        </DetailRow>
        <DetailRow label="Username">@{mentor.username}</DetailRow>
        <DetailRow label="Joined">{formatDate(mentor.createdAt)}</DetailRow>
        <DetailRow label="Submitted">{formatDate(request?.submittedAt || request?.createdAt)}</DetailRow>
        <DetailRow label="Reviewed by">{request?.reviewedBy ? `Admin #${request.reviewedBy}` : "Not reviewed yet"}</DetailRow>
        <DetailRow label="Reviewed at">{request?.reviewedAt ? formatDate(request.reviewedAt) : "—"}</DetailRow>
        {request?.requestedInfo && (
          <DetailRow label="Requested info">{request.requestedInfo}</DetailRow>
        )}
        {request?.adminNote && <DetailRow label="Admin note">{request.adminNote}</DetailRow>}
        {request?.portfolioUrl && (
          <DetailRow label="Portfolio">
            <a href={request.portfolioUrl} target="_blank" rel="noopener noreferrer">{request.portfolioUrl}</a>
          </DetailRow>
        )}
        {mentor.githubUrl && (
          <DetailRow label="GitHub">
            <a href={mentor.githubUrl} target="_blank" rel="noopener noreferrer">{mentor.githubUrl}</a>
          </DetailRow>
        )}
        {mentor.linkedinUrl && (
          <DetailRow label="LinkedIn">
            <a href={mentor.linkedinUrl} target="_blank" rel="noopener noreferrer">{mentor.linkedinUrl}</a>
          </DetailRow>
        )}
      </div>

      {mentor.aboutMe && (
        <div className="mv-block">
          <p className="mv-block__label">About</p>
          <p className="mv-block__text">{mentor.aboutMe}</p>
        </div>
      )}

      {skills.length > 0 && (
        <div className="mv-block">
          <p className="mv-block__label">Skills</p>
          <div className="mv-chips">
            {skills.map((skill) => (
              <span className="mv-chip" key={skill}>{skill}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main page ────────────────────────────────────────────── */

const DETAIL_TABS = [
  { key: "overview", label: "Overview", icon: "person" },
  { key: "certificates", label: "Certificates", icon: "workspace_premium" },
  { key: "resume", label: "Resume & Docs", icon: "description" },
  { key: "experience", label: "Experience", icon: "work" },
];

export default function MentorVerificationsPage({ notify }) {
  const [activeStatus, setActiveStatus] = useState("PENDING");
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detailTab, setDetailTab] = useState("overview");
  const [updatingId, setUpdatingId] = useState(null);
  const [rejectOpenFor, setRejectOpenFor] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [infoOpenFor, setInfoOpenFor] = useState(null);
  const [infoRequest, setInfoRequest] = useState("");
  const [infoError, setInfoError] = useState("");

  const loadQueue = useCallback(async (status) => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await client.get(
        `/api/v1/verification/mentor/requests?status=${status}`,
      );
      const data = res?.data?.data || res?.data || [];
      setRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      const statusCode = Number(err?.response?.status || 0);
      setLoadError(
        statusCode >= 500
          ? "The server is having trouble right now. Please try again shortly."
          : "We could not load the verification queue. Check that you are signed in as an admin.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue(activeStatus);
  }, [activeStatus, loadQueue]);

  const selected = useMemo(
    () => requests.find((request) => request.id === selectedId) || null,
    [requests, selectedId],
  );

  const switchStatus = (status) => {
    setActiveStatus(status);
    setSelectedId(null);
    setDetailTab("overview");
    setRejectOpenFor(null);
    setRejectReason("");
    setRejectError("");
    setInfoOpenFor(null);
    setInfoRequest("");
    setInfoError("");
  };

  const openRequestInfo = (request) => {
    setInfoOpenFor(request.id);
    setInfoRequest("");
    setInfoError("");
  };

  const submitRequestInfo = async (request) => {
    const requestedInfo = infoRequest.trim();
    if (!requestedInfo) {
      setInfoError("Tell the applicant what information you need.");
      return;
    }
    setUpdatingId(request.id);
    try {
      await client.patch(`/api/v1/verification/mentor/requests/${request.id}`, {
        status: "MORE_INFORMATION_REQUIRED",
        requestedInfo,
      });
      setInfoOpenFor(null);
      setInfoRequest("");
      await loadQueue(activeStatus);
      if (selectedId === request.id) {
        setSelectedId(null);
        setDetailTab("overview");
      }
      notify?.({
        type: "success",
        title: "More information requested",
        message: `${request?.mentor?.fullName || `Mentor #${request.id}`} was asked for more information and notified.`,
      });
    } catch (err) {
      notify?.({
        type: "error",
        title: "Request failed",
        message: err?.response?.data?.data?.error || err?.response?.data?.message || "Could not request more information.",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const approve = async (request) => {
    if (!window.confirm(`Approve verification for ${request?.mentor?.fullName || `Mentor #${request.id}`}? The mentor will be notified and a verified badge will be enabled.`)) {
      return;
    }
    setUpdatingId(request.id);
    try {
      await client.patch(`/api/v1/verification/mentor/requests/${request.id}`, {
        status: "APPROVED",
        adminNote: "Verified by admin",
      });
      await loadQueue(activeStatus);
      if (selectedId === request.id) {
        setSelectedId(null);
        setDetailTab("overview");
      }
      notify?.({
        type: "success",
        title: "Mentor approved",
        message: `${request?.mentor?.fullName || `Mentor #${request.id}`} is now a verified mentor.`,
      });
    } catch (err) {
      notify?.({
        type: "error",
        title: "Approval failed",
        message: err?.response?.data?.data?.error || err?.response?.data?.message || "Failed to approve the verification request.",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const openReject = (request) => {
    setRejectOpenFor(request.id);
    setRejectReason("");
    setRejectError("");
  };

  const submitRejection = async (request) => {
    const reason = rejectReason.trim();
    if (!reason) {
      setRejectError("A rejection reason is required so the mentor understands why.");
      return;
    }
    setUpdatingId(request.id);
    try {
      await client.patch(`/api/v1/verification/mentor/requests/${request.id}`, {
        status: "REJECTED",
        adminNote: reason,
      });
      setRejectOpenFor(null);
      setRejectReason("");
      await loadQueue(activeStatus);
      if (selectedId === request.id) {
        setSelectedId(null);
        setDetailTab("overview");
      }
      notify?.({
        type: "success",
        title: "Mentor rejected",
        message: `${request?.mentor?.fullName || `Mentor #${request.id}`}'s verification was rejected and they were notified.`,
      });
    } catch (err) {
      notify?.({
        type: "error",
        title: "Rejection failed",
        message: err?.response?.data?.data?.error || err?.response?.data?.message || "Failed to reject the verification request.",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <main className="admin-page">
      <section className="admin-hero">
        <div>
          <p className="admin-eyebrow">Moderation</p>
          <h1>Mentor verifications</h1>
          <p>
            Review pending mentors — check their certificates, resume, and
            experience — then approve or reject their verification request.
          </p>
        </div>
        <button
          type="button"
          className="admin-refresh-btn"
          onClick={() => loadQueue(activeStatus)}
          disabled={loading || Boolean(updatingId)}
        >
          <Icon name="refresh" /> {loading ? "Refreshing…" : "Refresh"}
        </button>
      </section>

      {/* Status filter */}
      <div className="admin-tabs mv-tabs" role="tablist" aria-label="Verification status">
        {STATUS_ORDER.map((status) => {
          const meta = STATUS_META[status];
          return (
            <button
              key={status}
              type="button"
              role="tab"
              aria-selected={activeStatus === status}
              className={`admin-tab mv-tab ${activeStatus === status ? "admin-tab--active" : ""}`}
              onClick={() => switchStatus(status)}
            >
              <Icon name={meta.icon} />
              {meta.label}
            </button>
          );
        })}
      </div>

      {loadError ? (
        <div className="mv-empty">
          <span className="mv-empty__icon"><Icon name="error_outline" /></span>
          <h3>Queue unavailable</h3>
          <p>{loadError}</p>
          <button type="button" className="admin-refresh-btn" onClick={() => loadQueue(activeStatus)}>
            Try again
          </button>
        </div>
      ) : loading && requests.length === 0 ? (
        <div className="mv-skeleton-grid" aria-label="Loading verification requests">
          {Array.from({ length: 3 }).map((_, i) => (
            <div className="mv-skeleton" key={i}>
              <div className="mv-skeleton__avatar" />
              <div className="mv-skeleton__lines">
                <div className="mv-skeleton__line mv-skeleton__line--lg" />
                <div className="mv-skeleton__line" />
                <div className="mv-skeleton__line" />
              </div>
            </div>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={STATUS_META[activeStatus]?.icon || "verified"}
          title={`No ${STATUS_META[activeStatus]?.label.toLowerCase()} requests`}
          message={
            activeStatus === "PENDING"
              ? "There are no mentors waiting for review right now. New requests will appear here."
              : `Mentors you ${activeStatus === "APPROVED" ? "approve" : "reject"} will be listed here.`
          }
        />
      ) : (
        <div className="mv-layout">
          {/* Queue list */}
          <div className="mv-list">
            {requests.map((request) => {
              const mentor = request?.mentor || {};
              const isSelected = selectedId === request.id;
              const skills = normalizeSkills(mentor.skills).slice(0, 4);
              return (
                <button
                  type="button"
                  key={request.id}
                  className={`mv-list-item ${isSelected ? "mv-list-item--active" : ""}`}
                  onClick={() => {
                    setSelectedId(request.id);
                    setDetailTab("overview");
                  }}
                >
                  <MentorAvatar mentor={mentor} size={46} />
                  <span className="mv-list-item__body">
                    <span className="mv-list-item__top">
                      <strong>{mentor.fullName || request.fullName || `Mentor #${request.id}`}</strong>
                      <StatusBadge status={request.status} />
                    </span>
                    <span className="mv-list-item__sub">
                      {mentor.headline || request.fullName || mentor.email || "No headline set"}
                    </span>
                    <span className="mv-list-item__sub">
                      {mentor.company
                        ? `${mentor.company} · ${mentor.yearsOfExperience ?? "?"} yrs`
                        : mentor.yearsOfExperience
                          ? `${mentor.yearsOfExperience} years experience`
                          : "Experience not provided"}
                    </span>
                    {skills.length > 0 && (
                      <span className="mv-list-item__skills">
                        {skills.join(" · ")}
                        {normalizeSkills(mentor.skills).length > skills.length && " …"}
                      </span>
                    )}
                    <span className="mv-list-item__meta">
                      Submitted {formatDate(request.submittedAt || request.createdAt)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Detail panel */}
          <div className="mv-detail">
            {!selected ? (
              <EmptyState
                icon="touch_app"
                title="Select a mentor"
                message="Choose a mentor from the queue to review their certificates, resume, and experience."
              />
            ) : (
              <>
                <header className="mv-detail__header">
                  <MentorAvatar mentor={selected.mentor} size={56} />
                  <div className="mv-detail__identity">
                    <div className="mv-detail__name-row">
                      <h2>{selected.mentor?.fullName || `Mentor #${selected.id}`}</h2>
                      <StatusBadge status={selected.status} />
                    </div>
                    <p className="mv-detail__sub">
                      {selected.mentor?.headline && <span>{selected.mentor.headline}</span>}
                      {selected.mentor?.company && <span> · {selected.mentor.company}</span>}
                      {selected.mentor?.yearsOfExperience != null && (
                        <span> · {selected.mentor.yearsOfExperience} yrs experience</span>
                      )}
                    </p>
                    <p className="mv-detail__email">
                      {selected.mentor?.email}
                      {selected.mentor?.username ? ` · @${selected.mentor.username}` : ""}
                    </p>
                  </div>
                  <div className="mv-detail__actions">
                    {(selected.status === "PENDING" || selected.status === "MORE_INFORMATION_REQUIRED") && (
                      <>
                        <button
                          type="button"
                          className="admin-action-btn admin-action-approve"
                          disabled={updatingId === selected.id}
                          onClick={() => approve(selected)}
                        >
                          <Icon name="check_circle" /> Approve
                        </button>
                        <button
                          type="button"
                          className="admin-action-btn admin-action-cancel"
                          disabled={updatingId === selected.id}
                          onClick={() => openRequestInfo(selected)}
                        >
                          <Icon name="contact_support" /> Request more info
                        </button>
                        <button
                          type="button"
                          className="admin-action-btn admin-action-reject"
                          disabled={updatingId === selected.id}
                          onClick={() => openReject(selected)}
                        >
                          <Icon name="cancel" /> Reject
                        </button>
                      </>
                    )}
                    {selected.mentor?.email && (
                      <a
                        className="admin-action-btn admin-action-send"
                        href={`mailto:${encodeURIComponent(selected.mentor.email)}?subject=${encodeURIComponent("SkillSwap: Your mentor verification application")}&body=${encodeURIComponent(`Hi ${selected.mentor.fullName || "there"},\n\nRegarding your mentor verification application (#${selected.id}, status: ${selected.status || "PENDING"}).\n\n${selected.resumeUrl ? `We've reviewed the resume you submitted: ${selected.resumeUrl}\n` : ""}${selected.documentUrl ? `Verification document: ${selected.documentUrl}\n` : ""}\nBest regards,\nThe SkillSwap team`)}`}
                      >
                        <Icon name="send" /> Send message
                      </a>
                    )}
                    {(selected.resumeUrl || selected.mentor?.resumeUrl) && (
                      <a
                        className="admin-action-btn admin-action-cancel"
                        href={selected.resumeUrl || selected.mentor.resumeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Icon name="download" /> Resume
                      </a>
                    )}
                  </div>
                </header>

                {rejectOpenFor === selected.id && (
                  <div className="mv-reject-form">
                    <label htmlFor="mv-reject-reason">Rejection reason (sent to the mentor)</label>
                    <textarea
                      id="mv-reject-reason"
                      rows={3}
                      value={rejectReason}
                      onChange={(e) => {
                        setRejectReason(e.target.value);
                        setRejectError("");
                      }}
                      placeholder="Explain which documents or details could not be verified…"
                    />
                    {rejectError && <p className="mv-reject-error">{rejectError}</p>}
                    <div className="mv-reject-form__actions">
                      <button
                        type="button"
                        className="admin-action-btn admin-action-reject"
                        disabled={updatingId === selected.id}
                        onClick={() => submitRejection(selected)}
                      >
                        {updatingId === selected.id ? "Rejecting…" : "Confirm rejection"}
                      </button>
                      <button
                        type="button"
                        className="admin-action-btn admin-action-cancel"
                        disabled={updatingId === selected.id}
                        onClick={() => setRejectOpenFor(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {infoOpenFor === selected.id && (
                  <div className="mv-reject-form">
                    <label htmlFor="mv-info-reason">What information do you need? (sent to the applicant)</label>
                    <textarea
                      id="mv-info-reason"
                      rows={3}
                      value={infoRequest}
                      onChange={(e) => {
                        setInfoRequest(e.target.value);
                        setInfoError("");
                      }}
                      placeholder="e.g., Please upload a recent government ID and a second certificate."
                    />
                    {infoError && <p className="mv-reject-error">{infoError}</p>}
                    <div className="mv-reject-form__actions">
                      <button
                        type="button"
                        className="admin-action-btn admin-action-approve"
                        disabled={updatingId === selected.id}
                        onClick={() => submitRequestInfo(selected)}
                      >
                        {updatingId === selected.id ? "Sending…" : "Send request"}
                      </button>
                      <button
                        type="button"
                        className="admin-action-btn admin-action-cancel"
                        disabled={updatingId === selected.id}
                        onClick={() => setInfoOpenFor(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <nav className="mv-detail-tabs" aria-label="Review sections">
                  {DETAIL_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      className={`mv-detail-tab ${detailTab === tab.key ? "mv-detail-tab--active" : ""}`}
                      onClick={() => setDetailTab(tab.key)}
                    >
                      <Icon name={tab.icon} /> {tab.label}
                    </button>
                  ))}
                </nav>

                <div className="mv-detail__content">
                  {detailTab === "overview" && <OverviewSection request={selected} />}
                  {detailTab === "certificates" && <CertificatesSection request={selected} />}
                  {detailTab === "resume" && <ResumeSection request={selected} />}
                  {detailTab === "experience" && <ExperienceSection request={selected} />}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
