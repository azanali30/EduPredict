import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { User, PredictionRecord } from '../../types';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/forms/Button';
import { TeacherPredictionModal } from '../../components/predictions/TeacherPredictionModal';
import {
  Users,
  Search,
  UserCheck,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  BrainCircuit,
} from 'lucide-react';

export const TeacherStudents: React.FC = () => {
  const [students, setStudents] = useState<User[]>([]);
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inspection Modal State
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
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch assigned students or predictions.');
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
    } catch (err: any) {
      setError(err?.message || 'Failed to retrieve student details.');
    } finally {
      setModalLoading(false);
    }
  };

  // Build a map of studentId -> latest prediction
  const latestPredictionByStudent = new Map<string, PredictionRecord>();
  predictions.forEach((pred) => {
    const existing = latestPredictionByStudent.get(pred.student_id);
    if (!existing || new Date(pred.created_at) > new Date(existing.created_at)) {
      latestPredictionByStudent.set(pred.student_id, pred);
    }
  });

  // Calculate cohort risk counts
  let highRiskCount = 0;
  let modRiskCount = 0;
  students.forEach((s) => {
    const pred = latestPredictionByStudent.get(s.id);
    if (pred?.predicted_status === 'High Risk') highRiskCount++;
    else if (pred?.predicted_status === 'Moderate Risk') modRiskCount++;
  });

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (riskFilter !== 'ALL') {
      const pred = latestPredictionByStudent.get(s.id);
      if (riskFilter === 'NO_PRED') {
        if (pred) return false;
      } else if (pred?.predicted_status !== riskFilter) {
        return false;
      }
    }
    return true;
  });

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
            <AlertTriangle size={12} className="text-rose-600" />
            High Risk
          </span>
        );
      case 'Moderate Risk':
        return (
          <span className="badge bg-amber-100 text-amber-800 border-amber-200 text-[10px] font-bold flex items-center gap-1">
            <AlertCircle size={12} className="text-amber-600" />
            Moderate Risk
          </span>
        );
      case 'Low Risk / On Track':
      default:
        return (
          <span className="badge bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold flex items-center gap-1">
            <CheckCircle2 size={12} className="text-emerald-600" />
            Low Risk
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">
            Assigned Students Directory
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Cohort management, predictive risk screening, and student evaluation tracking
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="badge badge-teacher text-xs py-1 px-3">
            Instructor Authorized Access
          </span>
        </div>
      </div>

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* Academic Attention Banner (if any student is flagged High or Moderate Risk) */}
      {(highRiskCount > 0 || modRiskCount > 0) && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/90 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="text-xs">
              <span className="font-bold text-amber-900 block">
                Learners Requiring Academic Attention
              </span>
              <span className="text-amber-800">
                {highRiskCount} student{highRiskCount !== 1 ? 's' : ''} flagged High Risk,{' '}
                {modRiskCount} student{modRiskCount !== 1 ? 's' : ''} flagged Moderate Risk. Early intervention recommended.
              </span>
            </div>
          </div>
          <button
            onClick={() => setRiskFilter(highRiskCount > 0 ? 'High Risk' : 'Moderate Risk')}
            className="btn btn-outline text-xs px-3 py-1 bg-white border-amber-300 text-amber-900 hover:bg-amber-100 shrink-0"
          >
            Filter Flagged Learners
          </button>
        </div>
      )}

      {/* Search & Actions Bar */}
      <div className="card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:max-w-md">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by student name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-400">Risk Filter:</span>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:border-brand-500"
            >
              <option value="ALL">All Cohort</option>
              <option value="High Risk">High Risk</option>
              <option value="Moderate Risk">Moderate Risk</option>
              <option value="Low Risk / On Track">Low Risk / On Track</option>
              <option value="NO_PRED">No Prediction Yet</option>
            </select>
          </div>

          <span className="text-xs font-semibold text-slate-500">
            {filteredStudents.length} of {students.length}
          </span>
        </div>
      </div>

      {/* Roster Table */}
      {loading ? (
        <div className="card p-6 space-y-3">
          <LoadingSkeleton height="44px" />
          <LoadingSkeleton height="44px" />
          <LoadingSkeleton height="44px" />
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon={<Users size={40} className="text-brand-500" />}
            title={students.length === 0 ? 'No Students Assigned Yet' : 'No Students Match Filter'}
            description={
              students.length === 0
                ? 'Your instructor account does not currently have any student assignments. When an administrator links students in the Admin Console, they will appear here.'
                : 'Try adjusting your search query or risk filter.'
            }
          />
        </div>
      ) : (
        <div className="data-table-container shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student ID</th>
                <th>Full Name</th>
                <th>Institutional Email</th>
                <th>Latest AI Status</th>
                <th>Projected Mark</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s) => {
                const latestPred = latestPredictionByStudent.get(s.id);
                return (
                  <tr key={s.id}>
                    <td className="font-mono text-xs text-slate-400">
                      {s.id.slice(-8)}
                    </td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-sky-50 text-sky-700 font-bold text-xs flex items-center justify-center border border-sky-200">
                          {s.full_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-navy-900">{s.full_name}</span>
                      </div>
                    </td>
                    <td className="text-slate-600 font-mono text-xs">{s.email}</td>
                    <td>{getRiskBadge(latestPred?.predicted_status)}</td>
                    <td>
                      {latestPred ? (
                        <div className="flex items-center gap-1 font-mono text-xs font-bold text-navy-950">
                          <span>{latestPred.predicted_marks.toFixed(1)}</span>
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

      {/* Teacher Prediction Modal */}
      <TeacherPredictionModal
        student={predictingStudent}
        isOpen={!!predictingStudent}
        onClose={() => setPredictingStudent(null)}
        onPredictionCreated={loadData}
      />

      {/* Student Profile Inspection Modal */}
      <Modal
        isOpen={!!selectedStudent || modalLoading}
        onClose={() => {
          setSelectedStudent(null);
          setModalLoading(false);
        }}
        title="Student Profile Inspection"
      >
        {modalLoading ? (
          <div className="space-y-4 py-4">
            <LoadingSkeleton height="35px" width="50%" />
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
                <span className="text-slate-400 block mb-0.5">Database ID</span>
                <span className="font-mono text-slate-800 text-[11px] truncate block">{selectedStudent.id}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-400 block mb-0.5">Registered</span>
                <span className="font-semibold text-slate-800">
                  {selectedStudent.created_at ? new Date(selectedStudent.created_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-sky-50/60 border border-sky-100 text-xs text-slate-600 space-y-1">
              <div className="font-bold text-navy-900 flex items-center gap-1.5">
                <BrainCircuit size={14} className="text-brand-500" />
                <span>AI Prediction Availability</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                You can generate performance predictions across Mathematics and Portuguese Language milestones directly from the student roster.
              </p>
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
