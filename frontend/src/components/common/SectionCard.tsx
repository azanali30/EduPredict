import React from 'react';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  rightAction?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
  noPadding?: boolean;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  subtitle,
  icon,
  rightAction,
  className = '',
  children,
  noPadding = false,
}) => {
  const hasHeader = title || subtitle || icon || rightAction;

  return (
    <div className={`card overflow-hidden ${className}`}>
      {hasHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2.5">
            {icon && (
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-brand-royal flex items-center justify-center shrink-0 border border-sky-100">
                {icon}
              </div>
            )}
            <div>
              {title && (
                <h3 className="text-base font-bold text-navy-900 tracking-tight">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {rightAction && (
            <div className="shrink-0 flex items-center gap-2">
              {rightAction}
            </div>
          )}
        </div>
      )}

      <div className={noPadding ? '' : 'p-6'}>
        {children}
      </div>
    </div>
  );
};
