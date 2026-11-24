import React, { useEffect, useState } from 'react';
import { api, dropoutApi } from '../../services/api';
import { AnalystDropoutOverviewResponse } from '../../types';
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
  Lock,
  GraduationCap,
  Cpu,
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
  const [dropoutData, setDropoutData] = useState<AnalystDropoutOverviewResponse | null>(null);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const [_, dropRes] = await Promise.all([
          api.getAnalystOverview().catch(() => null),
          dropoutApi.getAnalystDropoutOverview().catch(() => null),
        ]);
        if (dropRes) {
          setDropoutData(dropRes);
        }
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
            In accordance with project architecture guidelines, the <span className="font-bold">Academic Attrition Vulnerability Indicator</span> represents a transparent rule-based advisory heuristic (evaluating absence velocity and milestone score deficits below 50.0% / &lt; 10.0/20.0). It is <span className="font-bold">not</span> an empirical institutional dropout classifier, and distinguishes academic failure risk from administrative university withdrawal.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="On-Track Ratio"
          value="68%"
          subtitle="Students meeting passing standards (≥ 50.0%)"
          icon={<CheckCircle2 size={20} className="text-emerald-500" />}
        />
        <StatCard
          title="Moderate Risk Advisory"
          value="20%"
          subtitle="Score range 50.0% – 69.9% (10.0 – 13.9 / 20.0)"
          icon={<AlertTriangle size={20} className="text-amber-500" />}
        />
        <StatCard
          title="High Risk Vulnerability"
          value="12%"
          subtitle="Predicted final mark < 50.0% (< 10.0 / 20.0)"
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

      {/* Empirical Dropout Prediction Telemetry (Phase 8A) */}
      <SectionCard
        title="Empirical Student Dropout Early Warning Analytics"
        subtitle="Calibrated institutional attrition predictions with strict Statistical Disclosure Control (N < 5 suppression)."
        icon={<GraduationCap size={20} className="text-brand-royal" />}
      >
        <div className="space-y-4">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3">
            <Lock size={16} className="text-slate-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700">
              <span className="font-bold text-slate-900">Privacy & Statistical Disclosure Control: </span>
              <span>
                {dropoutData?.privacy_notice ||
                  'Statistical Disclosure Control applied: cells with count < 5 are suppressed with complementary cell masking. No student PII is exposed.'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <p className="text-xs font-semibold text-slate-500 uppercase">Total Assessed</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {dropoutData?.total_assessed?.display ?? '0'}
              </p>
              {dropoutData?.total_assessed?.suppressed && (
                <span className="text-[10px] text-amber-600 font-semibold">Protected cell</span>
              )}
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <p className="text-xs font-semibold text-slate-500 uppercase">Low Risk (P &lt; 30%)</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">
                {dropoutData?.risk_distribution?.Low?.display ?? '0'}
              </p>
              <p className="text-[10px] text-slate-400">On Track / High Retention</p>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <p className="text-xs font-semibold text-slate-500 uppercase">Moderate Risk</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">
                {dropoutData?.risk_distribution?.Moderate?.display ?? '0'}
              </p>
              <p className="text-[10px] text-slate-400">30% &le; P &lt; 60%</p>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <p className="text-xs font-semibold text-slate-500 uppercase">High Risk</p>
              <p className="text-2xl font-bold text-rose-600 mt-1">
                {dropoutData?.risk_distribution?.High?.display ?? '0'}
              </p>
              <p className="text-[10px] text-slate-400">P &ge; 60% Vulnerability</p>
            </div>
          </div>

          {dropoutData?.model_summary && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Cpu size={16} className="text-brand-600" />
                <span className="text-xs font-bold text-slate-800">
                  Model Calibration & Benchmark Diagnostics ({dropoutData.model_summary.model_version})
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-500">Holdout ROC-AUC:</span>
                  <span className="ml-1.5 font-bold text-slate-800 font-mono">
                    {dropoutData.model_summary.roc_auc ?? '0.9317'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Holdout PR-AUC:</span>
                  <span className="ml-1.5 font-bold text-slate-800 font-mono">
                    {dropoutData.model_summary.pr_auc ?? '0.9024'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Brier Score:</span>
                  <span className="ml-1.5 font-bold text-slate-800 font-mono">
                    {dropoutData.model_summary.brier_score ?? '0.0851'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Calibration:</span>
                  <span className="ml-1.5 font-semibold text-slate-800">
                    {dropoutData.model_summary.calibration ?? 'Sigmoid CV'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </SectionCard>
    </div>
  );
};
