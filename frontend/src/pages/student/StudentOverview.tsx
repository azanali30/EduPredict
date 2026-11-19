import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StatCard } from '../../components/common/StatCard';
import { api } from '../../services/api';
import { SubjectItem } from '../../types';
import {
  CalendarCheck,
  Clock,
  CheckCircle,
  Award,
  Sparkles,
  BookOpen,
  ArrowRight,
  BrainCircuit,
  AlertTriangle,
  Lightbulb,
  TrendingUp,
  BarChart3,
  Info,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/forms/Button';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from 'recharts';

export const StudentOverview: React.FC = () => {
  const { user } = useAuth();
  const [enrolledSubjects, setEnrolledSubjects] = useState<SubjectItem[]>([]);

  useEffect(() => {
    api.getStudentSubjects()
      .then((res) => setEnrolledSubjects(res.subjects || []))
      .catch((err) => console.error('Failed to load student subjects:', err));
  }, []);

  // Curricular baseline indicator benchmarks (for visual representation)
  const benchmarkTrajectory = [
    { week: 'Wk 1', benchmark: 88, target: 90 },
    { week: 'Wk 2', benchmark: 86, target: 90 },
    { week: 'Wk 3', benchmark: 89, target: 92 },
    { week: 'Wk 4', benchmark: 85, target: 92 },
    { week: 'Wk 5', benchmark: 91, target: 94 },
    { week: 'Wk 6', benchmark: 87, target: 94 },
    { week: 'Wk 7', benchmark: 92, target: 95 },
    { week: 'Wk 8', benchmark: 90, target: 95 },
  ];

  const subjectCurriculumRadar = [
    { subject: 'Math', target: 90, classAvg: 76 },
    { subject: 'CS & Algorithms', target: 92, classAvg: 78 },
    { subject: 'Statistics', target: 85, classAvg: 70 },
    { subject: 'Databases', target: 88, classAvg: 74 },
    { subject: 'Physics', target: 82, classAvg: 68 },
  ];

  return (
    <div className="space-y-6">
      {/* Premium Hero Greeting Banner */}
      <div className="card bg-gradient-to-br from-navy-950 via-navy-900 to-navy-850 text-white p-6 sm:p-8 relative overflow-hidden border border-navy-800/80 shadow-soft">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 right-20 w-64 h-64 bg-sky-400/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-sky-300 text-xs font-semibold mb-3 backdrop-blur-sm">
              <Sparkles size={14} className="text-sky-400" />
              <span>Student Performance Analytics Portal</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
              Welcome back, {user?.full_name}!
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Monitor your academic indicators, track attendance velocity against curriculum benchmarks, and review upcoming predictive model timelines.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link to="/student/records">
              <Button
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10 backdrop-blur-sm"
                leftIcon={<BookOpen size={16} />}
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
              <div key={s.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition-all">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-navy-900">{s.name}</span>
                  {s.code && (
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
                      {s.code}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                  <span>Term: <strong className="text-brand-royal font-mono">{s.academic_term || '2026-T1'}</strong></span>
                  <span className="badge badge-success text-[9px] py-0 px-1.5">Enrolled</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Primary KPI Metrics */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Core Academic Indicators
          </h2>
          <span className="text-xs text-slate-400 font-medium">
            Term 1 (Awaiting Student Submission)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Attendance Rate"
            value="--"
            subtitle="Target: ≥ 85% recommended"
            badgeText="Unlogged"
            badgeVariant="info"
            icon={<CalendarCheck size={20} />}
          />
          <StatCard
            title="Weekly Study Hours"
            value="--"
            subtitle="Target: 15–20 hrs/week"
            badgeText="Pending"
            badgeVariant="warning"
            icon={<Clock size={20} />}
          />
          <StatCard
            title="Assignment Rate"
            value="--"
            subtitle="Target: ≥ 90% completed"
            badgeText="Unlogged"
            badgeVariant="info"
            icon={<CheckCircle size={20} />}
          />
          <StatCard
            title="Internal Assessment"
            value="--"
            subtitle="Exams awaiting entry"
            badgeText="Unlogged"
            badgeVariant="info"
            icon={<Award size={20} />}
          />
        </div>
      </div>

      {/* Visual Analytics Charts Section (Recharts) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance & Assessment Trend Chart */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-brand-500" />
                <h3 className="text-base font-bold text-navy-900">
                  Attendance & Engagement Benchmark
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Curricular baseline vs target attendance percentage across semester weeks
              </p>
            </div>
            <span className="badge badge-info text-[10px]">Benchmark View</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={benchmarkTrajectory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="benchmarkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="targetGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="week" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} domain={[60, 100]} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B192C',
                    borderColor: '#1E3E62',
                    borderRadius: '0.75rem',
                    color: '#ffffff',
                    fontSize: '12px',
                  }}
                />
                <Area type="monotone" dataKey="target" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#targetGrad)" name="Target (%)" />
                <Area type="monotone" dataKey="benchmark" stroke="#0284c7" strokeWidth={2} fillOpacity={1} fill="url(#benchmarkGrad)" name="Curriculum Avg (%)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-brand-500" /> Curriculum Baseline
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400" /> Target Requirement
            </span>
            <span className="text-[11px] text-slate-400 italic">Personal overlay active upon record entry</span>
          </div>
        </div>

        {/* Subject-Wise Competency Radar Chart */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 size={18} className="text-brand-500" />
                <h3 className="text-base font-bold text-navy-900">
                  Subject-Wise Target Competency
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Target mastery levels vs historical cohort benchmark distribution
              </p>
            </div>
            <span className="badge badge-info text-[10px]">Curricular Model</span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart outerRadius="75%" data={subjectCurriculumRadar}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#475569', fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#94a3b8" fontSize={10} />
                <Radar name="Target Competency" dataKey="target" stroke="#0284c7" fill="#0284c7" fillOpacity={0.4} />
                <Radar name="Cohort Baseline" dataKey="classAvg" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.2} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0B192C',
                    borderColor: '#1E3E62',
                    borderRadius: '0.75rem',
                    color: '#ffffff',
                    fontSize: '12px',
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>5 Core Knowledge Domains</span>
            <Link to="/student/records" className="text-brand-600 hover:text-brand-700 font-semibold">
              Enter Subject Marks &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Honest AI Prediction Pipeline Status Card (Phase 4 & 5 Roadmap) */}
      <div className="card p-6 bg-gradient-to-r from-sky-50/50 via-white to-indigo-50/40 border-brand-100">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-100 text-sky-800 text-[11px] font-bold uppercase tracking-wider">
              <BrainCircuit size={14} className="text-sky-600" />
              <span>Machine Learning Inference Pipeline</span>
            </div>
            <h3 className="text-lg font-extrabold text-navy-900 tracking-tight">
              Predictive Models & Risk Classifier Status
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              EduPredict employs supervised Scikit-learn regressors (projected mark %) and random forest classifiers (Low, Moderate, High risk tiers). As per project specifications, model training commences in <strong>Phase 4</strong> followed by real-time user inference in <strong>Phase 5</strong>.
            </p>
          </div>

          {/* Stepper Pipeline Visual */}
          <div className="flex items-center gap-2 sm:gap-3 bg-white p-3 sm:p-4 rounded-xl border border-slate-200/80 shadow-sm shrink-0">
            <div className="text-center">
              <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-300 flex items-center justify-center text-xs font-bold mx-auto mb-1">
                ✓
              </div>
              <span className="text-[10px] font-bold text-slate-700 block">Schema</span>
              <span className="text-[9px] text-emerald-600 font-semibold">Verified</span>
            </div>

            <div className="w-6 sm:w-10 h-0.5 bg-slate-200" />

            <div className="text-center">
              <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 border border-amber-300 flex items-center justify-center text-xs font-bold mx-auto mb-1 animate-pulse">
                4
              </div>
              <span className="text-[10px] font-bold text-slate-700 block">Training</span>
              <span className="text-[9px] text-amber-600 font-semibold">Scheduled</span>
            </div>

            <div className="w-6 sm:w-10 h-0.5 bg-slate-200" />

            <div className="text-center">
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center text-xs font-bold mx-auto mb-1">
                5
              </div>
              <span className="text-[10px] font-bold text-slate-400 block">Inference</span>
              <span className="text-[9px] text-slate-400 font-semibold">Upcoming</span>
            </div>
          </div>
        </div>
      </div>

      {/* Strengths, Weaknesses & Actionable Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Academic Strengths & Weaknesses */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" />
              <h3 className="text-base font-bold text-navy-900">
                Subject Strengths & Bottlenecks
              </h3>
            </div>
            <span className="badge badge-warning text-[10px]">Awaiting Records</span>
          </div>

          <div className="py-8 text-center max-w-sm mx-auto space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <BarChart3 size={24} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-navy-900">No Assessment Data Submitted</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Feature weight analysis will rank your highest performing subjects alongside identified risk bottlenecks once semester marks are logged.
              </p>
            </div>
            <Link to="/student/records">
              <Button variant="outline" size="sm">
                Log Academic Record
              </Button>
            </Link>
          </div>
        </div>

        {/* Actionable Improvement Strategies */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Lightbulb size={18} className="text-brand-500" />
              <h3 className="text-base font-bold text-navy-900">
                Actionable Recommendations
              </h3>
            </div>
            <span className="badge badge-info text-[10px]">Rule Engine Ready</span>
          </div>

          <div className="py-8 text-center max-w-sm mx-auto space-y-3">
            <div className="w-12 h-12 rounded-full bg-sky-50 text-sky-600 flex items-center justify-center mx-auto">
              <Lightbulb size={24} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-navy-900">Personalized Guidance Pending</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Tailored intervention advice (e.g. recommended weekly study hour adjustments, revision checklists) will automatically generate based on your feature vector.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
              <Info size={12} />
              <span>Guidance engine activates following Phase 4 training</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
