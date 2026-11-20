import React, { useState, useEffect } from 'react';
import { EmptyState } from '../../components/common/EmptyState';
import { BookOpen, Calendar, Info } from 'lucide-react';
import { api } from '../../services/api';
import { SubjectItem } from '../../types';

export const StudentRecords: React.FC = () => {
  const [enrolledSubjects, setEnrolledSubjects] = useState<SubjectItem[]>([]);

  useEffect(() => {
    api.getStudentSubjects()
      .then((res) => setEnrolledSubjects(res.subjects || []))
      .catch((err) => console.error('Failed to load enrolled subjects:', err));
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">
            Academic Coursework Records
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Institutional course registrations, term enrollments, and academic evaluations
          </p>
        </div>

        <span className="badge badge-student text-xs py-1.5 px-3">
          {enrolledSubjects.length} Active {enrolledSubjects.length === 1 ? 'Enrollment' : 'Enrollments'}
        </span>
      </div>

      {/* KPI Cards Preview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Registered Courses
          </span>
          <span className="text-2xl font-extrabold text-navy-900">{enrolledSubjects.length}</span>
          <span className="text-xs text-brand-royal font-semibold block mt-1">Active Curriculum</span>
        </div>
        <div className="card p-5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Current Academic Term
          </span>
          <span className="text-2xl font-extrabold text-navy-900 font-mono">
            {enrolledSubjects[0]?.academic_term || '2026-T1'}
          </span>
          <span className="text-xs text-slate-400 block mt-1">Official Semester</span>
        </div>
        <div className="card p-5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Enrollment Status
          </span>
          <span className="text-2xl font-extrabold text-emerald-600">Active</span>
          <span className="text-xs text-slate-400 block mt-1">Verified on MongoDB Store</span>
        </div>
      </div>

      {/* Enrolled Courses Table */}
      {enrolledSubjects.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-navy-900">
              Active Course Enrollments
            </h3>
            <span className="badge badge-success text-[10px]">Institutional Registrar Verified</span>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Subject Name</th>
                  <th>Course Code</th>
                  <th>Academic Term</th>
                  <th>Grading Scale</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {enrolledSubjects.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <BookOpen size={14} className="text-brand-600 shrink-0" />
                        <span className="font-bold text-xs text-navy-900">{s.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                        {s.code || '—'}
                      </span>
                    </td>
                    <td className="font-mono text-xs font-bold text-brand-royal">
                      {s.academic_term || '2026-T1'}
                    </td>
                    <td className="text-xs text-slate-500 font-mono">
                      {s.target_scale || '0 - 100'}
                    </td>
                    <td>
                      <span className="badge badge-success text-[10px]">
                        {s.enrollment_status || 'active'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main Records Container */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-brand-500" />
            <h3 className="text-base font-bold text-navy-900">Historical Exam Logs</h3>
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
