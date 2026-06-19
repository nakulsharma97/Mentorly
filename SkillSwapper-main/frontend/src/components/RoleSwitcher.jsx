import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

export default function RoleSwitcher({ profile, onProfileUpdated }) {
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);
  const [message, setMessage] = useState('');

  const handleRoleSwitch = async (newRole) => {
    try {
      setSwitching(true);
      setMessage('');
      
      const response = await client.put('/api/v1/users/me/role', {
        role: newRole
      });
      
      setMessage(`Successfully switched to ${newRole === 'MENTOR' ? 'Mentor' : 'Learner'} role!`);
      
      if (onProfileUpdated) {
        onProfileUpdated(response.data.data);
      }
      
      setTimeout(() => {
        setSwitching(false);
        navigate('/home', { replace: true });
      }, 500);
    } catch (error) {
      setMessage(`Error switching role: ${error.response?.data?.message || error.message}`);
      setSwitching(false);
    }
  };

  const currentRole = profile?.role || 'LEARNER';
  const otherRole = currentRole === 'MENTOR' ? 'LEARNER' : 'MENTOR';
  const otherRoleLabel = otherRole === 'MENTOR' ? '👨‍🏫 Mentor' : '👨‍🎓 Learner';

  return (
    <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest overflow-hidden">
      <div className="bg-gradient-to-r from-tertiary/10 to-tertiary-container/10 border-b border-outline-variant/10 px-6 py-4">
        <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-tertiary">swap_horiz</span>
          Switch Role
        </h3>
      </div>
      <div className="p-6">
        <div className="mb-4">
          <p className="text-sm text-on-surface-variant mb-3">
            Current Role: <span className="font-bold text-on-surface">{currentRole === 'MENTOR' ? '👨‍🏫 Mentor' : '👨‍🎓 Learner'}</span>
          </p>
          <p className="text-xs text-on-surface-variant">
            Want to experience the platform from a different perspective? Switch roles to see both dashboards.
          </p>
        </div>

        {message && (
          <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
            message.includes('Error') 
              ? 'bg-error/10 text-error-container' 
              : 'bg-success/10 text-success-container'
          }`}>
            {message}
          </div>
        )}

        <button
          onClick={() => handleRoleSwitch(otherRole)}
          disabled={switching}
          className="w-full px-4 py-3 rounded-lg bg-tertiary text-on-tertiary font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {switching ? (
            <>
              <span className="animate-spin">⟳</span>
              Switching...
            </>
          ) : (
            <>
              Switch to {otherRoleLabel}
            </>
          )}
        </button>

        <div className="mt-6 pt-6 border-t border-outline-variant/10">
          <p className="text-xs text-on-surface-variant mb-3">💡 What you'll see as {otherRoleLabel}:</p>
          {otherRole === 'MENTOR' ? (
            <ul className="space-y-2 text-xs text-on-surface-variant">
              <li className="flex items-start gap-2">
                <span className="mt-1">→</span>
                <span>Manage your own sessions and pricing</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">→</span>
                <span>Track your earnings and withdrawals</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">→</span>
                <span>Review pending learner bookings</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">→</span>
                <span>Build your reputation with ratings</span>
              </li>
            </ul>
          ) : (
            <ul className="space-y-2 text-xs text-on-surface-variant">
              <li className="flex items-start gap-2">
                <span className="mt-1">→</span>
                <span>Browse and book mentors</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">→</span>
                <span>Track your learning progress</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">→</span>
                <span>Watch skills and get recommendations</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1">→</span>
                <span>Manage payment methods</span>
              </li>
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
