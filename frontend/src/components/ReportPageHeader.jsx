import React from 'react';

export default function ReportPageHeader({
  title,
  description,
  children,
  actions,
  surface = true,
  className = '',
}) {
  return (
    <header className={[
      'dashboard-page-header',
      'report-page-header',
      surface ? 'report-page-header--surface' : 'report-page-header--plain',
      className,
    ].filter(Boolean).join(' ')}>
      <div className="report-page-heading">
        <h2 className="dashboard-page-title">{title}</h2>
        {description && <p className="dashboard-page-subtitle">{description}</p>}
      </div>
      {(children || actions) && (
        <div className="report-page-controls">
          {children}
          {actions && <div className="report-page-actions">{actions}</div>}
        </div>
      )}
    </header>
  );
}
