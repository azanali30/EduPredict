import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { StatCard } from '../../components/common/StatCard';
import { EmptyState } from '../../components/common/EmptyState';
import { Button } from '../../components/forms/Button';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  CalendarCheck,
  Clock,
  CheckCircle,
  Award,
  TrendingUp,
  BrainCircuit,
  ArrowRight,
  Sparkles,
  BookOpen,
  Lightbulb,
} from 'lucide-react';
import { api, attendanceApi, academicRecordsApi } from '../../services/api';
import {
  AcademicRecordItem,
  PredictionRecord,
  StudentAttendanceResponse,
  SubjectItem,
} from '../../types';

export const StudentOverview: React.FC = () => {
  const { user } = useAuth();
  const [enrolledSubjects, setEnrolledSubjects] = useState<SubjectItem[]>([]);
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [attendance, setAttendance] = useState<StudentAttendanceResponse | null>(null);
  const [academicRecords, setAcademicRecords] = useState<AcademicRecordItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [subjRes, predRes, attRes, recRes] = await Promise.all([
          api.getStudentSubjects().catch(() => ({ subjects: [] })),
          api.listPredictions({ limit: 20 }).catch(() => ({ predictions: [] })),
          attendanceApi.getMyAttendance({ limit: 20 }).catch(() => null),
          academicRecordsApi.list({ limit: 20 }).catch(() => ({ records: [] })),
        ]);
        setEnrolledSubjects(subjRes.subjects || []);
        setPredictions(predRes.predictions || []);
        setAttendance(attRes);
        setAcademicRecords(recRes.records || []);
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, []);

  const verifiedAtt = attendance?.verified_institutional_attendance;
  const latestPred = predictions[0];
  const latestRec = academicRecords[0];

  const attendanceValue =
    verifiedAtt?.has_records && verifiedAtt.overall_attendance_percentage !== null
      ? `${verifiedAtt.overall_attendance_percentage.toFixed(1)}%`
      : 'No sessions recorded';

  const studyHoursVal =
    latestRec?.study_hours_per_week ??
    latestPred?.features_summary?.study_hours_per_week?.value ??
    null;

  const assignmentVal =
    latestRec?.assignment_completion_rate ??
    latestPred?.features_summary?.assignment_completion_rate?.value ??
    null;

  const latestGradeVal =
    latestPred?.predicted_marks !== undefined && latestPred?.predicted_marks !== null
      ? `${latestPred.predicted_marks.toFixed(1)}%`
      : 'Prediction unavailable';

  const chartData = [...predictions]
    .reverse()
    .map((p, idx) => ({
      checkpoint: `Run ${idx + 1} (${p.subject.slice(0, 4)} M${p.milestone})`,
      predicted: Number(p.predicted_marks.toFixed(1)),
    }));

  const currentTermDisplay =
    enrolledSubjects[0]?.academic_term || latestRec?.term || 'No active term';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy-900 via-navy-800 to-navy-700 text-white p-6 sm:p-8 shadow-medium">
        <div className="absolute right-0 top-0 -mt-12 -mr-12 w-64 h-64 rounded-full bg-brand-500/20 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-semibold text-sky-200">
              <Sparkles size={14} className="text-sky-300" />
              <span>Student Academic Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-heading text-white">
              Welcome back, {user?.full_name || 'Student'}
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Review your verified institutional attendance, coursework assessment records, and AI performance predictions in one workspace.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link to="/student/records">
              <Button
                variant="outline"
                className="bg-white/10 hover:bg-white/20 border-white/20 text-white"
              >
                Academic Records
              </Button>
            </Link>
            <Link to="/student/predictions">
              <Button
                variant="primary"
                leftIcon={<BrainCircuit size={16} />}
                rightIcon={<ArrowRight size={14} />}
                className="shadow-glow"
              >
                AI Predictions
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Enrolled Courses Card */}
      {enrolledSubjects.length > 0 && (
        <div className="card p-5 bg-white border border-slate-200">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-brand-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-navy-900">
                Your Enrolled Academic Courses ({enrolledSubjects.length})
              </h3>
            </div>
            <span className="badge badge-student text-[10px]">Active Enrollments</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {enrolledSubjects.map((s) => (
              <div
                key={s.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-navy-900">{s.name}</span>
                  {s.code && (
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
                      {s.code}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                  <span>
                    Term: <strong className="text-brand-royal font-mono">{s.academic_term || '--'}</strong>
                  </span>
                  <span className="badge badge-success text-[9px] py-0 px-1.5">Enrolled</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Primary KPI Metrics (Strictly Real Data / Honest Empty States) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Core Academic Indicators
          </h2>
          <span className="text-xs text-slate-400 font-medium font-mono">
            {loading ? 'Loading...' : currentTermDisplay}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Verified Institutional Attendance"
            value={attendanceValue}
            subtitle={
              verifiedAtt?.has_records
                ? `${verifiedAtt.total_sessions} roll-call session(s)`
                : 'Target: ≥ 85% roll-call attendance'
            }
            badgeText={verifiedAtt?.has_records ? 'Verified Roll Call' : 'Unrecorded'}
            badgeVariant={verifiedAtt?.has_records ? 'success' : 'info'}
            icon={<CalendarCheck size={20} />}
          />
          <StatCard
            title="Weekly Study Hours"
            value={studyHoursVal !== null ? `${studyHoursVal} hrs` : 'Insufficient data'}
            subtitle={studyHoursVal !== null ? 'From latest record/evaluation' : 'No study hours logged'}
            icon={<Clock size={20} />}
          />
          <StatCard
            title="Assignment Completion"
            value={assignmentVal !== null ? `${assignmentVal}%` : 'Insufficient data'}
            subtitle={assignmentVal !== null ? 'Coursework completion metric' : 'No coursework logged'}
            icon={<CheckCircle size={20} />}
          />
          <StatCard
            title="Latest ML Prediction"
            value={latestGradeVal}
            subtitle={latestPred ? `${latestPred.subject} · ${latestPred.predicted_status}` : 'Run an AI Prediction'}
            badgeText={latestPred ? latestPred.predicted_status : 'Unavailable'}
            badgeVariant={
              latestPred?.predicted_status === 'High Risk'
                ? 'danger'
                : latestPred?.predicted_status === 'Moderate Risk'
                ? 'warning'
                : latestPred
                ? 'success'
                : 'info'
            }
            icon={<Award size={20} />}
          />
        </div>
      </div>

      {/* Real Persisted Prediction Progression or Honest Empty State */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-brand-500" />
              <h3 className="text-base font-bold text-navy-900">
                Predicted Performance Checkpoints
              </h3>
            </div>
            <span className="badge badge-info text-[10px]">{predictions.length} Run(s)</span>
          </div>

          {chartData.length === 0 ? (
            <EmptyState
              icon={<TrendingUp size={28} />}
              title="Insufficient historical data"
              description="No prediction runs or benchmark checkpoints have been saved for your account yet. Complete an evaluation to populate your live progression curve."
            />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="studentPredGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0284c7" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="checkpoint" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} tickLine={false} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="predicted"
                    name="Predicted Mark (%)"
                    stroke="#0284c7"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#studentPredGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Coursework & Advisory Summary */}
        <div className="card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Lightbulb size={18} className="text-brand-500" />
                <h3 className="text-base font-bold text-navy-900">
                  Coursework & Model Inference Status
                </h3>
              </div>
              <span className="badge badge-success text-[10px]">Models Active</span>
            </div>

            {academicRecords.length === 0 && predictions.length === 0 ? (
              <EmptyState
                icon={<BookOpen size={28} />}
                title="No coursework or predictions recorded"
                description="Verified coursework records and explainable recommendations appear here once instructors enter grades or you run an AI prediction."
              />
            ) : (
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600 font-medium">Persisted Coursework Records</span>
                  <span className="font-bold text-navy-900">{academicRecords.length} record(s)</span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-600 font-medium">AI Performance Evaluations</span>
                  <span className="font-bold text-navy-900">{predictions.length} prediction(s)</span>
                </div>
                {latestRec && (
                  <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200">
                    <div className="font-bold text-navy-900">
                      Latest Record: {latestRec.subject} ({latestRec.term})
                    </div>
                    <div className="text-slate-600 mt-1">
                      G1: {latestRec.g1 ?? '--'} · G2: {latestRec.g2 ?? '--'} · Final:{' '}
                      {latestRec.final_exam_marks ?? '--'}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <Link to="/student/attendance" className="text-brand-600 font-semibold hover:underline">
              View Verified Attendance &rarr;
            </Link>
            <Link to="/student/recommendations" className="text-brand-600 font-semibold hover:underline">
              View Recommendations &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
