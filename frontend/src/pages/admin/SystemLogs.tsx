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
      return <span className="badge badge-success">{eventType}</span>;
    }
    if (eventType.includes('FAILED') || eventType.includes('DENIED') || eventType.includes('SECURITY')) {
      return <span className="badge badge-danger">{eventType}</span>;
    }
    return <span className="badge badge-warning">{eventType}</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>System Security & Audit Trail</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Immutable chronological record of authentication attempts, role modifications, and admin actions
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchLogs}
          isLoading={loading}
          leftIcon={<RefreshCw size={14} />}
        >
          Refresh Logs
        </Button>
      </div>

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {loading ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <LoadingSkeleton height="40px" />
          <LoadingSkeleton height="40px" />
          <LoadingSkeleton height="40px" />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={<ShieldAlert size={36} color="var(--brand-blue)" />}
          title="No Audit Logs Recorded"
          description="Security logs will appear here as users log in, register, and update permissions."
        />
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp (UTC)</th>
                <th>Event Type</th>
                <th>Target User ID</th>
                <th>Actor Admin ID</th>
                <th>Details Payload</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id}>
                  <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                    {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}
                  </td>
                  <td>{getEventBadge(log.event_type)}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {log.user_id ? log.user_id.slice(-6) : '--'}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                    {log.actor_id ? log.actor_id.slice(-6) : '--'}
                  </td>
                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '350px' }}>
                    <code style={{ backgroundColor: 'var(--bg-subtle)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>
                      {JSON.stringify(log.details)}
                    </code>
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
