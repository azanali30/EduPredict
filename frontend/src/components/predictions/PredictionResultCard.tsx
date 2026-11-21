import React from 'react';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Brain,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { PredictionRecord } from '../../types';

interface PredictionResultCardProps {
  prediction: PredictionRecord;
  onReset?: () => void;
}

export const PredictionResultCard: React.FC<PredictionResultCardProps> = ({
  prediction,
  onReset,
}) => {
  const {
    subject,
    milestone,
    predicted_marks,
    predicted_status,
    confidence_scores,
    top_confidence,
    confidence_type,
    uncertainty_warning,
    uncertainty_message,
    early_warning_advisory,
    regressor_model,
    classifier_model,
    created_at,
  } = prediction;

  // Determine continuous mark risk tier to detect model disagreement
  const continuousRiskTier =
    predicted_marks < 50
      ? 'High Risk'
      : predicted_marks < 70
      ? 'Moderate Risk'
      : 'Low Risk / On Track';

  const hasModelDisagreement = continuousRiskTier !== predicted_status;

  // Risk Status Styling
  const getRiskStatusConfig = (status: string) => {
    switch (status) {
      case 'High Risk':
        return {
          bg: 'bg-rose-50 text-rose-700 border-rose-200',
          badge: 'bg-rose-600 text-white',
          border: 'border-rose-300',
          indicator: 'bg-rose-500',
          icon: <AlertTriangle size={18} className="text-rose-600 shrink-0" />,
          accent: 'text-rose-600',
        };
      case 'Moderate Risk':
        return {
          bg: 'bg-amber-50 text-amber-800 border-amber-200',
          badge: 'bg-amber-500 text-white',
          border: 'border-amber-300',
          indicator: 'bg-amber-500',
          icon: <AlertCircle size={18} className="text-amber-600 shrink-0" />,
          accent: 'text-amber-600',
        };
      case 'Low Risk / On Track':
      default:
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          badge: 'bg-emerald-600 text-white',
          border: 'border-emerald-300',
          indicator: 'bg-emerald-500',
          icon: <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />,
          accent: 'text-emerald-600',
        };
    }
  };

  const statusConfig = getRiskStatusConfig(predicted_status);

  // Confidence estimation type description
  const isEnsembleVote =
    classifier_model?.toLowerCase().includes('random') ||
    classifier_model?.toLowerCase().includes('forest');
  const estimatorDescription = isEnsembleVote
    ? 'Uncalibrated ensemble vote-based confidence estimate'
    : 'Uncalibrated gradient-boosting probability estimate';

  const milestoneLabel =
    milestone === 0
      ? 'Milestone 0: Early Warning'
      : milestone === 1
      ? 'Milestone 1: Mid-Term'
      : 'Milestone 2: Pre-Final';

  return (
    <div className="space-y-6">
      {/* Primary Result Card */}
      <div className="card p-6 sm:p-8 border-slate-200 shadow-soft bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-slate-100 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="badge bg-navy-100 text-navy-800 font-bold text-xs">
                {subject}
              </span>
              <span className="badge bg-slate-100 text-slate-700 text-xs">
                {milestoneLabel}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-navy-900 tracking-tight">
              Predictive Performance Evaluation
            </h2>
            <p className="text-xs text-slate-500">
              Generated: {new Date(created_at).toLocaleString()} | ID: {prediction.id}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onReset && (
              <button
                onClick={onReset}
                className="btn btn-secondary text-xs px-3 py-1.5"
              >
                New Prediction
              </button>
            )}
          </div>
        </div>

        {/* Milestone 0 Prominent Early Warning Banner */}
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
            early_warning_advisory.actionable_guidance ||
            'Supplement this screening with verified midterm examination marks.';

          return (
            <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50/90 p-4 sm:p-5 text-amber-900">
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1.5 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-amber-950">
                      {early_warning_advisory.title || 'Milestone 0 Early Warning Advisory'}
                    </span>
                    <span className="badge bg-amber-200 text-amber-900 border-amber-300 font-mono font-bold text-[11px]">
                      Holdout False-Negative Rate: {Number(fnRate).toFixed(2)}%
                    </span>
                  </div>
                  <p className="text-amber-800 leading-relaxed">
                    {noticeText}
                  </p>
                  <p className="text-amber-900 font-medium">
                    <strong>Actionable Guidance:</strong> {guidanceText}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Model Disagreement Banner */}
        {hasModelDisagreement && (
          <div className="mb-6 rounded-xl border border-sky-300 bg-sky-50/90 p-4 text-sky-950">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <span className="font-bold text-sm text-sky-900">
                  Model Disagreement Advisory
                </span>
                <p className="text-sky-800 leading-relaxed">
                  The continuous regressor projected <strong>{predicted_marks.toFixed(1)}/100</strong> (which maps to <em>{continuousRiskTier}</em>), while the independent classifier categorized the student as <strong>{predicted_status}</strong>.
                </p>
                <p className="text-sky-700 text-[11px]">
                  Both models operate on separate loss functions (MSE optimization vs. multi-class cross-entropy). Neither prediction has been altered; both outputs are presented for comprehensive educator review.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Low Confidence Uncertainty Warning */}
        {uncertainty_warning && (
          <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <span className="font-bold text-sm text-amber-950">
                  Model Uncertainty Notice
                </span>
                <p className="text-amber-800">
                  {uncertainty_message ||
                    `Top class confidence (${(top_confidence * 100).toFixed(1)}%) is below the 55.0% threshold. Predictions in this regime should be treated with heightened caution.`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Core Predictions Grid: Regressor Marks vs Risk Classifier */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Continuous Marks Regressor Card */}
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-slate-700">
                <TrendingUp size={18} className="text-brand-600" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Projected Final Mark
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">Scale 0 - 100</span>
            </div>

            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-4xl sm:text-5xl font-black text-navy-950 font-mono tracking-tight">
                {predicted_marks.toFixed(1)}%
              </span>
              <span className="text-xs sm:text-sm text-slate-500 font-semibold font-mono">
                ({(predicted_marks / 5).toFixed(1)} / 20.0)
              </span>
            </div>

            {/* Score progress bar */}
            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden mb-3">
              <div
                className={`h-full transition-all duration-700 ${
                  predicted_marks < 50
                    ? 'bg-rose-500'
                    : predicted_marks < 70
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, predicted_marks))}%` }}
              />
            </div>

            <div className="flex justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
              <span>Failing: &lt;50.0% (&lt;10/20)</span>
              <span>Passing: 50.0–69.9%</span>
              <span>Good: ≥70.0%</span>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Model:</span>
              <span className="font-mono text-slate-600 font-medium">
                {regressor_model}
              </span>
            </div>
          </div>

          {/* Discrete Risk Classifier Card */}
          <div className={`rounded-2xl border ${statusConfig.border} ${statusConfig.bg} p-6 relative overflow-hidden`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {statusConfig.icon}
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Academic Risk Classification
                </span>
              </div>
              <span className={`badge ${statusConfig.badge} text-[11px] font-bold px-2.5 py-0.5`}>
                {predicted_status}
              </span>
            </div>

            <div className="mb-4">
              <div className="text-3xl font-extrabold tracking-tight text-navy-950 mb-1">
                {predicted_status}
              </div>
              <p className="text-xs text-slate-600">
                Top Confidence:{' '}
                <strong className="text-navy-900 font-mono">
                  {(top_confidence * 100).toFixed(1)}%
                </strong>{' '}
                <span className="text-slate-400">({estimatorDescription})</span>
              </p>
            </div>

            {/* Confidence distribution breakdown */}
            <div className="space-y-2 pt-2 border-t border-slate-200/60">
              <span className="text-[11px] font-semibold text-slate-600 block">
                Class Probability Estimates:
              </span>
              {Object.entries(confidence_scores).map(([cls, score]) => {
                const pct = (score * 100).toFixed(1);
                return (
                  <div key={cls} className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-700">
                      <span>{cls}</span>
                      <span className="font-mono font-semibold">{pct}%</span>
                    </div>
                    <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          cls.includes('High')
                            ? 'bg-rose-500'
                            : cls.includes('Moderate')
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200/60 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Classifier:</span>
              <span className="font-mono text-slate-700 font-medium">
                {classifier_model}
              </span>
            </div>
          </div>
        </div>

        {/* Metadata & Governance Footer */}
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 space-y-2">
          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <Brain size={14} className="text-brand-600" />
            <span>Model Provenance & Epistemic Uncertainty Notice</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            All confidence scores are {confidence_type.toLowerCase()}. Probabilities reflect sample proportions or log-odds in the training distribution and should not be interpreted as Bayesian posterior chances. Model decisions must be corroborated with teacher observations and formal academic assessments.
          </p>
        </div>
      </div>
    </div>
  );
};
