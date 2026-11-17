import React from 'react';
import { Inbox } from 'lucide-react';
import { Button } from '../forms/Button';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionText,
  onAction,
}) => {
  return (
    <div className="card flex flex-col items-center justify-center text-center p-12 gap-4">
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shadow-inner">
        {icon || <Inbox size={28} />}
      </div>
      <div className="max-w-md">
        <h4 className="text-lg font-bold text-navy-900 mb-1.5">{title}</h4>
        <p className="text-sm text-slate-500 leading-relaxed">
          {description}
        </p>
      </div>
      {actionText && onAction && (
        <Button variant="outline" size="sm" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
};
