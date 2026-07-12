import { useState } from 'react';
import client from '../api/client';
import Icon from '../modules/common/dashboard/Icon';
import './AdminOperationsPage.css';

export default function NotificationBroadcastPage({ notify }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      notify?.({ type: 'error', title: 'Validation', message: 'Title and message are required.' });
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const res = await client.post('/api/v1/admin/notifications/broadcast', {
        title: title.trim(),
        message: message.trim(),
        targetRole: targetRole || null,
      });
      const data = res?.data?.data || {};
      setResult(data);
      notify?.({ type: 'success', title: 'Broadcast sent', message: `Sent to ${data.sentCount} users.` });
      setTitle('');
      setMessage('');
    } catch (err) {
      const msg = err?.response?.data?.data?.error || err?.response?.data?.message || 'Broadcast failed';
      notify?.({ type: 'error', title: 'Broadcast failed', message: msg });
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="admin-page">
      <div className="admin-hero" style={{ marginBottom: 0, borderRadius: '0 0 18px 18px' }}>
        <div>
          <p className="admin-eyebrow">Tools</p>
          <h1>Broadcast Notification</h1>
          <p>Send platform-wide announcements to all users or a specific role.</p>
        </div>
      </div>

      <div className="admin-panel" style={{ marginTop: 18 }}>
        <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, color: '#334155' }}>Target Audience</label>
            <select value={targetRole} onChange={(e) => setTargetRole(e.target.value)}
              style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', width: '100%', maxWidth: 400 }}>
              <option value="">All users</option>
              <option value="LEARNER">Learners only</option>
              <option value="MENTOR">Mentors only</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, color: '#334155' }}>Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Platform Maintenance Tomorrow"
              style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', width: '100%', maxWidth: 600 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 700, marginBottom: 6, color: '#334155' }}>Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your announcement message..."
              rows={5}
              style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', width: '100%', maxWidth: 600, font: 'inherit', resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button type="submit" className="admin-refresh-btn" disabled={sending || !title.trim() || !message.trim()}
              style={{ padding: '10px 20px' }}>
              {sending ? 'Sending...' : 'Send Broadcast'}
            </button>
            {result && (
              <span style={{ color: '#065f46', fontSize: '0.9rem' }}>
                ✅ Sent to {result.sentCount} users (role: {result.targetRole || 'all'})
              </span>
            )}
          </div>
        </form>
      </div>

      <div className="admin-panel" style={{ marginTop: 18 }}>
        <div className="admin-section-heading">
          <div>
            <p className="admin-eyebrow">Usage Tips</p>
            <h2>Broadcast Guidelines</h2>
          </div>
        </div>
        <ul style={{ color: '#475569', lineHeight: 1.8, paddingLeft: 20, margin: 0 }}>
          <li>Use for platform announcements, maintenance notices, or feature launches.</li>
          <li>Messages are sent as in-app notifications (not email) to all selected users.</li>
          <li>Keep titles short and actionable. Messages support plain text only.</li>
          <li>There is no undo — broadcast notifications cannot be retracted.</li>
        </ul>
      </div>
    </section>
  );
}
