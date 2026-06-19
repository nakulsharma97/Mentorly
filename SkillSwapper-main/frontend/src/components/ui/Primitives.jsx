import React from 'react';

export function UIButton({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={`ui-btn ui-btn-${variant} ui-btn-${size} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

export function UICard({ children, className = '', as: Component = 'section', ...props }) {
  return (
    <Component className={`ui-card ${className}`.trim()} {...props}>
      {children}
    </Component>
  );
}

export function UIField({ label, htmlFor, hint, className = '', children }) {
  return (
    <div className={`ui-field ${className}`.trim()}>
      {label ? <label className="ui-field-label" htmlFor={htmlFor}>{label}</label> : null}
      {children}
      {hint ? <p className="ui-field-hint">{hint}</p> : null}
    </div>
  );
}

export function UIBadge({ children, className = '', tone = 'neutral', ...props }) {
  return (
    <span className={`ui-badge ui-badge-${tone} ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}

export function UIAlert({ title, message, tone = 'info', className = '', ...props }) {
  return (
    <div className={`ui-alert ui-alert-${tone} ${className}`.trim()} role="alert" {...props}>
      {title ? <p className="ui-alert-title">{title}</p> : null}
      {message ? <p className="ui-alert-text">{message}</p> : null}
    </div>
  );
}
