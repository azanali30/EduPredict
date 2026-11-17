import React from 'react';
import { Link } from 'react-router-dom';
import { Info, ArrowLeft, ShieldAlert } from 'lucide-react';
import { Button } from '../../components/forms/Button';

export const ForgotPasswordPage: React.FC = () => {
  return (
    <div className="text-center py-4">
      <div className="w-14 h-14 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-4 border border-sky-100 shadow-sm">
        <Info size={28} />
      </div>

      <h2 className="text-2xl font-extrabold text-navy-900 mb-2 tracking-tight">
        Password Assistance
      </h2>

      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left text-sm text-slate-600 leading-relaxed mb-6 space-y-2">
        <div className="flex items-center gap-2 font-bold text-navy-900 text-xs uppercase tracking-wider">
          <ShieldAlert size={16} className="text-amber-500" />
          <span>Administrative Reset Policy</span>
        </div>
        <p className="text-xs text-slate-500">
          Automated self-service email recovery is intentionally disabled to protect institutional educational records.
        </p>
        <p className="text-xs text-slate-500">
          To reset your credentials, please contact your designated EduPredict System Administrator or Instructor to issue a secure password reset.
        </p>
      </div>

      <Link to="/login">
        <Button variant="primary" size="lg" className="w-full" leftIcon={<ArrowLeft size={16} />}>
          Return to Sign In
        </Button>
      </Link>
    </div>
  );
};
