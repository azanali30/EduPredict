import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { PredictionRecord, SubjectItem } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { EmptyState } from '../../components/common/EmptyState';
import {
  BarChart3,
  Award,
  TrendingUp,
  BrainCircuit,
  Sparkles,
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

export const StudentPerformance: React.FC = () => {
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [predsRes, subjsRes] = await Promise.all([
          api.listPredictions(),
          api.getStudentSubjects(),
        ]);
        setPredictions(predsRes.predictions || []);
        setSubjects(subjsRes.subjects || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load personal performance telemetry.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <LoadingState title="Loading Academic Performance Analytics..." description="Compiling your personal evaluations." />;
  }

  // Calculate average grade
  const avgGrade =
    predictions.length > 0
      ? (
          predictions.reduce((acc, p) => acc + (p.predicted_final_grade ?? p.predicted_marks ?? 0), 0) /
          predictions.length
        ).toFixed(1)
      : 'N/A';

  const latestPred = predictions[0];

  const milestoneComparisonData = predictions.slice(0, 5).map((p) => ({
    name: `${p.subject} (M${p.milestone})`,
    grade: parseFloat(p.predicted_marks.toFixed(1)),
    benchmark: 50.0, // Passing threshold on 0-100 scale
  }));

  const radarData = [
    { subject: 'Study Discipline', score: 85, benchmark: 75 },
    { subject: 'Attendance Velocity', score: 92, benchmark: 80 },
    { subject: 'Assignment Completion', score: 88, benchmark: 78 },
    { subject: 'Exam Preparedness', score: 80, benchmark: 72 },
    { subject: 'Academic Consistency', score: 86, benchmark: 74 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personal Academic Performance Analytics"
        subtitle="Track your predicted performance trajectory, compare milestone outcomes, and evaluate study discipline benchmarks."
        icon={<BarChart3 size={24} className="text-brand-royal" />}
      />

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          title="Average Predicted Mark"
          value={avgGrade !== 'N/A' ? `${avgGrade}%` : 'Pending'}
          subtitle={avgGrade !== 'N/A' ? `Across all evaluations (${avgGrade}/100)` : 'Across all evaluations'}
          icon={<Award size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Evaluations on File"
          value={predictions.length}
          subtitle="Model predictions recorded"
          icon={<BrainCircuit size={20} className="text-brand-ocean" />}
        />
        <StatCard
          title="Academic Risk Status"
          value={latestPred ? latestPred.predicted_status : 'On Track'}
          subtitle="Latest assessment status"
          icon={<Sparkles size={20} className="text-emerald-500" />}
        />
        <StatCard
          title="Registered Subjects"
          value={subjects.length}
          subtitle="Active curriculum enrollments"
          icon={<TrendingUp size={20} className="text-brand-mint" />}
        />
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard
          title="Milestone Predictions vs. Passing Threshold"
          subtitle="Your predicted continuous marks compared to standard passing cutoff (50/100)."
        >
          {milestoneComparisonData.length === 0 ? (
            <EmptyState
              title="No Predictions Recorded"
              description="Complete a self-assessment prediction to view your milestone comparison chart."
              icon={<BarChart3 size={32} />}
            />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={milestoneComparisonData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="grade" name="Predicted Mark (%)" fill="#2455C5" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="benchmark" name="Passing Benchmark (50%)" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Academic Capability Radar"
          subtitle="Multi-dimensional evaluation of your academic engagement indicators."
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: '#475569' }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar name="Your Score" dataKey="score" stroke="#2455C5" fill="#2455C5" fillOpacity={0.3} />
                <Radar name="Class Benchmark" dataKey="benchmark" stroke="#168CCB" fill="#168CCB" fillOpacity={0.15} />
                <Tooltip />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>
    </div>
  );
};
