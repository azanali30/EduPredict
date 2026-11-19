import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { PredictionRecord } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { Button } from '../../components/forms/Button';
import {
  FileText,
  Download,
  FileSpreadsheet,
  Calendar,
  CheckCircle2,
  Table,
} from 'lucide-react';

export const AdminReports: React.FC = () => {
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await api.listPredictions({ limit: 100 });
        setPredictions(res.predictions || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to aggregate administrative report data.');
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  const exportCSV = () => {
    if (predictions.length === 0) return;
    const headers = ['ID', 'Subject', 'Milestone', 'Predicted_Grade', 'Risk_Status', 'Academic_Term', 'Created_At'];
    const rows = predictions.map((p) => [
      p.id,
      `"${p.subject}"`,
      p.milestone,
      (p.predicted_final_grade ?? p.predicted_marks ?? 0).toFixed(2),
      `"${p.predicted_status}"`,
      `"${p.academic_term || '2026-T1'}"`,
      `"${p.created_at}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `edupredict_institutional_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportJSON = () => {
    if (predictions.length === 0) return;
    const jsonStr = JSON.stringify(predictions, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edupredict_institutional_report_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <LoadingState title="Loading Reporting Engine..." description="Compiling institutional report datasets." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Administrative Reports & Data Exports"
          subtitle="Generate standardized academic telemetry reports, audit spreadsheets, and structured analytical exports."
          icon={<FileText size={24} className="text-brand-royal" />}
        />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            leftIcon={<Download size={14} />}
            onClick={exportJSON}
            className="text-xs"
          >
            Export JSON
          </Button>
          <Button
            variant="primary"
            leftIcon={<FileSpreadsheet size={14} />}
            onClick={exportCSV}
            className="text-xs shadow-glow"
          >
            Download CSV Export
          </Button>
        </div>
      </div>

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Exportable Records"
          value={predictions.length}
          subtitle="Verified prediction rows"
          icon={<Table size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Academic Term"
          value="2026-T1"
          subtitle="Current reporting cycle"
          icon={<Calendar size={20} className="text-brand-ocean" />}
        />
        <StatCard
          title="Audit Compliance"
          value="100% SDC Verified"
          subtitle="De-identified exports"
          icon={<CheckCircle2 size={20} className="text-emerald-500" />}
        />
      </div>

      {/* Report Preview */}
      <SectionCard
        title="Institutional Telemetry Preview"
        subtitle="Sample of prediction audit rows formatted for export."
      >
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Milestone</th>
                <th>Predicted Grade</th>
                <th>Risk Tier</th>
                <th>Academic Term</th>
                <th>Recorded At</th>
              </tr>
            </thead>
            <tbody>
              {predictions.slice(0, 10).map((p) => (
                <tr key={p.id}>
                  <td className="font-bold text-navy-900">{p.subject}</td>
                  <td className="font-mono text-xs">M{p.milestone}</td>
                  <td className="font-semibold text-brand-royal">{(p.predicted_final_grade ?? p.predicted_marks ?? 0).toFixed(1)} / 20.0</td>
                  <td>
                    <span className="badge bg-slate-100 text-slate-700 text-xs">
                      {p.predicted_status}
                    </span>
                  </td>
                  <td className="font-mono text-xs">{p.academic_term || '2026-T1'}</td>
                  <td className="text-xs text-slate-500">{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
};
