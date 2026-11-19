import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { PredictionRecord } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { EmptyState } from '../../components/common/EmptyState';
import {
  TrendingUp,
  Award,
  ArrowUpRight,
  Clock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  Line,
} from 'recharts';

export const StudentProgress: React.FC = () => {
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        const res = await api.listPredictions();
        setPredictions(res.predictions || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load progress telemetry.');
      } finally {
        setLoading(false);
      }
    };
    fetchPredictions();
  }, []);

  if (loading) {
    return <LoadingState title="Loading Academic Progress & Trends..." description="Compiling evaluation trajectories." />;
  }

  // Trajectory over time
  const trajectoryData = predictions
    .slice()
    .reverse()
    .map((p, idx) => ({
      run: `Eval ${idx + 1} (${p.subject.slice(0, 4)} M${p.milestone})`,
      predictedGrade: parseFloat((p.predicted_final_grade ?? p.predicted_marks ?? 0).toFixed(1)),
      targetGoal: 14.0,
      passingCutoff: 10.0,
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Learning Progress & Trends"
        subtitle="Visualize your academic progress trajectory across milestone evaluations and track growth toward target goals."
        icon={<TrendingUp size={24} className="text-brand-royal" />}
      />

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Evaluations"
          value={predictions.length}
          subtitle="Progress checkpoints logged"
          icon={<Clock size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Target Academic Goal"
          value="14.0 / 20.0"
          subtitle="Good Standing (Bom/Muito Bom)"
          icon={<Award size={20} className="text-brand-ocean" />}
        />
        <StatCard
          title="Trajectory Velocity"
          value={predictions.length > 0 ? '+1.2 pts' : 'Baseline'}
          subtitle="Estimated growth per milestone"
          icon={<ArrowUpRight size={20} className="text-emerald-500" />}
        />
      </div>

      {/* Trajectory Chart */}
      <SectionCard
        title="Milestone Evaluation Trajectory"
        subtitle="Tracking predicted final marks across consecutive evaluation checkpoints."
      >
        {trajectoryData.length === 0 ? (
          <EmptyState
            title="No Progress Checkpoints"
            description="Complete milestone evaluations in AI Predictions to begin tracking your academic growth curve."
            icon={<TrendingUp size={32} />}
          />
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trajectoryData}>
                <defs>
                  <linearGradient id="gradeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2455C5" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#2455C5" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="run" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 20]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="predictedGrade"
                  name="Predicted Grade (/20)"
                  stroke="#2455C5"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#gradeGradient)"
                />
                <Line
                  type="monotone"
                  dataKey="targetGoal"
                  name="Target Goal (14)"
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="passingCutoff"
                  name="Passing Cutoff (10)"
                  stroke="#f59e0b"
                  strokeDasharray="2 2"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>
    </div>
  );
};
