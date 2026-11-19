import React from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { SectionCard } from '../../components/common/SectionCard';
import { StatCard } from '../../components/common/StatCard';
import {
  Bell,
  CheckCircle2,
  Info,
  Calendar,
} from 'lucide-react';

export const StudentNotifications: React.FC = () => {
  const notifications = [
    {
      id: '1',
      title: 'Milestone 1 Mid-Term Window Open',
      category: 'Exam Schedule',
      message: 'G1 examination assessments are now active. Run an AI self-assessment prediction to see your forecast.',
      time: '3 hours ago',
      type: 'info',
    },
    {
      id: '2',
      title: 'Course Enrollment Verified',
      category: 'Registrar',
      message: 'Your course registrations for term 2026-T1 have been officially confirmed.',
      time: '1 day ago',
      type: 'success',
    },
    {
      id: '3',
      title: 'Academic Study Tips Available',
      category: 'Academic Advisory',
      message: 'Personalized recommendations generated based on your weekly study hours and past predictions.',
      time: '3 days ago',
      type: 'info',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Notifications & Announcements"
        subtitle="Stay updated on exam milestone timelines, registrar confirmations, and personalized study reminders."
        icon={<Bell size={24} className="text-brand-royal" />}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Active Notifications"
          value={notifications.length}
          subtitle="Recent announcements"
          icon={<Bell size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Current Term"
          value="2026-T1"
          subtitle="Spring Semester Cycle"
          icon={<Calendar size={20} className="text-brand-ocean" />}
        />
        <StatCard
          title="Status"
          value="All Caught Up"
          subtitle="No overdue reminders"
          icon={<CheckCircle2 size={20} className="text-emerald-500" />}
        />
      </div>

      {/* Notifications Feed */}
      <SectionCard
        title="Recent Academic Notices"
        subtitle="Updates and reminders from your instructors and system administrators."
      >
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3.5 hover:bg-slate-100/60 transition-colors"
            >
              {n.type === 'success' ? (
                <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <Info size={18} className="text-brand-ocean shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-navy-900">{n.title}</span>
                  <span className="text-[10px] text-slate-400">{n.time}</span>
                </div>
                <span className="inline-block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  {n.category}
                </span>
                <p className="text-xs text-slate-600 leading-snug">{n.message}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
};
