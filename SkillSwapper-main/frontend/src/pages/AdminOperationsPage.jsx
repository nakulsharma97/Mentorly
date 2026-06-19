import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import './AdminOperationsPage.css';

const statusOptions = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED'];

const formatSubmittedDate = (value) => {
  if (!value) {
    return 'Unknown date';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  }).format(date);
};

const getMentorSkills = (skills) => {
  if (Array.isArray(skills)) {
    return skills.map((item) => String(item || '').trim()).filter(Boolean);
  }
  return String(skills || '')
    .split(/[\n,;|]+/)
    .map((item) => item.trim())
    .filter(Boolean);
};

export default function AdminOperationsPage({ notify }) {
  const [summary, setSummary] = useState(null);
  const [reports, setReports] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [status, setStatus] = useState('OPEN');
  const [loading, setLoading] = useState(true);
  const [verificationLoading, setVerificationLoading] = useState(true);
  const [verificationUpdatingId, setVerificationUpdatingId] = useState(null);
  const [activeRejectId, setActiveRejectId] = useState(null);
  const [rejectReasonById, setRejectReasonById] = useState({});
  const [rejectErrorById, setRejectErrorById] = useState({});

  const loadVerificationQueue = useCallback(async () => {
    setVerificationLoading(true);
    try {
      const verificationResponse = await client.get('/api/v1/verification/mentor/requests?status=PENDING');
      const queue = verificationResponse?.data?.data || verificationResponse?.data || [];
      setVerifications(Array.isArray(queue) ? queue : []);
    } catch {
      notify?.({
        type: 'error',
        title: 'Verification queue unavailable',
        message: 'Could not load mentor verification requests.'
      });
    } finally {
      setVerificationLoading(false);
    }
  }, [notify]);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryResponse, reportsResponse] = await Promise.all([
        client.get('/api/v1/admin/summary'),
        client.get(`/api/v1/admin/reports?status=${status}`)
      ]);
      setSummary(summaryResponse.data.data);
      setReports(reportsResponse.data.data || []);
    } catch {
      notify?.({
        type: 'error',
        title: 'Admin data unavailable',
        message: 'Check that you are signed in as an admin and the backend is running.'
      });
    } finally {
      setLoading(false);
    }
  }, [notify, status]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  useEffect(() => {
    loadVerificationQueue();
  }, [loadVerificationQueue]);

  const approveVerification = async (item) => {
    setVerificationUpdatingId(item.id);
    try {
      await client.patch(`/api/v1/verification/mentor/requests/${item.id}`, {
        status: 'APPROVED',
        reviewNote: 'Approved by admin'
      });
      setVerifications((prev) => prev.filter((request) => request.id !== item.id));
      notify?.({
        type: 'success',
        title: 'Mentor approved',
        message: `Mentor ${item?.mentor?.fullName || item?.mentor?.email || item.id} approved successfully`
      });
    } catch (error) {
      notify?.({
        type: 'error',
        title: 'Approval failed',
        message: error?.response?.data?.data?.error || error?.response?.data?.message || 'Failed to approve mentor verification.'
      });
    } finally {
      setVerificationUpdatingId(null);
    }
  };

  const startReject = (itemId) => {
    setActiveRejectId(itemId);
    setRejectReasonById((prev) => ({
      ...prev,
      [itemId]: prev[itemId] || ''
    }));
    setRejectErrorById((prev) => ({
      ...prev,
      [itemId]: ''
    }));
  };

  const cancelReject = (itemId) => {
    setActiveRejectId((prev) => (prev === itemId ? null : prev));
    setRejectErrorById((prev) => ({
      ...prev,
      [itemId]: ''
    }));
  };

  const submitRejection = async (item) => {
    const reason = String(rejectReasonById[item.id] || '').trim();
    if (!reason) {
      setRejectErrorById((prev) => ({
        ...prev,
        [item.id]: 'Rejection reason is required.'
      }));
      return;
    }

    setVerificationUpdatingId(item.id);
    try {
      await client.patch(`/api/v1/verification/mentor/requests/${item.id}`, {
        status: 'REJECTED',
        reviewNote: reason
      });
      setVerifications((prev) => prev.filter((request) => request.id !== item.id));
      setActiveRejectId((prev) => (prev === item.id ? null : prev));
      notify?.({
        type: 'success',
        title: 'Mentor rejected',
        message: `Mentor ${item?.mentor?.fullName || item?.mentor?.email || item.id} verification rejected`
      });
    } catch (error) {
      notify?.({
        type: 'error',
        title: 'Rejection failed',
        message: error?.response?.data?.data?.error || error?.response?.data?.message || 'Failed to reject mentor verification.'
      });
    } finally {
      setVerificationUpdatingId(null);
    }
  };

  const updateReportStatus = async (reportId, nextStatus) => {
    try {
      await client.patch(`/api/v1/admin/reports/${reportId}`, { status: nextStatus });
      notify?.({
        type: 'success',
        title: 'Report updated',
        message: `Report moved to ${nextStatus.toLowerCase().replace('_', ' ')}.`
      });
      loadAdminData();
    } catch {
      notify?.({
        type: 'error',
        title: 'Update failed',
        message: 'The report could not be updated.'
      });
    }
  };

  if (loading) {
    return (
      <main className="admin-page">
        <section className="admin-hero">
          <h1>Admin operations</h1>
          <p>Loading moderation queue...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <section className="admin-hero">
        <div>
          <p className="admin-eyebrow">Operations</p>
          <h1>Admin control center</h1>
          <p>Review reports, track mentor verification, and keep the marketplace healthy.</p>
        </div>
      </section>

      {summary && (
        <section className="admin-summary-grid" aria-label="Platform summary">
          <SummaryCard label="Users" value={summary.totalUsers} />
          <SummaryCard label="Learners" value={summary.learners} />
          <SummaryCard label="Mentors" value={summary.mentors} />
          <SummaryCard label="Open reports" value={summary.openReports} />
          <SummaryCard label="Pending verifications" value={summary.pendingMentorVerifications} />
        </section>
      )}

      <section className="admin-panel">
        <div className="admin-section-heading">
          <div>
            <p className="admin-eyebrow">Trust and safety</p>
            <h2>Report queue</h2>
          </div>
          <label className="admin-field">
            <span>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {statusOptions.map((item) => (
                <option key={item} value={item}>{item.replace('_', ' ')}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Reason</th>
                <th>Target</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>
                    <strong>{report.reason}</strong>
                    <p>{report.details || 'No extra details provided.'}</p>
                  </td>
                  <td>{report.targetType || 'USER'} #{report.targetId || report.reported?.id}</td>
                  <td>{report.status}</td>
                  <td>
                    <select
                      value={report.status}
                      onChange={(event) => updateReportStatus(report.id, event.target.value)}
                    >
                      {statusOptions.map((item) => (
                        <option key={item} value={item}>{item.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {reports.length === 0 && (
                <tr>
                  <td colSpan="4">No reports in this queue.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel">
        <div className="admin-section-heading">
          <div>
            <p className="admin-eyebrow">Verification</p>
            <h2>
              Mentor Verification Queue{' '}
              <span className="admin-count-badge">{verifications.length} pending verifications</span>
            </h2>
          </div>
          <button
            type="button"
            className="admin-refresh-btn"
            onClick={loadVerificationQueue}
            disabled={verificationLoading || Boolean(verificationUpdatingId)}
          >
            {verificationLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="admin-list">
          {verificationLoading && <p>Loading pending verification requests...</p>}
          {!verificationLoading && verifications.map((item) => {
            const skills = getMentorSkills(item?.mentor?.skills);
            const isUpdating = verificationUpdatingId === item.id;
            const isRejectOpen = activeRejectId === item.id;
            return (
              <article className="admin-card admin-verification-card" key={item.id}>
                <div className="admin-verification-header">
                  <h3>{item?.mentor?.fullName || `Mentor #${item?.mentor?.id || item.id}`}</h3>
                  <span className="admin-status">{item.status}</span>
                </div>
                <p className="admin-verification-meta">
                  <strong>Email:</strong> {item?.mentor?.email || 'Not provided'}
                </p>
                <p className="admin-verification-meta">
                  <strong>Skills:</strong> {skills.length ? skills.join(', ') : 'No skills listed'}
                </p>
                <p className="admin-verification-meta">
                  <strong>Document type:</strong> {item.documentType || 'Unknown'}
                </p>
                <p className="admin-verification-meta">
                  <strong>Document:</strong>{' '}
                  <a href={item.documentUrl} target="_blank" rel="noreferrer">View Document</a>
                </p>
                <p className="admin-verification-meta">
                  <strong>Submitted:</strong> {formatSubmittedDate(item.createdAt)}
                </p>

                <div className="admin-verification-actions">
                  <button
                    type="button"
                    className="admin-action-btn admin-action-approve"
                    disabled={isUpdating}
                    onClick={() => approveVerification(item)}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="admin-action-btn admin-action-reject"
                    disabled={isUpdating}
                    onClick={() => startReject(item.id)}
                  >
                    Reject
                  </button>
                </div>

                {isRejectOpen && (
                  <div className="admin-reject-form">
                    <label htmlFor={`rejection-reason-${item.id}`}>Rejection reason (required)</label>
                    <input
                      id={`rejection-reason-${item.id}`}
                      type="text"
                      value={rejectReasonById[item.id] || ''}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setRejectReasonById((prev) => ({
                          ...prev,
                          [item.id]: nextValue
                        }));
                        setRejectErrorById((prev) => ({
                          ...prev,
                          [item.id]: ''
                        }));
                      }}
                      placeholder="Explain why this request is being rejected"
                    />
                    {rejectErrorById[item.id] && <p className="admin-reject-error">{rejectErrorById[item.id]}</p>}
                    <div className="admin-reject-actions">
                      <button
                        type="button"
                        className="admin-action-btn admin-action-reject"
                        disabled={isUpdating}
                        onClick={() => submitRejection(item)}
                      >
                        Submit Rejection
                      </button>
                      <button
                        type="button"
                        className="admin-action-btn admin-action-cancel"
                        disabled={isUpdating}
                        onClick={() => cancelReject(item.id)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
          {!verificationLoading && verifications.length === 0 && <p>No pending verification requests</p>}
        </div>
      </section>
    </main>
  );
}

function SummaryCard({ label, value }) {
  return (
    <article className="admin-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
