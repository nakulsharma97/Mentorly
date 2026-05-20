import { useCallback, useEffect, useState } from 'react';
import client from '../api/client';
import './AdminOperationsPage.css';

const statusOptions = ['OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED'];

export default function AdminOperationsPage({ notify }) {
  const [summary, setSummary] = useState(null);
  const [reports, setReports] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [status, setStatus] = useState('OPEN');
  const [loading, setLoading] = useState(true);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryResponse, reportsResponse, verificationsResponse] = await Promise.all([
        client.get('/api/v1/admin/summary'),
        client.get(`/api/v1/admin/reports?status=${status}`),
        client.get('/api/v1/admin/mentor-verifications?status=PENDING')
      ]);
      setSummary(summaryResponse.data.data);
      setReports(reportsResponse.data.data || []);
      setVerifications(verificationsResponse.data.data || []);
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
            <h2>Pending mentors</h2>
          </div>
        </div>

        <div className="admin-list">
          {verifications.map((item) => (
            <article className="admin-card" key={item.id}>
              <h3>{item.mentor?.fullName || `Mentor #${item.mentor?.id || item.id}`}</h3>
              <p>{item.experienceSummary || 'No summary provided.'}</p>
              <span className="admin-status">{item.status}</span>
            </article>
          ))}
          {verifications.length === 0 && <p>No pending mentor verification requests.</p>}
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
