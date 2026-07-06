import { useEffect, useState } from 'react';

const TOAST_ICON = {
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info'
};

export default function ToastCenter({ toasts, onDismiss }) {
  const [pausedToastIds, setPausedToastIds] = useState([]);

  useEffect(() => {
    const timers = toasts
      .filter((toast) => !toast.persistent && !pausedToastIds.includes(toast.id))
      .map((toast) => setTimeout(() => onDismiss(toast.id), toast.duration || 4200));
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [toasts, onDismiss, pausedToastIds]);

  const pauseToast = (id) => {
    setPausedToastIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const resumeToast = (id) => {
    setPausedToastIds((prev) => prev.filter((item) => item !== id));
  };

  return (
    <div className="toast-center" role="status" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <article
          key={toast.id}
          className={`toast-card toast-${toast.type || 'info'} ${toast.persistent ? 'toast-persistent' : ''} ${toast.className || ''}`.trim()}
          onMouseEnter={() => pauseToast(toast.id)}
          onMouseLeave={() => resumeToast(toast.id)}
        >
          <div className="toast-icon-wrap" aria-hidden="true">
            <span className="material-symbols-outlined toast-icon">{TOAST_ICON[toast.type] || TOAST_ICON.info}</span>
          </div>
          <div className="toast-content">
            <p className="toast-title">{toast.title}</p>
            {toast.message ? <p className="toast-message">{toast.message}</p> : null}
            {toast.persistent ? <p className="toast-persistent-tag">Pinned notification</p> : null}
            {(toast.actionLabel && typeof toast.onAction === 'function') || (toast.undoLabel && typeof toast.onUndo === 'function') ? (
              <div className="toast-actions-row">
                {toast.actionLabel && typeof toast.onAction === 'function' ? (
                  <button className="toast-action" type="button" onClick={() => toast.onAction(toast.id)}>
                    {toast.actionLabel}
                  </button>
                ) : null}
                {toast.undoLabel && typeof toast.onUndo === 'function' ? (
                  <button className="toast-action toast-action-ghost" type="button" onClick={() => toast.onUndo(toast.id)}>
                    {toast.undoLabel}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="toast-close"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </article>
      ))}
    </div>
  );
}
