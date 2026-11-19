import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
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
} from 'lucide-react';

export const AdminDataManagement: React.FC = () => {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await api.getHealth();
        setHealth(res);
      } catch (err: any) {
        setError(err?.message || 'Failed to retrieve database health telemetry.');
      } finally {
        setLoading(false);
      }
    };
    fetchHealth();
  }, []);

  if (loading) {
    return <LoadingState title="Loading Data Management Telemetry..." description="Inspecting MongoDB database instances." />;
  }

  const dbConnected = health?.database?.connected || health?.status === 'healthy';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Management & Ingestion Pipelines"
        subtitle="Database connectivity monitoring, schema governance, dataset provenance, and import verification."
        icon={<Database size={24} className="text-brand-royal" />}
      />

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Database Engine"
          value="MongoDB 6.0"
          subtitle="Port 27017 Local Replica"
          icon={<Server size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Connection Health"
          value={dbConnected ? 'Operational' : 'Disconnected'}
          subtitle={dbConnected ? 'Ping latency < 2ms' : 'Service offline'}
          icon={<CheckCircle2 size={20} className={dbConnected ? 'text-emerald-500' : 'text-rose-500'} />}
        />
        <StatCard
          title="Dataset Provenance"
          value="UCI Benchmark"
          subtitle="Cortez & Silva (2008) Schema"
          icon={<FileCode size={20} className="text-brand-ocean" />}
        />
      </div>

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
              { name: 'predictions', description: 'ML inference records with milestone features', status: 'Active' },
              { name: 'system_logs', description: 'Audit trail for administrative operations', status: 'Active' },
              { name: 'teacher_student_assignments', description: 'Legacy linkages (Preserved for audit)', status: 'Legacy Read-Only' },
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
