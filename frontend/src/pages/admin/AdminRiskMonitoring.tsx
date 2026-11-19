import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { PredictionRecord } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { EmptyState } from '../../components/common/EmptyState';
import { PredictionDetailModal } from '../../components/predictions/PredictionDetailModal';
import { Button } from '../../components/forms/Button';
import {
  AlertTriangle,
  AlertCircle,
  Eye,
  CheckCircle,
  Filter,
  Search,
  Activity,
  ShieldAlert,
} from 'lucide-react';

export const AdminRiskMonitoring: React.FC = () => {
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inspectRecord, setInspectRecord] = useState<PredictionRecord | null>(null);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.listPredictions({ limit: 100 });
        const all = res.predictions || [];
        // Filter for High or Moderate Risk
        const riskOnly = all.filter(
          (p) => p.predicted_status === 'High Risk' || p.predicted_status === 'Moderate Risk'
        );
        setPredictions(riskOnly);
      } catch (err: any) {
        setError(err?.message || 'Failed to retrieve at-risk monitoring queue.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredPredictions = predictions.filter((p) => {
    const matchesSeverity = !severityFilter || p.predicted_status === severityFilter;
    const matchesSearch =
      !search ||
      p.subject.toLowerCase().includes(search.toLowerCase()) ||
      p.predicted_status.toLowerCase().includes(search.toLowerCase());
    return matchesSeverity && matchesSearch;
  });

  const highRiskCount = predictions.filter((p) => p.predicted_status === 'High Risk').length;
  const modRiskCount = predictions.filter((p) => p.predicted_status === 'Moderate Risk').length;

  if (loading) {
    return <LoadingState title="Loading Academic Risk & Anomaly Monitor..." description="Scanning for student attrition vulnerabilities." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Institutional Risk & Anomaly Monitoring"
        subtitle="Real-time academic attrition triage, early-warning alerts, and model-derived intervention queues."
        icon={<AlertTriangle size={24} className="text-rose-500" />}
      />

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Active Risk Flags"
          value={predictions.length}
          subtitle="Identified vulnerable records"
          icon={<ShieldAlert size={20} className="text-rose-500" />}
        />
        <StatCard
          title="High-Risk Priority Triage"
          value={highRiskCount}
          subtitle="Immediate faculty intervention recommended"
          icon={<AlertCircle size={20} className="text-rose-600" />}
        />
        <StatCard
          title="Moderate-Risk Advisories"
          value={modRiskCount}
          subtitle="Academic monitoring recommended"
          icon={<Activity size={20} className="text-amber-500" />}
        />
      </div>

      {/* Risk Triage Table */}
      <SectionCard
        title="Vulnerability Triage Queue"
        subtitle="Students exhibiting performance trajectories below curriculum passing benchmarks (< 10 / 20)."
      >
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by subject..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 text-xs sm:text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="input py-1.5 px-3 text-xs sm:text-sm w-40"
            >
              <option value="">All Risk Tiers</option>
              <option value="High Risk">High Risk Only</option>
              <option value="Moderate Risk">Moderate Risk Only</option>
            </select>
          </div>

          <span className="text-xs text-slate-500 font-medium ml-auto">
            Showing {filteredPredictions.length} flagged evaluations
          </span>
        </div>

        {filteredPredictions.length === 0 ? (
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
                {filteredPredictions.map((pred) => (
                  <tr key={pred.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="font-bold text-navy-900">{pred.subject}</td>
                    <td>
                      <span className="badge bg-slate-100 text-slate-700 text-xs font-mono">
                        Milestone {pred.milestone}
                      </span>
                    </td>
                    <td className="font-semibold text-rose-600 text-sm">
                      {(pred.predicted_final_grade ?? pred.predicted_marks ?? 0).toFixed(1)} / 20.0
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          pred.predicted_status === 'High Risk'
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

      <PredictionDetailModal
        prediction={inspectRecord}
        isOpen={Boolean(inspectRecord)}
        onClose={() => setInspectRecord(null)}
      />
    </div>
  );
};
