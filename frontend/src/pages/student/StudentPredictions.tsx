import React, { useState, useEffect } from 'react';
import {
  BrainCircuit,
  Sparkles,
  History,
} from 'lucide-react';
import { api } from '../../services/api';
import {
  PredictionRecord,
  CreatePredictionPayload,
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

  // Fetch prediction history on mount
  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.listPredictions({ limit: 50 });
      setPredictions(res.predictions || []);
    } catch (err: any) {
      console.error('Failed to retrieve prediction history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleCreatePrediction = async (payload: CreatePredictionPayload) => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await api.createPrediction(payload);
      setCurrentResult(res.prediction);
      setSuccessMessage('Predictive inference executed and archived successfully.');
      // Refresh history list
      fetchHistory();
      // Smooth scroll to top of card
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err?.message || 'Failed to generate academic prediction.');
    } finally {
      setLoading(false);
    }
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

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between">
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-800 font-bold ml-2"
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

          {/* Prediction Input Form */}
          <PredictionForm
            onSubmit={handleCreatePrediction}
            loading={loading}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {historyLoading ? (
            <div className="card p-6 space-y-3">
              <LoadingSkeleton height="44px" />
              <LoadingSkeleton height="44px" />
              <LoadingSkeleton height="44px" />
            </div>
          ) : (
            <PredictionHistoryTable
              predictions={predictions}
              onRefresh={fetchHistory}
            />
          )}
        </div>
      )}
    </div>
  );
};
