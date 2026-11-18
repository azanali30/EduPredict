import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  title?: string;
  description?: string;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  title = 'Loading Workspace Telemetry...',
  description = 'Connecting to MongoDB and synchronizing analytics.',
  className = '',
}) => {
  return (
    <div className={`card p-12 flex flex-col items-center justify-center text-center gap-3 ${className}`}>
      <div className="w-12 h-12 rounded-2xl bg-sky-50 text-brand-royal flex items-center justify-center border border-sky-100 shadow-sm">
        <Loader2 size={24} className="animate-spin text-brand-royal" />
      </div>
      <div>
        <h4 className="text-sm font-bold text-navy-900">{title}</h4>
        {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
      </div>
    </div>
  );
};
