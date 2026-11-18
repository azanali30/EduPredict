import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../../services/api';
import { User, PredictionRecord } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { StudentProfileDrawer } from '../../components/common/StudentProfileDrawer';
import { TeacherPredictionModal } from '../../components/predictions/TeacherPredictionModal';
import { Button } from '../../components/forms/Button';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  TrendingUp,
  Search,
  BookOpen,
  Award,
  AlertTriangle,
  Info,
  Sparkles,
  UserCheck,
  Layers,
  ArrowRight,
  TrendingDown,
  Minus,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export const TeacherPerformance: React.FC = () => {
  const [students, setStudents] = useState<User[]>([]);
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');

  // Drawer & Modal state
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [predictingStudent, setPredictingStudent] = useState<User | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [studentsRes, predsRes] = await Promise.all([
        api.getTeacherStudents(),
        api.listPredictions({ limit: 100 }),
      ]);
      setStudents(studentsRes.students || []);
      setPredictions(predsRes.predictions || []);
    } catch (err: any) {
      console.error('Failed to load performance analytics telemetry:', err);
      setError(err?.message || 'Failed to retrieve performance telemetry from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Map of studentId -> Latest Prediction
  const latestPredMap = useMemo(() => {
    const map = new Map<string, PredictionRecord>();
    predictions.forEach((p) => {
      const existing = map.get(p.student_id);
      if (!existing || new Date(p.created_at) > new Date(existing.created_at)) {
        map.set(p.student_id, p);
      }
    });
    return map;
  }, [predictions]);

  // Subject-wise telemetry aggregation
  const subjectStats = useMemo(() => {
    const mathPreds = predictions.filter((p) => p.subject === 'Mathematics');
    const portPreds = predictions.filter((p) => p.subject === 'Portuguese Language');

    const calcAvg = (arr: PredictionRecord[]) => {
      if (arr.length === 0) return '--';
      const sum = arr.reduce((acc, p) => acc + p.predicted_marks, 0);
      return (sum / arr.length).toFixed(1);
    };

    return {
      math: {
        count: mathPreds.length,
        avg: calcAvg(mathPreds),
        highRisk: mathPreds.filter((p) => p.predicted_status === 'High Risk').length,
        modRisk: mathPreds.filter((p) => p.predicted_status === 'Moderate Risk').length,
        lowRisk: mathPreds.filter((p) => p.predicted_status === 'Low Risk / On Track').length,
      },
      port: {
        count: portPreds.length,
        avg: calcAvg(portPreds),
        highRisk: portPreds.filter((p) => p.predicted_status === 'High Risk').length,
        modRisk: portPreds.filter((p) => p.predicted_status === 'Moderate Risk').length,
        lowRisk: portPreds.filter((p) => p.predicted_status === 'Low Risk / On Track').length,
      },
    };
  }, [predictions]);

  // Grade Band Distribution
  const { gradeBandData, highestMark, lowestMark, medianMark, evaluatedCount } = useMemo(() => {
    let distinction = 0; // >= 80
    let merit = 0;       // 65-79.9
    let pass = 0;        // 50-64.9
    let failing = 0;     // < 50
    const marks: number[] = [];

    students.forEach((s) => {
      const p = latestPredMap.get(s.id);
      if (p) {
        const mark = p.predicted_marks;
        marks.push(mark);
        if (mark >= 80) distinction++;
        else if (mark >= 65) merit++;
        else if (mark >= 50) pass++;
        else failing++;
      }
    });

    marks.sort((a, b) => a - b);
    const highest = marks.length > 0 ? marks[marks.length - 1].toFixed(1) : '--';
    const lowest = marks.length > 0 ? marks[0].toFixed(1) : '--';
    const median = marks.length > 0 ? marks[Math.floor(marks.length / 2)].toFixed(1) : '--';

    const data = [
      { band: 'Distinction (80–100%)', count: distinction, fill: '#10B981' },
      { band: 'Merit (65–79%)', count: merit, fill: '#0284C7' },
      { band: 'Pass (50–64%)', count: pass, fill: '#F59E0B' },
      { band: 'High Risk (<50%)', count: failing, fill: '#E11D48' },
    ];

    return {
      gradeBandData: data,
      highestMark: highest,
      lowestMark: lowest,
      medianMark: median,
      evaluatedCount: marks.length,
    };
  }, [students, latestPredMap]);

  // Milestone comparison breakdown (M0 vs M1 vs M2 across all records)
  const milestoneBreakdown = useMemo(() => {
    const m0 = predictions.filter((p) => p.milestone === 0);
    const m1 = predictions.filter((p) => p.milestone === 1);
    const m2 = predictions.filter((p) => p.milestone === 2);

    const getStats = (arr: PredictionRecord[]) => {
      if (arr.length === 0) return { count: 0, avg: '--', confidence: '--' };
      const avgMark = (arr.reduce((acc, p) => acc + p.predicted_marks, 0) / arr.length).toFixed(1);
      const avgConf = ((arr.reduce((acc, p) => acc + p.top_confidence, 0) / arr.length) * 100).toFixed(0);
      return { count: arr.length, avg: `${avgMark}%`, confidence: `${avgConf}%` };
    };

    return [
      { milestone: 'Milestone 0: Initial', stats: getStats(m0), desc: 'Demographic & Socio-Economic Features' },
      { milestone: 'Milestone 1: Mid-Term', stats: getStats(m1), desc: 'Includes Period 1 Exam Marks (G1)' },
      { milestone: 'Milestone 2: Pre-Final', stats: getStats(m2), desc: 'Includes Period 1 & Period 2 Marks (G1 + G2)' },
    ];
  }, [predictions]);

  // Multi-milestone student trajectories
  const longitudinalStudents = useMemo(() => {
    const list: Array<{
      student: User;
      m0?: PredictionRecord;
      m1?: PredictionRecord;
      m2?: PredictionRecord;
      trend: 'improving' | 'declining' | 'stable';
    }> = [];

    students.forEach((s) => {
      const studentPreds = predictions.filter((p) => p.student_id === s.id);
      if (studentPreds.length > 1) {
        const m0 = studentPreds.find((p) => p.milestone === 0);
        const m1 = studentPreds.find((p) => p.milestone === 1);
        const m2 = studentPreds.find((p) => p.milestone === 2);

        // Calculate trend between earliest and latest milestone available
        let trend: 'improving' | 'declining' | 'stable' = 'stable';
        const sorted = [...studentPreds].sort((a, b) => a.milestone - b.milestone);
        if (sorted.length >= 2) {
          const first = sorted[0].predicted_marks;
          const last = sorted[sorted.length - 1].predicted_marks;
          if (last - first > 3) trend = 'improving';
          else if (first - last > 3) trend = 'declining';
        }

        list.push({ student: s, m0, m1, m2, trend });
      }
    });

    return list;
  }, [students, predictions]);

  // Filtered student list
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const query = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !query ||
        s.full_name.toLowerCase().includes(query) ||
        s.email.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      const pred = latestPredMap.get(s.id);
      if (subjectFilter !== 'ALL') {
        if (!pred || pred.subject !== subjectFilter) return false;
      }

      return true;
    });
  }, [students, searchTerm, subjectFilter, latestPredMap]);

  if (loading) {
    return <LoadingState title="Loading Academic Analytics..." description="Calculating cohort grade distributions and milestone comparisons." />;
  }

  if (error) {
    return <ErrorState title="Failed to Load Performance Analytics" message={error} onRetry={loadData} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Performance Analytics"
        subtitle="Cohort grade band distributions, cross-subject evaluation benchmarks, and multi-milestone progression tracking."
        badgeText="Academic Intelligence"
        badgeVariant="brand"
        actions={
          <div className="flex items-center gap-2">
            <Link to="/teacher/students">
              <Button variant="outline" size="sm" rightIcon={<ArrowRight size={14} />}>
                Student Roster
              </Button>
            </Link>
          </div>
        }
      />

      {/* Distinction & Advisory Disclosure */}
      <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200 text-xs text-sky-950 flex items-start gap-3">
        <Info size={18} className="text-brand-royal shrink-0 mt-0.5" />
        <div className="space-y-0.5 leading-relaxed">
          <span className="font-bold text-brand-royal block">
            AI Projected Marks Notice & Curricular Guidance
          </span>
          <p className="text-slate-600">
            Projected marks are algorithmic continuous scores generated by trained regression ensembles based on available demographic, academic, and behavioral features. They represent early performance estimates and must not be treated as official recorded transcript grades.
          </p>
        </div>
      </div>

      {/* Top Telemetry KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Cohort Evaluated Ratio"
          value={`${evaluatedCount} / ${students.length}`}
          subtitle={`${students.length > 0 ? ((evaluatedCount / students.length) * 100).toFixed(0) : 0}% screening coverage`}
          badgeText="Evaluated"
          badgeVariant="brand"
          icon={<BookOpen size={20} />}
          iconBg="bg-sky-50 text-brand-royal"
        />

        <StatCard
          title="Highest Projected Mark"
          value={highestMark !== '--' ? `${highestMark}%` : '--'}
          subtitle="Top scoring cohort learner"
          badgeText="Upper Band"
          badgeVariant="success"
          icon={<Award size={20} />}
          iconBg="bg-emerald-50 text-emerald-600"
        />

        <StatCard
          title="Cohort Median Projected Mark"
          value={medianMark !== '--' ? `${medianMark}%` : '--'}
          subtitle="50th percentile benchmark"
          badgeText="Median"
          badgeVariant="info"
          icon={<TrendingUp size={20} />}
          iconBg="bg-sky-50 text-sky-600"
        />

        <StatCard
          title="Lowest Projected Mark"
          value={lowestMark !== '--' ? `${lowestMark}%` : '--'}
          subtitle="Priority intervention target"
          badgeText="Attention"
          badgeVariant="danger"
          icon={<AlertTriangle size={20} />}
          iconBg="bg-rose-50 text-rose-600"
        />
      </div>

      {/* Score Band Distribution Chart */}
      <SectionCard
        title="Cohort Projected Mark Bands"
        subtitle="Distribution of assigned students across academic performance tiers"
        icon={<BarChart3 size={18} />}
        rightAction={
          <span className="badge badge-brand text-[10px] font-bold">
            Continuous Inference Bands
          </span>
        }
      >
        {evaluatedCount === 0 ? (
          <EmptyState
            icon={<BarChart3 size={36} className="text-brand-royal" />}
            title="No Assessments Recorded Yet"
            description="Run AI assessments for your assigned students from the roster to generate cohort mark distribution analytics."
            actionText="Go to Student Roster"
            onAction={() => window.location.assign('/teacher/students')}
          />
        ) : (
          <div className="space-y-4">
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gradeBandData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="band" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0B192C',
                      borderColor: '#1E3E62',
                      borderRadius: '0.75rem',
                      color: '#ffffff',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Students" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
              <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block mb-0.5">Distinction (80–100%)</span>
                <span className="text-lg font-extrabold text-emerald-900">{gradeBandData[0].count} Learners</span>
              </div>
              <div className="p-3 rounded-xl bg-sky-50/60 border border-sky-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 block mb-0.5">Merit (65–79%)</span>
                <span className="text-lg font-extrabold text-sky-900">{gradeBandData[1].count} Learners</span>
              </div>
              <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block mb-0.5">Pass (50–64%)</span>
                <span className="text-lg font-extrabold text-amber-900">{gradeBandData[2].count} Learners</span>
              </div>
              <div className="p-3 rounded-xl bg-rose-50/60 border border-rose-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 block mb-0.5">High Risk (&lt;50%)</span>
                <span className="text-lg font-extrabold text-rose-900">{gradeBandData[3].count} Learners</span>
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Two Column: Subject Comparison & Milestone Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subject-Wise Prediction Overview */}
        <SectionCard
          title="Subject Evaluation Comparison"
          subtitle="Comparative telemetry between Mathematics and Portuguese Language"
          icon={<BookOpen size={18} className="text-brand-royal" />}
        >
          <div className="space-y-4">
            {/* Mathematics */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-brand-royal font-bold text-xs flex items-center justify-center">
                    MA
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-navy-900">Mathematics</h4>
                    <span className="text-[11px] text-slate-500">{subjectStats.math.count} Recorded Evaluations</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Avg Projected Mark</span>
                  <span className="text-base font-extrabold text-navy-900 font-mono">
                    {subjectStats.math.avg !== '--' ? `${subjectStats.math.avg}%` : '--'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-slate-200/60">
                <div className="p-2 bg-white rounded-lg border border-slate-200/60">
                  <span className="text-[10px] text-slate-400 block">High Risk</span>
                  <span className="font-bold text-rose-600">{subjectStats.math.highRisk}</span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200/60">
                  <span className="text-[10px] text-slate-400 block">Moderate</span>
                  <span className="font-bold text-amber-600">{subjectStats.math.modRisk}</span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200/60">
                  <span className="text-[10px] text-slate-400 block">Low Risk</span>
                  <span className="font-bold text-emerald-600">{subjectStats.math.lowRisk}</span>
                </div>
              </div>
            </div>

            {/* Portuguese Language */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center">
                    PT
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-navy-900">Portuguese Language</h4>
                    <span className="text-[11px] text-slate-500">{subjectStats.port.count} Recorded Evaluations</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 block">Avg Projected Mark</span>
                  <span className="text-base font-extrabold text-navy-900 font-mono">
                    {subjectStats.port.avg !== '--' ? `${subjectStats.port.avg}%` : '--'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-slate-200/60">
                <div className="p-2 bg-white rounded-lg border border-slate-200/60">
                  <span className="text-[10px] text-slate-400 block">High Risk</span>
                  <span className="font-bold text-rose-600">{subjectStats.port.highRisk}</span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200/60">
                  <span className="text-[10px] text-slate-400 block">Moderate</span>
                  <span className="font-bold text-amber-600">{subjectStats.port.modRisk}</span>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200/60">
                  <span className="text-[10px] text-slate-400 block">Low Risk</span>
                  <span className="font-bold text-emerald-600">{subjectStats.port.lowRisk}</span>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Milestone Comparison Metrics */}
        <SectionCard
          title="Milestone Telemetry Comparison"
          subtitle="Evaluation volume and model confidence progression across milestones"
          icon={<Layers size={18} className="text-brand-royal" />}
        >
          <div className="space-y-3">
            {milestoneBreakdown.map((item, idx) => (
              <div key={idx} className="p-3.5 rounded-xl border border-slate-200/80 bg-white flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-navy-900">{item.milestone}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">{item.desc}</p>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Evaluations</span>
                    <span className="text-xs font-bold text-navy-900 font-mono">{item.stats.count}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Avg Mark</span>
                    <span className="text-xs font-bold text-brand-royal font-mono">{item.stats.avg}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Confidence</span>
                    <span className="text-xs font-bold text-emerald-600 font-mono">{item.stats.confidence}</span>
                  </div>
                </div>
              </div>
            ))}

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500">
              <strong>Observation Note:</strong> Milestone 1 and 2 models exhibit higher confidence distributions because early exam marks (G1/G2) provide direct academic feature signals compared to Milestone 0 socio-economic proxies.
            </div>
          </div>
        </SectionCard>
      </div>

      {/* Multi-Milestone Student Progression Trajectories */}
      {longitudinalStudents.length > 0 && (
        <SectionCard
          title="Multi-Milestone Progression Trajectories"
          subtitle="Assigned learners evaluated across multiple academic milestones"
          icon={<TrendingUp size={18} className="text-brand-royal" />}
          rightAction={
            <span className="badge badge-brand text-[10px] font-bold">
              {longitudinalStudents.length} Students Tracked
            </span>
          }
        >
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>M0 (Initial) Mark</th>
                  <th>M1 (Period 1) Mark</th>
                  <th>M2 (Period 2) Mark</th>
                  <th>Trajectory</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {longitudinalStudents.map(({ student, m0, m1, m2, trend }) => (
                  <tr key={student.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-sky-50 text-brand-royal font-bold text-xs flex items-center justify-center shrink-0 border border-sky-100">
                          {student.full_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-xs text-navy-900">{student.full_name}</span>
                      </div>
                    </td>
                    <td className="font-mono text-xs">
                      {m0 ? `${m0.predicted_marks.toFixed(1)}%` : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="font-mono text-xs">
                      {m1 ? `${m1.predicted_marks.toFixed(1)}%` : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="font-mono text-xs">
                      {m2 ? `${m2.predicted_marks.toFixed(1)}%` : <span className="text-slate-300">—</span>}
                    </td>
                    <td>
                      {trend === 'improving' ? (
                        <span className="badge badge-success text-[10px] font-bold flex items-center gap-1">
                          <TrendingUp size={11} /> Improving
                        </span>
                      ) : trend === 'declining' ? (
                        <span className="badge badge-danger text-[10px] font-bold flex items-center gap-1">
                          <TrendingDown size={11} /> Declining
                        </span>
                      ) : (
                        <span className="badge bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center gap-1">
                          <Minus size={11} /> Stable
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedStudent(student)}
                        leftIcon={<UserCheck size={13} />}
                      >
                        Profile
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* Cohort Learner Academic Details Table */}
      <SectionCard
        title="Student Performance Registry"
        subtitle="Current performance standing and latest continuous prediction metrics"
        icon={<Award size={18} className="text-brand-royal" />}
        rightAction={
          <div className="flex items-center gap-3">
            <div className="relative w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search learners..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-brand-royal"
              />
            </div>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:border-brand-royal"
            >
              <option value="ALL">All Subjects</option>
              <option value="Mathematics">Mathematics</option>
              <option value="Portuguese Language">Portuguese</option>
            </select>
          </div>
        }
      >
        {filteredStudents.length === 0 ? (
          <EmptyState
            icon={<Search size={32} className="text-slate-400" />}
            title="No Students Match Criteria"
            description="Adjust your search query or subject filter to view assigned learner records."
          />
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Institutional Email</th>
                  <th>Course Subject</th>
                  <th>Milestone</th>
                  <th>Projected Mark</th>
                  <th>Risk Tier</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s) => {
                  const p = latestPredMap.get(s.id);
                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-royal via-brand-ocean to-brand-mint text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {s.full_name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-navy-900 text-xs">{s.full_name}</span>
                        </div>
                      </td>
                      <td className="font-mono text-xs text-slate-600">{s.email}</td>
                      <td className="text-xs font-medium text-slate-700">
                        {p?.subject || <span className="text-slate-300">—</span>}
                      </td>
                      <td>
                        {p ? (
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                            M{p.milestone}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td>
                        {p ? (
                          <div className="flex items-baseline gap-1 font-mono text-xs font-bold text-navy-950">
                            <span>{p.predicted_marks.toFixed(1)}</span>
                            <span className="text-[10px] text-slate-400">/ 100</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td>
                        <StatusBadge
                          status={p?.predicted_status || 'Unscreened'}
                          label={p ? undefined : 'Unscreened'}
                        />
                      </td>
                      <td className="text-right">
                        <div className="inline-flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedStudent(s)}
                            leftIcon={<UserCheck size={13} />}
                          >
                            Profile
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setPredictingStudent(s)}
                            leftIcon={<Sparkles size={13} />}
                          >
                            Assess AI
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Slide-over Profile Drawer */}
      <StudentProfileDrawer
        isOpen={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
        student={selectedStudent}
        latestPrediction={selectedStudent ? latestPredMap.get(selectedStudent.id) : null}
        onAssessClick={(student) => setPredictingStudent(student)}
      />

      {/* Prediction Assessment Modal */}
      <TeacherPredictionModal
        student={predictingStudent}
        isOpen={!!predictingStudent}
        onClose={() => setPredictingStudent(null)}
        onPredictionCreated={loadData}
      />
    </div>
  );
};
