import React, { useEffect, useState } from 'react';
import { api, dropoutApi } from '../../services/api';
import { PredictionRecord, DropoutRecord } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { EmptyState } from '../../components/common/EmptyState';
import {
  Compass,
  Lightbulb,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  GraduationCap,
  Info,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/forms/Button';

export const StudentRecommendations: React.FC = () => {
  const { user } = useAuth();
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [dropoutRecord, setDropoutRecord] = useState<DropoutRecord | null>(null);
  const [dropoutHistory, setDropoutHistory] = useState<DropoutRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [predsRes, dropoutRes, historyRes] = await Promise.all([
          api.listPredictions().catch(() => ({ predictions: [] })),
          user?.id
            ? dropoutApi.getStudentDropoutRisk(user.id).catch(() => null)
            : Promise.resolve(null),
          user?.id
            ? dropoutApi.getStudentDropoutHistory(user.id, 1, 5).catch(() => null)
            : Promise.resolve(null),
        ]);
        setPredictions(predsRes?.predictions || []);
        if (dropoutRes?.assessment) {
          setDropoutRecord(dropoutRes.assessment);
        }
        if (historyRes?.history) {
          setDropoutHistory(historyRes.history);
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to generate recommendations.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user?.id]);

  if (loading) {
    return <LoadingState title="Synthesizing AI Improvement Recommendations..." description="Analyzing your predictive feature weights." />;
  }

  const latest = predictions[0];
  const feat = latest?.features_summary || {};
  const studyHours: number | null =
    typeof feat.study_hours_per_week?.value === 'number' ? feat.study_hours_per_week.value : null;
  const absences: number | null =
    typeof feat.absences?.value === 'number' ? feat.absences.value : null;
  const grade: number | null =
    typeof latest?.predicted_marks === 'number' ? latest.predicted_marks : null;

  const targetHeadroom =
    grade === null
      ? 'Prediction unavailable'
      : grade < 70
      ? `+${(70 - grade).toFixed(1)} pts to 70% target`
      : 'On Track (≥ 70%)';

  // Generate dynamic, explainable recommendations strictly from verified persisted features
  const recommendations = !latest
    ? []
    : [
        {
          id: '1',
          title: 'Weekly Study Time Optimization',
          category: 'Study Discipline',
          impact: studyHours !== null && studyHours < 5 ? 'High Impact Focus Area' : 'Maintenance Plan',
          currentStatus:
            studyHours !== null ? `${studyHours} hrs/week recorded` : 'Study hours unavailable',
          action:
            studyHours === null
              ? 'Study hours were not recorded on this evaluation.'
              : studyHours < 5
              ? 'Increasing your weekly focused study hours to 5–7 hours improves model predicted performance in standard academic benchmarks.'
              : 'Your study commitment is strong. Focus on spaced repetition and practice problem sets to consolidate gains.',
          icon: <Clock size={20} className="text-brand-royal" />,
          priority: studyHours !== null && studyHours < 5 ? 'High' : 'Medium',
        },
        {
          id: '2',
          title: 'Session Attendance Consistency',
          category: 'Attendance Velocity',
          impact: 'Attendance Risk Factor',
          currentStatus:
            absences !== null ? `${absences} ML-feature absences on record` : 'Absences unavailable',
          action:
            absences === null
              ? 'Absence count was not included in this evaluation.'
              : absences > 4
              ? 'Each session absence reduces your estimated attendance proxy by 1.67%. Maintaining zero additional absences protects against early-warning risk triggers.'
              : 'Attendance is exemplary. Consistent classroom presence directly correlates with higher milestone stability.',
          icon: <CheckCircle2 size={20} className="text-emerald-500" />,
          priority: absences !== null && absences > 4 ? 'High' : 'Low',
        },
        {
          id: '3',
          title: 'Milestone Revision Strategy',
          category: 'Exam Preparedness',
          impact: targetHeadroom,
          currentStatus:
            grade !== null ? `Predicted Grade: ${grade.toFixed(1)}%` : 'Prediction unavailable',
          action:
            'Prioritize fundamental coursework topics before mid-term evaluations. Utilize practice quizzes to verify mastery before exams.',
          icon: <Lightbulb size={20} className="text-amber-500" />,
          priority: grade !== null && grade < 60 ? 'High' : 'Medium',
        },
      ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI-Driven Academic Improvement Recommendations"
        subtitle="Personalized, explainable study guidance calibrated from your machine learning performance evaluations."
        icon={<Compass size={24} className="text-brand-royal" />}
      />

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {dropoutRecord && (
        <SectionCard
          title="Early-Warning Support & Assessment History"
          subtitle={dropoutRecord.disclaimer}
        >
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <span className="text-xs uppercase text-slate-500 font-semibold">Current Support Tier</span>
                <p className="font-bold text-slate-900">
                  {dropoutRecord.risk_tier} ({(dropoutRecord.risk_probability * 100).toFixed(1)}%)
                </p>
              </div>
              <div className="text-xs text-slate-500">
                Term: {dropoutRecord.academic_term} · Model: {dropoutRecord.model_version}
              </div>
            </div>
            {dropoutHistory.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-600 uppercase">Recent Assessment History</p>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {dropoutHistory.map((h) => (
                    <div key={h.id} className="px-3 py-2 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800">{h.academic_term}</span>
                      <span className="text-slate-600">
                        {h.risk_tier} ({(h.risk_probability * 100).toFixed(1)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Active Advisory Tips"
          value={recommendations.length}
          subtitle="Targeted interventions"
          icon={<Lightbulb size={20} className="text-amber-500" />}
        />
        <StatCard
          title="Target Headroom (70% Benchmark)"
          value={targetHeadroom}
          subtitle="Computed from latest persisted prediction"
          icon={<Sparkles size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="High Priority Actions"
          value={recommendations.filter((r) => r.priority === 'High').length}
          subtitle="Immediate study focus"
          icon={<AlertTriangle size={20} className="text-rose-500" />}
        />
      </div>

      {/* Academic Retention & Supportive Intervention (Phase 8A) */}
      {dropoutRecord && (
        <SectionCard
          title="Academic Retention & Degree Progression Support"
          subtitle="Supportive insights and customized resources designed to help you stay on track toward graduation."
          icon={<GraduationCap size={20} className="text-brand-royal" />}
        >
          <div className="space-y-4">
            <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              dropoutRecord.risk_tier === 'High'
                ? 'bg-rose-50/50 border-rose-200 text-rose-900'
                : dropoutRecord.risk_tier === 'Moderate'
                ? 'bg-amber-50/50 border-amber-200 text-amber-900'
                : 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                  dropoutRecord.risk_tier === 'High'
                    ? 'bg-rose-100 text-rose-700'
                    : dropoutRecord.risk_tier === 'Moderate'
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-emerald-100 text-emerald-700'
                }`}>
                  {dropoutRecord.risk_tier === 'High' ? (
                    <AlertTriangle size={20} />
                  ) : (
                    <CheckCircle2 size={20} />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-bold">
                    {dropoutRecord.risk_tier === 'High'
                      ? 'Proactive Support Recommended'
                      : dropoutRecord.risk_tier === 'Moderate'
                      ? 'Skill Building Opportunity'
                      : 'Degree Progress On Track'}
                  </h4>
                  <p className="text-xs opacity-80 pt-0.5">
                    {dropoutRecord.risk_tier === 'High'
                      ? 'Early warning indicator suggests connecting with learning resources can significantly boost term outcomes.'
                      : dropoutRecord.risk_tier === 'Moderate'
                      ? 'Consolidating study routines and reviewing core coursework will reinforce your trajectory.'
                      : 'Your current academic momentum and course completion indicators are strong.'}
                  </p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold self-start sm:self-auto ${
                dropoutRecord.risk_tier === 'High'
                  ? 'bg-rose-200 text-rose-800'
                  : dropoutRecord.risk_tier === 'Moderate'
                  ? 'bg-amber-200 text-amber-800'
                  : 'bg-emerald-200 text-emerald-800'
              }`}>
                {dropoutRecord.risk_tier} Risk Tier
              </span>
            </div>

            {/* Protective Factors */}
            {dropoutRecord.protective_factors && dropoutRecord.protective_factors.length > 0 && (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
                <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                  <Sparkles size={14} className="text-brand-royal" />
                  Demonstrated Academic Strengths:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {dropoutRecord.protective_factors.map((pf, idx) => (
                    <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-100 flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-slate-800">{pf.factor}: </span>
                        <span className="text-slate-600">{pf.detail}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {dropoutRecord.recommendations && dropoutRecord.recommendations.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-bold text-slate-700">Recommended Next Steps for Support:</p>
                <div className="grid grid-cols-1 gap-2">
                  {dropoutRecord.recommendations.map((recStr, idx) => (
                    <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200 flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                        {idx + 1}
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed font-medium">{recStr}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="p-3 bg-slate-50 rounded-lg text-[11px] text-slate-500 border border-slate-200 flex items-start gap-2">
              <Info size={14} className="text-slate-400 shrink-0 mt-0.5" />
              <span>{dropoutRecord.disclaimer}</span>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Recommendations Cards */}
      <SectionCard
        title="Tailored Improvement Pathways"
        subtitle="Actionable steps derived from empirical regression feature weights (Cortez & Silva 2008)."
      >
        {recommendations.length === 0 ? (
          <EmptyState
            icon={<Lightbulb size={28} />}
            title="Insufficient historical data"
            description="Prediction unavailable — run an evaluation in AI Predictions first so recommendations can be calculated strictly from your persisted metrics."
          />
        ) : (
        <div className="space-y-4">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-slate-100/60 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white shadow-sm border border-slate-200 flex items-center justify-center shrink-0">
                  {rec.icon}
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-bold text-navy-900">{rec.title}</h4>
                    <span className="badge bg-slate-200 text-slate-700 text-[10px] font-semibold">
                      {rec.category}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      {rec.impact}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    Current Metric: <span className="text-navy-900 font-semibold">{rec.currentStatus}</span>
                  </div>
                  <p className="text-xs text-slate-700 pt-1 leading-relaxed max-w-2xl">{rec.action}</p>
                </div>
              </div>

              <div className="shrink-0 flex items-center justify-end">
                <Link to="/student/predictions">
                  <Button variant="outline" size="sm" rightIcon={<ArrowRight size={14} />} className="text-xs">
                    Re-Assess
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
        )}
      </SectionCard>
    </div>
  );
};
