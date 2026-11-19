import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  Activity,
  Info,
  ShieldCheck,
  Terminal,
  Server,
  Zap,
} from 'lucide-react';

export const AnalystAnomalies: React.FC = () => {
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDiagnostics = async () => {
      try {
        const res = await api.getAnalystDiagnostics();
        setDiagnostics(res);
      } catch (err: any) {
        setError(err?.message || 'Failed to connect to analyst diagnostic channel.');
      } finally {
        setLoading(false);
      }
    };
    fetchDiagnostics();
  }, []);

  if (loading) {
    return <LoadingState title="Connecting to Analyst Diagnostic Channel..." description="Verifying analyst-only RBAC telemetry channel." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Model Anomaly Analysis & Diagnostic Telemetry"
        subtitle="Inspect machine learning diagnostic telemetry, anomaly severity distributions, and dedicated analytical channels."
        icon={<Activity size={24} className="text-brand-royal" />}
      />

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* Anomaly Terminology Disclosure */}
      <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 text-blue-950 text-xs flex items-start gap-3">
        <Info size={16} className="text-brand-royal shrink-0 mt-0.5" />
        <div>
          <div className="font-bold">Anomaly Scoring & Severity Methodology</div>
          <p className="mt-0.5 leading-relaxed text-blue-900">
            In accordance with statistical disclosure standards, anomaly detection pipelines generate <span className="font-bold">anomaly scores and anomaly severity ranks</span>, not calibrated probabilities. G3 final examination marks and ground-truth academic classifications are strictly prohibited from entering unsupervised feature pipelines.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Diagnostic Channel Status"
          value={diagnostics?.status === 'active' ? 'Operational' : 'Offline'}
          subtitle="Strict Analyst RBAC channel"
          icon={<Zap size={20} className="text-emerald-500" />}
        />
        <StatCard
          title="Active Role Context"
          value={diagnostics?.role || 'analyst'}
          subtitle="Least-privilege verification"
          icon={<ShieldCheck size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Anomaly Detection Algorithm"
          value="Isolation Forest"
          subtitle="Contamination factor = 0.05"
          icon={<Server size={20} className="text-brand-ocean" />}
        />
      </div>

      {/* Diagnostics Payload Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard
          title="Diagnostic Telemetry Channel Ledger"
          subtitle="Live response payload from protected analyst backend endpoint (GET /api/analyst/diagnostics)."
        >
          <div className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto border border-slate-800">
            <div className="flex items-center gap-2 text-slate-400 mb-2 border-b border-slate-800 pb-2">
              <Terminal size={14} className="text-brand-mint" />
              <span>Analyst Diagnostic Telemetry Response</span>
            </div>
            <pre className="text-emerald-400 leading-relaxed">
              {JSON.stringify(diagnostics, null, 2)}
            </pre>
          </div>
        </SectionCard>

        <SectionCard
          title="Anomaly Score Interpretation Matrix"
          subtitle="Understanding severity classifications and threshold triggers."
        >
          <div className="space-y-3">
            {[
              {
                tier: 'Standard / Typical',
                score: 'Score > 0.0',
                description: 'Feature vector conforms to expected empirical study and demographic distributions.',
                status: 'Normal',
                type: 'success' as const,
              },
              {
                tier: 'Moderate Anomaly',
                score: '-0.1 < Score <= 0.0',
                description: 'Unusual combination of study hours, family support, or prior failure counts.',
                status: 'Review',
                type: 'warning' as const,
              },
              {
                tier: 'High Severity Anomaly',
                score: 'Score <= -0.1',
                description: 'Significant outlier feature vector; manual teacher observation recommended.',
                status: 'High Severity',
                type: 'error' as const,
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex items-start justify-between gap-3"
              >
                <div>
                  <div className="font-bold text-xs text-navy-900 flex items-center gap-2">
                    <span>{item.tier}</span>
                    <span className="font-mono text-[10px] text-slate-500 font-normal">({item.score})</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5 leading-snug">{item.description}</p>
                </div>
                <StatusBadge status={item.status} type={item.type} />
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
};
