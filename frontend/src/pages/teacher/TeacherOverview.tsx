import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
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
import { PredictionDetailModal } from '../../components/predictions/PredictionDetailModal';
import { Button } from '../../components/forms/Button';
import { Link } from 'react-router-dom';
import { useTeacherSubject, TeacherSubjectSelector } from '../../context/TeacherSubjectContext';
import {
  Users,
  AlertCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  Sparkles,
  BarChart2,
  CheckCircle2,
  Eye,
  TrendingUp,
  Lock,
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

export const TeacherOverview: React.FC = () => {
  const { user } = useAuth();
  const { selectedSubject, selectedSubjectId, hasNoAssignments, loading: subjectsLoading } = useTeacherSubject();
  const [students, setStudents] = useState<User[]>([]);
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal / Drawer states
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [predictingStudent, setPredictingStudent] = useState<User | null>(null);
  const [inspectingPrediction, setInspectingPrediction] = useState<PredictionRecord | null>(null);

  const loadData = async () => {
    if (hasNoAssignments || !selectedSubjectId) {
      setStudents([]);
      setPredictions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setStudents([]);
    setPredictions([]);
    setSelectedStudent(null);
    setPredictingStudent(null);
    setInspectingPrediction(null);
    try {
      const [studentsRes, predsRes] = await Promise.all([
        api.getTeacherStudents({ subject_id: selectedSubjectId }),
        api.listPredictions({ subject: selectedSubject?.name, limit: 100 }),
      ]);
      setStudents(studentsRes.students || []);
      setPredictions(predsRes.predictions || []);
    } catch (err: any) {
      console.error('Failed to load teacher overview telemetry:', err);
      setError(err?.message || 'Failed to retrieve classroom telemetry from server.');
      setStudents([]);
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!subjectsLoading) {
      loadData();
    }
  }, [selectedSubjectId, subjectsLoading, hasNoAssignments]);

  // Map of studentId -> User
  const studentMap = useMemo(() => {
    const map = new Map<string, User>();
    students.forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

  // Map of studentId -> Latest PredictionRecord
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

  // Telemetry KPIs calculation
  const { highRiskCount, modRiskCount, lowRiskCount, unscreenedCount, evaluatedCount } = useMemo(() => {
    let high = 0;
    let mod = 0;
    let low = 0;
    let evaluated = 0;

    students.forEach((s) => {
      const p = latestPredMap.get(s.id);
      if (p) {
        evaluated++;
        if (p.predicted_status === 'High Risk') high++;
        else if (p.predicted_status === 'Moderate Risk') mod++;
        else low++;
      }
    });

    const unscreened = Math.max(0, students.length - evaluated);
    return {
      highRiskCount: high,
      modRiskCount: mod,
      lowRiskCount: low,
      unscreenedCount: unscreened,
      evaluatedCount: evaluated,
    };
  }, [students, latestPredMap]);

  // Recharts Risk Distribution Data
  const cohortRiskData = useMemo(() => [
    { category: 'High Risk', count: highRiskCount, fill: '#E11D48' },
    { category: 'Moderate Risk', count: modRiskCount, fill: '#F59E0B' },
    { category: 'Low Risk', count: lowRiskCount, fill: '#10B981' },
    { category: 'Unscreened', count: unscreenedCount, fill: '#94A3B8' },
  ], [highRiskCount, modRiskCount, lowRiskCount, unscreenedCount]);

  // Priority Attention Queue: Students flagged High or Moderate Risk
  const attentionStudents = useMemo(() => {
    const flagged: Array<{ student: User; prediction: PredictionRecord }> = [];
    students.forEach((s) => {
      const p = latestPredMap.get(s.id);
      if (p && (p.predicted_status === 'High Risk' || p.predicted_status === 'Moderate Risk')) {
        flagged.push({ student: s, prediction: p });
      }
    });

    // Sort: High Risk first, then lowest predicted marks
    return flagged.sort((a, b) => {
      if (a.prediction.predicted_status === 'High Risk' && b.prediction.predicted_status !== 'High Risk') return -1;
      if (b.prediction.predicted_status === 'High Risk' && a.prediction.predicted_status !== 'High Risk') return 1;
      return a.prediction.predicted_marks - b.prediction.predicted_marks;
    });
  }, [students, latestPredMap]);

  // Recent Predictions Slice (latest 6 records)
  const recentPredictions = useMemo(() => {
    return predictions.slice(0, 6);
  }, [predictions]);

  if (loading || subjectsLoading) {
    return <LoadingState title="Loading Classroom Telemetry..." description="Connecting to MongoDB and synchronizing assigned cohort models." />;
  }

  if (hasNoAssignments) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={`Classroom Overview – ${user?.full_name || 'Instructor'}`}
          subtitle="Cohort performance indicators, risk distribution telemetry, and early warning priority queue."
          badgeText="Instructor Analytics"
          badgeVariant="teacher"
        />
        <EmptyState
          icon={<Lock size={36} className="text-amber-500" />}
          title="No Academic Subjects Assigned"
          description="Your instructor account does not currently have any active subject assignments. Please contact an institution administrator to assign you to academic subjects and terms in the Admin Workspace."
        />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Failed to Load Classroom Telemetry" message={error} onRetry={loadData} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={`Classroom Overview – ${user?.full_name || 'Instructor'}`}
        subtitle="Cohort performance indicators, risk distribution telemetry, and early warning priority queue."
        badgeText="Instructor Analytics"
        badgeVariant="teacher"
        actions={
          <div className="flex items-center gap-2">
            <TeacherSubjectSelector showLabel={false} />
            <Link to="/teacher/students">
              <Button
                variant="outline"
                size="sm"
                rightIcon={<ArrowRight size={14} />}
              >
                Student Directory ({students.length})
              </Button>
            </Link>
          </div>
        }
      />

      {/* 1. Four Core KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Assigned Students"
          value={students.length}
          subtitle="Authorized learner cohort"
          badgeText="Verified"
          badgeVariant="brand"
          icon={<Users size={20} />}
          iconBg="bg-sky-50 text-brand-royal"
        />

        <StatCard
          title="Students with High Risk"
          value={highRiskCount}
          subtitle={highRiskCount > 0 ? "Immediate intervention advised" : "No critical risk alerts"}
          badgeText={highRiskCount > 0 ? "Critical" : "Clear"}
          badgeVariant={highRiskCount > 0 ? "danger" : "success"}
          icon={<AlertCircle size={20} />}
          iconBg={highRiskCount > 0 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}
        />

        <StatCard
          title="Students with Moderate Risk"
          value={modRiskCount}
          subtitle="Milestone monitoring recommended"
          badgeText="Advisory"
          badgeVariant="warning"
          icon={<AlertTriangle size={20} />}
          iconBg="bg-amber-50 text-amber-600"
        />

        <StatCard
          title="Students Not Yet Screened"
          value={unscreenedCount}
          subtitle={`${evaluatedCount} of ${students.length} evaluated`}
          badgeText={unscreenedCount > 0 ? "Pending" : "Complete"}
          badgeVariant={unscreenedCount > 0 ? "info" : "success"}
          icon={<Clock size={20} />}
          iconBg="bg-slate-100 text-slate-600"
        />
      </div>

      {/* 2. Cohort Risk Distribution Chart */}
      <SectionCard
        title="Student Risk Distribution"
        subtitle={`Evaluation status across your ${students.length} assigned learners`}
        icon={<BarChart2 size={18} />}
        rightAction={
          <span className="badge badge-brand text-[10px] font-bold">
            Real-Time AI Telemetry
          </span>
        }
      >
        {students.length === 0 ? (
          <EmptyState
            icon={<Users size={36} className="text-brand-royal" />}
            title="No Assigned Students"
            description="Your instructor account does not currently have any student assignments. When an administrator links students in the Admin Console, they will appear here."
          />
        ) : (
          <div className="space-y-4">
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cohortRiskData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="category" stroke="#94a3b8" fontSize={12} tickLine={false} />
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

            <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
              <span>
                <strong>Data Coverage Note:</strong> Risk classifications reflect the latest recorded prediction for each student from the loaded sample of {predictions.length} assessments.
              </span>
              <span className="font-mono text-slate-600 shrink-0 font-medium">
                {evaluatedCount} of {students.length} Screened ({students.length > 0 ? ((evaluatedCount / students.length) * 100).toFixed(0) : 0}%)
              </span>
            </div>
          </div>
        )}
      </SectionCard>

      {/* 3. Priority Attention Queue */}
      <SectionCard
        title="Priority Attention Queue"
        subtitle="Assigned learners flagged as High Risk or Moderate Risk requiring academic intervention"
        icon={<AlertTriangle size={18} className="text-rose-500" />}
        rightAction={
          <span className={`badge ${attentionStudents.length > 0 ? 'badge-danger' : 'badge-success'} text-[10px] font-bold`}>
            {attentionStudents.length} {attentionStudents.length === 1 ? 'Learner Flagged' : 'Learners Flagged'}
          </span>
        }
      >
        {attentionStudents.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
              <CheckCircle2 size={24} />
            </div>
            <h4 className="text-sm font-bold text-navy-900">All Evaluated Students On Track</h4>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              There are currently no assigned students flagged as High Risk or Moderate Risk in your classroom cohort.
            </p>
          </div>
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Institutional Email</th>
                  <th>Course Subject</th>
                  <th>Risk Indicator</th>
                  <th>Projected Mark</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {attentionStudents.map(({ student, prediction }) => (
                  <tr key={student.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-royal via-brand-ocean to-brand-mint text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {student.full_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-navy-900">{student.full_name}</span>
                      </div>
                    </td>
                    <td className="font-mono text-xs text-slate-600">{student.email}</td>
                    <td className="text-xs font-medium text-slate-700">{prediction.subject}</td>
                    <td>
                      <StatusBadge status={prediction.predicted_status} />
                    </td>
                    <td>
                      <div className="flex items-baseline gap-1 font-mono text-xs font-bold text-navy-950">
                        <span>{prediction.predicted_marks.toFixed(1)}</span>
                        <span className="text-[10px] text-slate-400">/ 100</span>
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedStudent(student)}
                          leftIcon={<Eye size={13} />}
                        >
                          View Student
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => setPredictingStudent(student)}
                          leftIcon={<Sparkles size={13} />}
                        >
                          Re-Assess
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* 4. Recent AI Predictions */}
      <SectionCard
        title="Recent AI Predictions"
        subtitle="Live stream of academic assessments generated for your assigned students"
        icon={<TrendingUp size={18} className="text-brand-royal" />}
        rightAction={
          <span className="badge badge-info text-[10px] font-bold">
            {predictions.length} Total Records
          </span>
        }
      >
        {recentPredictions.length === 0 ? (
          <EmptyState
            icon={<Sparkles size={36} className="text-brand-royal" />}
            title="No Predictions Recorded Yet"
            description="You have not generated any machine learning performance predictions for your assigned cohort yet. Launch an assessment from the student roster to begin."
            actionText="Go to Student Roster"
            onAction={() => window.location.assign('/teacher/students')}
          />
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Assessment Subject</th>
                  <th>Milestone</th>
                  <th>Projected Mark</th>
                  <th>Risk Status</th>
                  <th>Date Evaluated</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentPredictions.map((pred) => {
                  const student = studentMap.get(pred.student_id);
                  const studentName = student ? student.full_name : `ID: ${pred.student_id.slice(-8)}`;

                  return (
                    <tr key={pred.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-sky-50 text-brand-royal font-bold text-xs flex items-center justify-center border border-sky-200 shrink-0">
                            {studentName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-navy-900 text-xs">{studentName}</span>
                        </div>
                      </td>
                      <td className="text-xs text-slate-700 font-medium">{pred.subject}</td>
                      <td>
                        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                          M{pred.milestone}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-baseline gap-1 font-mono text-xs font-bold text-navy-950">
                          <span>{pred.predicted_marks.toFixed(1)}</span>
                          <span className="text-[10px] text-slate-400">/ 100</span>
                        </div>
                      </td>
                      <td>
                        <StatusBadge status={pred.predicted_status} />
                      </td>
                      <td className="text-xs text-slate-500">
                        {new Date(pred.created_at).toLocaleDateString()}
                      </td>
                      <td className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setInspectingPrediction(pred)}
                          leftIcon={<Eye size={13} />}
                        >
                          Details
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Student Profile Slide-Over Drawer */}
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
        students={students}
        isOpen={!!predictingStudent}
        onClose={() => setPredictingStudent(null)}
        onPredictionCreated={loadData}
      />

      {/* Historical Prediction Detail Inspection Modal */}
      <PredictionDetailModal
        prediction={inspectingPrediction}
        isOpen={!!inspectingPrediction}
        onClose={() => setInspectingPrediction(null)}
      />
    </div>
  );
};
