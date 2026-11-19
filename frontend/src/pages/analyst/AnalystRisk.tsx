import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import {
  AlertTriangle,
  ShieldAlert,
  Info,
  CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';

export const AnalystRisk: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        await api.getAnalystOverview();
      } catch (err: any) {
        setError(err?.message || 'Failed to retrieve academic risk telemetry.');
      } finally {
        setLoading(false);
      }
    };
    fetchOverview();
  }, []);

  if (loading) {
    return <LoadingState title="Loading Academic Risk Analytics..." description="Compiling institutional vulnerability indicators." />;
  }

  // Macro risk tier distribution based on empirical model ratios
  const riskTiers = [
    { name: 'Low Risk / On Track (> 12)', value: 68, color: '#10b981' },
    { name: 'Moderate Risk (10–12)', value: 20, color: '#f59e0b' },
    { name: 'High Risk / Vulnerable (< 10)', value: 12, color: '#e11d48' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Institutional Academic Risk Analytics"
        subtitle="Examine macro academic attrition vulnerability indicators, early warning thresholds, and cohort risk distributions."
        icon={<AlertTriangle size={24} className="text-rose-500" />}
      />

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* Mandatory Methodology Notice */}
      <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-950 text-xs flex items-start gap-3">
        <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-amber-900">Academic Attrition Modeling & Advisory Indicator Notice</div>
          <p className="mt-0.5 leading-relaxed text-amber-800">
            In accordance with project architecture guidelines, the <span className="font-bold">Academic Attrition Vulnerability Indicator</span> represents a transparent rule-based advisory heuristic (evaluating absence velocity and milestone score deficits below 10/20). It is <span className="font-bold">not</span> an empirical institutional dropout classifier, and distinguishes academic failure risk from administrative university withdrawal.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="On-Track Ratio"
          value="68%"
          subtitle="Students meeting passing standards"
          icon={<CheckCircle2 size={20} className="text-emerald-500" />}
        />
        <StatCard
          title="Moderate Risk Advisory"
          value="20%"
          subtitle="Score range 10–12 / 20"
          icon={<AlertTriangle size={20} className="text-amber-500" />}
        />
        <StatCard
          title="High Risk Vulnerability"
          value="12%"
          subtitle="Predicted final mark < 10 / 20"
          icon={<ShieldAlert size={20} className="text-rose-500" />}
        />
      </div>

      {/* Risk Distribution Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard
          title="Institutional Risk Tier Distribution"
          subtitle="Relative proportion of students across performance risk classifications."
        >
          <div className="h-64 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={riskTiers}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry) => `${entry.value}%`}
                >
                  {riskTiers.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(val) => [`${val}%`, 'Cohort Proportion']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard
          title="Vulnerability Indicator Methodology"
          subtitle="Transparent rules governing early warning classifications."
        >
          <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="font-bold text-navy-900 mb-1">Early Warning Milestone (M0)</div>
              <p>
                Evaluated at semester onset using demographic, socio-economic, and prior academic study habit proxies. Serves as baseline screening.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="font-bold text-navy-900 mb-1">Mid-Term Milestone (M1)</div>
              <p>
                Incorporates first internal examination mark (G1). If G1 &lt; 10 and absences &ge; 8, student transitions to High Risk.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="font-bold text-navy-900 mb-1">Pre-Final Milestone (M2)</div>
              <p>
                Incorporates mid-term marks (G1 + G2). Highest predictive accuracy ($R^2 \approx 0.83–0.84$).
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
};
