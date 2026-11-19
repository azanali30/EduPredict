import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { PredictionRecord } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import {
  BarChart3,
  TrendingUp,
  BrainCircuit,
  Award,
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
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export const AdminAnalytics: React.FC = () => {
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const predsRes = await api.listPredictions({ limit: 100 });
        setPredictions(predsRes.predictions || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to retrieve institutional analytics.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Compute analytics
  const total = predictions.length;
  const mathPreds = predictions.filter((p) => p.subject === 'Mathematics');
  const portPreds = predictions.filter((p) => p.subject === 'Portuguese Language');

  const mathAvg =
    mathPreds.length > 0
      ? (
          mathPreds.reduce((acc, p) => acc + (p.predicted_final_grade ?? p.predicted_marks ?? 0), 0) /
          mathPreds.length
        ).toFixed(1)
      : '0.0';

  const portAvg =
    portPreds.length > 0
      ? (
          portPreds.reduce((acc, p) => acc + (p.predicted_final_grade ?? p.predicted_marks ?? 0), 0) /
          portPreds.length
        ).toFixed(1)
      : '0.0';

  const highRisk = predictions.filter((p) => p.predicted_status === 'High Risk').length;
  const modRisk = predictions.filter((p) => p.predicted_status === 'Moderate Risk').length;
  const lowRisk = predictions.filter((p) => p.predicted_status === 'Low Risk / On Track').length;

  const riskData = [
    { name: 'High Risk', value: highRisk, color: '#e11d48' },
    { name: 'Moderate Risk', value: modRisk, color: '#f59e0b' },
    { name: 'Low Risk', value: lowRisk, color: '#10b981' },
  ].filter((d) => d.value > 0);

  const subjectComparisonData = [
    { subject: 'Mathematics', averageGrade: parseFloat(mathAvg), evaluations: mathPreds.length },
    { subject: 'Portuguese', averageGrade: parseFloat(portAvg), evaluations: portPreds.length },
  ];

  const milestoneData = [
    {
      name: 'Milestone 0 (Early)',
      evaluations: predictions.filter((p) => p.milestone === 0).length,
    },
    {
      name: 'Milestone 1 (Mid)',
      evaluations: predictions.filter((p) => p.milestone === 1).length,
    },
    {
      name: 'Milestone 2 (Pre-Final)',
      evaluations: predictions.filter((p) => p.milestone === 2).length,
    },
  ];

  if (loading) {
    return <LoadingState title="Loading Executive Performance Analytics..." description="Synthesizing cross-subject performance trends." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive Performance Analytics"
        subtitle="Institutional grade distribution models, milestone trajectory analysis, and curricular benchmarking."
        icon={<BarChart3 size={24} className="text-brand-royal" />}
      />

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          title="Total Evaluations"
          value={total}
          subtitle="Processed AI predictions"
          icon={<BrainCircuit size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Mathematics Avg"
          value={`${mathAvg} / 20`}
          subtitle={`Based on ${mathPreds.length} evaluations`}
          icon={<Award size={20} className="text-brand-ocean" />}
        />
        <StatCard
          title="Portuguese Avg"
          value={`${portAvg} / 20`}
          subtitle={`Based on ${portPreds.length} evaluations`}
          icon={<Award size={20} className="text-brand-mint" />}
        />
        <StatCard
          title="On-Track Ratio"
          value={total > 0 ? `${((lowRisk / total) * 100).toFixed(0)}%` : '0%'}
          subtitle={`${lowRisk} low-risk students`}
          icon={<TrendingUp size={20} className="text-emerald-500" />}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subject Comparison */}
        <SectionCard
          title="Subject-Wise Performance Benchmarks"
          subtitle="Average predicted grades across core disciplines (0–20 Portuguese scale)."
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjectComparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="subject" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 20]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="averageGrade" name="Average Grade (/20)" fill="#2455C5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* Risk Distribution Pie */}
        <SectionCard
          title="Institutional Academic Risk Distribution"
          subtitle="Categorization of students across High, Moderate, and Low risk thresholds."
        >
          <div className="h-64 flex items-center justify-center">
            {riskData.length === 0 ? (
              <div className="text-xs text-slate-400">No prediction risk data available.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                  >
                    {riskData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </SectionCard>

        {/* Milestone Progression */}
        <SectionCard
          title="Milestone Evaluation Volume"
          subtitle="Distribution of early warning (M0), mid-term (M1), and pre-final (M2) runs."
          className="lg:col-span-2"
        >
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={milestoneData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="evaluations" name="Evaluations Count" fill="#168CCB" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>
    </div>
  );
};
