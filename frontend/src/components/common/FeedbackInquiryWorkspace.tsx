import React, { useCallback, useEffect, useState } from 'react';
import { feedbackApi } from '../../services/api';
import { FeedbackTicketRecord, SubjectItem } from '../../types';
import { PageHeader } from './PageHeader';
import { SectionCard } from './SectionCard';
import { StatCard } from './StatCard';
import { StatusBadge } from './StatusBadge';
import { LoadingState } from './LoadingState';
import { ErrorAlert } from './ErrorAlert';
import { EmptyState } from './EmptyState';
import { Button } from '../forms/Button';
import { InputField } from '../forms/InputField';
import { CheckCircle2, Clock, HelpCircle, MessageSquare, Send } from 'lucide-react';

interface FeedbackInquiryWorkspaceProps {
  role: 'student' | 'teacher';
  pageTitle: string;
  pageSubtitle: string;
  categories: Array<{ value: string; label: string }>;
  subjects?: SubjectItem[];
  defaultSubjectId?: string;
  statLabel: string;
  statValue: string;
  statSubtitle: string;
  guidelinesCard: React.ReactNode;
}

export const FeedbackInquiryWorkspace: React.FC<FeedbackInquiryWorkspaceProps> = ({
  role,
  pageTitle,
  pageSubtitle,
  categories,
  subjects = [],
  defaultSubjectId = '',
  statLabel,
  statValue,
  statSubtitle,
  guidelinesCard,
}) => {
  const [category, setCategory] = useState(categories[0]?.value || 'Platform Usability');
  const [subjectId, setSubjectId] = useState(defaultSubjectId);
  const [subjectTitle, setSubjectTitle] = useState('');
  const [message, setMessage] = useState('');
  const [shareWithInstructor, setShareWithInstructor] = useState(true);

  const [tickets, setTickets] = useState<FeedbackTicketRecord[]>([]);
  const [summary, setSummary] = useState({ total: 0, open: 0, reviewed: 0, resolved: 0 });
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedMsg, setSubmittedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (defaultSubjectId && !subjectId) {
      setSubjectId(defaultSubjectId);
    }
  }, [defaultSubjectId, subjectId]);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await feedbackApi.list({
        page,
        limit: 10,
        status: statusFilter || undefined,
      });
      setTickets(res.tickets || []);
      setSummary(res.summary || { total: 0, open: 0, reviewed: 0, resolved: 0 });
      setTotalPages(res.total_pages || 1);
    } catch (err: any) {
      setError(err?.message || 'Failed to load feedback history.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectTitle.trim() || !message.trim()) return;
    setSubmitting(true);
    setError(null);
    setSubmittedMsg(null);

    try {
      const payload: {
        category: string;
        title: string;
        message: string;
        subject_id?: string;
        share_with_instructor?: boolean;
      } = {
        category,
        title: subjectTitle.trim(),
        message: message.trim(),
      };
      if (subjectId) {
        payload.subject_id = subjectId;
      }
      if (role === 'student' && category === 'Academic Counseling' && subjectId) {
        payload.share_with_instructor = shareWithInstructor;
      }

      await feedbackApi.submit(payload);
      setSubmittedMsg('Inquiry submitted and persisted successfully.');
      setSubjectTitle('');
      setMessage('');
      setPage(1);
      await loadTickets();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit feedback inquiry.');
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadgeType = (status: string) =>
    status === 'Resolved' ? 'success' : status === 'Reviewed' ? 'info' : 'warning';

  return (
    <div className="space-y-6">
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        icon={<MessageSquare size={24} className="text-brand-royal" />}
      />

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title={statLabel}
          value={statValue}
          subtitle={statSubtitle}
          icon={<HelpCircle size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Open Inquiries"
          value={summary.open}
          subtitle={`${summary.reviewed} currently under review`}
          icon={<Clock size={20} className="text-amber-500" />}
        />
        <StatCard
          title="Resolved Tickets"
          value={summary.resolved}
          subtitle={`${summary.total} total persisted inquiries`}
          icon={<CheckCircle2 size={20} className="text-emerald-500" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SectionCard
            title="Submit Feedback or Support Inquiry"
            subtitle="Submit a persisted inquiry reviewed by institutional administrators."
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              {submittedMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center gap-2 border border-emerald-200">
                  <CheckCircle2 size={16} />
                  <span>{submittedMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Category</label>
                  <select
                    aria-label="Category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="input text-xs sm:text-sm"
                  >
                    {categories.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Subject (Optional)</label>
                  <select
                    aria-label="Subject"
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="input text-xs sm:text-sm"
                  >
                    <option value="">General / Non-Course Specific</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {role === 'student' && category === 'Academic Counseling' && subjectId && (
                <label className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <input
                    type="checkbox"
                    checked={shareWithInstructor}
                    onChange={(e) => setShareWithInstructor(e.target.checked)}
                    className="rounded border-slate-300 text-brand-royal"
                  />
                  <span>
                    Allow my assigned instructor for this course to view this Academic Counseling request
                  </span>
                </label>
              )}

              <InputField
                label="Topic / Subject"
                value={subjectTitle}
                onChange={(e) => setSubjectTitle(e.target.value)}
                placeholder="Summarize your inquiry or support request..."
                required
              />

              <div>
                <label className="label">Message / Details</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your inquiry, curriculum feedback, or counseling question in detail..."
                  className="input h-28 text-xs sm:text-sm resize-none"
                  required
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                leftIcon={<Send size={14} />}
                disabled={submitting}
                className="shadow-glow"
              >
                {submitting ? 'Submitting...' : 'Submit Inquiry'}
              </Button>
            </form>
          </SectionCard>
        </div>

        <div>{guidelinesCard}</div>
      </div>

      {/* Persisted Ticket History */}
      <SectionCard
        title={role === 'teacher' ? 'My Inquiries & Authorized Counseling Requests' : 'My Submitted Feedback History'}
        subtitle="Track status updates, administrative responses, and intervention notes."
        rightAction={
          <select
            aria-label="Filter ticket status"
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
        }
      >
        {loading ? (
          <LoadingState title="Loading Ticket History..." description="Retrieving persisted support inquiries." />
        ) : tickets.length === 0 ? (
          <EmptyState
            title="No feedback inquiries yet"
            description="Submitted feedback tickets and authorized counseling requests will appear here."
          />
        ) : (
          <div className="space-y-3">
            {tickets.map((t) => (
              <div key={t.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-navy-900">{t.title}</div>
                    <div className="text-[11px] text-slate-500">
                      {t.category}
                      {t.subject ? ` • ${t.subject}` : ''}
                      {role === 'teacher' && t.sender_role === 'student'
                        ? ` • Student Request (${t.sender_name})`
                        : ''}
                      {t.created_at ? ` • ${new Date(t.created_at).toLocaleString()}` : ''}
                    </div>
                  </div>
                  <StatusBadge status={t.status} label={t.status} type={statusBadgeType(t.status)} />
                </div>

                <p className="text-xs text-slate-700 leading-relaxed">{t.message}</p>

                {t.admin_response && (
                  <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-100 text-xs text-blue-950">
                    <span className="font-bold">Admin Response: </span>
                    {t.admin_response}
                  </div>
                )}

                {t.intervention_notes && (
                  <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-100 text-xs text-emerald-950">
                    <span className="font-bold">Intervention Notes: </span>
                    {t.intervention_notes}
                  </div>
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
