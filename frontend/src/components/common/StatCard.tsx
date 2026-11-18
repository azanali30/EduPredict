import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  iconBg?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  badgeText?: string;
  badgeVariant?: 'success' | 'warning' | 'danger' | 'info' | 'brand';
  onClick?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  iconBg,
  trend,
  badgeText,
  badgeVariant = 'info',
  onClick,
  className = '',
}) => {
  const getBadgeClass = () => {
    switch (badgeVariant) {
      case 'brand':
        return 'badge-brand';
      case 'success':
        return 'badge-success';
      case 'warning':
        return 'badge-warning';
      case 'danger':
        return 'badge-danger';
      case 'info':
      default:
        return 'badge-info';
    }
  };

  return (
    <div
      onClick={onClick}
      className={`card flex flex-col gap-3 p-5 sm:p-6 transition-all duration-200 hover:shadow-soft ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          {title}
        </span>
        {icon && (
          <div
            className={`flex items-center justify-center w-9 h-9 rounded-xl ${
              iconBg || 'bg-sky-50 text-brand-royal'
            } border border-slate-100 shadow-sm shrink-0`}
          >
            {icon}
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight font-heading">
          {value}
        </span>
        {badgeText && (
          <span className={`badge ${getBadgeClass()} text-[10px] py-0.5 px-2`}>
            {badgeText}
          </span>
        )}
      </div>

      {(subtitle || trend) && (
        <div className="flex items-center gap-2 text-xs flex-wrap">
          {trend && (
            <span
              className={`font-semibold ${
                trend.isPositive ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {trend.value}
            </span>
          )}
          {subtitle && <span className="text-slate-500">{subtitle}</span>}
        </div>
      )}
    </div>
  );
};
