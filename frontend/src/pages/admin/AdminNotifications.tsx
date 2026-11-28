import React, { useState } from 'react';
import { notificationsApi } from '../../services/api';
import { NotificationCenterPanel } from '../../components/common/NotificationCenterPanel';
import { SectionCard } from '../../components/common/SectionCard';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { Button } from '../../components/forms/Button';
import { InputField } from '../../components/forms/InputField';
import { CheckCircle2, Send } from 'lucide-react';

export const AdminNotifications: React.FC = () => {
  const [title, setTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [severity, setSeverity] = useState('info');
  const [targetRoles, setTargetRoles] = useState<string[]>(['student', 'teacher']);
  const [sending, setSending] = useState(false);
  const [sentInfo, setSentInfo] = useState<string | null>(null);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);

  const toggleRole = (role: string) => {
    setTargetRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !broadcastMessage.trim() || targetRoles.length === 0) {
      setBroadcastError('Title, message, and at least one recipient role are required.');
      return;
    }
    setSending(true);
    setBroadcastError(null);
    setSentInfo(null);
    try {
      const res = await notificationsApi.broadcast({
        title: title.trim(),
        message: broadcastMessage.trim(),
        severity,
        target_roles: targetRoles,
      });
      setSentInfo(`Broadcast delivered to ${res.recipient_count} active user inbox(es).`);
      setTitle('');
      setBroadcastMessage('');
      setRefreshSignal((s) => s + 1);
      window.dispatchEvent(new CustomEvent('edupredict:notifications-updated'));
    } catch (err: any) {
      setBroadcastError(err?.message || 'Failed to send broadcast notification.');
    } finally {
      setSending(false);
    }
  };

  const broadcastPanel = (
    <SectionCard
      title="Publish Institutional Broadcast"
      subtitle="Persist an announcement into targeted student, faculty, or admin inboxes."
    >
      <form onSubmit={handleBroadcast} className="space-y-3">
        <ErrorAlert message={broadcastError || ''} onDismiss={() => setBroadcastError(null)} />

        {sentInfo && (
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center gap-1.5 border border-emerald-200">
            <CheckCircle2 size={14} />
            <span>{sentInfo}</span>
          </div>
        )}

        <InputField
          label="Announcement Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Milestone 1 Evaluation Window Open"
          required
        />

        <div>
          <label className="label">Severity</label>
          <select
            aria-label="Broadcast Severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="input text-xs sm:text-sm"
          >
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div>
          <label className="label">Target Roles</label>
          <div className="flex flex-wrap gap-3 text-xs text-slate-700 pt-1">
            {(['student', 'teacher', 'admin'] as const).map((r) => (
              <label key={r} className="inline-flex items-center gap-1.5 capitalize">
                <input
                  type="checkbox"
                  checked={targetRoles.includes(r)}
                  onChange={() => toggleRole(r)}
                  className="rounded border-slate-300 text-brand-royal"
                />
                <span>{r}s</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Announcement Content</label>
          <textarea
            value={broadcastMessage}
            onChange={(e) => setBroadcastMessage(e.target.value)}
            placeholder="e.g. Mid-term Milestone 1 evaluations are open this week..."
            className="input h-28 text-xs sm:text-sm resize-none"
            required
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          leftIcon={<Send size={14} />}
          disabled={sending}
          className="w-full shadow-glow"
        >
          {sending ? 'Sending...' : 'Send Broadcast'}
        </Button>
      </form>
    </SectionCard>
  );

  return (
    <NotificationCenterPanel
      title="Notifications & Administrative Alerts"
      subtitle="Manage early-warning notifications, operational alerts, and institutional broadcasts."
      feedTitle="System & Early-Warning Alert Feed"
      feedSubtitle="Persisted alerts triggered by predictive pipelines and administrative announcements."
      sideSlot={broadcastPanel}
      refreshSignal={refreshSignal}
    />
  );
};
