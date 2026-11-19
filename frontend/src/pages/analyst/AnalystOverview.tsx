import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { AnalystOverviewResponse, AnalystCurriculumStatsResponse } from '../../types';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import {
  Users,
  GraduationCap,
  BookOpen,
  BrainCircuit,
  ShieldCheck,
  Layers,
  Lock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

export const AnalystOverview: React.FC = () => {
  const [overview, setOverview] = useState<AnalystOverviewResponse | null>(null);
  const [curriculum, setCurriculum] = useState<AnalystCurriculumStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ovRes, currRes] = await Promise.all([
          api.getAnalystOverview(),
          api.getAnalystCurriculumStats(),
        ]);
        setOverview(ovRes);
        setCurriculum(currRes);
      } catch (err: any) {
        setError(err?.message || 'Failed to retrieve institutional analyst telemetry.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <LoadingState title="Loading Institutional Analytics Overview..." description="Synthesizing de-identified aggregate telemetry." />;
  }

  const metrics = overview?.metrics;
  const subjects = curriculum?.subjects || [];

  const chartData = subjects.map((s) => ({
    name: s.code,
    fullName: s.name,
    enrollments: s.active_enrollments_suppressed ? 0 : s.active_enrollments || 0,
    enrollmentsDisplay: s.active_enrollments_display,
    teachers: s.assigned_teachers_suppressed ? 0 : s.assigned_teachers || 0,
    teachersDisplay: s.assigned_teachers_display,
    isSuppressed: s.active_enrollments_suppressed || s.assigned_teachers_suppressed,
  }));

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="card bg-gradient-to-br from-navy-950 via-navy-900 to-navy-850 text-white p-6 sm:p-8 relative overflow-hidden border border-navy-800/80 shadow-soft">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-sky-300 text-xs font-semibold mb-3 backdrop-blur-sm">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>Statistical Disclosure Control (SDC) Protected</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
              Institutional Research & Analytics Hub
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Macro-level institutional metrics, curriculum enrollment analytics, and predictive model telemetry with zero individual student PII exposure.
            </p>
          </div>

          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 border border-white/10 backdrop-blur-sm shrink-0">
            <Lock size={16} className="text-brand-mint" />
            <div className="text-left">
              <div className="text-[11px] font-bold text-white leading-tight">Cell Suppression Active</div>
              <div className="text-[10px] text-slate-300">Cohorts &lt; 5 de-identified</div>
            </div>
          </div>
        </div>
      </div>

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* Macro KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Total Students"
          value={metrics?.total_students_display || '0'}
          subtitle={metrics?.total_students_suppressed ? 'Protected cell (<5)' : 'Institutional headcount'}
          icon={<GraduationCap size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Total Faculty"
          value={metrics?.total_teachers_display || '0'}
          subtitle={metrics?.total_teachers_suppressed ? 'Protected cell (<5)' : 'Registered instructors'}
          icon={<Users size={20} className="text-brand-ocean" />}
        />
        <StatCard
          title="Active Curriculums"
          value={metrics?.total_active_subjects || 0}
          subtitle="Monitored disciplines"
          icon={<BookOpen size={20} className="text-brand-mint" />}
        />
        <StatCard
          title="Course Enrollments"
          value={metrics?.total_active_enrollments_display || '0'}
          subtitle={metrics?.total_active_enrollments_suppressed ? 'Suppressed (Complementary)' : 'Total registrations'}
          icon={<Layers size={20} className="text-amber-500" />}
        />
        <StatCard
          title="AI Predictions Run"
          value={metrics?.total_predictions_display || '0'}
          subtitle="Cumulative inferences"
          icon={<BrainCircuit size={20} className="text-emerald-500" />}
        />
      </div>

      {/* Curriculum Distribution & SDC Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SectionCard
            title="Curriculum Enrollment Distribution"
            subtitle="Subject registration headcounts. Protected small cohorts (<5) are withheld from raw numeric plotting."
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(val, name, item: any) => {
                      if (item.payload.isSuppressed) return ['< 5 (Confidential)', name];
                      return [val, name];
                    }}
                  />
                  <Legend />
                  <Bar dataKey="enrollments" name="Active Enrollments" fill="#2455C5" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="teachers" name="Assigned Teachers" fill="#168CCB" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>

        {/* SDC Confidentiality Policy Card */}
        <div>
          <SectionCard
            title="SDC Privacy Safeguards"
            subtitle="Minimum cell suppression & re-identification prevention."
          >
            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="font-bold text-navy-900 mb-1 flex items-center gap-1.5">
                  <Lock size={14} className="text-brand-royal" />
                  <span>Threshold Rule (N &ge; 5)</span>
                </div>
                <p>
                  Any cohort where active enrollments or assigned faculty are between 1 and 4 returns <code className="font-mono bg-slate-200 px-1 rounded">&lt;5</code> with raw values omitted.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="font-bold text-navy-900 mb-1 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-500" />
                  <span>Residual Disclosure Protection</span>
                </div>
                <p>
                  Complementary suppression is automatically applied to grand totals when a single subject is masked, preventing subtraction attacks.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="font-bold text-navy-900 mb-1">Zero PII Policy</div>
                <p>
                  Analysts can never retrieve individual student names, emails, academic histories, or raw grade records.
                </p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
};
