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
import {
  Sparkles,
  History,
} from 'lucide-react';

interface TeacherPredictionModalProps {
  student: User | null;
  isOpen: boolean;
  onClose: () => void;
  onPredictionCreated?: () => void;
}

export const TeacherPredictionModal: React.FC<TeacherPredictionModalProps> = ({
  student,
  isOpen,
  onClose,
  onPredictionCreated,
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [currentResult, setCurrentResult] = useState<PredictionRecord | null>(null);
  const [studentPredictions, setStudentPredictions] = useState<PredictionRecord[]>([]);

  // Load student's prediction history when opened or student changes
  const loadStudentHistory = async () => {
    if (!student) return;
    setHistoryLoading(true);
    try {
      const res = await api.listPredictions({ student_id: student.id, limit: 50 });
      setStudentPredictions(res.predictions || []);
    } catch (err: any) {
      console.error('Failed to load student predictions:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && student) {
      setCurrentResult(null);
      setError(null);
      setSuccess(null);
      loadStudentHistory();
    }
  }, [isOpen, student]);

  if (!student) return null;

  const handleCreatePrediction = async (payload: CreatePredictionPayload) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.createPrediction(payload);
      setCurrentResult(res.prediction);
      setSuccess('Prediction generated and recorded for assigned student.');
      loadStudentHistory();
      if (onPredictionCreated) onPredictionCreated();
    } catch (err: any) {
      setError(err?.message || 'Failed to generate prediction.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`AI Performance Prediction – ${student.full_name}`}
      maxWidth="max-w-4xl"
    >
      <div className="space-y-5">
        {/* Sub-navigation */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="badge badge-teacher text-[10px]">Instructor Workspace</span>
            <span className="text-xs text-slate-500 font-mono">ID: {student.id.slice(-8)}</span>
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
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
            {success}
          </div>
        )}

        {/* Content Area */}
        {activeTab === 'create' ? (
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
              studentId={student.id}
              studentName={student.full_name}
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
