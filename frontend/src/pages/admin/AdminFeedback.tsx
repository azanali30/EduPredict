import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { SectionCard } from '../../components/common/SectionCard';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Button } from '../../components/forms/Button';
import {
  MessageSquare,
  CheckCircle2,
  Clock,
  Filter,
} from 'lucide-react';

interface FeedbackItem {
  id: string;
  sender: string;
  role: 'student' | 'teacher';
  subject: string;
  category: string;
  message: string;
  status: 'Open' | 'Reviewed' | 'Resolved';
  date: string;
}

export const AdminFeedback: React.FC = () => {
  const [filter, setFilter] = useState('');
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([
    {
      id: '1',
      sender: 'Dr. Maria Santos',
      role: 'teacher',
      subject: 'Mathematics',
      category: 'Curriculum & Grading',
      message: 'Requesting calibration adjustments for Milestone 1 attendance proxy weighting.',
      status: 'Open',
      date: '2026-11-18',
    },
    {
      id: '2',
      sender: 'Ali Student',
      role: 'student',
      subject: 'Portuguese Language',
      category: 'Self-Assessment',
      message: 'The early warning prediction helped me identify that my weekly study hours were below benchmark.',
      status: 'Reviewed',
      date: '2026-11-17',
    },
    {
      id: '3',
      sender: 'Prof. Joao Silva',
      role: 'teacher',
      subject: 'Portuguese Language',
      category: 'Platform Usability',
      message: 'Subject roster filtering and student profile drawer are working seamlessly in classroom review.',
      status: 'Resolved',
      date: '2026-11-15',
    },
  ]);

  const toggleStatus = (id: string) => {
    setFeedbackList((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextStatus = item.status === 'Open' ? 'Reviewed' : item.status === 'Reviewed' ? 'Resolved' : 'Open';
          return { ...item, status: nextStatus };
        }
        return item;
      })
    );
  };

  const filtered = feedbackList.filter(
    (item) => !filter || item.role === filter || item.status === filter
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feedback & User Support Inquiries"
        subtitle="Review stakeholder feedback, faculty suggestions, and student academic counseling requests."
        icon={<MessageSquare size={24} className="text-brand-royal" />}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Inquiries"
          value={feedbackList.length}
          subtitle="Submitted user feedback"
          icon={<MessageSquare size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Open Items"
          value={feedbackList.filter((f) => f.status === 'Open').length}
          subtitle="Pending administrative review"
          icon={<Clock size={20} className="text-amber-500" />}
        />
        <StatCard
          title="Resolved Items"
          value={feedbackList.filter((f) => f.status === 'Resolved').length}
          subtitle="Completed inquiries"
          icon={<CheckCircle2 size={20} className="text-emerald-500" />}
        />
      </div>

      {/* Feedback Feed */}
      <SectionCard
        title="Institutional Feedback Directory"
        subtitle="Manage user feedback items and update review statuses."
      >
        <div className="flex items-center gap-3 mb-4">
          <Filter size={16} className="text-slate-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="input py-1.5 px-3 text-xs sm:text-sm w-44"
          >
            <option value="">All Feedback Items</option>
            <option value="student">Student Inquiries</option>
            <option value="teacher">Faculty Suggestions</option>
            <option value="Open">Status: Open</option>
            <option value="Resolved">Status: Resolved</option>
          </select>
        </div>

        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-100/60 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-navy-900">{item.sender}</span>
                  <span className={`badge badge-${item.role} text-[10px] py-0.5 px-2 capitalize`}>
                    {item.role}
                  </span>
                  <span className="text-[11px] font-semibold text-brand-royal">
                    • {item.subject}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-medium">{item.category} • {item.date}</div>
                <p className="text-xs text-slate-700 leading-relaxed pt-1">{item.message}</p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge
                  status={item.status}
                  type={item.status === 'Resolved' ? 'success' : item.status === 'Reviewed' ? 'info' : 'warning'}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleStatus(item.id)}
                  className="text-xs py-1 px-2.5"
                >
                  Mark as {item.status === 'Open' ? 'Reviewed' : item.status === 'Reviewed' ? 'Resolved' : 'Open'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
};
