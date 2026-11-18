import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '../forms/Button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Failed to Load Telemetry',
  message = 'An unexpected network or server error occurred while retrieving data.',
  onRetry,
  className = '',
}) => {
  return (
    <div className={`card p-10 flex flex-col items-center justify-center text-center gap-3.5 border-rose-200 bg-rose-50/40 ${className}`}>
      <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center border border-rose-200 shadow-sm">
        <AlertCircle size={24} />
      </div>
      <div className="max-w-md">
        <h4 className="text-base font-bold text-navy-900">{title}</h4>
        <p className="text-xs text-rose-700 mt-1 leading-relaxed">{message}</p>
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          leftIcon={<RotateCcw size={13} />}
          className="border-rose-300 bg-white text-rose-700 hover:bg-rose-50"
        >
          Try Again
        </Button>
      )}
    </div>
  );
};
