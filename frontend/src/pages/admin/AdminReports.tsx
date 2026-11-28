import React, { useEffect, useState } from 'react';
import { api, tableauApi } from '../../services/api';
import { PredictionRecord, TableauDatasetCatalogItem } from '../../types';
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
  const [tableauDatasets, setTableauDatasets] = useState<TableauDatasetCatalogItem[]>([]);
  const [downloadingDs, setDownloadingDs] = useState<string | null>(null);
  const [tableauMsg, setTableauMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const [predRes, tabRes] = await Promise.all([
          api.listPredictions({ limit: 100 }),
          tableauApi.listDatasets().catch(() => ({ datasets: [] })),
        ]);
        setPredictions(predRes.predictions || []);
        setTableauDatasets(tabRes.datasets || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to aggregate administrative report data.');
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  const handleTableauCsvExport = async (datasetKey: string) => {
    setDownloadingDs(datasetKey);
    setTableauMsg(null);
    setError(null);
    try {
      await tableauApi.downloadCsv(datasetKey, true);
      setTableauMsg(`Downloaded formula-safe, PII-free Tableau extract: edupredict_tableau_${datasetKey}.csv`);
    } catch (err: any) {
      setError(err?.message || 'Tableau export failed.');
    } finally {
      setDownloadingDs(null);
    }
  };

  const escapeCsvCell = (val: string) => {
    const clean = String(val ?? '');
    const neutralized = /^[=+\-@\t\r]/.test(clean) ? `'${clean}` : clean;
    return `"${neutralized.replace(/"/g, '""')}"`;
  };

  const distinctTerms = Array.from(
    new Set(predictions.map((p) => p.academic_term).filter((t): t is string => Boolean(t && t.trim())))
  );
  const termSummaryValue =
    distinctTerms.length === 0
      ? 'No records'
      : distinctTerms.length === 1
        ? distinctTerms[0]
        : `${distinctTerms.length} Active Terms`;

  const exportCSV = () => {
    if (predictions.length === 0) return;
    const headers = ['ID', 'Subject', 'Milestone', 'Predicted_Grade', 'Risk_Status', 'Academic_Term', 'Created_At'];
    const rows = predictions.map((p) => [
      escapeCsvCell(p.id),
      escapeCsvCell(p.subject),
      p.milestone,
      (p.predicted_final_grade ?? p.predicted_marks ?? 0).toFixed(2),
      escapeCsvCell(p.predicted_status),
      escapeCsvCell(p.academic_term || '--'),
      escapeCsvCell(p.created_at),
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
          title="Academic Term Scope"
          value={termSummaryValue}
          subtitle="Derived from persisted evaluations"
          icon={<Calendar size={20} className="text-brand-ocean" />}
        />
        <StatCard
          title="Export Governance"
          value="Admin Scoped"
          subtitle="Formula-safe CSV/JSON (use Analyst views for N<5 SDC)"
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
                  <td className="font-semibold text-brand-royal">
                    <div className="flex items-baseline gap-1 font-mono text-xs font-bold text-navy-950">
                      <span className="text-brand-royal text-sm">{p.predicted_marks.toFixed(1)}</span>
                      <span className="text-[10px] text-slate-400 font-normal">/ 100</span>
                    </div>
                  </td>
                  <td>
                    <span className="badge bg-slate-100 text-slate-700 text-xs">
                      {p.predicted_status}
                    </span>
                  </td>
                  <td className="font-mono text-xs">{p.academic_term || '--'}</td>
                  <td className="text-xs text-slate-500">{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Export for Tableau BI Section */}
      <SectionCard
        title="Export for Tableau BI Analytics"
        subtitle="Generate de-identified, formula-safe CSV datasets matching tableau/EduPredict_Analytics_Workbook.twb schemas."
        icon={<FileSpreadsheet size={18} className="text-emerald-600" />}
      >
        {tableauMsg && (
          <div className="mb-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 font-semibold">
            {tableauMsg}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {tableauDatasets.map((ds) => (
            <div key={ds.dataset} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between gap-3">
              <div>
                <div className="font-bold text-xs text-navy-900">{ds.title}</div>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{ds.description}</p>
                <div className="text-[10px] font-mono text-slate-400 mt-2">
                  Collections: {ds.source_collections.join(', ')}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                isLoading={downloadingDs === ds.dataset}
                leftIcon={<Download size={14} />}
                onClick={() => handleTableauCsvExport(ds.dataset)}
              >
                Export Tableau CSV
              </Button>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
};
