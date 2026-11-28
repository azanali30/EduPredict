import React, { useCallback, useEffect, useState } from 'react';
import { feedbackApi } from '../../services/api';
import { FeedbackTicketRecord } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { SectionCard } from '../../components/common/SectionCard';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { EmptyState } from '../../components/common/EmptyState';
import { Button } from '../../components/forms/Button';
import { CheckCircle2, Clock, Filter, MessageSquare, Search } from 'lucide-react';

export const AdminFeedback: React.FC = () => {
  const [tickets, setTickets] = useState<FeedbackTicketRecord[]>([]);
  const [summary, setSummary] = useState({ total: 0, open: 0, reviewed: 0, resolved: 0 });
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<'Open' | 'Reviewed' | 'Resolved'>('Reviewed');
  const [adminResponse, setAdminResponse] = useState('');
  const [interventionNotes, setInterventionNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await feedbackApi.list({
        page,
        limit: 12,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        search: search.trim() || undefined,
      });
      setTickets(res.tickets || []);
      setSummary(res.summary || { total: 0, open: 0, reviewed: 0, resolved: 0 });
      setTotalPages(res.total_pages || 1);
    } catch (err: any) {
      setError(err?.message || 'Failed to load institutional feedback tickets.');
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, statusFilter, search]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const startReview = (ticket: FeedbackTicketRecord) => {
    setEditingId(ticket.id);
    setEditStatus(ticket.status === 'Open' ? 'Reviewed' : ticket.status);
    setAdminResponse(ticket.admin_response || '');
    setInterventionNotes(ticket.intervention_notes || '');
    setSuccessMsg(null);
    setError(null);
  };

  const handleSaveReview = async (e: React.FormEvent, ticketId: string) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await feedbackApi.updateTicket(ticketId, {
        status: editStatus,
        admin_response: adminResponse.trim(),
        intervention_notes: interventionNotes.trim(),
      });
      setEditingId(null);
      setSuccessMsg('Support ticket updated and persisted cleanly.');
      await loadTickets();
    } catch (err: any) {
      setError(err?.message || 'Failed to update ticket.');
    } finally {
      setSaving(false);
    }
  };

  const badgeType = (status: string) =>
    status === 'Resolved' ? 'success' : status === 'Reviewed' ? 'info' : 'warning';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feedback & User Support Inquiries"
        subtitle="Review persisted stakeholder feedback, counseling requests, and respond through Open -> Reviewed -> Resolved workflows."
        icon={<MessageSquare size={24} className="text-brand-royal" />}
      />

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />
      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Inquiries"
          value={summary.total}
          subtitle="Persisted feedback tickets"
          icon={<MessageSquare size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Open / In Review"
          value={summary.open + summary.reviewed}
          subtitle={`${summary.open} open · ${summary.reviewed} reviewed`}
          icon={<Clock size={20} className="text-amber-500" />}
        />
        <StatCard
          title="Resolved Items"
          value={summary.resolved}
          subtitle="Completed inquiries"
          icon={<CheckCircle2 size={20} className="text-emerald-500" />}
        />
      </div>

      <SectionCard
        title="Institutional Feedback Directory"
        subtitle="Filter submitted inquiries, post official responses, and advance ticket status."
      >
        <div className="flex flex-wrap items-center gap-3 mb-4 pb-3 border-b border-slate-100">
          <Filter size={16} className="text-slate-400" />
          <select
            aria-label="Filter by sender role"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="input py-1.5 px-3 text-xs w-40"
          >
            <option value="">All Roles</option>
            <option value="student">Students</option>
            <option value="teacher">Teachers</option>
          </select>

          <select
            aria-label="Filter by ticket status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="input py-1.5 px-3 text-xs w-40"
          >
            <option value="">All Statuses</option>
            <option value="Open">Status: Open</option>
            <option value="Reviewed">Status: Reviewed</option>
            <option value="Resolved">Status: Resolved</option>
          </select>

          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search title, sender, or content..."
              className="input py-1.5 pl-8 pr-3 text-xs w-full"
            />
          </div>
        </div>

        {loading ? (
          <LoadingState title="Loading Feedback Directory..." description="Retrieving support tickets." />
        ) : tickets.length === 0 ? (
          <EmptyState
            title="No feedback tickets found"
            description="No student or faculty inquiries match your current filter criteria."
          />
        ) : (
          <div className="space-y-3">
            {tickets.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-navy-900">{item.title}</span>
                      <span className={`badge badge-${item.sender_role} text-[10px] py-0.5 px-2 capitalize`}>
                        {item.sender_role}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-600">{item.sender_name}</span>
                      {item.subject && (
                        <span className="text-[11px] font-semibold text-brand-royal">
                          • {item.subject}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-medium">
                      {item.category}
                      {item.created_at ? ` • ${new Date(item.created_at).toLocaleString()}` : ''}
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed pt-1">{item.message}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={item.status} label={item.status} type={badgeType(item.status)} />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => (editingId === item.id ? setEditingId(null) : startReview(item))}
                      className="text-xs py-1 px-2.5"
                    >
                      {editingId === item.id ? 'Cancel' : 'Review & Respond'}
                    </Button>
                  </div>
                </div>

                {(item.admin_response || item.intervention_notes) && editingId !== item.id && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {item.admin_response && (
                      <div className="p-2.5 rounded-lg bg-blue-50/70 border border-blue-100 text-xs text-blue-950">
                        <span className="font-bold">Response: </span>
                        {item.admin_response}
                      </div>
                    )}
                    {item.intervention_notes && (
                      <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-100 text-xs text-emerald-950">
                        <span className="font-bold">Intervention Notes: </span>
                        {item.intervention_notes}
                      </div>
                    )}
                  </div>
                )}

                {editingId === item.id && (
                  <form
                    onSubmit={(e) => handleSaveReview(e, item.id)}
                    className="p-3 rounded-xl bg-white border border-slate-200 space-y-3"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="label">Ticket Status</label>
                        <select
                          aria-label="Update ticket status"
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value as 'Open' | 'Reviewed' | 'Resolved')}
                          className="input text-xs"
                        >
                          {item.status === 'Open' && <option value="Open">Open</option>}
                          {(item.status === 'Open' || item.status === 'Reviewed') && (
                            <option value="Reviewed">Reviewed</option>
                          )}
                          <option value="Resolved">Resolved</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="label">Administrator Response</label>
                      <textarea
                        value={adminResponse}
                        onChange={(e) => setAdminResponse(e.target.value)}
                        placeholder="Provide clear guidance or resolution summary..."
                        className="input h-20 text-xs resize-none"
                      />
                    </div>

                    <div>
                      <label className="label">Intervention Notes (Optional — Visible on Ticket)</label>
                      <textarea
                        value={interventionNotes}
                        onChange={(e) => setInterventionNotes(e.target.value)}
                        placeholder="Record academic follow-up or intervention steps visible to the ticket owner..."
                        className="input h-16 text-xs resize-none"
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <Button type="submit" variant="primary" size="sm" disabled={saving} className="text-xs">
                        {saving ? 'Saving...' : 'Save Review Update'}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            ))}

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-600">
                <span>
                  Page {page} of {totalPages}
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
  );
};
