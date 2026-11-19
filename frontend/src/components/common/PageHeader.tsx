import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  badgeText?: string;
  badgeVariant?: 'brand' | 'teacher' | 'info' | 'success' | 'warning';
  actions?: React.ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  icon,
  badgeText,
  badgeVariant = 'brand',
  actions,
  breadcrumbs,
}) => {
  const getBadgeClass = () => {
    switch (badgeVariant) {
      case 'brand':
        return 'badge-brand';
      case 'teacher':
        return 'badge-teacher';
      case 'success':
        return 'badge-success';
      case 'warning':
        return 'badge-warning';
      case 'info':
      default:
        return 'badge-info';
    }
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200/60">
      <div>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-2 font-medium" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <span>/</span>}
                {crumb.href ? (
                  <a href={crumb.href} className="hover:text-brand-royal transition-colors">
                    {crumb.label}
                  </a>
                ) : (
                  <span className="text-slate-600">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-2.5 flex-wrap">
          {icon && <span className="shrink-0">{icon}</span>}
          <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
            {title}
          </h1>
          {badgeText && (
            <span className={`badge ${getBadgeClass()} text-xs font-semibold py-0.5 px-2.5`}>
              {badgeText}
            </span>
          )}
        </div>

        {subtitle && (
          <p className="text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};
