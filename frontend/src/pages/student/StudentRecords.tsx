import React from 'react';
import { EmptyState } from '../../components/common/EmptyState';
import { BookOpen, Calendar, Info } from 'lucide-react';
import { Button } from '../../components/forms/Button';

export const StudentRecords: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">
            Academic Coursework Records
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Historical term logs, internal evaluation scores, and attendance indicators
          </p>
        </div>

        <Button variant="primary" leftIcon={<BookOpen size={16} />} disabled>
          Log Course Record (Phase 4 Ingestion)
        </Button>
      </div>

      {/* KPI Cards Preview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Logged Terms
          </span>
          <span className="text-2xl font-extrabold text-navy-900">0</span>
          <span className="text-xs text-slate-400 block mt-1">Awaiting batch import</span>
        </div>
        <div className="card p-5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Recorded Subjects
          </span>
          <span className="text-2xl font-extrabold text-navy-900">0</span>
          <span className="text-xs text-slate-400 block mt-1">Curricular baseline ready</span>
        </div>
        <div className="card p-5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Assessment Status
          </span>
          <span className="text-2xl font-extrabold text-emerald-600">Active</span>
          <span className="text-xs text-slate-400 block mt-1">Ready for dataset pipeline</span>
        </div>
      </div>

      {/* Main Records Container */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-brand-500" />
            <h3 className="text-base font-bold text-navy-900">Coursework History</h3>
          </div>
          <span className="badge badge-info text-[10px]">MongoDB 6 Store</span>
        </div>

        <EmptyState
          icon={<BookOpen size={36} className="text-brand-500" />}
          title="No Academic Records Logged Yet"
          description="Your personal coursework indicators (attendance %, study hours, internal quiz marks, and midterm exam scores) will be stored in your student profile when logged by your instructor or imported in the data pipeline."
        />

        {/* Informative Schema Format Card */}
        <div className="mt-8 p-5 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center gap-2 text-xs font-bold text-navy-900 uppercase tracking-wider mb-2">
            <Info size={16} className="text-brand-500" />
            <span>Standard EduPredict Record Schema</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-600">
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="font-semibold block text-slate-900">Attendance</span>
              <span className="text-[11px] text-slate-400">Class presence (0–100%)</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="font-semibold block text-slate-900">Study Rhythm</span>
              <span className="text-[11px] text-slate-400">Weekly hours invested</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="font-semibold block text-slate-900">Quiz & Midterm</span>
              <span className="text-[11px] text-slate-400">Continuous evaluation</span>
            </div>
            <div className="bg-white p-3 rounded-lg border border-slate-200">
              <span className="font-semibold block text-slate-900">Class Participation</span>
              <span className="text-[11px] text-slate-400">Engagement index</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
