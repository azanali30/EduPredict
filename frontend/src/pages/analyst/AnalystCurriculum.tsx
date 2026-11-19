import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { AnalystCurriculumStatsResponse } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { EmptyState } from '../../components/common/EmptyState';
import {
  BookOpen,
  Lock,
  ShieldCheck,
} from 'lucide-react';

export const AnalystCurriculum: React.FC = () => {
  const [data, setData] = useState<AnalystCurriculumStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.getAnalystCurriculumStats();
        setData(res);
      } catch (err: any) {
        setError(err?.message || 'Failed to load curriculum analytics.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <LoadingState title="Loading Curriculum Analytics..." description="Applying statistical disclosure control safeguards." />;
  }

  const subjects = data?.subjects || [];
  const suppressedCount = subjects.filter(
    (s) => s.active_enrollments_suppressed || s.assigned_teachers_suppressed
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subject & Curriculum Analytics (SDC Compliant)"
        subtitle="Analyze course registration volumes, faculty allocations, and department distributions under strict cell suppression."
        icon={<BookOpen size={24} className="text-brand-royal" />}
      />

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Monitored Curriculums"
          value={subjects.length}
          subtitle="Active academic disciplines"
          icon={<BookOpen size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Protected Small Cohorts"
          value={suppressedCount}
          subtitle="Subjects with N < 5 masked"
          icon={<Lock size={20} className="text-amber-500" />}
        />
        <StatCard
          title="Privacy Standard"
          value="k = 5 Anonymity"
          subtitle="Zero student PII exposed"
          icon={<ShieldCheck size={20} className="text-emerald-500" />}
        />
      </div>

      {/* Curriculum Table */}
      <SectionCard
        title="Curriculum Allocation & Enrollment Ledger"
        subtitle="Subject counts with minimum cell suppression enforced on small cohorts (1–4)."
      >
        {subjects.length === 0 ? (
          <EmptyState
            title="No Curriculum Telemetry"
            description="No active subject statistics are currently available."
            icon={<BookOpen size={32} />}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="table">
              <thead>
                <tr>
                  <th>Course Code</th>
                  <th>Discipline Name</th>
                  <th>Department</th>
                  <th>Active Enrollments</th>
                  <th>Assigned Faculty</th>
                  <th>SDC Privacy Status</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((s) => (
                  <tr key={s.subject_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="font-mono font-bold text-xs text-brand-royal">{s.code}</td>
                    <td className="font-bold text-navy-900">{s.name}</td>
                    <td>
                      <span className="badge bg-slate-100 text-slate-700 text-xs">
                        {s.department || 'General'}
                      </span>
                    </td>
                    <td>
                      {s.active_enrollments_suppressed ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          <Lock size={10} />
                          &lt; 5 (Confidential)
                        </span>
                      ) : (
                        <span className="font-mono text-sm font-bold text-navy-900">
                          {s.active_enrollments_display}
                        </span>
                      )}
                    </td>
                    <td>
                      {s.assigned_teachers_suppressed ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          <Lock size={10} />
                          &lt; 5 (Confidential)
                        </span>
                      ) : (
                        <span className="font-mono text-sm font-bold text-navy-900">
                          {s.assigned_teachers_display}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium">
                        <ShieldCheck size={14} className="text-emerald-500" />
                        Verified
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
};
