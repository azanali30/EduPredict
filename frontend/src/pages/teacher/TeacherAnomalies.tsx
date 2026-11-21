import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { AnomalyRecord, AnomalyReviewStatus } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { EmptyState } from '../../components/common/EmptyState';
import { StatusBadge } from '../../components/common/StatusBadge';
import { AnomalyReviewModal } from '../../components/anomalies/AnomalyReviewModal';
import { Button } from '../../components/forms/Button';
import { useTeacherSubject } from '../../context/TeacherSubjectContext';
import {
  Activity,
  AlertTriangle,
  Info,
  CheckCircle,
  Eye,
  ShieldAlert,
  AlertCircle,
} from 'lucide-react';

export const TeacherAnomalies: React.FC = () => {
  const { selectedSubject, hasNoAssignments, loading: subjectsLoading } =
    useTeacherSubject();

  const [anomalies, setAnomalies] = useState<AnomalyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchAnomalies = async () => {
    if (subjectsLoading) return;
    if (hasNoAssignments || !selectedSubject?.name) {
      setAnomalies([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.listAnomalies({
        subject: selectedSubject.name,
        status: statusFilter || undefined,
        limit: 100,
      });
      setAnomalies(res.anomalies || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to retrieve subject anomaly records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnomalies();
  }, [selectedSubject, subjectsLoading, hasNoAssignments, statusFilter]);

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

  if (loading || subjectsLoading) {
    return (
      <LoadingState
        title="Loading Subject Anomaly Monitor..."
        description="Auditing student performance and feature divergence trajectories."
      />
    );
  }

  const pendingCount = anomalies.filter((a) => a.review_status === 'Pending Review').length;
  const confirmedCount = anomalies.filter((a) => a.review_status === 'Confirmed Anomaly').length;
  const dismissedCount = anomalies.filter((a) => a.review_status === 'Dismissed (Benign)').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Classroom Anomaly & Discrepancy Monitor — ${selectedSubject?.name || 'Subject'}`}
        subtitle="Detect atypical student learning patterns, multi-dimensional feature divergence, and review outlier signals."
        icon={<Activity size={24} className="text-brand-royal" />}
      />

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* Transparent Advisory Disclosure Banner */}
      <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 text-blue-950 text-xs flex items-start gap-3">
        <Info size={16} className="text-brand-royal shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold">Pedagogical Governance Notice:</span> Anomaly alerts represent{' '}
          <span className="font-semibold underline">unsupervised Isolation Forest divergence</span> in student learning features. Anomaly scores are relative density rankings, NOT probabilities of academic failure or evidence of misconduct. Faculty review and supportive academic mentorship are required.
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          title="Flagged Anomalies"
          value={anomalies.length}
          subtitle={`Active in ${selectedSubject?.code || 'course'}`}
          icon={<ShieldAlert size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Pending Review"
          value={pendingCount}
          subtitle="Awaiting your faculty triage"
          icon={<AlertCircle size={20} className="text-amber-500" />}
        />
        <StatCard
          title="Confirmed Anomalies"
          value={confirmedCount}
          subtitle="Flagged for pedagogical review"
          icon={<AlertTriangle size={20} className="text-rose-500" />}
        />
        <StatCard
          title="Dismissed (Benign)"
          value={dismissedCount}
          subtitle="Evaluated as benign outliers"
          icon={<CheckCircle size={20} className="text-emerald-500" />}
        />
      </div>

      {/* Anomalies Table */}
      <SectionCard
        title="Detected Classroom Anomaly Records"
        subtitle={`Review identified feature anomalies within your assigned subject (${selectedSubject?.name || 'N/A'}).`}
      >
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input py-1.5 px-3 text-xs w-48"
          >
            <option value="">All Review Statuses</option>
            <option value="Pending Review">Pending Review Only</option>
            <option value="Confirmed Anomaly">Confirmed Anomaly Only</option>
            <option value="Dismissed (Benign)">Dismissed (Benign) Only</option>
          </select>

          <span className="text-xs text-slate-500 font-medium ml-auto">
            Showing {anomalies.length} records for {selectedSubject?.name}
          </span>
        </div>

        {anomalies.length === 0 ? (
          <EmptyState
            title="No Anomaly Signals Detected"
            description={`No atypical learning patterns or isolation anomalies currently recorded for ${selectedSubject?.name || 'this subject'}.`}
            icon={<CheckCircle size={32} className="text-emerald-500" />}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="table">
              <thead>
                <tr>
                  <th>Milestone & Record</th>
                  <th>Anomaly Score (Uncalibrated)</th>
                  <th>Cohort Percentile</th>
                  <th>Severity</th>
                  <th>Supporting Statistical Deviations</th>
                  <th>Review Status</th>
                  <th className="text-right">Faculty Triage</th>
                </tr>
              </thead>
              <tbody>
                {anomalies.map((anom) => (
                  <tr key={anom.id} className="hover:bg-slate-50/80 transition-colors">
                    <td>
                      <div className="font-bold text-navy-900">{anom.milestone}</div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Ref: {anom.source_record_id.slice(-8)}
                      </div>
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
                        <span className="text-[11px] text-slate-400 italic">Multi-dimensional</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {anom.supporting_deviations.map((dev, i) => (
                            <span
                              key={i}
                              className="text-[10px] font-mono bg-amber-50 text-amber-900 border border-amber-200/60 px-1.5 py-0.5 rounded"
                            >
                              {dev.feature}: {dev.observed_value}
                              {dev.z_score ? ` (|Z|=${Math.abs(dev.z_score).toFixed(1)})` : ''}
                            </span>
                          ))}
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

      {/* Review Modal */}
      <AnomalyReviewModal
        isOpen={Boolean(selectedAnomaly)}
        record={selectedAnomaly}
        onClose={() => setSelectedAnomaly(null)}
        onSave={handleReviewSave}
      />
    </div>
  );
};
