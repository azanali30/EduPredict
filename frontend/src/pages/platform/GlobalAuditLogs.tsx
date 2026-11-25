import React, { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { platformApi } from '../../services/api';
import type { GlobalAuditLogItem } from '../../types';

export const GlobalAuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<GlobalAuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await platformApi.getAuditLogs({ limit: 50 });
      setLogs(res.logs || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load global audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingState title="Loading Global Audit Logs..." description="Fetching platform governance events..." />;
  if (error) return <ErrorState title="Audit Logs Unavailable" message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Global Platform Audit Logs" subtitle="Security-scrubbed platform lifecycle, billing, and super-admin events." icon={<Shield size={24} className="text-brand-600" />} />
      <SectionCard title="Recent Platform Events" subtitle="Paginated immutable audit trail.">
        {logs.length === 0 ? (
          <p className="text-sm text-slate-500">No global audit events recorded.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase">
                  <th className="py-2 pr-3">Timestamp</th>
                  <th className="py-2 px-3">Action</th>
                  <th className="py-2 px-3">Actor Role</th>
                  <th className="py-2 px-3">Target Institution</th>
                  <th className="py-2 px-3">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2 pr-3 font-mono">{new Date(l.timestamp).toLocaleString()}</td>
                    <td className="py-2 px-3 font-semibold">{l.action}</td>
                    <td className="py-2 px-3">{l.actor_role}</td>
                    <td className="py-2 px-3 font-mono">{l.target_institution || '—'}</td>
                    <td className="py-2 px-3">{l.outcome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
};
