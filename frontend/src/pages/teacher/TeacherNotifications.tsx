import React from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { SectionCard } from '../../components/common/SectionCard';
import { StatCard } from '../../components/common/StatCard';
import { useTeacherSubject } from '../../context/TeacherSubjectContext';
import {
  Bell,
  AlertTriangle,
  Info,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

export const TeacherNotifications: React.FC = () => {
  const { selectedSubject } = useTeacherSubject();

  const notifications = [
    {
      id: '1',
      title: 'Milestone 1 Mid-Term Evaluation Window',
      category: 'Academic Calendar',
      message: `The evaluation window for ${selectedSubject?.name || 'assigned courses'} Milestone 1 is currently active. Review student G1 performance indicators.`,
      time: '2 hours ago',
      type: 'info',
    },
    {
      id: '2',
      title: 'At-Risk Early Warning Active',
      category: 'AI Pipeline',
      message: 'Students scoring below 50.0% (< 10.0 / 20.0) in milestone evaluations have been placed in your At-Risk triage queue.',
      time: '1 day ago',
      type: 'warning',
    },
    {
      id: '3',
      title: 'Subject Enrollment Verified',
      category: 'Course Administration',
      message: `Administrator confirmed the course enrollment roster for term 2026-T1 in ${selectedSubject?.code || 'your course'}.`,
      time: '2 days ago',
      type: 'success',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Classroom Notifications & Alerts"
        subtitle="Stay informed about upcoming milestone deadlines, at-risk student warnings, and curriculum notices."
        icon={<Bell size={24} className="text-brand-royal" />}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Active Notifications"
          value={notifications.length}
          subtitle="Unread classroom updates"
          icon={<Bell size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Current Term"
          value="2026-T1"
          subtitle="Spring academic cycle"
          icon={<Calendar size={20} className="text-brand-ocean" />}
        />
        <StatCard
          title="Triage Alerts"
          value="1 High Priority"
          subtitle="Requires faculty attention"
          icon={<AlertTriangle size={20} className="text-amber-500" />}
        />
      </div>

      {/* Notifications Feed */}
      <SectionCard
        title="Classroom Alert Feed"
        subtitle="Recent administrative announcements and algorithmic performance notifications."
      >
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3.5 hover:bg-slate-100/60 transition-colors"
            >
              {n.type === 'success' && <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />}
              {n.type === 'info' && <Info size={18} className="text-brand-ocean shrink-0 mt-0.5" />}
              {n.type === 'warning' && <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />}
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
