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
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/forms/Button';
import { InputField } from '../../components/forms/InputField';
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
} from 'lucide-react';

export const AdminTeachers: React.FC = () => {
  const [teachers, setTeachers] = useState<User[]>([]);
  const [assignments, setAssignments] = useState<TeacherSubjectAssignmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Modal State for adding teacher
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('STEM & Mathematics');
  const [contactNumber, setContactNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Status updating state
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

  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!fullName.trim()) {
      setFormError('Full name is required.');
      return;
    }
    if (!employeeId.trim()) {
      setFormError('Teacher / Employee ID is required.');
      return;
    }
    if (!email.trim()) {
      setFormError('Institutional faculty email address is required.');
      return;
    }
    if (!password.trim()) {
      setFormError('Initial secure password is required.');
      return;
    }
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }

    setCreating(true);
    try {
      await api.adminCreateUser({
        full_name: fullName.trim(),
        employee_id: employeeId.trim(),
        email: email.trim(),
        department: department.trim() || undefined,
        contact_number: contactNumber.trim() || undefined,
        password: password.trim(),
        role: 'teacher',
        is_active: isActive,
      });

      setSuccessMessage(`Faculty member '${fullName.trim()}' successfully created.`);
      setIsModalOpen(false);
      // Reset form
      setFullName('');
      setEmployeeId('');
      setEmail('');
      setContactNumber('');
      setPassword('');
      setIsActive(true);
      // Refresh list
      await fetchData();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create teacher account.');
    } finally {
      setCreating(false);
    }
  };

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

  const filteredTeachers = teachers.filter(
    (t) =>
      t.full_name.toLowerCase().includes(search.toLowerCase()) ||
      t.email.toLowerCase().includes(search.toLowerCase()) ||
      (t.employee_id && t.employee_id.toLowerCase().includes(search.toLowerCase())) ||
      (t.department && t.department.toLowerCase().includes(search.toLowerCase()))
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
        actions={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={16} />}
            onClick={() => {
              setFormError(null);
              setIsModalOpen(true);
            }}
            className="shadow-sm font-semibold"
          >
            Add Teacher
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
        rightAction={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() => {
              setFormError(null);
              setIsModalOpen(true);
            }}
            className="text-xs"
          >
            + Add Teacher
          </Button>
        }
      >
        <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search faculty by name, ID, department, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 text-xs sm:text-sm"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium self-end sm:self-center">
            Showing {filteredTeachers.length} of {teachers.length} instructors
          </span>
        </div>

        {filteredTeachers.length === 0 ? (
          <EmptyState
            title="No Teachers Found"
            description={search ? `No faculty profiles match '${search}'.` : 'No teacher accounts registered.'}
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
                  <th className="w-1/6">Department</th>
                  <th className="w-1/4">Email</th>
                  <th className="w-1/4">Assigned Courses</th>
                  <th className="w-1/12 text-center">Status</th>
                  <th className="w-1/12 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map((teacher) => {
                  const teacherAllocations = assignments.filter(
                    (a) => a.teacher_id === teacher.id && a.status === 'active'
                  );
                  const isUpdatingThis = statusUpdatingId === teacher.id;
                  return (
                    <tr key={teacher.id} className="hover:bg-slate-50/80 transition-colors">
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-royal via-brand-ocean to-brand-mint text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                            {teacher.full_name ? teacher.full_name.charAt(0).toUpperCase() : 'T'}
                          </div>
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
                        <span className="inline-flex items-center gap-1 text-xs text-slate-700">
                          <Building size={12} className="text-slate-400 shrink-0" />
                          <span>{teacher.department || 'General Faculty'}</span>
                        </span>
                      </td>
                      <td className="text-slate-600 text-xs">
                        <span className="flex items-center gap-1.5 truncate max-w-xs">
                          <Mail size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">{teacher.email}</span>
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
                      <td className="text-center">
                        <StatusBadge
                          status={teacher.is_active !== false ? 'Active' : 'Inactive'}
                          type={teacher.is_active !== false ? 'success' : 'neutral'}
                        />
                      </td>
                      <td className="text-right whitespace-nowrap">
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Add Teacher Registration Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          if (!creating) setIsModalOpen(false);
        }}
        title="Register New Faculty Member"
      >
        <form onSubmit={handleCreateTeacher} className="space-y-4">
          <ErrorAlert message={formError || ''} onDismiss={() => setFormError(null)} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="Full Name *"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Dr. Robert Vance"
              required
            />
            <InputField
              label="Teacher / Employee ID *"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="e.g. FAC-2026-001"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="Institutional Email *"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. r.vance@faculty.edupredict.com"
              required
            />
            <div className="flex flex-col gap-1.5 mb-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-navy-900">
                Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="input text-xs sm:text-sm py-2.5"
              >
                <option value="STEM & Mathematics">STEM & Mathematics</option>
                <option value="Humanities & Languages">Humanities & Languages</option>
                <option value="Natural Sciences">Natural Sciences</option>
                <option value="Social Sciences">Social Sciences</option>
                <option value="Computer Science & Data Analytics">Computer Science & Data Analytics</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="Contact Number"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              placeholder="e.g. +1 555-0142"
            />
            <div className="flex flex-col gap-1.5 mb-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-navy-900">
                Initial Account Status
              </label>
              <select
                value={isActive ? 'active' : 'inactive'}
                onChange={(e) => setIsActive(e.target.value === 'active')}
                className="input text-xs sm:text-sm py-2.5"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <InputField
            label="Initial Secure Password *"
            isPassword
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 chars with mixed case, number, symbol"
            helperText="The instructor will use this credential for their initial workspace authentication."
            required
          />

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="md"
              disabled={creating}
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={creating}
              leftIcon={<Plus size={16} />}
              className="shadow-glow"
            >
              Create Faculty Account
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
