import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { User, PredictionRecord } from '../../types';
import { StatCard } from '../../components/common/StatCard';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { Modal } from '../../components/common/Modal';
import { TeacherPredictionModal } from '../../components/predictions/TeacherPredictionModal';
import {
  Users,
  AlertCircle,
  ArrowRight,
  Search,
  UserCheck,
  BarChart2,
  TrendingUp,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/forms/Button';
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
  const [students, setStudents] = useState<User[]>([]);
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Selected Student Modal State
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  // Prediction Modal State
  const [predictingStudent, setPredictingStudent] = useState<User | null>(null);

  const loadData = async () => {
    try {
      const [studentsRes, predsRes] = await Promise.all([
        api.getTeacherStudents(),
        api.listPredictions({ limit: 100 }),
      ]);
      setStudents(studentsRes.students || []);
      setPredictions(predsRes.predictions || []);
    } catch (err) {
      console.error('Failed to load teacher overview telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleInspectStudent = async (studentId: string) => {
    setModalLoading(true);
    try {
      const res = await api.getStudentDetails(studentId);
      setSelectedStudent(res.student);
    } catch (err) {
      console.error('Failed to inspect student:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Build map of latest prediction per student
  const latestPredMap = new Map<string, PredictionRecord>();
  predictions.forEach((p) => {
    const existing = latestPredMap.get(p.student_id);
    if (!existing || new Date(p.created_at) > new Date(existing.created_at)) {
      latestPredMap.set(p.student_id, p);
    }
  });

  // Calculate telemetry
  let highRiskCount = 0;
  let modRiskCount = 0;
  let lowRiskCount = 0;
  let scoreSum = 0;
  let scoreCount = 0;

  students.forEach((s) => {
    const p = latestPredMap.get(s.id);
    if (p) {
      if (p.predicted_status === 'High Risk') highRiskCount++;
      else if (p.predicted_status === 'Moderate Risk') modRiskCount++;
      else lowRiskCount++;

      scoreSum += p.predicted_marks;
      scoreCount++;
    }
  });

  const avgProjectedScore = scoreCount > 0 ? (scoreSum / scoreCount).toFixed(1) : '--';

  // Risk Distribution Data for Recharts
  const cohortRiskData = [
    { category: 'High Risk', count: highRiskCount, fill: '#e11d48' },
    { category: 'Moderate Risk', count: modRiskCount, fill: '#f59e0b' },
    { category: 'Low Risk', count: lowRiskCount, fill: '#10b981' },
    { category: 'Unscreened', count: Math.max(0, students.length - scoreCount), fill: '#94a3b8' },
  ];

  const getRiskBadge = (status?: string) => {
    if (!status) {
      return (
        <span className="badge bg-slate-100 text-slate-500 text-[10px]">
          No Model Run
        </span>
      );
    }
    switch (status) {
      case 'High Risk':
        return (
          <span className="badge bg-rose-100 text-rose-800 border-rose-200 text-[10px] font-bold flex items-center gap-1">
            <AlertTriangle size={11} className="text-rose-600" />
            High Risk
          </span>
        );
      case 'Moderate Risk':
        return (
          <span className="badge bg-amber-100 text-amber-800 border-amber-200 text-[10px] font-bold flex items-center gap-1">
            <AlertCircle size={11} className="text-amber-600" />
            Moderate Risk
          </span>
        );
      case 'Low Risk / On Track':
      default:
        return (
          <span className="badge bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold flex items-center gap-1">
            <CheckCircle2 size={11} className="text-emerald-600" />
            Low Risk
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Teacher Hero Greeting */}
      <div className="card bg-gradient-to-br from-navy-950 via-navy-900 to-navy-850 text-white p-6 sm:p-8 relative overflow-hidden border border-navy-800/80 shadow-soft">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="max-w-2xl">
            <span className="badge bg-purple-400/20 text-purple-300 border-purple-400/30 text-xs font-semibold mb-3 inline-block">
              Instructor Analytics Hub
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
              Instructor Console – {user?.full_name}
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Track assigned learner cohorts, monitor early warning risk flags, and run AI performance predictions across Mathematics and Portuguese Language.
            </p>
          </div>

          <Link to="/teacher/students">
            <Button
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 shrink-0"
              rightIcon={<ArrowRight size={16} />}
            >
              Full Student Directory
            </Button>
          </Link>
        </div>
      </div>

      {/* Cohort KPI Metrics */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">
          Assigned Cohort Indicators & Predictive Telemetry
        </h2>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <LoadingSkeleton height="110px" />
            <LoadingSkeleton height="110px" />
            <LoadingSkeleton height="110px" />
            <LoadingSkeleton height="110px" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Assigned Students"
              value={students.length}
              subtitle="Active mapped learners"
              badgeText="Authorized"
              badgeVariant="success"
              icon={<Users size={20} />}
            />
            <StatCard
              title="High Risk Alerts"
              value={highRiskCount}
              subtitle={highRiskCount > 0 ? "Immediate review advised" : "No critical flags"}
              badgeText={highRiskCount > 0 ? "Attention" : "Clear"}
              badgeVariant={highRiskCount > 0 ? "danger" : "success"}
              icon={<AlertCircle size={20} />}
            />
            <StatCard
              title="Moderate Risk Alerts"
              value={modRiskCount}
              subtitle="Monitor milestone progress"
              badgeText="Advisory"
              badgeVariant="warning"
              icon={<AlertTriangle size={20} />}
            />
            <StatCard
              title="Cohort Avg Projected Mark"
              value={avgProjectedScore !== '--' ? `${avgProjectedScore}%` : '--'}
              subtitle={`${scoreCount} of ${students.length} evaluated`}
              badgeText="AI Inference"
              badgeVariant="info"
              icon={<TrendingUp size={20} />}
            />
          </div>
        )}
      </div>

      {/* Visual Analytics & Breakdown */}
      {students.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-navy-900 flex items-center gap-2">
                <BarChart2 size={18} className="text-brand-500" />
                Cohort Academic Risk Classification Distribution
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluation results across your {students.length} assigned learners
              </p>
            </div>
            <span className="badge badge-info text-[10px]">Real-Time Model Inference</span>
          </div>

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
        </div>
      )}

      {/* Assigned Student Roster Table with Search */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-navy-900">Assigned Student Roster</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live mapping of student accounts authorized for your inspection and prediction
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
              />
            </div>
            <span className="text-xs font-semibold text-slate-500 shrink-0">
              {filteredStudents.length} / {students.length}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            <LoadingSkeleton height="44px" />
            <LoadingSkeleton height="44px" />
            <LoadingSkeleton height="44px" />
          </div>
        ) : filteredStudents.length === 0 ? (
          <EmptyState
            icon={<Users size={36} className="text-brand-500" />}
            title={students.length === 0 ? 'No Assigned Students' : 'No Students Match Filter'}
            description={
              students.length === 0
                ? 'Your administrator has not mapped any student accounts to your profile yet. Links configured in Admin will appear here.'
                : 'Try adjusting your search query.'
            }
          />
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Institutional Email</th>
                  <th>Risk Indicator</th>
                  <th>Projected Mark</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s) => {
                  const pred = latestPredMap.get(s.id);
                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-sky-50 text-sky-700 font-bold text-xs flex items-center justify-center shrink-0 border border-sky-200">
                            {s.full_name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-navy-900">{s.full_name}</span>
                        </div>
                      </td>
                      <td className="text-slate-600 font-mono text-xs">{s.email}</td>
                      <td>{getRiskBadge(pred?.predicted_status)}</td>
                      <td>
                        {pred ? (
                          <div className="flex items-center gap-1 font-mono text-xs font-bold text-navy-950">
                            <span>{pred.predicted_marks.toFixed(1)}</span>
                            <span className="text-[10px] text-slate-400">/ 100</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setPredictingStudent(s)}
                            leftIcon={<Sparkles size={13} />}
                          >
                            Predict AI
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleInspectStudent(s.id)}
                            leftIcon={<UserCheck size={13} />}
                          >
                            Profile
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
      </div>

      {/* Teacher Prediction Modal */}
      <TeacherPredictionModal
        student={predictingStudent}
        isOpen={!!predictingStudent}
        onClose={() => setPredictingStudent(null)}
        onPredictionCreated={loadData}
      />

      {/* Student Details Inspection Modal */}
      <Modal
        isOpen={!!selectedStudent || modalLoading}
        onClose={() => {
          setSelectedStudent(null);
          setModalLoading(false);
        }}
        title="Student Performance Profile"
      >
        {modalLoading ? (
          <div className="space-y-3 py-4">
            <LoadingSkeleton height="30px" width="50%" />
            <LoadingSkeleton height="80px" />
          </div>
        ) : selectedStudent ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-sky-400 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                {selectedStudent.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 className="text-base font-bold text-navy-900">{selectedStudent.full_name}</h4>
                <p className="text-xs text-slate-500">{selectedStudent.email}</p>
                <div className="mt-1">
                  <span className="badge badge-student text-[9px] py-0 px-2">
                    Verified Student
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-400 block mb-0.5">Identifier</span>
                <span className="font-mono text-slate-800 text-[11px] truncate block">{selectedStudent.id}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-400 block mb-0.5">Enrolled Date</span>
                <span className="font-semibold text-slate-800">
                  {selectedStudent.created_at ? new Date(selectedStudent.created_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const s = selectedStudent;
                  setSelectedStudent(null);
                  setPredictingStudent(s);
                }}
                leftIcon={<Sparkles size={14} />}
              >
                Launch Prediction Engine
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setSelectedStudent(null)}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};
