import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { SystemLog } from '../../types';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { Button } from '../../components/forms/Button';
import { ShieldAlert, RefreshCw } from 'lucide-react';

export const SystemLogs: React.FC = () => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getAuditLogs(50);
      setLogs(res.logs || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getEventBadge = (eventType: string) => {
    if (eventType.includes('SUCCESS') || eventType.includes('CREATED')) {
      return <span className="badge badge-success text-[10px]">{eventType}</span>;
    }
    if (eventType.includes('FAILED') || eventType.includes('DENIED') || eventType.includes('SECURITY')) {
      return <span className="badge badge-danger text-[10px]">{eventType}</span>;
    }
    return <span className="badge badge-warning text-[10px]">{eventType}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">
            System Security & Audit Trail
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Immutable chronological telemetry of authentication attempts, role modifications, and admin actions
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchLogs}
          isLoading={loading}
          leftIcon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />}
        >
          Refresh Audit Trail
        </Button>
      </div>

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* Logs Table */}
      {loading ? (
        <div className="card p-6 space-y-3">
          <LoadingSkeleton height="40px" />
          <LoadingSkeleton height="40px" />
          <LoadingSkeleton height="40px" />
          <LoadingSkeleton height="40px" />
        </div>
      ) : logs.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon={<ShieldAlert size={40} className="text-brand-500" />}
            title="No Security Logs Recorded"
            description="System events and authentication logs will appear here automatically as users interact with the application."
          />
        </div>
      ) : (
        <div className="data-table-container shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>Event Type</th>
                <th>Actor / User</th>
                <th>IP Origin</th>
                <th>Logged Timestamp (UTC)</th>
                <th>Payload Context</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, idx) => (
                <tr key={log._id || idx}>
                  <td>{getEventBadge(log.event_type)}</td>
                  <td className="font-semibold text-navy-900 text-xs">
                    {log.actor_id || log.user_id || 'System'}
                  </td>
                  <td className="font-mono text-xs text-slate-500">
                    {log.ip_address || '127.0.0.1'}
                  </td>
                  <td className="text-slate-500 text-xs">
                    {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
                  </td>
                  <td>
                    {log.details ? (
                      <pre className="font-mono text-[11px] bg-slate-100 p-1.5 rounded-lg max-w-xs overflow-x-auto text-slate-700">
                        {JSON.stringify(log.details)}
                      </pre>
                    ) : (
                      <span className="text-slate-400 text-xs">--</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
