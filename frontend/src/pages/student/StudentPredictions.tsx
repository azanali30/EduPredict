import React, { useState, useEffect } from 'react';
import {
  BrainCircuit,
  Sparkles,
  History,
  BookOpen,
  Filter,
} from 'lucide-react';
import { api } from '../../services/api';
import {
  PredictionRecord,
  CreatePredictionPayload,
  SubjectItem,
} from '../../types';
import { PredictionForm } from '../../components/predictions/PredictionForm';
import { PredictionResultCard } from '../../components/predictions/PredictionResultCard';
import { PredictionHistoryTable } from '../../components/predictions/PredictionHistoryTable';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';

export const StudentPredictions: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [currentResult, setCurrentResult] = useState<PredictionRecord | null>(null);
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [enrolledSubjects, setEnrolledSubjects] = useState<SubjectItem[]>([]);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('ALL');

  // Load enrolled subjects on mount
  useEffect(() => {
    api.getStudentSubjects()
      .then((res) => {
        setEnrolledSubjects(res.subjects || []);
      })
      .catch((err) => {
        console.error('Failed to load student enrolled subjects:', err);
      });
  }, []);

  // Fetch prediction history
  const fetchHistory = async (subjectFilter?: string) => {
    setHistoryLoading(true);
    try {
      const params: any = { limit: 50 };
      const activeFilter = subjectFilter !== undefined ? subjectFilter : selectedSubjectFilter;
      if (activeFilter !== 'ALL') {
        params.subject = activeFilter;
      }
      const res = await api.listPredictions(params);
      setPredictions(res.predictions || []);
    } catch (err: any) {
      console.error('Failed to retrieve prediction history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [selectedSubjectFilter]);

  const handleCreatePrediction = async (payload: CreatePredictionPayload) => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await api.createPrediction(payload);
      setCurrentResult(res.prediction);
      setSuccessMessage('Predictive inference executed and archived successfully.');
      fetchHistory();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err?.message || 'Failed to generate academic prediction.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubjectFilterChange = (subj: string) => {
    setSelectedSubjectFilter(subj);
    fetchHistory(subj);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-50 text-sky-700 text-[11px] font-bold uppercase tracking-wider mb-2 border border-sky-200">
            <BrainCircuit size={14} className="text-sky-600" />
            <span>AI Predictive Intelligence Hub</span>
          </div>
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">
            Academic Performance Predictions & Risk Model
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Subject-specific regression marks estimation, discrete risk categorization, and early warning indicators
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 shrink-0">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'create'
                ? 'bg-white text-navy-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles size={14} />
            <span>Generate Prediction</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'history'
                ? 'bg-white text-navy-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History size={14} />
            <span>History ({predictions.length})</span>
          </button>
        </div>
      </div>

      {/* Active Enrolled Courses Indicator Banner */}
      {enrolledSubjects.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-brand-600 shrink-0" />
            <span className="text-xs font-bold text-navy-900">Your Enrolled Courses:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {enrolledSubjects.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 text-navy-900 font-bold text-xs border border-slate-200"
              >
                <span>{s.name}</span>
                {s.code && (
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-white text-slate-600 border border-slate-200">
                    {s.code}
                  </span>
                )}
                {s.academic_term && (
                  <span className="text-[10px] font-mono text-brand-600 font-semibold">
                    {s.academic_term}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between">
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 font-bold ml-2 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content Areas */}
      {activeTab === 'create' ? (
        <div className="space-y-6">
          {/* Active Result Card (if prediction just generated) */}
          {currentResult && (
            <PredictionResultCard
              prediction={currentResult}
              onReset={() => setCurrentResult(null)}
            />
          )}

          {/* Prediction Input Form with Authorized Subjects passed */}
          <PredictionForm
            onSubmit={handleCreatePrediction}
            loading={loading}
            authorizedSubjects={enrolledSubjects.length > 0 ? enrolledSubjects : undefined}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Subject Filter Bar in History Tab */}
          {enrolledSubjects.length > 1 && (
            <div className="card p-3 flex items-center gap-2 bg-white border-slate-200">
              <Filter size={14} className="text-slate-400" />
              <span className="text-xs font-semibold text-slate-500">Filter Course:</span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSubjectFilterChange('ALL')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedSubjectFilter === 'ALL'
                      ? 'bg-brand-royal text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Courses
                </button>
                {enrolledSubjects.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSubjectFilterChange(s.name)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      selectedSubjectFilter === s.name
                        ? 'bg-brand-royal text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {historyLoading ? (
            <div className="card p-6 space-y-3">
              <LoadingSkeleton height="44px" />
              <LoadingSkeleton height="44px" />
              <LoadingSkeleton height="44px" />
            </div>
          ) : (
            <PredictionHistoryTable
              predictions={predictions}
              onRefresh={() => fetchHistory()}
            />
          )}
        </div>
      )}
    </div>
  );
};
