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
import { StudentRegistrationModal } from '../../components/admin/StudentRegistrationModal';
import { EditUserModal } from '../../components/admin/EditUserModal';
import { Button } from '../../components/forms/Button';
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
  Filter,
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

export const AdminStudents: React.FC = () => {
  const [students, setStudents] = useState<User[]>([]);
  const [enrollments, setEnrollments] = useState<StudentSubjectEnrollmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Selected Student for Drawer & Editing
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [editingStudent, setEditingStudent] = useState<User | null>(null);

  // Registration Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.student_id && s.student_id.toLowerCase().includes(search.toLowerCase()));

    const sDept = s.department || s.academic_info?.department || '';
    const matchesDept = deptFilter === 'ALL' || sDept.toLowerCase().includes(deptFilter.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && s.is_active !== false) ||
      (statusFilter === 'INACTIVE' && s.is_active === false);

    return matchesSearch && matchesDept && matchesStatus;
  });

  const activeEnrollmentsCount = enrollments.filter((e) => e.status === 'active').length;

  if (loading) {
    return <LoadingState title="Loading Student Governance Directory..." description="Retrieving student profiles and enrollments." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Management Directory"
        subtitle="Comprehensive administrative control over student identity registration, multi-section profiles, and course enrollment records."
        icon={<GraduationCap size={24} className="text-brand-royal" />}
        actions={
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={16} />}
            onClick={() => setIsModalOpen(true)}
            className="shadow-sm font-semibold"
          >
            + Add Student
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
            onClick={() => setIsModalOpen(true)}
            className="text-xs"
          >
            + Add Student
          </Button>
        }
      >
        <div className="mb-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name, ID, or email..."
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
              Showing {filteredStudents.length} of {students.length} students
            </span>
          </div>
        </div>

        {filteredStudents.length === 0 ? (
          <EmptyState
            title="No Students Found"
            description={search || deptFilter !== 'ALL' || statusFilter !== 'ALL' ? 'No student profiles match the filter criteria.' : 'No student accounts exist in the directory.'}
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
                  <th className="w-1/5">Institutional Email</th>
                  <th className="w-1/6">Department & Degree</th>
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
                  const dept = student.department || student.academic_info?.department || 'STEM & Mathematics';
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                      <td>
                        <div className="flex items-center gap-2.5">
                          {student.avatar_url ? (
                            <img
                              src={student.avatar_url}
                              alt={student.full_name}
                              className="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-2xs shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-brand-royal via-brand-ocean to-brand-mint text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                              {student.full_name ? student.full_name.charAt(0).toUpperCase() : 'S'}
                            </div>
                          )}
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
                        <span className="text-xs font-medium text-slate-700 block truncate max-w-[180px]">
                          {dept}
                        </span>
                        <span className="text-[10px] text-brand-royal font-semibold block">
                          {studentEnrollments.length} enrolled {studentEnrollments.length === 1 ? 'subject' : 'subjects'}
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
                            onClick={() => setEditingStudent(student)}
                            leftIcon={<Edit size={13} />}
                            className="text-xs py-1 px-2"
                            title="Edit student profile"
                          >
                            Edit
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
                            className={`text-xs py-1 px-2.5 ${student.is_active !== false
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
        onEditClick={(s) => {
          setSelectedStudent(null);
          setEditingStudent(s);
        }}
      />

      {/* Comprehensive Multi-Section Student Registration Modal */}
      <StudentRegistrationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={(newUser) => {
          setSuccessMessage(`Student account '${newUser.full_name}' successfully provisioned.`);
          fetchData();
        }}
      />

      {/* Edit Student Modal */}
      <EditUserModal
        isOpen={Boolean(editingStudent)}
        onClose={() => setEditingStudent(null)}
        user={editingStudent}
        onSuccess={(updated) => {
          setSuccessMessage(`Profile for '${updated.full_name}' updated successfully.`);
          fetchData();
        }}
      />
    </div>
  );
};
