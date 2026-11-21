import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../forms/Button';
import { StatusBadge } from '../common/StatusBadge';
import { AnomalyRecord, AnomalyReviewStatus } from '../../types';
import { AlertTriangle, CheckCircle, Info, ShieldAlert } from 'lucide-react';

interface AnomalyReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: AnomalyRecord | null;
  onSave: (anomalyId: string, status: AnomalyReviewStatus, notes: string) => Promise<void>;
}

export const AnomalyReviewModal: React.FC<AnomalyReviewModalProps> = ({
  isOpen,
  onClose,
  record,
  onSave,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<AnomalyReviewStatus>('Pending Review');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (record) {
      setSelectedStatus(record.review_status);
      setNotes(record.review_notes || '');
      setError(null);
    }
  }, [record]);

  if (!record) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await onSave(record.id, selectedStatus, notes);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update review status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSeverityBadgeType = (sev: string) => {
    switch (sev) {
      case 'Critical':
        return 'error' as const;
      case 'High':
        return 'warning' as const;
      case 'Medium':
        return 'warning' as const;
      default:
        return 'info' as const;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Academic Anomaly Human Triage Review"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Transparent Methodology Advisory */}
        <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-100 text-blue-950 text-xs flex items-start gap-2.5">
          <Info size={16} className="text-brand-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <span className="font-bold">Pedagogical Safeguard Notice:</span> Anomaly scores are
            uncalibrated isolation forest metrics measuring empirical feature rarity. They do{' '}
            <span className="font-semibold underline">not</span> represent probabilities of academic
            failure or misconduct. Human review is required before any advisory action.
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Record Overview Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <div>
            <span className="text-slate-400 block text-[10px] font-semibold uppercase">Subject</span>
            <span className="font-bold text-navy-900">{record.subject}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] font-semibold uppercase">Milestone</span>
            <span className="font-bold text-navy-900">{record.milestone}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] font-semibold uppercase">
              Anomaly Score (Uncalibrated)
            </span>
            <span className="font-mono font-bold text-rose-600">
              {record.anomaly_score.toFixed(4)}
            </span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] font-semibold uppercase">
              Cohort Percentile (Rank)
            </span>
            <span className="font-mono font-bold text-navy-900">
              {record.cohort_percentile.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Severity & Review Status Meta */}
        <div className="flex items-center justify-between text-xs px-1">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Assigned Severity:</span>
            <StatusBadge
              status={record.anomaly_severity}
              type={getSeverityBadgeType(record.anomaly_severity)}
            />
          </div>
          <div className="text-slate-400 text-[11px]">
            Model Version: <span className="font-mono text-slate-600">{record.model_version}</span>
          </div>
        </div>

        {/* Supporting Statistical Deviations */}
        <div>
          <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-2">
            Supporting Statistical Deviations ({record.supporting_deviations.length})
          </label>
          {record.supporting_deviations.length === 0 ? (
            <p className="text-xs text-slate-400 italic bg-slate-50 p-3 rounded-lg border border-slate-200">
              No extreme univariate feature outliers detected; isolation is driven by multi-dimensional interactions.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {record.supporting_deviations.map((dev, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/80 text-xs flex items-start justify-between gap-2"
                >
                  <div>
                    <div className="font-bold text-amber-950 flex items-center gap-1.5">
                      <span className="font-mono text-[11px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                        {dev.feature}
                      </span>
                      <span className="text-slate-600 font-normal">{dev.description}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex gap-3">
                      <span>
                        Observed: <strong className="text-slate-800">{String(dev.observed_value)}</strong>
                      </span>
                      <span>
                        Cohort Baseline: <strong className="text-slate-800">{String(dev.cohort_mean_or_mode)}</strong>
                      </span>
                    </div>
                  </div>
                  {dev.z_score !== undefined && dev.z_score !== null && (
                    <span className="shrink-0 font-mono text-[10px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded">
                      |Z| = {Math.abs(dev.z_score).toFixed(2)}
                    </span>
                  )}
                  {dev.rarity_percentage !== undefined && dev.rarity_percentage !== null && (
                    <span className="shrink-0 font-mono text-[10px] font-bold text-purple-800 bg-purple-100/80 px-2 py-0.5 rounded">
                      {dev.rarity_percentage.toFixed(1)}% cohort rarity
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Human Triage Action Selector */}
        <div>
          <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-2">
            Triage Decision (Human Reviewer)
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                {
                  status: 'Pending Review' as AnomalyReviewStatus,
                  label: 'Pending Review',
                  icon: ShieldAlert,
                  activeColor: 'border-amber-500 bg-amber-50 text-amber-800',
                },
                {
                  status: 'Confirmed Anomaly' as AnomalyReviewStatus,
                  label: 'Confirmed Anomaly',
                  icon: AlertTriangle,
                  activeColor: 'border-rose-500 bg-rose-50 text-rose-800',
                },
                {
                  status: 'Dismissed (Benign)' as AnomalyReviewStatus,
                  label: 'Dismissed (Benign)',
                  icon: CheckCircle,
                  activeColor: 'border-emerald-500 bg-emerald-50 text-emerald-800',
                },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const isSelected = selectedStatus === item.status;
              return (
                <button
                  key={item.status}
                  type="button"
                  onClick={() => setSelectedStatus(item.status)}
                  className={`p-2.5 rounded-lg border text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition-all ${
                    isSelected
                      ? `${item.activeColor} shadow-sm ring-1 ring-offset-1`
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Review Notes */}
        <div>
          <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1">
            Reviewer Notes / Academic Context (Mandatory for Confirmation/Dismissal)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Document contextual observations, faculty intervention plans, or the rationale for benign dismissal..."
            className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 text-slate-800 placeholder:text-slate-400"
          />
        </div>

        {/* Existing Reviewer Metadata if already reviewed */}
        {record.reviewed_by_name && (
          <div className="p-2.5 rounded-lg bg-slate-100 text-[11px] text-slate-600 flex justify-between items-center">
            <span>
              Last reviewed by <strong>{record.reviewed_by_name}</strong>
            </span>
            <span>
              {record.reviewed_at ? new Date(record.reviewed_at).toLocaleString() : ''}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end items-center gap-2 pt-2 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" isLoading={isSubmitting}>
            Save Review Decision
          </Button>
        </div>
      </form>
    </Modal>
  );
};
