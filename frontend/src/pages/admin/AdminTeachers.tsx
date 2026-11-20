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
import { TeacherProfileDrawer } from '../../components/common/TeacherProfileDrawer';
import { TeacherRegistrationModal } from '../../components/admin/TeacherRegistrationModal';
import { EditUserModal } from '../../components/admin/EditUserModal';
import { Button } from '../../components/forms/Button';
import {
  UserCheck,
  Search,
  BookOpen,
  Mail,
  Layers,
  Plus,
  Phone,
  Hash,
  CheckCircle2,
  UserX,
  Building,
  Filter,
  Eye,
  Edit,
} from 'lucide-react';

const DEPARTMENTS = [
  'ALL',
  'STEM & Mathematics',
  'Humanities & Languages',
  'Natural Sciences',
  'Social Sciences',
  'Computer Science & Data Analytics',
];

export const AdminTeachers: React.FC = () => {
  const [teachers, setTeachers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<TeacherSubjectAssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Drawer & Edit Modal State
  const [selectedTeacher, setSelectedTeacher] = useState<User | null>(null);
  const [editingTeacher, setEditingTeacher] = useState<User | null>(null);

  // Registration Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

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

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleStatus = async (teacher: User) => {
    const newStatus = !teacher.is_active;
    const actionLabel = newStatus ? 'activate' : 'deactivate';
    if (!window.confirm(`Are you sure you want to ${actionLabel} faculty account '${teacher.full_name}'?`)) {
      return;
    }

    setStatusUpdatingId(teacher.id);
    try {
      await api.adminUpdateUserStatus(teacher.id, newStatus);
      setSuccessMessage(`Account for '${teacher.full_name}' is now ${newStatus ? 'active' : 'inactive'}.`);
      await fetchData();
    } catch (err: any) {
      setError(err?.message || `Failed to ${actionLabel} teacher account.`);
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const filteredTeachers = teachers.filter((t) => {
    const matchesSearch =
      t.full_name.toLowerCase().includes(search.toLowerCase()) ||
      t.email.toLowerCase().includes(search.toLowerCase()) ||
      (t.employee_id && t.employee_id.toLowerCase().includes(search.toLowerCase())) ||
      (t.department && t.department.toLowerCase().includes(search.toLowerCase()));

    const tDept = t.department || t.professional_info?.department || '';
    const matchesDept = deptFilter === 'ALL' || tDept.toLowerCase().includes(deptFilter.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && t.is_active !== false) ||
      (statusFilter === 'INACTIVE' && t.is_active === false);

    return matchesSearch && matchesDept && matchesStatus;
  });

  const activeAssignmentsCount = assignments.filter((a) => a.status === 'active').length;

  if (loading) {
    return <LoadingState title="Loading Teacher Directory..." description="Retrieving faculty profiles and subject allocations." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Faculty Management Directory"
        subtitle="Manage faculty credentials, multi-section professional profiles, and inspect teaching workload allocations."
        icon={<UserCheck size={24} className="text-brand-royal" />}
        actions={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={16} />}
            onClick={() => setIsModalOpen(true)}
            className="shadow-sm font-semibold"
          >
            + Add Teacher
          </Button>
        }
      />

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-800 text-xs underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Registered Faculty"
          value={teachers.length}
          subtitle="Active faculty accounts"
          icon={<UserCheck size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Active Teaching Allocations"
          value={activeAssignmentsCount}
          subtitle="Course assignments across terms"
          icon={<BookOpen size={20} className="text-brand-ocean" />}
        />
        <StatCard
          title="Avg Workload Density"
          value={teachers.length > 0 ? (activeAssignmentsCount / teachers.length).toFixed(1) : '0.0'}
          subtitle="Courses per instructor"
          icon={<Layers size={20} className="text-brand-mint" />}
        />
      </div>

      {/* Faculty Directory Table */}
      <SectionCard
        title="Faculty Allocations & Teaching Workload"
        subtitle="Review assigned courses, academic term bounds, and active teaching statuses."
        rightAction={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() => setIsModalOpen(true)}
            className="text-xs"
          >
            + Add Teacher
          </Button>
        }
      >
        <div className="mb-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search faculty by name, ID, department, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 text-xs sm:text-sm w-full"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
              <Filter size={13} className="text-slate-400" />
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="bg-transparent text-xs text-slate-700 font-medium focus:outline-none"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept === 'ALL' ? 'All Departments' : dept}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-transparent text-xs text-slate-700 font-medium focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>
            </div>

            <span className="text-xs text-slate-500 font-medium ml-auto">
              Showing {filteredTeachers.length} of {teachers.length} faculty members
            </span>
          </div>
        </div>

        {filteredTeachers.length === 0 ? (
          <EmptyState
            title="No Teachers Found"
            description={search || deptFilter !== 'ALL' || statusFilter !== 'ALL' ? 'No faculty profiles match the filter criteria.' : 'No faculty accounts exist in the directory.'}
            icon={<UserCheck size={32} />}
            actionText="Register Teacher"
            onAction={() => setIsModalOpen(true)}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="table w-full">
              <thead>
                <tr>
                  <th className="w-1/4">Faculty Member</th>
                  <th className="w-1/6">Employee ID</th>
                  <th className="w-1/5">Department</th>
                  <th className="w-1/5">Institutional Email</th>
                  <th className="w-1/12 text-center">Status</th>
                  <th className="w-1/6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map((teacher) => {
                  const teacherAssignments = assignments.filter(
                    (a) => a.teacher_id === teacher.id && a.status === 'active'
                  );
                  const isUpdatingThis = statusUpdatingId === teacher.id;
                  const dept = teacher.department || teacher.professional_info?.department || 'STEM & Mathematics';
                  return (
                    <tr key={teacher.id} className="hover:bg-slate-50/80 transition-colors">
                      <td>
                        <div className="flex items-center gap-2.5">
                          {teacher.avatar_url ? (
                            <img
                              src={teacher.avatar_url}
                              alt={teacher.full_name}
                              className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-2xs shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-royal via-brand-ocean to-brand-mint text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                              {teacher.full_name ? teacher.full_name.charAt(0).toUpperCase() : 'T'}
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-navy-900 block leading-tight">{teacher.full_name}</span>
                            {teacher.contact_number && (
                              <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Phone size={10} />
                                {teacher.contact_number}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          <Hash size={11} className="text-slate-400" />
                          {teacher.employee_id || teacher.id.slice(-8)}
                        </span>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          <Building size={11} className="text-slate-400" />
                          {dept}
                        </span>
                        <span className="text-[10px] text-brand-royal font-semibold block mt-0.5">
                          {teacherAssignments.length} assigned {teacherAssignments.length === 1 ? 'course' : 'courses'}
                        </span>
                      </td>
                      <td className="text-slate-600 text-xs">
                        <span className="flex items-center gap-1.5 truncate max-w-xs">
                          <Mail size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">{teacher.email}</span>
                        </span>
                      </td>
                      <td className="text-center">
                        <StatusBadge
                          status={teacher.is_active !== false ? 'Active' : 'Inactive'}
                          type={teacher.is_active !== false ? 'success' : 'neutral'}
                        />
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setSelectedTeacher(teacher)}
                            leftIcon={<Eye size={13} className="text-brand-royal" />}
                            className="text-xs py-1 px-2.5"
                          >
                            Inspect
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingTeacher(teacher)}
                            leftIcon={<Edit size={13} />}
                            className="text-xs py-1 px-2"
                            title="Edit faculty profile"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isUpdatingThis}
                            onClick={() => handleToggleStatus(teacher)}
                            leftIcon={
                              teacher.is_active !== false ? (
                                <UserX size={13} className="text-rose-500" />
                              ) : (
                                <UserCheck size={13} className="text-emerald-500" />
                              )
                            }
                            className={`text-xs py-1 px-2.5 ${
                              teacher.is_active !== false
                                ? 'hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300'
                                : 'hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300'
                            }`}
                          >
                            {teacher.is_active !== false ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Teacher Profile Drawer */}
      <TeacherProfileDrawer
        teacher={selectedTeacher}
        isOpen={Boolean(selectedTeacher)}
        onClose={() => setSelectedTeacher(null)}
        assignments={assignments.filter((a) => a.teacher_id === selectedTeacher?.id && a.status === 'active')}
        onEditClick={(t) => {
          setSelectedTeacher(null);
          setEditingTeacher(t);
        }}
      />

      {/* Comprehensive Multi-Section Faculty Registration Modal */}
      <TeacherRegistrationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={(newUser) => {
          setSuccessMessage(`Faculty account '${newUser.full_name}' successfully provisioned.`);
          fetchData();
        }}
      />

      {/* Edit Teacher Modal */}
      <EditUserModal
        isOpen={Boolean(editingTeacher)}
        onClose={() => setEditingTeacher(null)}
        user={editingTeacher}
        onSuccess={(updated) => {
          setSuccessMessage(`Profile for '${updated.full_name}' updated successfully.`);
          fetchData();
        }}
      />
    </div>
  );
};
