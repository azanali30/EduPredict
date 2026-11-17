import React from 'react';
import { Outlet } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-50">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-navy-900 text-sky-400 mb-3 shadow-md">
          <GraduationCap size={28} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-900 tracking-tight">
          EduPredict
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          AI-Powered Academic Performance Intelligence
        </p>
      </div>

      <div className="card w-full max-w-md shadow-card rounded-2xl bg-white p-6 sm:p-8">
        <Outlet />
      </div>

      <footer className="mt-8 text-center text-xs text-slate-400">
        EduPredict &copy; {new Date().getFullYear()} – Standalone Educational Intelligence Platform
      </footer>
    </div>
  );
};
