import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { SubjectItem } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { EmptyState } from '../../components/common/EmptyState';
import { Link } from 'react-router-dom';
import { Button } from '../../components/forms/Button';
import {
  BookOpen,
  Calendar,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

export const StudentSubjects: React.FC = () => {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const res = await api.getStudentSubjects();
        setSubjects(res.subjects || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load enrolled subjects.');
      } finally {
        setLoading(false);
      }
    };
    fetchSubjects();
  }, []);

  if (loading) {
    return <LoadingState title="Loading Enrolled Subjects..." description="Retrieving your verified course registrations." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Enrolled Academic Subjects"
        subtitle="Review your registered courses, evaluation scales, and access subject-specific predictive assessments."
        icon={<BookOpen size={24} className="text-brand-royal" />}
      />

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Enrolled Subjects"
          value={subjects.length}
          subtitle="Active curriculum registrations"
          icon={<BookOpen size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Active Term"
          value={subjects[0]?.academic_term || '2026-T1'}
          subtitle="Spring Semester Cycle"
          icon={<Calendar size={20} className="text-brand-ocean" />}
        />
        <StatCard
          title="Enrollment Status"
          value="Verified"
          subtitle="Official registrar enrollment"
          icon={<CheckCircle2 size={20} className="text-emerald-500" />}
        />
      </div>

      {/* Subjects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {subjects.length === 0 ? (
          <div className="md:col-span-2">
            <EmptyState
              title="No Course Enrollments Found"
              description="You are not actively enrolled in any subjects for the current term. Please check with your administrator."
              icon={<BookOpen size={32} />}
            />
          </div>
        ) : (
          subjects.map((subj) => (
            <div
              key={subj.id}
              className="card p-6 border border-slate-200 hover:border-brand-royal/50 hover:shadow-soft transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <span className="font-mono text-xs font-bold text-brand-royal bg-brand-royal/10 px-2 py-0.5 rounded">
                    {subj.code}
                  </span>
                  <h3 className="text-lg font-bold text-navy-900 mt-1">{subj.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{subj.department || 'General Department'}</p>
                </div>
                <StatusBadge
                  status={subj.status === 'active' ? 'Enrolled' : 'Active'}
                  type="success"
                />
              </div>

              <p className="text-xs text-slate-600 line-clamp-2 mb-4 leading-relaxed">
                {subj.description || 'Core curriculum discipline calibrated for AI academic performance and risk modeling.'}
              </p>

              <div className="space-y-2 pt-3 border-t border-slate-100 text-xs text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Academic Term:</span>
                  <span className="font-mono font-semibold text-navy-900">{subj.academic_term || '2026-T1'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Target Scale:</span>
                  <span className="font-medium text-navy-900">{subj.target_scale || '0–20 (Portuguese Standard)'}</span>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between pt-3 border-t border-slate-100">
                <Link to="/student/predictions">
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Sparkles size={14} />}
                    className="text-xs shadow-glow"
                  >
                    Run Prediction
                  </Button>
                </Link>

                <Link to="/student/records">
                  <Button variant="ghost" size="sm" rightIcon={<ArrowRight size={14} />} className="text-xs">
                    Academic Records
                  </Button>
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
