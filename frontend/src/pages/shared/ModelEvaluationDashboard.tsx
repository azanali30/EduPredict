import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  CheckCircle2,
  GitBranch,
  Info,
  Layers,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { useAuth } from '../../context/AuthContext';
import { evaluationApi } from '../../services/api';
import type {
  DemandEvaluationResponse,
  DropoutEvaluationResponse,
  ModelRegistryItem,
} from '../../types';

type EvalTab = 'dropout' | 'demand' | 'registry';

export const ModelEvaluationDashboard: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState<EvalTab>('dropout');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [dropoutEval, setDropoutEval] = useState<DropoutEvaluationResponse | null>(null);
  const [demandEval, setDemandEval] = useState<DemandEvaluationResponse | null>(null);
  const [registryModels, setRegistryModels] = useState<ModelRegistryItem[]>([]);

  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [approvalNotes, setApprovalNotes] = useState<string>('');
  const [registryMessage, setRegistryMessage] = useState<string | null>(null);
  const [registryError, setRegistryError] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dropRes, demRes, regRes] = await Promise.all([
        evaluationApi.getDropoutEvaluation(),
        evaluationApi.getDemandEvaluation(),
        evaluationApi.listRegistryModels(),
      ]);
      setDropoutEval(dropRes);
      setDemandEval(demRes);
      setRegistryModels(regRes.models || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load model evaluation telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleActivate = async (modelId: string) => {
    if (!approvalNotes.trim()) {
      setRegistryError('Approval notes are required before activating a model.');
      return;
    }
    setRegistryError(null);
    setRegistryMessage(null);
    try {
      const res = await evaluationApi.activateModel(modelId, approvalNotes.trim());
      setRegistryMessage(`Activated ${res.model.model_name} (${res.model.model_version}).`);
      setActivatingId(null);
      setApprovalNotes('');
      const regRes = await evaluationApi.listRegistryModels();
      setRegistryModels(regRes.models || []);
    } catch (err: any) {
      setRegistryError(err?.message || 'Failed to activate model.');
    }
  };

  const handleDeactivate = async (modelId: string) => {
    setRegistryError(null);
    setRegistryMessage(null);
    try {
      const res = await evaluationApi.deactivateModel(modelId);
      setRegistryMessage(`Deactivated ${res.model.model_name} (${res.model.model_version}).`);
      const regRes = await evaluationApi.listRegistryModels();
      setRegistryModels(regRes.models || []);
    } catch (err: any) {
      setRegistryError(err?.message || 'Failed to deactivate model.');
    }
  };

  if (loading) {
    return (
      <LoadingState
        title="Loading Model Evaluation & Comparison..."
        description="Retrieving classification benchmarks, walk-forward demand metrics, and model registry..."
      />
    );
  }

  if (error) {
    return <ErrorState title="Model Evaluation Unavailable" message={error} onRetry={loadAll} />;
  }

  const fmtPct = (v?: number | null) =>
    v !== undefined && v !== null ? `${(v * 100).toFixed(1)}%` : 'N/A';
  const fmtNum = (v?: number | null, digits = 3) =>
    v !== undefined && v !== null ? v.toFixed(digits) : 'N/A';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Model Evaluation, Comparison & Registry"
        subtitle="Phase 8C benchmark validation, calibration diagnostics, walk-forward forecasting evaluation, and governed model lifecycle."
        icon={<Award className="text-brand-600" size={24} />}
        actions={
          <button
            onClick={loadAll}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        }
      />

      {/* Domain Tabs — Classification and Regression kept strictly separate */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('dropout')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'dropout'
              ? 'bg-brand-600 text-white'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <ShieldCheck size={16} />
          Dropout Classification
        </button>
        <button
          onClick={() => setActiveTab('demand')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'demand'
              ? 'bg-brand-600 text-white'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <TrendingUp size={16} />
          Course Demand Forecasting
        </button>
        <button
          onClick={() => setActiveTab('registry')}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'registry'
              ? 'bg-brand-600 text-white'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <GitBranch size={16} />
          Model Registry ({registryModels.length})
        </button>
      </div>

      {/* TAB 1: DROPOUT CLASSIFICATION */}
      {activeTab === 'dropout' && dropoutEval && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-sm flex items-start gap-3">
            <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-semibold">
                Benchmark Validation Notice ({dropoutEval.validation_status})
              </p>
              <p className="mt-1">{dropoutEval.benchmark_disclosure}</p>
              <p className="mt-1 text-xs text-amber-800">
                Dataset: {dropoutEval.dataset.name} · Train: {dropoutEval.dataset.train_samples} ·
                Holdout Test: {dropoutEval.dataset.test_samples} · Local Institutional Validation:{' '}
                {dropoutEval.local_institutional_validation ? 'Yes' : 'No (Pending local outcomes)'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard
              title="Champion ROC-AUC"
              value={fmtNum(dropoutEval.calibrated_champion_metrics.roc_auc)}
              subtitle={dropoutEval.champion_model}
              icon={<Award size={18} />}
            />
            <StatCard
              title="Champion PR-AUC"
              value={fmtNum(dropoutEval.calibrated_champion_metrics.pr_auc)}
              subtitle="Precision-Recall Area"
              icon={<BarChart3 size={18} />}
            />
            <StatCard
              title="F1 Score"
              value={fmtNum(dropoutEval.calibrated_champion_metrics.f1_score)}
              subtitle={`Acc: ${fmtPct(dropoutEval.calibrated_champion_metrics.accuracy)}`}
              icon={<CheckCircle2 size={18} />}
            />
            <StatCard
              title="Brier Score"
              value={fmtNum(dropoutEval.calibrated_champion_metrics.brier_score, 4)}
              subtitle="Lower is better calibrated"
              icon={<Activity size={18} />}
            />
            <StatCard
              title="Expected Calib. Error"
              value={fmtNum(dropoutEval.expected_calibration_error, 4)}
              subtitle="ECE across probability bins"
              icon={<Layers size={18} />}
            />
          </div>

          <SectionCard
            title="Candidate Classification Model Comparison"
            subtitle="Evaluated on identical UCI holdout test split"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase">
                    <th className="py-2.5 pr-4">Model</th>
                    <th className="py-2.5 px-3">Accuracy</th>
                    <th className="py-2.5 px-3">Precision</th>
                    <th className="py-2.5 px-3">Recall</th>
                    <th className="py-2.5 px-3">F1</th>
                    <th className="py-2.5 px-3">ROC-AUC</th>
                    <th className="py-2.5 px-3">PR-AUC</th>
                    <th className="py-2.5 px-3">Brier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dropoutEval.candidate_comparison.map((c) => (
                    <tr key={c.model_name} className={c.is_champion ? 'bg-brand-50/40' : ''}>
                      <td className="py-2.5 pr-4 font-medium text-slate-900">
                        {c.model_name}{' '}
                        {c.is_champion && (
                          <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-brand-100 text-brand-700">
                            Champion
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">{fmtPct(c.accuracy)}</td>
                      <td className="py-2.5 px-3">{fmtPct(c.precision)}</td>
                      <td className="py-2.5 px-3">{fmtPct(c.recall)}</td>
                      <td className="py-2.5 px-3">{fmtNum(c.f1_score)}</td>
                      <td className="py-2.5 px-3 font-semibold">{fmtNum(c.roc_auc)}</td>
                      <td className="py-2.5 px-3">{fmtNum(c.pr_auc)}</td>
                      <td className="py-2.5 px-3">{fmtNum(c.brier_score, 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard title="ROC Curve (Calibrated Champion)" subtitle="True Positive Rate vs False Positive Rate">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dropoutEval.roc_curve}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="fpr" type="number" domain={[0, 1]} tickFormatter={(v) => v.toFixed(1)} />
                    <YAxis domain={[0, 1]} tickFormatter={(v) => v.toFixed(1)} />
                    <Tooltip />
                    <Line type="monotone" dataKey="tpr" name="TPR" stroke="#2563eb" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard title="Precision-Recall Curve" subtitle="Precision across Recall thresholds">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dropoutEval.pr_curve}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="recall" type="number" domain={[0, 1]} tickFormatter={(v) => v.toFixed(1)} />
                    <YAxis domain={[0, 1]} tickFormatter={(v) => v.toFixed(1)} />
                    <Tooltip />
                    <Line type="monotone" dataKey="precision" name="Precision" stroke="#0d9488" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard title="Calibration Reliability Diagram" subtitle="Predicted probability vs observed positive fraction">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dropoutEval.calibration_curve}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="mean_predicted_probability" type="number" domain={[0, 1]} />
                    <YAxis domain={[0, 1]} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="fraction_of_positives" name="Observed Fraction" stroke="#7c3aed" strokeWidth={2} />
                    <Line type="monotone" dataKey="mean_predicted_probability" name="Ideal Diagonal" stroke="#94a3b8" strokeDasharray="4 4" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard title="Holdout Confusion Matrix" subtitle="Calibrated champion predictions at 0.50 threshold">
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                  <p className="text-xs uppercase text-emerald-700 font-semibold">True Negative (TN)</p>
                  <p className="text-2xl font-bold text-emerald-900 mt-1">
                    {dropoutEval.calibrated_champion_metrics.confusion_matrix.tn}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-center">
                  <p className="text-xs uppercase text-amber-700 font-semibold">False Positive (FP)</p>
                  <p className="text-2xl font-bold text-amber-900 mt-1">
                    {dropoutEval.calibrated_champion_metrics.confusion_matrix.fp}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-center">
                  <p className="text-xs uppercase text-rose-700 font-semibold">False Negative (FN)</p>
                  <p className="text-2xl font-bold text-rose-900 mt-1">
                    {dropoutEval.calibrated_champion_metrics.confusion_matrix.fn}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-center">
                  <p className="text-xs uppercase text-blue-700 font-semibold">True Positive (TP)</p>
                  <p className="text-2xl font-bold text-blue-900 mt-1">
                    {dropoutEval.calibrated_champion_metrics.confusion_matrix.tp}
                  </p>
                </div>
              </div>
            </SectionCard>
          </div>

          <SectionCard
            title="Top Feature Contributions"
            subtitle={dropoutEval.explainability_disclaimer}
          >
            <div className="space-y-2.5">
              {dropoutEval.feature_contributions.map((fc) => (
                <div key={fc.feature} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2">
                  <div>
                    <span className="font-medium text-slate-800">{fc.feature}</span>
                    {fc.note && <span className="ml-2 text-xs text-slate-500">({fc.note})</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        fc.direction === 'increases_risk'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {fc.direction === 'increases_risk' ? 'Increases Risk' : 'Protective'}
                    </span>
                    <span className="font-mono text-xs text-slate-700 w-16 text-right">
                      {fc.importance.toFixed(4)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* TAB 2: COURSE DEMAND FORECASTING */}
      {activeTab === 'demand' && demandEval && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-900 text-sm flex items-start gap-3">
            <Info size={18} className="shrink-0 mt-0.5 text-blue-600" />
            <div>
              <p className="font-semibold">
                Validation Methodology: {demandEval.validation_methodology} (Status: {demandEval.overall_status})
              </p>
              {demandEval.insufficient_data_notice && (
                <p className="mt-1 text-amber-800 font-medium">
                  Insufficient Data Notice: {demandEval.insufficient_data_notice}
                </p>
              )}
            </div>
          </div>

          <SectionCard
            title="Forecasting Model Comparison (Walk-Forward)"
            subtitle="Regression metrics are reported separately from dropout classification metrics"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase">
                    <th className="py-2.5 pr-4">Model</th>
                    <th className="py-2.5 px-3">Subjects</th>
                    <th className="py-2.5 px-3">MAE</th>
                    <th className="py-2.5 px-3">RMSE</th>
                    <th className="py-2.5 px-3">MAPE</th>
                    <th className="py-2.5 px-3">sMAPE</th>
                    <th className="py-2.5 px-3">Forecast Bias</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {demandEval.model_comparison.map((m) => (
                    <tr key={m.model_name}>
                      <td className="py-2.5 pr-4 font-medium text-slate-900">{m.model_name}</td>
                      <td className="py-2.5 px-3">{m.evaluated_subjects}</td>
                      <td className="py-2.5 px-3">{fmtNum(m.mae, 2)}</td>
                      <td className="py-2.5 px-3">{fmtNum(m.rmse, 2)}</td>
                      <td className="py-2.5 px-3">{m.mape !== null ? `${m.mape.toFixed(1)}%` : 'N/A'}</td>
                      <td className="py-2.5 px-3">{m.smape !== null ? `${m.smape.toFixed(1)}%` : 'N/A'}</td>
                      <td className="py-2.5 px-3">{fmtNum(m.forecast_bias, 2)}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 text-xs rounded-full bg-slate-100 text-slate-700">
                          {m.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {demandEval.actual_vs_predicted.length > 0 && (
            <SectionCard title="Actual vs Predicted Enrollment by Subject" subtitle="Latest observed term vs +1 term forecast">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={demandEval.actual_vs_predicted}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="subject_code" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="latest_actual" name="Latest Actual" fill="#64748b" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="predicted_enrollment" name="Predicted (+1T)" fill="#2563eb" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* TAB 3: MODEL REGISTRY */}
      {activeTab === 'registry' && (
        <div className="space-y-4">
          {registryMessage && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
              {registryMessage}
            </div>
          )}
          {registryError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">
              {registryError}
            </div>
          )}

          <SectionCard
            title="Governed Model Registry"
            subtitle={
              isAdmin
                ? 'Administrators can activate or deactivate models with mandatory approval notes.'
                : 'Read-only registry view for Analysts.'
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase">
                    <th className="py-2.5 pr-4">Model</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Version</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Validation</th>
                    <th className="py-2.5 px-3">Approval Notes</th>
                    {isAdmin && <th className="py-2.5 pl-3 text-right">Governance</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {registryModels.map((m) => (
                    <tr key={m.id}>
                      <td className="py-3 pr-4 font-medium text-slate-900">{m.model_name}</td>
                      <td className="py-3 px-3 uppercase text-xs">{m.model_type}</td>
                      <td className="py-3 px-3 font-mono text-xs">{m.model_version}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                            m.is_active
                              ? 'bg-emerald-100 text-emerald-700'
                              : m.deployment_status === 'staging'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {m.is_active ? 'active' : m.deployment_status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-xs text-slate-600">{m.model_status}</td>
                      <td className="py-3 px-3 text-xs text-slate-600 max-w-xs truncate">
                        {m.approval_notes || '—'}
                      </td>
                      {isAdmin && (
                        <td className="py-3 pl-3 text-right space-x-2">
                          {m.is_active ? (
                            <button
                              onClick={() => handleDeactivate(m.id)}
                              className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                            >
                              Deactivate
                            </button>
                          ) : activatingId === m.id ? (
                            <div className="inline-flex items-center gap-2">
                              <input
                                type="text"
                                value={approvalNotes}
                                onChange={(e) => setApprovalNotes(e.target.value)}
                                placeholder="Approval notes..."
                                className="px-2 py-1 text-xs border border-slate-300 rounded-md"
                              />
                              <button
                                onClick={() => handleActivate(m.id)}
                                className="px-2.5 py-1 text-xs font-medium rounded-md bg-brand-600 text-white hover:bg-brand-700"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => {
                                  setActivatingId(null);
                                  setApprovalNotes('');
                                }}
                                className="px-2 py-1 text-xs text-slate-500"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setActivatingId(m.id)}
                              className="px-2.5 py-1 text-xs font-medium rounded-md bg-brand-600 text-white hover:bg-brand-700"
                            >
                              Activate
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
};
