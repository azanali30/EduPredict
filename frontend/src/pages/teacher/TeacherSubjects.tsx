import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { SubjectItem } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { EmptyState } from '../../components/common/EmptyState';
import { Button } from '../../components/forms/Button';
import { Link } from 'react-router-dom';
import { useTeacherSubject } from '../../context/TeacherSubjectContext';
import {
  BookOpen,
  Calendar,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

export const TeacherSubjects: React.FC = () => {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setSelectedSubjectId, selectedSubjectId } = useTeacherSubject();

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const res = await api.getTeacherSubjects();
        setSubjects(res.subjects || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to retrieve assigned subjects.');
      } finally {
        setLoading(false);
      }
    };
    fetchSubjects();
  }, []);

  if (loading) {
    return <LoadingState title="Loading Assigned Subjects..." description="Retrieving faculty curriculum allocations." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Assigned Subjects & Curriculums"
        subtitle="Review disciplines officially assigned to you by administrators, inspect evaluation scales, and switch workspace context."
        icon={<BookOpen size={24} className="text-brand-royal" />}
      />

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Assigned Subjects"
          value={subjects.length}
          subtitle="Active academic disciplines"
          icon={<BookOpen size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Active Term"
          value={subjects[0]?.academic_term || '2026-T1'}
          subtitle="Current teaching semester"
          icon={<Calendar size={20} className="text-brand-ocean" />}
        />
        <StatCard
          title="Selected Workspace"
          value={subjects.find((s) => s.id === selectedSubjectId)?.name || 'None'}
          subtitle="Current active classroom"
          icon={<CheckCircle2 size={20} className="text-emerald-500" />}
        />
      </div>

      {/* Subject Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {subjects.length === 0 ? (
          <div className="md:col-span-2">
            <EmptyState
              title="No Subjects Assigned"
              description="You have not been assigned to any subjects for the active academic term. Please contact the administrator."
              icon={<BookOpen size={32} />}
            />
          </div>
        ) : (
          subjects.map((subj) => {
            const isCurrent = subj.id === selectedSubjectId;
            return (
              <div
                key={subj.id}
                className={`card p-6 border transition-all duration-200 ${
                  isCurrent
                    ? 'border-brand-royal bg-gradient-to-br from-white to-blue-50/30 shadow-md ring-2 ring-brand-royal/20'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-soft'
                }`}
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
                    status={subj.status === 'active' ? 'Active Allocation' : 'Assigned'}
                    type="success"
                  />
                </div>

                <p className="text-xs text-slate-600 line-clamp-2 mb-4 leading-relaxed">
                  {subj.description || 'Core curriculum course calibrated for AI academic performance and risk modeling.'}
                </p>

                <div className="space-y-2 pt-3 border-t border-slate-100 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Academic Term:</span>
                    <span className="font-mono font-semibold text-navy-900">{subj.academic_term || '2026-T1'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Grading Scale:</span>
                    <span className="font-medium text-navy-900">{subj.target_scale || '0–20 (Standard Scale)'}</span>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setSelectedSubjectId(subj.id)}
                    className={`btn btn-sm text-xs py-1.5 px-3 ${
                      isCurrent
                        ? 'btn-primary shadow-glow cursor-default'
                        : 'btn-outline border-slate-300 hover:border-brand-royal hover:text-brand-royal'
                    }`}
                  >
                    {isCurrent ? 'Active Workspace' : 'Switch Workspace'}
                  </button>

                  <Link to="/teacher/students">
                    <Button variant="ghost" size="sm" rightIcon={<ArrowRight size={14} />} className="text-xs">
                      View Roster
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
