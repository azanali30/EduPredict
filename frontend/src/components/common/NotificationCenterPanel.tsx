import React, { useCallback, useEffect, useState } from 'react';
import { notificationsApi } from '../../services/api';
import { NotificationRecord } from '../../types';
import { PageHeader } from './PageHeader';
import { SectionCard } from './SectionCard';
import { StatCard } from './StatCard';
import { LoadingState } from './LoadingState';
import { ErrorAlert } from './ErrorAlert';
import { EmptyState } from './EmptyState';
import { StatusBadge } from './StatusBadge';
import { Button } from '../forms/Button';
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  Filter,
  Info,
  ShieldAlert,
} from 'lucide-react';

interface NotificationCenterPanelProps {
  title: string;
  subtitle: string;
  feedTitle: string;
  feedSubtitle: string;
  sideSlot?: React.ReactNode;
  refreshSignal?: number;
}

const formatRelativeDate = (iso?: string | null) => {
  if (!iso) return 'Just now';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
};

export const NotificationCenterPanel: React.FC<NotificationCenterPanelProps> = ({
  title,
  subtitle,
  feedTitle,
  feedSubtitle,
  sideSlot,
  refreshSignal = 0,
}) => {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [readFilter, setReadFilter] = useState<'true' | 'false' | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await notificationsApi.list({
        page,
        limit: 10,
        category: categoryFilter || undefined,
        severity: severityFilter || undefined,
        is_read: readFilter || undefined,
      });
      setNotifications(res.notifications || []);
      setTotal(res.total || 0);
      setUnreadCount(res.unread_count || 0);
      setTotalPages(res.total_pages || 1);
    } catch (err: any) {
      setError(err?.message || 'Failed to load persisted notifications.');
    } finally {
      setLoading(false);
    }
  }, [page, categoryFilter, severityFilter, readFilter, refreshSignal]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkRead = async (id: string) => {
    setActionBusy(id);
    setError(null);
    try {
      await notificationsApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, is_read: true } : item))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err: any) {
      setError(err?.message || 'Failed to mark notification as read.');
    } finally {
      setActionBusy(null);
    }
  };

  const handleMarkAllRead = async () => {
    setActionBusy('all');
    setError(null);
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);
    } catch (err: any) {
      setError(err?.message || 'Failed to mark all notifications as read.');
    } finally {
      setActionBusy(null);
    }
  };

  const renderIcon = (severity: string) => {
    if (severity === 'critical') {
      return <ShieldAlert size={18} className="text-rose-500 shrink-0 mt-0.5" />;
    }
    if (severity === 'warning') {
      return <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />;
    }
    if (severity === 'success') {
      return <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />;
    }
    return <Info size={18} className="text-brand-ocean shrink-0 mt-0.5" />;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        icon={<Bell size={24} className="text-brand-royal" />}
      />

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Unread Notifications"
          value={unreadCount}
          subtitle="Requiring attention"
          icon={<Bell size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Matching Alerts"
          value={total}
          subtitle="Persisted inbox items"
          icon={<Info size={20} className="text-brand-ocean" />}
        />
        <StatCard
          title="Critical Alerts"
          value={notifications.filter((n) => n.severity === 'critical' && !n.is_read).length}
          subtitle="Unread critical alerts on page"
          icon={<ShieldAlert size={20} className="text-rose-500" />}
        />
      </div>

      <div className={sideSlot ? 'grid grid-cols-1 lg:grid-cols-3 gap-6' : 'space-y-6'}>
        <div className={sideSlot ? 'lg:col-span-2' : ''}>
          <SectionCard
            title={feedTitle}
            subtitle={feedSubtitle}
            rightAction={
              <Button
                variant="outline"
                size="sm"
                leftIcon={<CheckCheck size={14} />}
                onClick={handleMarkAllRead}
                disabled={unreadCount === 0 || actionBusy === 'all'}
                className="text-xs"
              >
                {actionBusy === 'all' ? 'Updating...' : 'Mark All Read'}
              </Button>
            }
          >
            {/* Filter Controls */}
            <div className="flex flex-wrap items-center gap-3 mb-4 pb-3 border-b border-slate-100">
              <Filter size={15} className="text-slate-400" />
              <select
                aria-label="Filter by category"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="input py-1.5 px-3 text-xs w-44"
              >
                <option value="">All Categories</option>
                <option value="early_warning">Early Warning Alerts</option>
                <option value="dropout_risk">Dropout Risk Alerts</option>
                <option value="anomaly_alert">Anomaly Alerts</option>
                <option value="broadcast">Institutional Broadcasts</option>
                <option value="feedback_update">Ticket Updates</option>
              </select>

              <select
                aria-label="Filter by severity"
                value={severityFilter}
                onChange={(e) => {
                  setSeverityFilter(e.target.value);
                  setPage(1);
                }}
                className="input py-1.5 px-3 text-xs w-36"
              >
                <option value="">All Severities</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
                <option value="success">Success</option>
              </select>

              <select
                aria-label="Filter by read status"
                value={readFilter}
                onChange={(e) => {
                  setReadFilter(e.target.value as 'true' | 'false' | '');
                  setPage(1);
                }}
                className="input py-1.5 px-3 text-xs w-36"
              >
                <option value="">All Statuses</option>
                <option value="false">Unread Only</option>
                <option value="true">Read Only</option>
              </select>
            </div>

            {loading ? (
              <LoadingState title="Loading Notifications..." description="Fetching your persistent inbox feed." />
            ) : notifications.length === 0 ? (
              <EmptyState
                title="No notifications found"
                description="You have no persisted notifications matching the selected filters."
              />
            ) : (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-start justify-between gap-3 transition-colors ${
                      n.is_read
                        ? 'bg-slate-50/70 border-slate-100'
                        : 'bg-blue-50/50 border-brand-royal/25 shadow-sm'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {renderIcon(n.severity)}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-navy-900">{n.title}</span>
                          {!n.is_read && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-royal text-white">
                              Unread
                            </span>
                          )}
                          <StatusBadge
                            status={n.severity}
                            label={n.severity.toUpperCase()}
                            type={
                              n.severity === 'critical'
                                ? 'danger'
                                : n.severity === 'warning'
                                ? 'warning'
                                : n.severity === 'success'
                                ? 'success'
                                : 'info'
                            }
                          />
                        </div>
                        <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-1">
                          {n.category.replace(/_/g, ' ')}
                          {n.subject ? ` • ${n.subject}` : ''}
                          {' • '}
                          {formatRelativeDate(n.created_at)}
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed mt-1.5">{n.message}</p>
                      </div>
                    </div>

                    {!n.is_read && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleMarkRead(n.id)}
                        disabled={actionBusy === n.id}
                        className="text-xs shrink-0"
                      >
                        {actionBusy === n.id ? 'Marking...' : 'Mark Read'}
                      </Button>
                    )}
                  </div>
                ))}

                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-600">
                    <span>
                      Page {page} of {totalPages} ({total} total)
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="text-xs"
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="text-xs"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </SectionCard>
        </div>

        {sideSlot && <div>{sideSlot}</div>}
      </div>
    </div>
  );
};
