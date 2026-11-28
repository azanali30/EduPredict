import React, { useEffect, useState } from 'react';
import { EmptyState } from '../../components/common/EmptyState';
import { BookOpen, Info } from 'lucide-react';
import { api, academicRecordsApi } from '../../services/api';
import { AcademicRecordItem, SubjectItem } from '../../types';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';

export const StudentRecords: React.FC = () => {
  const [enrolledSubjects, setEnrolledSubjects] = useState<SubjectItem[]>([]);
  const [records, setRecords] = useState<AcademicRecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [subjRes, recsRes] = await Promise.all([
          api.getStudentSubjects(),
          academicRecordsApi.list({ limit: 50 }),
        ]);
        setEnrolledSubjects(subjRes.subjects || []);
        setRecords(recsRes.records || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load academic records.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) {
    return (
      <LoadingState
        title="Loading Academic Records..."
        description="Retrieving enrolled courses and verified coursework records."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">
            Academic Coursework Records
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Institutional course registrations, term enrollments, and verified coursework assessments
          </p>
        </div>

        <span className="badge badge-student text-xs py-1.5 px-3">
          {enrolledSubjects.length} Active {enrolledSubjects.length === 1 ? 'Enrollment' : 'Enrollments'}
        </span>
      </div>

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* KPI Cards */}
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
            {enrolledSubjects[0]?.academic_term || records[0]?.term || '--'}
          </span>
          <span className="text-xs text-slate-400 block mt-1">
            {enrolledSubjects.length > 0 ? 'Official Semester' : 'No active term'}
          </span>
        </div>
        <div className="card p-5">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Coursework Records
          </span>
          <span className="text-2xl font-extrabold text-navy-900">{records.length}</span>
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
                      <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                        {s.code || 'SUBJ'}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-slate-600">{s.academic_term || '--'}</td>
                    <td className="text-xs text-slate-500">0–20 Scale</td>
                    <td>
                      <span className="badge badge-success text-[10px]">Active</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Verified Academic Coursework Records */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-navy-900">
              Verified Academic Coursework & Examination Records
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Official coursework scores distinct from AI predictive model simulations.
            </p>
          </div>
          <span className="badge badge-info text-[10px]">Read-Only Student View</span>
        </div>

        {records.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<BookOpen size={28} />}
              title="No academic coursework records recorded yet"
              description="Verified grades and coursework entries recorded by your instructors or registrar will appear here."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Term</th>
                  <th>G1 (0–20)</th>
                  <th>G2 (0–20)</th>
                  <th>Final (0–20)</th>
                  <th>Assignment Rate</th>
                  <th>Quiz Average</th>
                  <th>Weekly Study Hours</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => (
                  <tr key={rec.id}>
                    <td className="font-bold text-xs text-navy-900">{rec.subject}</td>
                    <td className="font-mono text-xs">{rec.term}</td>
                    <td className="font-mono text-xs">{rec.g1 ?? '--'}</td>
                    <td className="font-mono text-xs">{rec.g2 ?? '--'}</td>
                    <td className="font-mono text-xs font-bold">{rec.final_exam_marks ?? '--'}</td>
                    <td className="font-mono text-xs">
                      {rec.assignment_completion_rate !== null && rec.assignment_completion_rate !== undefined
                        ? `${rec.assignment_completion_rate}%`
                        : '--'}
                    </td>
                    <td className="font-mono text-xs">
                      {rec.quiz_average !== null && rec.quiz_average !== undefined ? `${rec.quiz_average}%` : '--'}
                    </td>
                    <td className="font-mono text-xs">{rec.study_hours_per_week ?? '--'}</td>
                    <td>
                      <span className="badge badge-info text-[10px]">{rec.source || 'institutional_entry'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
        <Info size={15} className="text-brand-royal shrink-0 mt-0.5" />
        <span>
          Coursework grades shown above reflect verified academic records maintained by faculty and administrators. To estimate upcoming exam outcomes, use AI Predictions.
        </span>
      </div>
    </div>
  );
};
