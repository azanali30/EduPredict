import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { AnalystAnomalyStats } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import {
  Activity,
  ShieldCheck,
  Server,
  Lock,
  BarChart3,
  Layers,
  AlertTriangle,
  Zap,
} from 'lucide-react';

export const AnalystAnomalies: React.FC = () => {
  const [stats, setStats] = useState<AnalystAnomalyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      setError(null);
      try {
        const statsRes = await api.getAnalystAnomalyStats();
        setStats(statsRes);
      } catch (err: any) {
        setError(err?.message || 'Failed to connect to analyst anomaly statistics channel.');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <LoadingState
        title="Connecting to Analyst Aggregate Telemetry..."
        description="Fetching differential privacy and cell-suppressed anomaly analytics."
      />
    );
  }

  const renderSuppressedValue = (
    item?: { count: number | null; display: string; suppressed: boolean },
    suffix = ''
  ): string => {
    if (!item) return '0';
    if (item.suppressed) {
      return `${item.display} (Suppressed)`;
    }
    return `${item.display}${suffix}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Curriculum Anomaly Analytics & Telemetry"
        subtitle="Population-level density divergence, severity distributions, and privacy-preserving cell suppression (N < 5)."
        icon={<Activity size={24} className="text-brand-royal" />}
      />

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* Minimum Cell Suppression & SDC Disclosure Banner */}
      <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 text-blue-950 text-xs flex items-start gap-3">
        <ShieldCheck size={18} className="text-brand-royal shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <div className="font-bold text-navy-900">
            Statistical Disclosure Control (SDC) & Minimum Cell Suppression (N &lt; 5)
          </div>
          <p className="mt-0.5 text-blue-900">
            In compliance with educational privacy protocols, row-level student records are strictly restricted from the Analyst dashboard. Any frequency cell with fewer than 5 records is automatically masked as{' '}
            <code className="bg-blue-100/80 px-1 rounded font-mono text-[11px]">&lt;5</code> to prevent cohort subtraction or identity reconstruction.
          </p>
          {stats?.privacy_notice && (
            <p className="mt-1.5 text-slate-500 italic text-[11px] border-t border-blue-100/80 pt-1.5">
              {stats.privacy_notice}
            </p>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          title="Total Evaluated Records"
          value={stats?.total_evaluated_records ?? 0}
          subtitle="Mathematics & Portuguese Language"
          icon={<Layers size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Flagged Anomalies"
          value={renderSuppressedValue(stats?.total_anomalies)}
          subtitle="Outliers at 5% contamination"
          icon={<AlertTriangle size={20} className="text-amber-500" />}
        />
        <StatCard
          title="Differential Privacy"
          value="N < 5 Policy"
          subtitle="Active cell suppression"
          icon={<Lock size={20} className="text-emerald-500" />}
        />
        <StatCard
          title="Algorithm Configuration"
          value="Isolation Forest"
          subtitle="Contamination factor = 0.05"
          icon={<Server size={20} className="text-brand-ocean" />}
        />
      </div>

      {/* Breakdown Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subject Breakdown Card */}
        <SectionCard
          title="Subject Cohort Telemetry"
          subtitle="Aggregated evaluation records and flagged anomaly counts by curriculum track."
        >
          <div className="space-y-4">
            {stats?.subject_breakdown &&
              Object.entries(stats.subject_breakdown).map(([subj, data]) => (
                <div
                  key={subj}
                  className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-navy-900">{subj}</span>
                    <span className="text-xs text-slate-500 font-mono">
                      Evaluated: {renderSuppressedValue(data.total_records)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
                    <span className="text-slate-600 font-medium">Flagged Anomalies:</span>
                    <span className="font-bold font-mono text-rose-600">
                      {renderSuppressedValue(data.anomalies_count)}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </SectionCard>

        {/* Severity & Review Status Breakdown Card */}
        <SectionCard
          title="Severity & Review Status Distributions"
          subtitle="Cross-sectional distribution of anomaly severity levels and faculty review progress."
        >
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Severity Stratification
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {stats?.severity_breakdown &&
                  Object.entries(stats.severity_breakdown).map(([sev, item]) => (
                    <div
                      key={sev}
                      className="p-3 bg-white rounded-lg border border-slate-200 flex flex-col"
                    >
                      <span className="text-[11px] font-semibold text-slate-500">{sev}</span>
                      <span className="text-base font-bold text-navy-900 font-mono mt-0.5">
                        {renderSuppressedValue(item)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="pt-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Human Review Progress
              </h4>
              <div className="space-y-2">
                {stats?.status_breakdown &&
                  Object.entries(stats.status_breakdown).map(([st, item]) => (
                    <div
                      key={st}
                      className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-slate-700">{st}</span>
                      <span className="font-bold font-mono text-navy-900">
                        {renderSuppressedValue(item)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Model Methodology Matrix */}
      <SectionCard
        title="Isolation Forest Model Architecture & Interpretation Matrix"
        subtitle="Mathematical specifications, contamination parameters, and statistical deviation metrics."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="font-bold text-navy-900 flex items-center gap-1.5">
              <Zap size={14} className="text-amber-500" />
              <span>Contamination Parameter</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Configured at <strong className="font-mono">0.05 (5.0%)</strong> to establish the decision threshold corresponding to the empirical 95th percentile of expected density divergence.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="font-bold text-navy-900 flex items-center gap-1.5">
              <BarChart3 size={14} className="text-brand-royal" />
              <span>Uncalibrated Path Scores</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Isolation tree depth produces uncalibrated density indices. These are ranked as cohort percentiles, strictly avoiding probabilistic student failure claims.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
            <div className="font-bold text-navy-900 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>Target Leakage Immunity</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Target variables (<code className="font-mono text-[10px]">G3, academic_status, pass_status</code>) and synthetic proxies are excluded from both feature pipelines.
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
};
