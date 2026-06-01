import { useEffect, useState } from 'react';

export default function OfflineStatusBanner() {
  const [isOffline, setIsOffline] = useState(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false));

  useEffect(() => {
    const updateConnectionState = () => {
      setIsOffline(!navigator.onLine);
    };

    window.addEventListener('online', updateConnectionState);
    window.addEventListener('offline', updateConnectionState);
    updateConnectionState();

    return () => {
      window.removeEventListener('online', updateConnectionState);
      window.removeEventListener('offline', updateConnectionState);
    };
  }, []);

  if (!isOffline) {
    return null;
  }

  return (
    <div className="offline-banner" role="status" aria-live="polite">
      <span className="material-symbols-outlined" aria-hidden="true">cloud_off</span>
      <div>
        <strong>You are offline.</strong>
        <p>Previously loaded pages and recent data may still be available until your connection returns.</p>
      </div>
    </div>
  );
}