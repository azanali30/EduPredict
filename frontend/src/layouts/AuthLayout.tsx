import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { GraduationCap, Sparkles, TrendingUp, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { LoadingState } from '../components/common/LoadingState';

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-slate-50">
      {/* Left Visual Branding Panel (Split-Screen on Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-navy-950 via-navy-900 to-navy-850 text-white p-12 xl:p-16 flex-col justify-between relative overflow-hidden">
        {/* Subtle decorative background circles / glows */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-80 h-80 bg-sky-400/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Header */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-brand-600 to-sky-400 flex items-center justify-center text-white shadow-glow">
              <GraduationCap size={26} />
            </div>
            <div>
              <div className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
                EduPredict
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-400/20 text-sky-300 border border-sky-400/30">
                  AI Analytics
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Educational Performance Intelligence Platform
              </p>
            </div>
          </div>
        </div>

        {/* Center Presentation: Value Prop & Simulated SaaS Analytics Card */}
        <div className="relative z-10 my-auto py-8 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sky-300 text-xs font-semibold mb-6 backdrop-blur-sm">
            <Sparkles size={14} className="text-sky-400 animate-pulse" />
            <span>Early Academic Risk Forecasting Engine</span>
          </div>

          <h1 className="text-3xl xl:text-4xl font-extrabold text-white tracking-tight leading-tight mb-4">
            Transforming Academic Data into Actionable Early Interventions.
          </h1>

          <p className="text-slate-300 text-sm leading-relaxed mb-8">
            EduPredict evaluates attendance velocity, assessment performance, and study indicators through machine learning to illuminate learning bottlenecks before semester exams occur.
          </p>

          {/* Floating UI Showcase Mock Card */}
          <div className="rounded-2xl bg-white/10 border border-white/15 p-5 backdrop-blur-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-400/20 text-sky-300 flex items-center justify-center">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Cohort Performance Vector</div>
                  <div className="text-[11px] text-slate-400">Multi-Feature Linear & Ensemble Scoring</div>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[11px] font-bold">
                Model Ready
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-1">
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <span className="text-[11px] text-slate-400 block mb-1">Study Rhythm</span>
                <span className="text-base font-extrabold text-white">18.5 hrs/wk</span>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <span className="text-[11px] text-slate-400 block mb-1">Attendance</span>
                <span className="text-base font-extrabold text-sky-300">94.2%</span>
              </div>
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <span className="text-[11px] text-slate-400 block mb-1">Risk Profile</span>
                <span className="text-base font-extrabold text-emerald-400">On Track</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-300">
              <CheckCircle2 size={14} className="text-sky-400 shrink-0" />
              <span>Three distinct role interfaces: Student, Teacher, and Administrator</span>
            </div>
          </div>
        </div>

        {/* Footer Security Badges */}
        <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 pt-6 border-t border-white/10">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-sky-400" />
            <span>MongoDB 6.x Operational Store & Role-Based RBAC</span>
          </div>
          <span>&copy; {new Date().getFullYear()} EduPredict</span>
        </div>
      </div>

      {/* Right Form Container */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-10 lg:p-14">
        {/* Mobile Header Branding (Visible only on smaller screens) */}
        <div className="lg:hidden flex items-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center text-white shadow-md">
            <GraduationCap size={22} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-navy-900 leading-tight">EduPredict</h1>
            <p className="text-[11px] text-slate-500 font-medium">Educational Analytics Platform</p>
          </div>
        </div>

        {/* Form Card Container */}
        <div className="w-full max-w-md bg-white rounded-2xl shadow-card p-8 sm:p-10 border border-slate-200/80">
          <Suspense fallback={<LoadingState title="Loading Authenticator..." description="Please wait..." />}>
            <Outlet />
          </Suspense>
        </div>

        {/* Mobile Footer */}
        <div className="lg:hidden mt-8 text-center text-xs text-slate-400">
          &copy; {new Date().getFullYear()} EduPredict • Standalone Academic Analytics
        </div>
      </div>
    </div>
  );
};
