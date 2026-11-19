import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { User, TeacherSubjectAssignmentItem } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { EmptyState } from '../../components/common/EmptyState';
import {
  UserCheck,
  Search,
  BookOpen,
  Mail,
  Layers,
} from 'lucide-react';

export const AdminTeachers: React.FC = () => {
  const [teachers, setTeachers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<TeacherSubjectAssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, assignRes] = await Promise.all([
          api.getAdminUsers('teacher'),
          api.adminListTeacherSubjects(),
        ]);
        setTeachers(usersRes.users || []);
        setAssignments(assignRes.assignments || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load teacher directory.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredTeachers = teachers.filter(
    (t) =>
      t.full_name.toLowerCase().includes(search.toLowerCase()) ||
      t.email.toLowerCase().includes(search.toLowerCase())
  );

  const activeAssignmentsCount = assignments.filter((a) => a.status === 'active').length;

  if (loading) {
    return <LoadingState title="Loading Teacher Directory..." description="Retrieving faculty profiles and subject allocations." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teacher Management & Faculty Directory"
        subtitle="Manage academic faculty, inspect course allocations, and govern subject teaching assignments."
        icon={<UserCheck size={24} className="text-brand-royal" />}
      />

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Faculty Members"
          value={teachers.length}
          subtitle="Registered instructor accounts"
          icon={<UserCheck size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Active Course Allocations"
          value={activeAssignmentsCount}
          subtitle="Assigned teaching sections"
          icon={<BookOpen size={20} className="text-brand-ocean" />}
        />
        <StatCard
          title="Average Workload"
          value={teachers.length > 0 ? (activeAssignmentsCount / teachers.length).toFixed(1) : '0.0'}
          subtitle="Subjects assigned per instructor"
          icon={<Layers size={20} className="text-brand-mint" />}
        />
      </div>

      {/* Faculty Directory Table */}
      <SectionCard
        title="Faculty Allocations & Teaching Workload"
        subtitle="Review assigned courses, academic term bounds, and active teaching statuses."
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search faculty by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 text-xs sm:text-sm"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Showing {filteredTeachers.length} of {teachers.length} instructors
          </span>
        </div>

        {filteredTeachers.length === 0 ? (
          <EmptyState
            title="No Teachers Found"
            description={search ? `No faculty profiles match '${search}'.` : 'No teacher accounts registered.'}
            icon={<UserCheck size={32} />}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="table">
              <thead>
                <tr>
                  <th>Faculty Member</th>
                  <th>Email</th>
                  <th>Assigned Courses</th>
                  <th>Status</th>
                  <th>Allocated Since</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map((teacher) => {
                  const teacherAllocations = assignments.filter(
                    (a) => a.teacher_id === teacher.id && a.status === 'active'
                  );
                  return (
                    <tr key={teacher.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="font-bold text-navy-900">{teacher.full_name}</td>
                      <td className="text-slate-600 text-xs">
                        <span className="flex items-center gap-1.5">
                          <Mail size={12} className="text-slate-400" />
                          {teacher.email}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {teacherAllocations.length === 0 ? (
                            <span className="text-xs text-slate-400 italic">No active courses</span>
                          ) : (
                            teacherAllocations.map((alloc) => (
                              <span
                                key={alloc.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-brand-royal/10 text-brand-royal border border-brand-royal/20"
                              >
                                {alloc.subject_name || alloc.subject_code || 'Subject'}
                                <span className="text-slate-400 font-normal">({alloc.academic_term})</span>
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td>
                        <StatusBadge
                          status={teacher.is_active !== false ? 'Active' : 'Inactive'}
                          type={teacher.is_active !== false ? 'success' : 'neutral'}
                        />
                      </td>
                      <td className="text-xs text-slate-500">
                        {teacher.created_at ? new Date(teacher.created_at).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
};
