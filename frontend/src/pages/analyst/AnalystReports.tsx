import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { AnalystCurriculumStatsResponse } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { Button } from '../../components/forms/Button';
import {
  FileSpreadsheet,
  Download,
  ShieldCheck,
  Lock,
} from 'lucide-react';

export const AnalystReports: React.FC = () => {
  const [data, setData] = useState<AnalystCurriculumStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.getAnalystCurriculumStats();
        setData(res);
      } catch (err: any) {
        setError(err?.message || 'Failed to retrieve report data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const exportCSV = () => {
    if (!data?.subjects || data.subjects.length === 0) return;
    const headers = ['Subject_Code', 'Subject_Name', 'Department', 'Active_Enrollments', 'Assigned_Faculty', 'SDC_Suppressed'];
    const rows = data.subjects.map((s) => [
      `"${s.code}"`,
      `"${s.name}"`,
      `"${s.department}"`,
      `"${s.active_enrollments_display}"`,
      `"${s.assigned_teachers_display}"`,
      s.active_enrollments_suppressed || s.assigned_teachers_suppressed ? 'TRUE' : 'FALSE',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `edupredict_analyst_curriculum_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportJSON = () => {
    if (!data) return;
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edupredict_analyst_curriculum_report_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <LoadingState title="Loading Statistical Reporting Engine..." description="Compiling SDC-compliant report datasets." />;
  }

  const subjects = data?.subjects || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Statistical Reports & SDC Data Exports"
          subtitle="Generate de-identified institutional research datasets with small-cohort cell suppression."
          icon={<FileSpreadsheet size={24} className="text-brand-royal" />}
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" leftIcon={<Download size={14} />} onClick={exportJSON} className="text-xs">
            Export JSON
          </Button>
          <Button variant="primary" leftIcon={<FileSpreadsheet size={14} />} onClick={exportCSV} className="text-xs shadow-glow">
            Download CSV Export
          </Button>
        </div>
      </div>

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Exportable Disciplines"
          value={subjects.length}
          subtitle="Curriculum rows compiled"
          icon={<FileSpreadsheet size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Privacy Verification"
          value="SDC Compliant"
          subtitle="Threshold N >= 5 active"
          icon={<ShieldCheck size={20} className="text-emerald-500" />}
        />
        <StatCard
          title="Export Format"
          value="Anonymized CSV"
          subtitle="Zero student PII emitted"
          icon={<Lock size={20} className="text-brand-ocean" />}
        />
      </div>

      {/* Preview Table */}
      <SectionCard
        title="Curriculum Statistical Preview"
        subtitle="Snapshot of export data rows with cell suppression indicators."
      >
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Subject Name</th>
                <th>Department</th>
                <th>Enrollments</th>
                <th>Faculty</th>
                <th>Cell Suppression</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.subject_id}>
                  <td className="font-mono text-xs font-bold text-brand-royal">{s.code}</td>
                  <td className="font-bold text-navy-900">{s.name}</td>
                  <td>{s.department}</td>
                  <td className="font-mono text-xs font-semibold">{s.active_enrollments_display}</td>
                  <td className="font-mono text-xs font-semibold">{s.assigned_teachers_display}</td>
                  <td>
                    {s.active_enrollments_suppressed || s.assigned_teachers_suppressed ? (
                      <span className="badge bg-amber-100 text-amber-800 text-[10px] font-bold">
                        Suppressed (&lt;5)
                      </span>
                    ) : (
                      <span className="badge bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        Unsuppressed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
};
