import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { PredictionRecord, SubjectItem } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { EmptyState } from '../../components/common/EmptyState';
import { PredictionDetailModal } from '../../components/predictions/PredictionDetailModal';
import { Button } from '../../components/forms/Button';
import {
  Sparkles,
  Search,
  Filter,
  Eye,
  BrainCircuit,
  AlertTriangle,
  Award,
  Layers,
} from 'lucide-react';

export const AdminPredictions: React.FC = () => {
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [subjectFilter, setSubjectFilter] = useState('');
  const [milestoneFilter, setMilestoneFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [search, setSearch] = useState('');

  // Modal
  const [inspectRecord, setInspectRecord] = useState<PredictionRecord | null>(null);

  const fetchPredictions = async () => {
    try {
      const [predsRes, subjsRes] = await Promise.all([
        api.listPredictions({ limit: 100 }),
        api.adminListSubjects(),
      ]);
      setPredictions(predsRes.predictions || []);
      setSubjects(subjsRes.subjects || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to retrieve AI predictions history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPredictions();
  }, []);

  const filteredPredictions = predictions.filter((p) => {
    const matchesSubject = !subjectFilter || p.subject === subjectFilter;
    const matchesMilestone = !milestoneFilter || p.milestone.toString() === milestoneFilter;
    const matchesRisk = !riskFilter || p.predicted_status === riskFilter;
    const matchesSearch =
      !search ||
      p.subject.toLowerCase().includes(search.toLowerCase()) ||
      p.predicted_status.toLowerCase().includes(search.toLowerCase());
    return matchesSubject && matchesMilestone && matchesRisk && matchesSearch;
  });

  if (loading) {
    return <LoadingState title="Loading AI Predictions Hub..." description="Retrieving institution-wide inference records." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Institution-Wide AI Predictions Hub"
        subtitle="Comprehensive audit trail and inspection console for all machine learning inference runs across students and subjects."
        icon={<Sparkles size={24} className="text-brand-royal" />}
      />

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          title="Total Predictions"
          value={predictions.length}
          subtitle="Inference records logged"
          icon={<BrainCircuit size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Early Warning (M0)"
          value={predictions.filter((p) => p.milestone === 0).length}
          subtitle="Demographic baseline runs"
          icon={<Layers size={20} className="text-brand-ocean" />}
        />
        <StatCard
          title="Mid-Term (M1)"
          value={predictions.filter((p) => p.milestone === 1).length}
          subtitle="G1 exam milestone runs"
          icon={<Award size={20} className="text-brand-mint" />}
        />
        <StatCard
          title="At-Risk Alerts"
          value={predictions.filter((p) => p.predicted_status === 'High Risk').length}
          subtitle="High-risk classifications"
          icon={<AlertTriangle size={20} className="text-rose-500" />}
        />
      </div>

      {/* Prediction History Table */}
      <SectionCard
        title="Predictive Model Inference Records"
        subtitle="Filter by subject discipline, evaluation milestone, or risk classification."
      >
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search predictions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 text-xs sm:text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="input py-1.5 px-3 text-xs sm:text-sm w-36"
            >
              <option value="">All Subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={milestoneFilter}
              onChange={(e) => setMilestoneFilter(e.target.value)}
              className="input py-1.5 px-3 text-xs sm:text-sm w-36"
            >
              <option value="">All Milestones</option>
              <option value="0">Milestone 0</option>
              <option value="1">Milestone 1</option>
              <option value="2">Milestone 2</option>
            </select>
          </div>

          <div>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="input py-1.5 px-3 text-xs sm:text-sm w-36"
            >
              <option value="">All Risk Tiers</option>
              <option value="High Risk">High Risk</option>
              <option value="Moderate Risk">Moderate Risk</option>
              <option value="Low Risk / On Track">Low Risk</option>
            </select>
          </div>

          <span className="text-xs text-slate-500 font-medium ml-auto">
            Showing {filteredPredictions.length} of {predictions.length} records
          </span>
        </div>

        {filteredPredictions.length === 0 ? (
          <EmptyState
            title="No Predictions Found"
            description="No prediction records match the chosen filter parameters."
            icon={<Sparkles size={32} />}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Milestone</th>
                  <th>Predicted Final Grade</th>
                  <th>Risk Tier</th>
                  <th>Confidence / R²</th>
                  <th>Recorded At</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPredictions.map((pred) => (
                  <tr key={pred.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="font-bold text-navy-900">{pred.subject}</td>
                    <td>
                      <span className="badge bg-slate-100 text-slate-700 text-xs font-mono">
                        M{pred.milestone}
                      </span>
                    </td>
                    <td className="font-semibold text-brand-royal text-sm">
                      {(pred.predicted_final_grade ?? pred.predicted_marks ?? 0).toFixed(1)} / 20.0
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          pred.predicted_status === 'High Risk'
                            ? 'bg-rose-100 text-rose-800'
                            : pred.predicted_status === 'Moderate Risk'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        } text-[10px] font-bold`}
                      >
                        {pred.predicted_status}
                      </span>
                    </td>
                    <td className="text-xs text-slate-500 font-mono">
                      {pred.regression_metrics?.r2 ? `R² = ${pred.regression_metrics.r2.toFixed(3)}` : 'Advisory Baseline'}
                    </td>
                    <td className="text-xs text-slate-500">
                      {new Date(pred.created_at).toLocaleString()}
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

      {/* Prediction Detail Modal */}
      <PredictionDetailModal
        prediction={inspectRecord}
        isOpen={Boolean(inspectRecord)}
        onClose={() => setInspectRecord(null)}
      />
    </div>
  );
};
