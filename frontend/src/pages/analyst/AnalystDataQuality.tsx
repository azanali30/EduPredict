import React from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  Database,
  CheckCircle2,
  FileCode,
  Table,
} from 'lucide-react';

export const AnalystDataQuality: React.FC = () => {
  const qualityMetrics = [
    { name: 'Mathematics Dataset (student-mat)', records: 395, features: 33, missingValues: 0, status: 'Complete' },
    { name: 'Portuguese Dataset (student-por)', records: 649, features: 33, missingValues: 0, status: 'Complete' },
    { name: 'Dual-Enrolled Intersection Cohort', records: 382, features: 33, missingValues: 0, status: 'Verified' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Quality, Completeness & Provenance"
        subtitle="Audit dataset integrity, feature schema definitions, and benchmark dataset provenance."
        icon={<Database size={24} className="text-brand-royal" />}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Completeness Rate"
          value="100.0%"
          subtitle="Zero missing feature values"
          icon={<CheckCircle2 size={20} className="text-emerald-500" />}
        />
        <StatCard
          title="Benchmark Observations"
          value="1,044 Rows"
          subtitle="Total UCI study records"
          icon={<Table size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Engineered Features"
          value="33 Variables"
          subtitle="Standardized feature vector"
          icon={<FileCode size={20} className="text-brand-ocean" />}
        />
      </div>

      {/* Dataset Ledger */}
      <SectionCard
        title="Benchmark Dataset Integrity Audit"
        subtitle="Verification status of the underlying training and evaluation datasets."
      >
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="table">
            <thead>
              <tr>
                <th>Dataset Corpus</th>
                <th>Observation Count</th>
                <th>Feature Count</th>
                <th>Missing Values</th>
                <th>Integrity Status</th>
              </tr>
            </thead>
            <tbody>
              {qualityMetrics.map((qm, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="font-bold text-navy-900">{qm.name}</td>
                  <td className="font-mono text-xs">{qm.records} rows</td>
                  <td className="font-mono text-xs">{qm.features} variables</td>
                  <td className="font-mono text-xs text-emerald-600 font-bold">{qm.missingValues} nulls</td>
                  <td>
                    <StatusBadge status={qm.status} type="success" />
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
