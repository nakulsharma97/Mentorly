import { useMemo } from 'react';
import './AdminOperationsPage.css';

const ENDPOINTS = [
  { method: 'GET', path: '/api/v1/admin/summary', desc: 'Platform summary counts (users, reports, verifications)', group: 'Overview' },
  { method: 'GET', path: '/api/v1/admin/dashboard?months=6', desc: 'Dashboard trends and health metrics (signups, sessions, revenue, completion rate, top skills, active mentors)', group: 'Overview' },
  { method: 'GET', path: '/api/v1/admin/health', desc: 'Platform health monitoring (uptime, memory, errors)', group: 'Monitoring' },
  { method: 'GET', path: '/api/v1/admin/users?role=&q=&page=0&size=50', desc: 'List all users with search and role filter', group: 'Users' },
  { method: 'PATCH', path: '/api/v1/admin/users/{id}/enabled', desc: 'Enable or disable a user account', group: 'Users' },
  { method: 'PATCH', path: '/api/v1/admin/users/{id}/role', desc: 'Change a user\'s role (LEARNER, MENTOR, ADMIN)', group: 'Users' },
  { method: 'GET', path: '/api/v1/admin/users/{id}/wallet', desc: 'View user wallet balance and transaction history', group: 'Users' },
  { method: 'POST', path: '/api/v1/admin/users/bulk/enable', desc: 'Bulk enable multiple users by ID', group: 'Users' },
  { method: 'POST', path: '/api/v1/admin/users/bulk/disable', desc: 'Bulk disable multiple users by ID', group: 'Users' },
  { method: 'POST', path: '/api/v1/admin/users/bulk/role', desc: 'Bulk update role for multiple users', group: 'Users' },
  { method: 'GET', path: '/api/v1/admin/sessions?status=&q=', desc: 'List all sessions with status filter and search', group: 'Sessions' },
  { method: 'GET', path: '/api/v1/admin/sessions/{id}/details', desc: 'Get session details with bookings, revenue, ratings', group: 'Sessions' },
  { method: 'PATCH', path: '/api/v1/admin/sessions/{id}/status', desc: 'Update session status (CANCELLED, etc.)', group: 'Sessions' },
  { method: 'DELETE', path: '/api/v1/admin/sessions/{id}', desc: 'Permanently delete an inappropriate session (refused if it has bookings)', group: 'Sessions' },
  { method: 'GET', path: '/api/v1/admin/skills?q=', desc: 'List all skills with watcher/task usage counts', group: 'Skills' },
  { method: 'PATCH', path: '/api/v1/admin/skills/{id}', desc: 'Edit a skill name/category (re-points references on rename)', group: 'Skills' },
  { method: 'DELETE', path: '/api/v1/admin/skills/{id}', desc: 'Delete a spam skill (refused if verification tasks depend on it)', group: 'Skills' },
  { method: 'POST', path: '/api/v1/admin/skills/{id}/merge', desc: 'Merge a duplicate skill into another, keeping references consistent', group: 'Skills' },
  { method: 'GET', path: '/api/v1/admin/skills/skill-requests?status=PENDING', desc: 'List skill category requests for moderation', group: 'Skills' },
  { method: 'PATCH', path: '/api/v1/admin/skills/skill-requests/{id}', desc: 'Approve (adds to catalog) or reject a skill category request', group: 'Skills' },
  { method: 'POST', path: '/api/v1/skills/request', desc: 'Submit a new skill category for admin approval', group: 'Skills' },
  { method: 'GET', path: '/api/v1/skills/my-requests', desc: 'View your own skill request history', group: 'Skills' },
  { method: 'GET', path: '/api/v1/admin/payments?status=&gateway=&q=', desc: 'Payment dashboard with stats and filter', group: 'Payments' },
  { method: 'POST', path: '/api/v1/admin/payments/{id}/refund', desc: 'Refund an escrowed payment', group: 'Payments' },
  { method: 'GET', path: '/api/v1/admin/conversations?type=&q=', desc: 'List all conversations (booking + direct)', group: 'Messaging' },
  { method: 'GET', path: '/api/v1/admin/conversations/booking/{id}/messages', desc: 'Get messages for a booking conversation', group: 'Messaging' },
  { method: 'GET', path: '/api/v1/admin/conversations/direct/{id}/messages', desc: 'Get messages for a direct conversation', group: 'Messaging' },
  { method: 'GET', path: '/api/v1/admin/reports?status=OPEN&targetType=&q=', desc: 'List reports with status / target-type / search filters', group: 'Moderation' },
  { method: 'PATCH', path: '/api/v1/admin/reports/{id}', desc: 'Update report status', group: 'Moderation' },
  { method: 'PATCH', path: '/api/v1/admin/reports/{id}/decision', desc: 'Resolve or reject a report (optionally suspend the reported user)', group: 'Moderation' },
  { method: 'POST', path: '/api/v1/safety/report', desc: 'Submit a report (MENTOR | LEARNER | SESSION | SKILL)', group: 'Moderation' },
  { method: 'GET', path: '/api/v1/admin/mentor-verifications?status=PENDING', desc: 'List mentor verification requests', group: 'Moderation' },
  { method: 'GET', path: '/api/v1/admin/flagged-content?status=OPEN', desc: 'List flagged content for moderation', group: 'Moderation' },
  { method: 'PATCH', path: '/api/v1/admin/flagged-content/{id}', desc: 'Moderate flagged content (resolve, reject)', group: 'Moderation' },
  { method: 'POST', path: '/api/v1/admin/notifications/broadcast', desc: 'Send in-app notification (ANNOUNCEMENT / MAINTENANCE / PLATFORM_UPDATE) to all users or a role', group: 'Notifications' },
  { method: 'GET', path: '/api/v1/admin/notification-preferences', desc: 'Get admin notification preferences', group: 'Notifications' },
  { method: 'PUT', path: '/api/v1/admin/notification-preferences', desc: 'Update admin notification preferences', group: 'Notifications' },
  { method: 'GET', path: '/api/v1/admin/audit-log?action=&page=0&size=50', desc: 'View audit trail of admin actions', group: 'Audit' },
  { method: 'GET', path: '/api/v1/admin/settings', desc: 'Get platform configuration settings', group: 'Settings' },
  { method: 'PUT', path: '/api/v1/admin/settings', desc: 'Update platform configuration settings', group: 'Settings' },
  { method: 'POST', path: '/api/v1/admin/users/{id}/wallet-ledger', desc: 'Add wallet ledger entry for a user', group: 'Wallet' },
];

const METHOD_COLORS = {
  GET: { bg: '#dbeafe', color: '#1e40af' },
  POST: { bg: '#d1fae5', color: '#065f46' },
  PUT: { bg: '#fef3c7', color: '#92400e' },
  PATCH: { bg: '#ede9fe', color: '#5b21b6' },
  DELETE: { bg: '#fee2e2', color: '#b91c1c' },
};

export default function AdminApiDocsPage() {
  const groups = useMemo(() => {
    const map = {};
    ENDPOINTS.forEach((ep) => {
      if (!map[ep.group]) map[ep.group] = [];
      map[ep.group].push(ep);
    });
    return Object.entries(map);
  }, []);

  return (
    <section className="admin-page">
      <div className="admin-hero" style={{ marginBottom: 0, borderRadius: '0 0 18px 18px' }}>
        <div>
          <p className="admin-eyebrow">Development</p>
          <h1>API Documentation</h1>
          <p>Complete reference for all admin API endpoints. {ENDPOINTS.length} endpoints across {groups.length} categories.</p>
        </div>
      </div>

      {groups.map(([group, endpoints]) => (
        <div key={group} className="admin-panel" style={{ padding: 0 }}>
          <div className="admin-section-heading" style={{ padding: '16px 22px', borderBottom: '1px solid #e2e8f0', margin: 0 }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>{group}</h3>
            <span className="admin-count-badge">{endpoints.length} endpoints</span>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Method</th>
                  <th>Endpoint</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map((ep, i) => {
                  const colors = METHOD_COLORS[ep.method] || METHOD_COLORS.GET;
                  return (
                    <tr key={i}>
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          background: colors.bg,
                          color: colors.color,
                          fontFamily: "'SF Mono', 'Consolas', monospace",
                        }}>
                          {ep.method}
                        </span>
                      </td>
                      <td>
                        <code style={{
                          fontFamily: "'SF Mono', 'Consolas', monospace",
                          fontSize: '0.82rem',
                          color: '#0f172a',
                          wordBreak: 'break-all',
                        }}>
                          {ep.path}
                        </code>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: '#475569' }}>{ep.desc}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );
}
