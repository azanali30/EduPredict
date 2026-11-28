import React, { useEffect, useState } from 'react';
import { api, monitoringApi, BackupSummaryItem, MonitoringOverviewResponse } from '../../services/api';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  Database,
  Server,
  CheckCircle2,
  FileCode,
  Info,
  HardDriveDownload,
  ShieldCheck,
} from 'lucide-react';

export const AdminDataManagement: React.FC = () => {
  const [health, setHealth] = useState<any>(null);
  const [overview, setOverview] = useState<MonitoringOverviewResponse | null>(null);
  const [backups, setBackups] = useState<BackupSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const fetchAll = async () => {
    setError(null);
    try {
      const [hRes, mRes, bRes] = await Promise.all([
        api.getHealth(),
        monitoringApi.getOverview().catch(() => null),
        monitoringApi.listBackups().catch(() => ({ backups: [] })),
      ]);
      setHealth(hRes);
      if (mRes) setOverview(mRes);
      setBackups(bRes?.backups || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to retrieve database health telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    setError(null);
    setBackupMsg(null);
    try {
      const res = await monitoringApi.createBackup();
      setBackupMsg(`Backup ${res.backup.backup_id} created and verified (${res.backup.total_documents} docs).`);
      await fetchAll();
    } catch (err: any) {
      setError(err?.message || 'Backup creation failed.');
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleVerifyBackup = async (backupId: string) => {
    setVerifyingId(backupId);
    setError(null);
    setBackupMsg(null);
    try {
      const res = await monitoringApi.verifyBackup(backupId);
      setBackupMsg(`Backup ${res.backup_id} verified (${res.total_documents} docs across ${res.collection_count} collections).`);
    } catch (err: any) {
      setError(err?.message || `Verification failed for ${backupId}.`);
    } finally {
      setVerifyingId(null);
    }
  };

  if (loading) {
    return <LoadingState title="Loading Data Management Telemetry..." description="Inspecting MongoDB database instances and backup status." />;
  }

  const dbConnected = overview?.database?.connected ?? (health?.database?.connected || health?.status === 'healthy');
  const latestBackup = overview?.backups?.latest;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Management & Ingestion Pipelines"
        subtitle="Database connectivity monitoring, schema governance, dataset provenance, and import verification."
        icon={<Database size={24} className="text-brand-royal" />}
      />

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />
      {backupMsg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
          {backupMsg}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Database Engine"
          value={`MongoDB ${overview?.database?.server_version || '6.0'}`}
          subtitle={`${overview?.database?.total_indexes ?? 0} indexes · ${overview?.errors?.recent_system_errors ?? 0} error logs`}
          icon={<Server size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Connection & Stream Health"
          value={dbConnected ? 'Operational' : 'Disconnected'}
          subtitle={
            dbConnected
              ? `Ping ${overview?.database?.latency_ms ?? '<2'} ms · Stream failed: ${overview?.streaming?.events_failed ?? 0}`
              : 'Service offline'
          }
          icon={<CheckCircle2 size={20} className={dbConnected ? 'text-emerald-500' : 'text-rose-500'} />}
        />
        <StatCard
          title="Latest Verified Backup"
          value={latestBackup ? `${latestBackup.total_documents} docs` : 'No Backups'}
          subtitle={
            latestBackup
              ? `${latestBackup.backup_id} (${Math.round((latestBackup.archive_size || 0) / 1024)} KB)`
              : 'Run backup below or via CLI'
          }
          icon={<FileCode size={20} className="text-brand-ocean" />}
        />
      </div>

      {/* Backup & Recovery Governance (Phase 11) */}
      <SectionCard
        title="MongoDB Backup & Integrity Verification"
        subtitle="Create and verify compressed BSON snapshots. Destructive restore is restricted to the CLI confirmation workflow."
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="text-xs text-slate-500">
            Retention: latest valid archives preserved · Stream reconciliation:{' '}
            <span className="font-semibold text-slate-700">
              {overview?.reconciliation?.consistent ? 'Consistent' : 'Pending'}
            </span>
          </div>
          <button
            onClick={handleCreateBackup}
            disabled={creatingBackup}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-royal hover:bg-brand-ocean text-white px-4 py-2 text-xs font-semibold disabled:opacity-60"
          >
            <HardDriveDownload size={15} />
            {creatingBackup ? 'Creating Backup...' : 'Create Backup Snapshot'}
          </button>
        </div>

        {backups.length === 0 ? (
          <div className="text-xs text-slate-500 py-3">No backup archives found yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase">
                  <th className="py-2 pr-4">Backup ID</th>
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2 pr-4">Documents</th>
                  <th className="py-2 pr-4">Size</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {backups.slice(0, 10).map((b) => (
                  <tr key={b.backup_id}>
                    <td className="py-2 pr-4 font-mono text-navy-900">{b.backup_id}</td>
                    <td className="py-2 pr-4 text-slate-500">{b.created_at}</td>
                    <td className="py-2 pr-4">{b.total_documents}</td>
                    <td className="py-2 pr-4">{Math.round((b.archive_size || 0) / 1024)} KB</td>
                    <td className="py-2 pr-4">
                      <StatusBadge
                        status={b.archive_exists && b.verified ? 'Verified' : 'Check Required'}
                        type={b.archive_exists && b.verified ? 'success' : 'neutral'}
                      />
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => handleVerifyBackup(b.backup_id)}
                        disabled={verifyingId === b.backup_id}
                        className="inline-flex items-center gap-1 text-brand-royal font-semibold hover:underline disabled:opacity-50"
                      >
                        <ShieldCheck size={14} />
                        {verifyingId === b.backup_id ? 'Verifying...' : 'Verify'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Database Schema & Collection Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard
          title="Database Storage Governance"
          subtitle="Core operational collections persisting institutional entities."
        >
          <div className="space-y-3">
            {[
              { name: 'users', description: 'System identities & role credentials', status: 'Active' },
              { name: 'subjects', description: 'Canonical academic disciplines (Math, Portuguese)', status: 'Active' },
              { name: 'teacher_subject_assignments', description: 'Faculty-subject term allocations', status: 'Active' },
              { name: 'student_subject_enrollments', description: 'Student course registrations', status: 'Active' },
              { name: 'attendance_sessions', description: 'Verified roll-call class sessions per subject/term', status: 'Active' },
              { name: 'attendance_records', description: 'Verified student roll-call marks (isolated from ML proxy)', status: 'Active' },
              { name: 'academic_records', description: 'Institutional coursework grades & stream-synced metrics', status: 'Active' },
              { name: 'analytical_academic_records', description: 'De-identified analytical lakehouse warehouse records', status: 'Active' },
              { name: 'predictions', description: 'ML performance inference records with milestone features', status: 'Active' },
              { name: 'dropout_records', description: 'Early-warning student dropout risk classifications', status: 'Active' },
              { name: 'dropout_prediction_history', description: 'Longitudinal dropout assessment snapshots', status: 'Active' },
              { name: 'demand_forecasts', description: 'Subject enrollment demand time-series projections', status: 'Active' },
              { name: 'demand_model_metadata', description: 'Course demand forecasting model telemetry', status: 'Active' },
              { name: 'anomaly_records', description: 'Human-reviewed academic anomaly alerts', status: 'Active' },
              { name: 'model_registry', description: 'Champion model lifecycle & evaluation metadata', status: 'Active' },
              { name: 'stream_events', description: 'Idempotent real-time event streaming ingestion ledger', status: 'Active' },
              { name: 'notifications', description: 'Persistent role-scoped alerts & institutional broadcasts', status: 'Active' },
              { name: 'feedback_tickets', description: 'Student/teacher support inquiries & interventions', status: 'Active' },
              { name: 'system_logs', description: 'Redacted audit trail for administrative & security events', status: 'Active' },
              { name: 'teacher_student_assignments', description: 'Legacy linkages (Preserved read-only for audit)', status: 'Legacy Read-Only' },
            ].map((col, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
              >
                <div>
                  <div className="font-mono text-xs font-bold text-navy-900">{col.name}</div>
                  <div className="text-[11px] text-slate-500">{col.description}</div>
                </div>
                <StatusBadge
                  status={col.status}
                  type={col.status === 'Active' ? 'success' : 'neutral'}
                />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Dataset Provenance & Quality Standards"
          subtitle="Origin verification and empirical modeling constraints."
        >
          <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
            <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 text-blue-900">
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <Info size={14} className="text-brand-royal" />
                <span>Benchmark Training Data Provenance</span>
              </div>
              <p>
                EduPredict predictive pipelines are calibrated on the UCI Student Performance Dataset, collected from two secondary schools in the Alentejo region of Portugal.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
              <div className="font-bold text-navy-900">Evaluation Target Scales:</div>
              <ul className="list-disc pl-4 space-y-1 text-slate-600">
                <li>
                  <span className="font-semibold text-navy-900">Mathematics:</span> Target G3 evaluated on standard 0–20 scale ($R^2 \approx 0.83$).
                </li>
                <li>
                  <span className="font-semibold text-navy-900">Portuguese Language:</span> Target G3 evaluated on standard 0–20 scale ($R^2 \approx 0.84$).
                </li>
              </ul>
            </div>

            <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100 text-amber-900">
              <div className="font-bold mb-1">Leakage Prevention Rule</div>
              <p>
                Target variables (G3, final exam marks, pass/fail status) and future milestone marks are strictly prohibited from entering early-stage inference payloads.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
};
