import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { User, StudentSubjectEnrollmentItem } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { EmptyState } from '../../components/common/EmptyState';
import { StudentProfileDrawer } from '../../components/common/StudentProfileDrawer';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/forms/Button';
import { InputField } from '../../components/forms/InputField';
import {
  GraduationCap,
  Search,
  BookOpen,
  Layers,
  Eye,
  Mail,
  Plus,
  Phone,
  Hash,
  CheckCircle2,
  UserX,
  UserCheck,
} from 'lucide-react';

export const AdminStudents: React.FC = () => {
  const [students, setStudents] = useState<User[]>([]);
  const [enrollments, setEnrollments] = useState<StudentSubjectEnrollmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);

  // Modal State for adding student
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Status updating state
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [usersRes, enrollRes] = await Promise.all([
        api.getAdminUsers('student'),
        api.adminListStudentEnrollments(),
      ]);
      setStudents(usersRes.users || []);
      setEnrollments(enrollRes.enrollments || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load student governance directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!fullName.trim()) {
      setFormError('Full name is required.');
      return;
    }
    if (!studentId.trim()) {
      setFormError('Student ID / Admission ID is required.');
      return;
    }
    if (!email.trim()) {
      setFormError('Institutional email address is required.');
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
        student_id: studentId.trim(),
        email: email.trim(),
        contact_number: contactNumber.trim() || undefined,
        password: password.trim(),
        role: 'student',
        is_active: isActive,
      });

      setSuccessMessage(`Student account '${fullName.trim()}' successfully created.`);
      setIsModalOpen(false);
      // Reset form
      setFullName('');
      setStudentId('');
      setEmail('');
      setContactNumber('');
      setPassword('');
      setIsActive(true);
      // Refresh list
      await fetchData();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create student account.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (student: User) => {
    const newStatus = !student.is_active;
    const actionLabel = newStatus ? 'activate' : 'deactivate';
    if (!window.confirm(`Are you sure you want to ${actionLabel} student account '${student.full_name}'?`)) {
      return;
    }

    setStatusUpdatingId(student.id);
    try {
      await api.adminUpdateUserStatus(student.id, newStatus);
      setSuccessMessage(`Account for '${student.full_name}' is now ${newStatus ? 'active' : 'inactive'}.`);
      await fetchData();
    } catch (err: any) {
      setError(err?.message || `Failed to ${actionLabel} student account.`);
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.student_id && s.student_id.toLowerCase().includes(search.toLowerCase()))
  );

  const activeEnrollmentsCount = enrollments.filter((e) => e.status === 'active').length;

  if (loading) {
    return <LoadingState title="Loading Student Governance Directory..." description="Retrieving student profiles and enrollments." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Management Directory"
        subtitle="Comprehensive administrative control over enrolled students, identity verification, and course enrollment records."
        icon={<GraduationCap size={24} className="text-brand-royal" />}
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
            Add Student
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
          title="Total Registered Students"
          value={students.length}
          subtitle="Active student directory accounts"
          icon={<GraduationCap size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Active Course Enrollments"
          value={activeEnrollmentsCount}
          subtitle="Total verified course registrations"
          icon={<Layers size={20} className="text-brand-ocean" />}
        />
        <StatCard
          title="Average Courses / Student"
          value={students.length > 0 ? (activeEnrollmentsCount / students.length).toFixed(1) : '0.0'}
          subtitle="Curriculum engagement density"
          icon={<BookOpen size={20} className="text-brand-mint" />}
        />
      </div>

      {/* Search and Table */}
      <SectionCard
        title="Student Identity & Enrollment Directory"
        subtitle="Search student records, inspect academic links, audit registered subjects, and create learner identities."
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
            + Add Student
          </Button>
        }
      >
        <div className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name, ID, or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 text-xs sm:text-sm"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium self-end sm:self-center">
            Showing {filteredStudents.length} of {students.length} students
          </span>
        </div>

        {filteredStudents.length === 0 ? (
          <EmptyState
            title="No Students Found"
            description={search ? `No student profiles match '${search}'.` : 'No student accounts exist in the directory.'}
            icon={<GraduationCap size={32} />}
            actionText="Register Student"
            onAction={() => setIsModalOpen(true)}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="table w-full">
              <thead>
                <tr>
                  <th className="w-1/4">Student Name</th>
                  <th className="w-1/6">Admission ID</th>
                  <th className="w-1/4">Institutional Email</th>
                  <th className="w-1/6">Active Enrollments</th>
                  <th className="w-1/12 text-center">Status</th>
                  <th className="w-1/6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const studentEnrollments = enrollments.filter(
                    (e) => e.student_id === student.id && e.status === 'active'
                  );
                  const isUpdatingThis = statusUpdatingId === student.id;
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-royal via-brand-ocean to-brand-mint text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                            {student.full_name ? student.full_name.charAt(0).toUpperCase() : 'S'}
                          </div>
                          <div>
                            <span className="font-bold text-navy-900 block leading-tight">{student.full_name}</span>
                            {student.contact_number && (
                              <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Phone size={10} />
                                {student.contact_number}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          <Hash size={11} className="text-slate-400" />
                          {student.student_id || student.id.slice(-8)}
                        </span>
                      </td>
                      <td className="text-slate-600 text-xs">
                        <span className="flex items-center gap-1.5 truncate max-w-xs">
                          <Mail size={12} className="text-slate-400 shrink-0" />
                          <span className="truncate">{student.email}</span>
                        </span>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-royal/10 text-brand-royal">
                          <BookOpen size={12} />
                          {studentEnrollments.length} subjects
                        </span>
                      </td>
                      <td className="text-center">
                        <StatusBadge
                          status={student.is_active !== false ? 'Active' : 'Inactive'}
                          type={student.is_active !== false ? 'success' : 'neutral'}
                        />
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setSelectedStudent(student)}
                            leftIcon={<Eye size={13} className="text-brand-royal" />}
                            className="text-xs py-1 px-2.5"
                          >
                            Inspect
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isUpdatingThis}
                            onClick={() => handleToggleStatus(student)}
                            leftIcon={
                              student.is_active !== false ? (
                                <UserX size={13} className="text-rose-500" />
                              ) : (
                                <UserCheck size={13} className="text-emerald-500" />
                              )
                            }
                            className={`text-xs py-1 px-2.5 ${
                              student.is_active !== false
                                ? 'hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300'
                                : 'hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300'
                            }`}
                          >
                            {student.is_active !== false ? 'Deactivate' : 'Activate'}
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

      {/* Student Profile Drawer */}
      <StudentProfileDrawer
        student={selectedStudent}
        isOpen={Boolean(selectedStudent)}
        onClose={() => setSelectedStudent(null)}
      />

      {/* Add Student Registration Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          if (!creating) setIsModalOpen(false);
        }}
        title="Register New Student Account"
      >
        <form onSubmit={handleCreateStudent} className="space-y-4">
          <ErrorAlert message={formError || ''} onDismiss={() => setFormError(null)} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="Full Name *"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Jane Doe"
              required
            />
            <InputField
              label="Student ID / Admission ID *"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              placeholder="e.g. STU-2026-001"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="Institutional Email *"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. j.doe@student.edupredict.com"
              required
            />
            <InputField
              label="Contact Number"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              placeholder="e.g. +1 555-0199"
            />
          </div>

          <InputField
            label="Initial Secure Password *"
            isPassword
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 chars with mixed case, number, symbol"
            helperText="The student will be prompted to update this password upon initial login."
            required
          />

          <div className="flex items-center gap-3 pt-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-navy-900">
              Account Status
            </label>
            <select
              value={isActive ? 'active' : 'inactive'}
              onChange={(e) => setIsActive(e.target.value === 'active')}
              className="input text-xs py-1.5 px-3 max-w-[140px]"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

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
              Create Student Account
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
