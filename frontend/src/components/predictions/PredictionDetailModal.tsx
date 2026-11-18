import React from 'react';
import { Modal } from '../common/Modal';
import { PredictionRecord } from '../../types';
import { ShieldAlert } from 'lucide-react';
import { Button } from '../forms/Button';

interface PredictionDetailModalProps {
  prediction: PredictionRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PredictionDetailModal: React.FC<PredictionDetailModalProps> = ({
  prediction,
  isOpen,
  onClose,
}) => {
  if (!prediction) return null;

  const {
    id,
    student_id,
    subject,
    milestone,
    predicted_marks,
    predicted_status,
    confidence_scores,
    top_confidence,
    early_warning_advisory,
    features_summary,
    regressor_model,
    classifier_model,
    created_at,
  } = prediction;

  const milestoneLabel =
    milestone === 0
      ? 'Milestone 0: Early Warning'
      : milestone === 1
      ? 'Milestone 1: Mid-Term'
      : 'Milestone 2: Pre-Final';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Prediction Audit & Indicator Record"
      maxWidth="max-w-3xl"
    >
      <div className="space-y-6 text-xs text-slate-700">
        {/* Header Metadata */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <span className="text-[11px] text-slate-400 block mb-0.5">Subject</span>
            <span className="font-bold text-navy-900">{subject}</span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block mb-0.5">Milestone</span>
            <span className="font-bold text-navy-900">{milestoneLabel}</span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block mb-0.5">Projected Mark</span>
            <span className="font-black font-mono text-brand-600 text-sm">
              {predicted_marks.toFixed(1)}/100
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block mb-0.5">Risk Status</span>
            <span
              className={`badge text-[10px] font-bold ${
                predicted_status === 'High Risk'
                  ? 'bg-rose-100 text-rose-800'
                  : predicted_status === 'Moderate Risk'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {predicted_status}
            </span>
          </div>
        </div>

        {/* Milestone 0 Safety Advisory Notice */}
        {milestone === 0 && early_warning_advisory && (() => {
          const fnRate =
            early_warning_advisory.false_negative_rate_estimate_pct ??
            early_warning_advisory.false_negative_rate_pct ??
            (subject.toLowerCase().includes('math') ? 61.54 : 75.0);
          const noticeText =
            early_warning_advisory.notice ||
            early_warning_advisory.warning ||
            'Milestone 0 predictions reflect behavioral and demographic tendencies only before examination scores are recorded.';
          const guidanceText =
            early_warning_advisory.recommended_action ||
            early_warning_advisory.actionable_guidance;

          return (
            <div className="p-4 rounded-xl border border-amber-300 bg-amber-50/80 text-amber-950 space-y-1.5">
              <div className="flex items-center gap-2">
                <ShieldAlert size={16} className="text-amber-600 shrink-0" />
                <span className="font-bold text-sm">
                  {early_warning_advisory.title || 'Milestone 0 Safety Advisory'}
                </span>
                <span className="badge bg-amber-200 text-amber-900 font-mono font-bold text-[10px]">
                  Holdout False-Negative Rate: {Number(fnRate).toFixed(2)}%
                </span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                {noticeText}
              </p>
              {guidanceText && (
                <p className="text-[11px] text-amber-900 font-medium">
                  <strong>Recommended Action:</strong> {guidanceText}
                </p>
              )}
            </div>
          );
        })()}

        {/* Inference Provenance */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Continuous Regressor Model
            </span>
            <div className="font-mono text-slate-800 text-[11px] font-semibold">
              {regressor_model}
            </div>
            <span className="text-[10px] text-slate-500">Optimized on G3 Exam Marks (MSE)</span>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">
              Multi-Class Classifier Model
            </span>
            <div className="font-mono text-slate-800 text-[11px] font-semibold">
              {classifier_model}
            </div>
            <span className="text-[10px] text-slate-500">
              Top Confidence: {(top_confidence * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Class Probabilities */}
        <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
          <span className="text-[11px] font-bold text-slate-700 block">
            Discrete Probability Scores:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {Object.entries(confidence_scores).map(([cls, score]) => (
              <div
                key={cls}
                className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between"
              >
                <span className="text-slate-600 font-medium">{cls}</span>
                <span className="font-mono font-bold text-navy-950">
                  {(score * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Input Features Provenance Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              Input Indicators ({Object.keys(features_summary || {}).length} Total)
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Audited Feature Payload
            </span>
          </div>

          <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
            {Object.entries(features_summary || {}).map(([key, item]) => (
              <div
                key={key}
                className={`p-2.5 flex items-center justify-between text-xs transition-colors ${
                  item.is_estimated_proxy
                    ? 'bg-purple-50/50 hover:bg-purple-50'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-slate-800">{item.label}</span>
                    {item.is_estimated_proxy && (
                      <span className="badge bg-purple-100 text-purple-800 text-[9px] font-semibold">
                        Estimated Proxy
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{key}</span>
                </div>
                <div className="font-mono font-bold text-slate-900 bg-white px-2 py-1 rounded border border-slate-200">
                  {String(item.value)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit ID & Timestamps */}
        <div className="pt-3 border-t border-slate-200 text-[10px] text-slate-400 flex flex-wrap justify-between gap-2">
          <span>Prediction ID: <code className="font-mono">{id}</code></span>
          <span>Target Student: <code className="font-mono">{student_id}</code></span>
          <span>Recorded: {new Date(created_at).toLocaleString()}</span>
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
