import React, { useState, useEffect } from 'react';
import {
  Modal,
} from '../common/Modal';
import {
  User,
  PredictionRecord,
  CreatePredictionPayload,
} from '../../types';
import { api } from '../../services/api';
import { PredictionForm } from './PredictionForm';
import { PredictionResultCard } from './PredictionResultCard';
import { PredictionHistoryTable } from './PredictionHistoryTable';
import { ErrorAlert } from '../common/ErrorAlert';
import { useTeacherSubject } from '../../context/TeacherSubjectContext';
import {
  Sparkles,
  History,
} from 'lucide-react';

interface TeacherPredictionModalProps {
  student: User | null;
  students?: User[];
  isOpen: boolean;
  onClose: () => void;
  onPredictionCreated?: () => void;
}

export const TeacherPredictionModal: React.FC<TeacherPredictionModalProps> = ({
  student,
  students = [],
  isOpen,
  onClose,
  onPredictionCreated,
}) => {
  const { subjects: teacherSubjects, selectedSubject } = useTeacherSubject();
  const [activeStudent, setActiveStudent] = useState<User | null>(student);
  const [activeSubjectName, setActiveSubjectName] = useState<string>(selectedSubject?.name || 'Mathematics');
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [currentResult, setCurrentResult] = useState<PredictionRecord | null>(null);
  const [studentPredictions, setStudentPredictions] = useState<PredictionRecord[]>([]);

  // Sync activeStudent when prop changes or modal opens
  useEffect(() => {
    setActiveStudent(student);
  }, [student, isOpen]);

  // Sync activeSubjectName when selectedSubject from context changes
  useEffect(() => {
    if (selectedSubject?.name) {
      setActiveSubjectName(selectedSubject.name);
    }
  }, [selectedSubject?.name]);

  // Filter eligible students enrolled in the currently selected activeSubjectName
  const eligibleStudents = React.useMemo(() => {
    if (!students || students.length === 0) {
      return activeStudent ? [activeStudent] : [];
    }
    return students.filter((s) => {
      if (s.enrolled_subjects_under_teacher && s.enrolled_subjects_under_teacher.length > 0) {
        return s.enrolled_subjects_under_teacher.some(
          (name) => name.toLowerCase() === activeSubjectName.toLowerCase()
        );
      }
      return true;
    });
  }, [students, activeStudent, activeSubjectName]);

  // Handle subject change from PredictionForm
  const handleSubjectChange = (newSubj: string) => {
    setActiveSubjectName(newSubj);
    setCurrentResult(null);
    setError(null);

    // Verify if activeStudent is enrolled in newSubj; if not, switch to first eligible student or null
    if (activeStudent?.enrolled_subjects_under_teacher && activeStudent.enrolled_subjects_under_teacher.length > 0) {
      const isEnrolled = activeStudent.enrolled_subjects_under_teacher.some(
        (name) => name.toLowerCase() === newSubj.toLowerCase()
      );
      if (!isEnrolled) {
        const nextEligible = students.find((s) =>
          s.enrolled_subjects_under_teacher?.some(
            (name) => name.toLowerCase() === newSubj.toLowerCase()
          )
        );
        setActiveStudent(nextEligible || null);
      }
    }
  };

  // Compute authorized subjects shared between teacher and active student
  const allowedSubjects = React.useMemo(() => {
    if (!activeStudent) return [];
    if (activeStudent.enrolled_subjects_under_teacher && Array.isArray(activeStudent.enrolled_subjects_under_teacher)) {
      return teacherSubjects.filter((ts) =>
        activeStudent.enrolled_subjects_under_teacher?.some(
          (name) => name.toLowerCase() === ts.name.toLowerCase()
        )
      );
    }
    return selectedSubject ? [selectedSubject] : teacherSubjects;
  }, [activeStudent, teacherSubjects, selectedSubject]);

  // Load student's prediction history when opened or student changes
  const loadStudentHistory = async () => {
    if (!activeStudent) return;
    setHistoryLoading(true);
    try {
      const res = await api.listPredictions({
        student_id: activeStudent.id,
        subject: activeSubjectName,
        limit: 50,
      });
      setStudentPredictions(res.predictions || []);
    } catch (err: any) {
      console.error('Failed to load student predictions:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeStudent) {
      setCurrentResult(null);
      setError(null);
      setSuccess(null);
      loadStudentHistory();
    }
  }, [isOpen, activeStudent?.id, activeSubjectName]);

  if (!activeStudent && (!students || students.length === 0)) return null;

  const handleCreatePrediction = async (payload: CreatePredictionPayload) => {
    if (!activeStudent) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.createPrediction({
        ...payload,
        student_id: activeStudent.id,
      });
      setCurrentResult(res.prediction);
      setSuccess('Prediction generated and recorded for assigned student.');
      loadStudentHistory();
      if (onPredictionCreated) onPredictionCreated();
    } catch (err: any) {
      if (err?.status === 403 || /authorized/i.test(err?.message || '')) {
        setError('Authorization Error: You are not authorized to create predictions for this learner in this subject.');
      } else {
        setError(err?.message || 'Failed to generate prediction.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={activeStudent ? `AI Performance Prediction – ${activeStudent.full_name}` : 'AI Performance Prediction'}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-5">
        {/* Sub-navigation & Student Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge badge-teacher text-[10px]">Instructor Workspace</span>
            {activeStudent && (
              <span className="text-xs text-slate-500 font-mono">ID: {activeStudent.id.slice(-8)}</span>
            )}

            {/* Selectable enrolled student dropdown */}
            {eligibleStudents.length > 1 && (
              <div className="flex items-center gap-1.5 ml-2 text-xs">
                <span className="font-semibold text-slate-400">Student:</span>
                <select
                  value={activeStudent?.id || ''}
                  onChange={(e) => {
                    const found = eligibleStudents.find((s) => s.id === e.target.value);
                    if (found) {
                      setActiveStudent(found);
                      setCurrentResult(null);
                      setError(null);
                    }
                  }}
                  className="px-2 py-1 rounded-lg border border-slate-200 bg-white font-medium text-navy-900 text-xs outline-none focus:border-brand-royal"
                >
                  {eligibleStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.id.slice(-6)})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setActiveTab('create')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-bold transition-all ${
                activeTab === 'create'
                  ? 'bg-white text-navy-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles size={13} />
              <span>New Assessment</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-bold transition-all ${
                activeTab === 'history'
                  ? 'bg-white text-navy-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History size={13} />
              <span>Prior Audits ({studentPredictions.length})</span>
            </button>
          </div>
        </div>

        <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

        {success && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
            {success}
          </div>
        )}

        {/* Content Area */}
        {!activeStudent ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            No students enrolled in {activeSubjectName} are currently selected.
          </div>
        ) : activeTab === 'create' ? (
          <div className="space-y-5 max-h-[72vh] overflow-y-auto pr-1">
            {currentResult && (
              <PredictionResultCard
                prediction={currentResult}
                onReset={() => setCurrentResult(null)}
              />
            )}

            <PredictionForm
              onSubmit={handleCreatePrediction}
              loading={loading}
              studentId={activeStudent.id}
              studentName={activeStudent.full_name}
              authorizedSubjects={allowedSubjects}
              initialSubject={activeSubjectName}
              onSubjectChange={handleSubjectChange}
            />
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto">
            <PredictionHistoryTable
              predictions={studentPredictions}
              loading={historyLoading}
              onRefresh={loadStudentHistory}
            />
          </div>
        )}
      </div>
    </Modal>
  );
};
