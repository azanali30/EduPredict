import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldX, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/forms/Button';
import { useAuth } from '../../context/AuthContext';

export const UnauthorizedPage: React.FC = () => {
  const { user } = useAuth();

  const getHomePath = () => {
    if (!user) return '/login';
    if (user.role === 'admin') return '/admin';
    if (user.role === 'teacher') return '/teacher';
    return '/student';
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-6 max-w-md mx-auto">
      <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mb-6 shadow-sm">
        <ShieldX size={36} />
      </div>

      <span className="badge badge-danger text-[10px] mb-2">Access Denied (403)</span>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 mb-2 tracking-tight">
        Unauthorized Area
      </h1>
      <p className="text-sm text-slate-500 mb-8 leading-relaxed">
        Your current account role privileges do not permit access to this module. Role-based access control (RBAC) boundaries are strictly enforced.
      </p>

      <Link to={getHomePath()}>
        <Button variant="primary" size="lg" leftIcon={<ArrowLeft size={16} />}>
          Return to My Workspace
        </Button>
      </Link>
    </div>
  );
};
