import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { PredictionRecord, AnomalyRecord, AnomalyReviewStatus } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { EmptyState } from '../../components/common/EmptyState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PredictionDetailModal } from '../../components/predictions/PredictionDetailModal';
import { AnomalyReviewModal } from '../../components/anomalies/AnomalyReviewModal';
import { Button } from '../../components/forms/Button';
import {
  AlertTriangle,
  AlertCircle,
  Eye,
  CheckCircle,
  Filter,
  Search,
  ShieldAlert,
  Info, 
  RefreshCw,
  Cpu,
} from 'lucide-react';

export const AdminRiskMonitoring: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'anomalies' | 'predictions'>('anomalies');

  // Anomaly Detection State (Phase 7C)
  const [anomalies, setAnomalies] = useState<AnomalyRecord[]>([]);
  const [anomaliesLoading, setAnomaliesLoading] = useState(true);
  const [anomaliesError, setAnomaliesError] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyRecord | null>(null);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchSuccessMsg, setBatchSuccessMsg] = useState<string | null>(null);

  // Supervised Predictions State
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [predLoading, setPredLoading] = useState(true);
  const [inspectRecord, setInspectRecord] = useState<PredictionRecord | null>(null);
  const [predSearch, setPredSearch] = useState('');

  const fetchAnomalies = async () => {
    setAnomaliesLoading(true);
    setAnomaliesError(null);
    try {
      const res = await api.listAnomalies({
        limit: 100,
        subject: subjectFilter || undefined,
        severity: severityFilter || undefined,
        status: statusFilter || undefined,
      });
      setAnomalies(res.anomalies || []);
    } catch (err: any) {
      setAnomaliesError(err?.message || 'Failed to retrieve academic anomaly records.');
    } finally {
      setAnomaliesLoading(false);
    }
  };

  const fetchPredictions = async () => {
    setPredLoading(true);
    try {
      const res = await api.listPredictions({ limit: 100 });
      const all = res.predictions || [];
      const riskOnly = all.filter(
        (p) => p.predicted_status === 'High Risk' || p.predicted_status === 'Moderate Risk'
      );
      setPredictions(riskOnly);
    } catch (err: any) {
      console.error('Failed to load predictions:', err);
    } finally {
      setPredLoading(false);
    }
  };

  useEffect(() => {
    fetchAnomalies();
  }, [subjectFilter, severityFilter, statusFilter]);

  useEffect(() => {
    fetchPredictions();
  }, []);

  const handleReviewSave = async (
    anomalyId: string,
    status: AnomalyReviewStatus,
    notes: string
  ) => {
    const res = await api.updateAnomalyStatus(anomalyId, {
      status,
      review_notes: notes,
    });
    setAnomalies((prev) =>
      prev.map((a) => (a.id === anomalyId ? res.anomaly : a))
    );
  };

  const handleTriggerBatchScan = async () => {
    setIsBatchRunning(true);
    setBatchSuccessMsg(null);
    setAnomaliesError(null);
    try {
      const resMath = await api.batchEvaluateAnomalies('Mathematics');
      const resPort = await api.batchEvaluateAnomalies('Portuguese Language');
      const totalEval = resMath.records_evaluated + resPort.records_evaluated;
      const totalFlagged = resMath.anomalies_detected + resPort.anomalies_detected;
      setBatchSuccessMsg(
        `Batch scan completed: Evaluated ${totalEval} records across Mathematics & Portuguese Language. ${totalFlagged} anomalies cataloged.`
      );
      await fetchAnomalies();
    } catch (err: any) {
      setAnomaliesError(err?.message || 'Failed to execute batch anomaly scan.');
    } finally {
      setIsBatchRunning(false);
    }
  };

  const pendingCount = anomalies.filter((a) => a.review_status === 'Pending Review').length;
  const confirmedCount = anomalies.filter((a) => a.review_status === 'Confirmed Anomaly').length;
  const dismissedCount = anomalies.filter((a) => a.review_status === 'Dismissed (Benign)').length;

  const getSeverityBadgeType = (sev: string) => {
    switch (sev) {
      case 'High Anomaly':
        return 'error' as const;
      case 'Moderate Anomaly':
        return 'warning' as const;
      case 'Low / Typical':
      default:
        return 'info' as const;
    }
  };

  const getStatusBadgeType = (st: string) => {
    switch (st) {
      case 'Confirmed Anomaly':
        return 'error' as const;
      case 'Dismissed (Benign)':
        return 'success' as const;
      default:
        return 'warning' as const;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Institutional Risk & Anomaly Monitoring"
        subtitle="Unsupervised anomaly detection, multi-dimensional feature divergence triage, and early warning risk signals."
        icon={<AlertTriangle size={24} className="text-rose-500" />}
      />

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('anomalies')}
          className={`pb-3 px-2 flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'anomalies'
            ? 'border-brand-600 text-brand-600'
            : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          <Cpu size={16} />
          <span>Unsupervised Anomaly Triage (Phase 7C)</span>
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-800 font-bold">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('predictions')}
          className={`pb-3 px-2 flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'predictions'
            ? 'border-brand-600 text-brand-600'
            : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
        >
          <ShieldAlert size={16} />
          <span>Supervised Risk Warnings</span>
        </button>
      </div>

      {activeTab === 'anomalies' && (
        <div className="space-y-6">
          <ErrorAlert message={anomaliesError || ''} onDismiss={() => setAnomaliesError(null)} />

          {batchSuccessMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                <span>{batchSuccessMsg}</span>
              </div>
              <button
                onClick={() => setBatchSuccessMsg(null)}
                className="text-emerald-600 hover:text-emerald-800 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Transparent Advisory Disclosure Banner */}
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 text-blue-950 text-xs flex items-start gap-3">
            <Info size={16} className="text-brand-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold">Pedagogical Anomaly Governance Notice:</span> Anomaly scores are{' '}
              <span className="font-semibold underline">uncalibrated Isolation Forest density metrics</span>, not probabilities of student failure or proof of academic misconduct. Flagged anomalies reflect atypical multi-dimensional demographic or performance configurations requiring faculty triage.
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <StatCard
              title="Flagged Anomalies"
              value={anomalies.length}
              subtitle="Cataloged atypical records"
              icon={<ShieldAlert size={20} className="text-rose-500" />}
            />
            <StatCard
              title="Pending Human Reviews"
              value={pendingCount}
              subtitle="Awaiting faculty/admin triage"
              icon={<AlertCircle size={20} className="text-amber-500" />}
            />
            <StatCard
              title="Confirmed Anomalies"
              value={confirmedCount}
              subtitle="Validated by academic reviewer"
              icon={<AlertTriangle size={20} className="text-rose-600" />}
            />
            <StatCard
              title="Dismissed (Benign)"
              value={dismissedCount}
              subtitle="Benign outlier configurations"
              icon={<CheckCircle size={20} className="text-emerald-500" />}
            />
          </div>

          {/* Anomaly Records Triage Table */}
          <SectionCard
            title="Academic Anomaly Monitoring Queue"
            subtitle="Review atypical multi-dimensional patterns detected across Mathematics and Portuguese Language cohorts."
            rightAction={
              <Button
                variant="outline"
                size="sm"
                leftIcon={<RefreshCw size={14} className={isBatchRunning ? 'animate-spin' : ''} />}
                onClick={handleTriggerBatchScan}
                isLoading={isBatchRunning}
              >
                Run Batch Anomaly Scan
              </Button>
            }
          >
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-slate-400" />
                <select
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                  className="input py-1.5 px-3 text-xs w-44"
                >
                  <option value="">All Subjects</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Portuguese Language">Portuguese Language</option>
                </select>
              </div>

              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="input py-1.5 px-3 text-xs w-44"
              >
                <option value="">All Severities</option>
                <option value="High Anomaly">High Anomaly</option>
                <option value="Moderate Anomaly">Moderate Anomaly</option>
                <option value="Low / Typical">Low / Typical</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input py-1.5 px-3 text-xs w-44"
              >
                <option value="">All Review Statuses</option>
                <option value="Pending Review">Pending Review</option>
                <option value="Confirmed Anomaly">Confirmed Anomaly</option>
                <option value="Dismissed (Benign)">Dismissed (Benign)</option>
              </select>

              <span className="text-xs text-slate-500 font-medium ml-auto">
                Showing {anomalies.length} anomaly records
              </span>
            </div>

            {anomaliesLoading ? (
              <LoadingState
                title="Loading Anomaly Monitoring Queue..."
                description="Querying isolation forest evaluated records."
              />
            ) : anomalies.length === 0 ? (
              <EmptyState
                title="No Anomaly Records Found"
                description="No records match the current filter criteria or batch evaluation has not been triggered."
                icon={<CheckCircle size={32} className="text-emerald-500" />}
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Subject & Milestone</th>
                      <th>Source Record Ref</th>
                      <th>Dataset Type</th>
                      <th>Anomaly Score (Uncalibrated)</th>
                      <th>Cohort Percentile</th>
                      <th>Severity</th>
                      <th>Supporting Deviations</th>
                      <th>Review Status</th>
                      <th className="text-right">Triage Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {anomalies.map((anom) => (
                      <tr key={anom.id} className="hover:bg-slate-50/80 transition-colors">
                        <td>
                          <div className="font-bold text-navy-900">{anom.subject}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {anom.milestone} • v{anom.model_version}
                          </div>
                        </td>
                        <td>
                          <span className="font-mono text-xs text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                            {anom.student_name ? `${anom.student_name} (${anom.source_record_id.slice(-8)})` : anom.source_record_id.slice(-12)}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              anom.is_benchmark
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {anom.is_benchmark ? 'Benchmark' : 'Institutional'}
                          </span>
                        </td>
                        <td>
                          <span className="font-mono font-bold text-xs text-rose-600">
                            {anom.anomaly_score.toFixed(4)}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1 font-mono text-xs">
                            <span className="font-bold text-navy-900">
                              {anom.cohort_percentile.toFixed(1)}%
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">rank</span>
                          </div>
                        </td>
                        <td>
                          <StatusBadge
                            status={anom.anomaly_severity}
                            type={getSeverityBadgeType(anom.anomaly_severity)}
                          />
                        </td>
                        <td className="max-w-xs">
                          {anom.supporting_deviations.length === 0 ? (
                            <span className="text-[11px] text-slate-400 italic">Multi-variate</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {anom.supporting_deviations.slice(0, 2).map((dev, i) => (
                                <span
                                  key={i}
                                  className="text-[10px] font-mono bg-amber-50 text-amber-800 border border-amber-200/60 px-1.5 py-0.5 rounded"
                                >
                                  {dev.feature}: {dev.observed_value}
                                  {dev.z_score ? ` (|Z|=${Math.abs(dev.z_score).toFixed(1)})` : ''}
                                </span>
                              ))}
                              {anom.supporting_deviations.length > 2 && (
                                <span className="text-[10px] text-slate-400 font-mono self-center">
                                  +{anom.supporting_deviations.length - 2} more
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td>
                          <StatusBadge
                            status={anom.review_status}
                            type={getStatusBadgeType(anom.review_status)}
                          />
                        </td>
                        <td className="text-right">
                          <Button
                            variant="secondary"
                            size="sm"
                            leftIcon={<Eye size={12} />}
                            onClick={() => setSelectedAnomaly(anom)}
                            className="text-xs py-1 px-2.5"
                          >
                            Review
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {activeTab === 'predictions' && (
        <div className="space-y-6">
          <SectionCard
            title="Supervised Vulnerability Triage Queue"
            subtitle="Students exhibiting performance trajectories below curriculum passing benchmarks (< 50.0% / < 10.0 / 20.0)."
          >
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-xs">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by subject..."
                  value={predSearch}
                  onChange={(e) => setPredSearch(e.target.value)}
                  className="input pl-9 text-xs sm:text-sm"
                />
              </div>

              <span className="text-xs text-slate-500 font-medium ml-auto">
                Showing {predictions.length} flagged evaluations
              </span>
            </div>

            {predLoading ? (
              <LoadingState
                title="Loading Supervised Risk Warnings..."
                description="Querying predictive models."
              />
            ) : predictions.length === 0 ? (
              <EmptyState
                title="No Active Risk Warnings"
                description="All student predictions are currently classified as Low Risk / On Track."
                icon={<CheckCircle size={32} className="text-emerald-500" />}
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Evaluation Milestone</th>
                      <th>Predicted Final Grade</th>
                      <th>Risk Tier</th>
                      <th>Advisory Rationale</th>
                      <th>Flagged Date</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {predictions
                      .filter((p) => !predSearch || p.subject.toLowerCase().includes(predSearch.toLowerCase()))
                      .map((pred) => (
                        <tr key={pred.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="font-bold text-navy-900">{pred.subject}</td>
                          <td>
                            <span className="badge bg-slate-100 text-slate-700 text-xs font-mono">
                              Milestone {pred.milestone}
                            </span>
                          </td>
                          <td className="font-semibold text-rose-600 text-sm">
                            <div className="flex items-baseline gap-1 font-mono text-xs font-bold text-rose-600">
                              <span className="text-sm">{pred.predicted_marks.toFixed(1)}</span>
                              <span className="text-[10px] text-slate-400 font-normal">/ 100</span>
                            </div>
                          </td>
                          <td>
                            <span
                              className={`badge ${pred.predicted_status === 'High Risk'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-amber-100 text-amber-800'
                                } text-[10px] font-bold`}
                            >
                              {pred.predicted_status}
                            </span>
                          </td>
                          <td className="text-xs text-slate-600 max-w-xs truncate">
                            {pred.classification_metrics?.class_distribution
                              ? `Class probability: ${(pred.classification_metrics.class_distribution[pred.predicted_status] * 100 || 0).toFixed(0)}%`
                              : 'Score < 10 threshold'}
                          </td>
                          <td className="text-xs text-slate-500">
                            {new Date(pred.created_at).toLocaleDateString()}
                          </td>
                          <td className="text-right">
                            <Button
                              variant="secondary"
                              size="sm"
                              leftIcon={<Eye size={12} />}
                              onClick={() => setInspectRecord(pred)}
                              className="text-xs py-1 px-2.5"
                            >
                              Inspect
                            </Button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* Anomaly Review Modal */}
      <AnomalyReviewModal
        isOpen={Boolean(selectedAnomaly)}
        record={selectedAnomaly}
        onClose={() => setSelectedAnomaly(null)}
        onSave={handleReviewSave}
      />

      {/* Supervised Prediction Detail Modal */}
      <PredictionDetailModal
        prediction={inspectRecord}
        isOpen={Boolean(inspectRecord)}
        onClose={() => setInspectRecord(null)}
      />
    </div>
  );
};
