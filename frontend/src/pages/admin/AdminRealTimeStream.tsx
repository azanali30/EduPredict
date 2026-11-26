import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Clock, RefreshCw, RotateCcw, Send } from 'lucide-react';
import { streamApi, StreamEventItem, StreamStatusResponse } from '../../services/api';
import { PageHeader } from '../../components/common/PageHeader';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { EmptyState } from '../../components/common/EmptyState';

export const AdminRealTimeStream: React.FC = () => {
  const [statusData, setStatusData] = useState<StreamStatusResponse | null>(null);
  const [events, setEvents] = useState<StreamEventItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState<boolean>(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Manual event ingestion state
  const [studentId, setStudentId] = useState('');
  const [subject, setSubject] = useState('Mathematics');
  const [eventType, setEventType] = useState<'attendance_update' | 'assessment_result' | 'lms_activity' | 'progress_update'>('attendance_update');
  const academicTerm = '2026-Fall';
  const [numericVal, setNumericVal] = useState('2');
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestMessage, setIngestMessage] = useState<string | null>(null);
  const [ingestError, setIngestError] = useState<string | null>(null);

  const loadData = async () => {
    setError(null);
    try {
      const [st, ev] = await Promise.all([
        streamApi.getStatus(),
        streamApi.listEvents({ limit: 30 }),
      ]);
      setStatusData(st);
      setEvents(ev.events || []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load real-time streaming telemetry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/stream/events?format=sse', { withCredentials: true });
      es.onopen = () => setSseConnected(true);
      es.addEventListener('stream_event', (e: MessageEvent) => {
        try {
          const parsed: StreamEventItem = JSON.parse(e.data);
          setEvents((prev) => [parsed, ...prev.filter((x) => x.event_id !== parsed.event_id)].slice(0, 30));
          streamApi.getStatus().then(setStatusData).catch(() => {});
        } catch {
          // ignore malformed SSE frame
        }
      });
      es.onerror = () => setSseConnected(false);
    } catch {
      setSseConnected(false);
    }
    return () => {
      es?.close();
    };
  }, []);

  const handleRetry = async (eventId: string) => {
    setRetryingId(eventId);
    setError(null);
    try {
      await streamApi.retryEvent(eventId);
      await loadData();
    } catch (err: any) {
      setError(err?.message || `Failed to retry event ${eventId}.`);
    } finally {
      setRetryingId(null);
    }
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIngestError(null);
    setIngestMessage(null);
    if (!studentId.trim()) {
      setIngestError('Please provide a valid Student ObjectId.');
      return;
    }

    const valNum = Number(numericVal);
    if (Number.isNaN(valNum)) {
      setIngestError('Please enter a valid numeric value for the event metric.');
      return;
    }

    const payloadByType: Record<string, Record<string, unknown>> = {
      attendance_update: { absences: valNum },
      assessment_result: { score: valNum, max_score: 100, g1: Math.min(20, Math.round(valNum / 5)) },
      lms_activity: { activity_minutes: valNum, studytime: 2 },
      progress_update: { completion_pct: valNum, studytime: 2 },
    };

    setIngestLoading(true);
    try {
      const eventId = `ui-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const res = await streamApi.ingestEvent({
        event_id: eventId,
        event_type: eventType,
        student_id: studentId.trim(),
        subject,
        academic_term: academicTerm.trim() || '2026-Fall',
        payload: payloadByType[eventType],
      });
      setIngestMessage(`Event ${res.event.event_id} (${res.status}) processed in ${res.event.processing_latency_ms ?? 0} ms.`);
      await loadData();
    } catch (err: any) {
      setIngestError(err?.message || 'Event ingestion failed. Check the student ID and metric range.');
    } finally {
      setIngestLoading(false);
    }
  };

  if (loading) {
    return <LoadingState title="Connecting to Real-Time Stream..." description="Loading operational metrics and recent campus events." />;
  }

  const metrics = statusData?.metrics;
  const recon = statusData?.reconciliation;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Real-Time Data Stream & Monitoring"
        subtitle="Live educational event ingestion, idempotency deduplication, and batch-stream reconciliation."
        actions={
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                sseConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${sseConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              {sseConnected ? 'SSE Live Connected' : 'SSE Standby'}
            </span>
            <button
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
            >
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>
        }
      />

      {error && <ErrorAlert message={error} />}

      {/* Operational KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium uppercase">
            <span>Events Received</span>
            <Activity size={16} className="text-brand-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{metrics?.events_received ?? 0}</p>
          <p className="mt-1 text-xs text-slate-500">
            Real-time: {metrics?.realtime_events ?? 0} · Backfill: {metrics?.backfill_events ?? 0}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium uppercase">
            <span>Processed Successfully</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{metrics?.events_processed ?? 0}</p>
          <p className="mt-1 text-xs text-slate-500">
            Reconciliation: {recon?.consistent ? 'Consistent' : 'Mismatch'}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium uppercase">
            <span>Failed / Pending</span>
            <AlertTriangle size={16} className="text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {metrics?.events_failed ?? 0} <span className="text-sm font-normal text-slate-400">/ {metrics?.events_pending ?? 0}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Out-of-order: {metrics?.out_of_order_events ?? 0} · Incomplete: {metrics?.incomplete_data_events ?? 0}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium uppercase">
            <span>Avg Processing Latency</span>
            <Clock size={16} className="text-indigo-600" />
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {metrics?.average_latency_ms !== null && metrics?.average_latency_ms !== undefined
              ? `${metrics.average_latency_ms} ms`
              : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-500 truncate" title={metrics?.delivery_guarantee}>
            {metrics?.delivery_guarantee || 'At-least-once (idempotent)'}
          </p>
        </div>
      </div>

      {/* Live Event Ingestion Form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-base font-semibold text-slate-900 mb-3">Ingest Real-Time Campus Event</h3>
        {ingestError && <div className="mb-3"><ErrorAlert message={ingestError} /></div>}
        {ingestMessage && (
          <div className="mb-3 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm text-emerald-800">
            {ingestMessage}
          </div>
        )}
        <form onSubmit={handleIngest} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Student ID (ObjectId)</label>
            <input
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="e.g. 65f..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Event Type</label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as any)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
            >
              <option value="attendance_update">Attendance Update</option>
              <option value="assessment_result">Assessment Result</option>
              <option value="lms_activity">LMS Activity</option>
              <option value="progress_update">Progress Update</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white"
            >
              <option value="Mathematics">Mathematics</option>
              <option value="Portuguese Language">Portuguese Language</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              {eventType === 'attendance_update'
                ? 'Absences'
                : eventType === 'assessment_result'
                ? 'Score (0-100)'
                : eventType === 'lms_activity'
                ? 'Activity Minutes'
                : 'Completion %'}
            </label>
            <input
              type="number"
              value={numericVal}
              onChange={(e) => setNumericVal(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={ingestLoading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              <Send size={15} />
              {ingestLoading ? 'Ingesting...' : 'Send Event'}
            </button>
          </div>
        </form>
      </div>

      {/* Recent Stream Events Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-base font-semibold text-slate-900 mb-3">Recent Sanitized Stream Events</h3>
        {events.length === 0 ? (
          <EmptyState
            title="No stream events recorded yet"
            description="Ingest a real-time educational event or run a batch backfill to observe live telemetry."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-4">Event ID</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Subject</th>
                  <th className="py-2 pr-4">Source</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Flags</th>
                  <th className="py-2 pr-4">Latency</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((ev) => (
                  <tr key={ev.event_id}>
                    <td className="py-2.5 pr-4 font-mono text-xs text-slate-700">{ev.event_id}</td>
                    <td className="py-2.5 pr-4">{ev.event_type}</td>
                    <td className="py-2.5 pr-4">{ev.subject}</td>
                    <td className="py-2.5 pr-4 text-xs text-slate-500">{ev.source}</td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          ev.status === 'processed'
                            ? 'bg-emerald-50 text-emerald-700'
                            : ev.status === 'failed'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {ev.status}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-slate-500">
                      {[
                        ev.is_backfill ? 'backfill' : null,
                        ev.is_out_of_order ? 'out-of-order' : null,
                        ev.has_missing_data ? 'incomplete' : null,
                      ]
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-slate-600">
                      {ev.processing_latency_ms !== null ? `${ev.processing_latency_ms} ms` : '—'}
                    </td>
                    <td className="py-2.5">
                      {ev.status === 'failed' ? (
                        <button
                          onClick={() => handleRetry(ev.event_id)}
                          disabled={retryingId === ev.event_id}
                          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline disabled:opacity-50"
                        >
                          <RotateCcw size={13} />
                          {retryingId === ev.event_id ? 'Retrying...' : 'Retry'}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
