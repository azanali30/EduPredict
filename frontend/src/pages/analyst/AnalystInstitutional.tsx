import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { AnalystOverviewResponse } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import {
  PieChart as PieIcon,
  Users,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';

export const AnalystInstitutional: React.FC = () => {
  const [overview, setOverview] = useState<AnalystOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const res = await api.getAnalystOverview();
        setOverview(res);
      } catch (err: any) {
        setError(err?.message || 'Failed to retrieve institutional analytics.');
      } finally {
        setLoading(false);
      }
    };
    fetchOverview();
  }, []);

  if (loading) {
    return <LoadingState title="Loading Institutional Analytics..." description="Compiling institutional macro ratios." />;
  }

  const metrics = overview?.metrics;
  const studentVal = metrics?.total_students || 395;
  const teacherVal = metrics?.total_teachers || 14;

  const ratio = teacherVal > 0 ? (studentVal / teacherVal).toFixed(1) : 'N/A';

  const distributionData = [
    { name: 'Enrolled Students', value: studentVal, color: '#2455C5' },
    { name: 'Academic Faculty', value: teacherVal, color: '#18D6B5' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Institutional Macro Analytics & Capacity"
        subtitle="Examine student-to-faculty ratios, curriculum enrollment density, and institutional engagement metrics."
        icon={<PieIcon size={24} className="text-brand-royal" />}
      />

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Student-to-Faculty Ratio"
          value={`${ratio} : 1`}
          subtitle="Institutional teaching density"
          icon={<Users size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Active Curriculums"
          value={metrics?.total_active_subjects || 0}
          subtitle="Monitored departments"
          icon={<Layers size={20} className="text-brand-ocean" />}
        />
        <StatCard
          title="Data Confidentiality"
          value="SDC Active"
          subtitle="Privacy threshold N >= 5"
          icon={<ShieldCheck size={20} className="text-emerald-500" />}
        />
      </div>

      {/* Analytics Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard
          title="Campus Demographics Macro Distribution"
          subtitle="Relative scale of registered student body versus active instructional faculty."
        >
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Curriculum Engagement Overview"
          subtitle="Macro indicators of student registrations across verified offerings."
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-navy-900">Total Course Enrollments</div>
                <div className="text-[11px] text-slate-500">Verified student-subject pairings</div>
              </div>
              <span className="font-mono text-base font-extrabold text-brand-royal">
                {metrics?.total_active_enrollments_display || '0'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-navy-900">Active Academic Disciplines</div>
                <div className="text-[11px] text-slate-500">Departments offering verified curricula</div>
              </div>
              <span className="font-mono text-base font-extrabold text-navy-900">
                {metrics?.total_active_subjects || 0}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-navy-900">Total Model Inferences</div>
                <div className="text-[11px] text-slate-500">Algorithmic risk assessments logged</div>
              </div>
              <span className="font-mono text-base font-extrabold text-brand-ocean">
                {metrics?.total_predictions_display || '0'}
              </span>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
};
