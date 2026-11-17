import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/forms/Button';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-6 max-w-md mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mb-6 shadow-inner">
        <FileQuestion size={36} />
      </div>

      <span className="badge badge-warning text-[10px] mb-2">Error 404</span>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 mb-2 tracking-tight">
        Page Not Found
      </h1>
      <p className="text-sm text-slate-500 mb-8 leading-relaxed">
        The requested educational analytics page or route could not be found. Please check the URL or navigate back to the home portal.
      </p>

      <Link to="/">
        <Button variant="primary" size="lg" leftIcon={<ArrowLeft size={16} />}>
          Return to Dashboard
        </Button>
      </Link>
    </div>
  );
};
