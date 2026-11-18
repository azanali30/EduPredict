import React from 'react';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  MinusCircle,
  HelpCircle,
} from 'lucide-react';

export type StatusBadgeType =
  | 'High Risk'
  | 'Moderate Risk'
  | 'Low Risk / On Track'
  | 'Low Risk'
  | 'Unscreened'
  | 'No Model Run'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'brand'
  | 'neutral';

interface StatusBadgeProps {
  status?: string | StatusBadgeType | null;
  label?: string;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'sm',
  showIcon = true,
  className = '',
}) => {
  const normStatus = (status || 'neutral').trim();

  let badgeClass = 'bg-slate-100 text-slate-600 border-slate-200';
  let icon = <HelpCircle size={size === 'sm' ? 11 : 13} />;
  let text = label || normStatus;

  switch (normStatus) {
    case 'High Risk':
    case 'danger':
      badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
      icon = <AlertTriangle size={size === 'sm' ? 11 : 13} className="text-rose-600 shrink-0" />;
      text = label || 'High Risk';
      break;

    case 'Moderate Risk':
    case 'warning':
      badgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
      icon = <AlertCircle size={size === 'sm' ? 11 : 13} className="text-amber-600 shrink-0" />;
      text = label || 'Moderate Risk';
      break;

    case 'Low Risk / On Track':
    case 'Low Risk':
    case 'success':
      badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      icon = <CheckCircle2 size={size === 'sm' ? 11 : 13} className="text-emerald-600 shrink-0" />;
      text = label || 'Low Risk';
      break;

    case 'Unscreened':
    case 'No Model Run':
    case 'neutral':
      badgeClass = 'bg-slate-100 text-slate-500 border-slate-200';
      icon = <MinusCircle size={size === 'sm' ? 11 : 13} className="text-slate-400 shrink-0" />;
      text = label || (normStatus === 'neutral' ? 'Pending' : normStatus);
      break;

    case 'brand':
    case 'info':
      badgeClass = 'bg-sky-50 text-sky-700 border-sky-200';
      icon = <CheckCircle2 size={size === 'sm' ? 11 : 13} className="text-sky-600 shrink-0" />;
      text = label || 'Active';
      break;
  }

  const sizeClass = size === 'sm' ? 'text-[11px] py-0.5 px-2' : 'text-xs py-1 px-2.5';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold rounded-full border ${badgeClass} ${sizeClass} tracking-tight select-none ${className}`}
    >
      {showIcon && icon}
      <span>{text}</span>
    </span>
  );
};
