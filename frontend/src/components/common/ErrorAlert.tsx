import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
  onDismiss?: () => void;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({ message, onDismiss }) => {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-center justify-between p-3.5 mb-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm animate-in fade-in duration-200"
    >
      <div className="flex items-center gap-2">
        <AlertCircle size={18} className="shrink-0 text-rose-500" />
        <span className="font-medium">{message}</span>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-rose-500 hover:text-rose-700 p-1 rounded-md transition-colors"
          aria-label="Dismiss alert"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};
