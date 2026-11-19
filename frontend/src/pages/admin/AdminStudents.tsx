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
import {
  GraduationCap,
  Search,
  BookOpen,
  Layers,
  Eye,
  Mail,
} from 'lucide-react';

export const AdminStudents: React.FC = () => {
  const [students, setStudents] = useState<User[]>([]);
  const [enrollments, setEnrollments] = useState<StudentSubjectEnrollmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);

  useEffect(() => {
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
    fetchData();
  }, []);

  const filteredStudents = students.filter(
    (s) =>
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase())
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
      />

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

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
        subtitle="Search student records, inspect academic links, and audit registered subjects."
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 text-xs sm:text-sm"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Showing {filteredStudents.length} of {students.length} students
          </span>
        </div>

        {filteredStudents.length === 0 ? (
          <EmptyState
            title="No Students Found"
            description={search ? `No student profiles match '${search}'.` : 'No student accounts exist in the directory.'}
            icon={<GraduationCap size={32} />}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Email Address</th>
                  <th>Active Enrollments</th>
                  <th>Account Status</th>
                  <th>Created At</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const studentEnrollments = enrollments.filter(
                    (e) => e.student_id === student.id && e.status === 'active'
                  );
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="font-bold text-navy-900">{student.full_name}</td>
                      <td className="text-slate-600 text-xs">
                        <span className="flex items-center gap-1.5">
                          <Mail size={12} className="text-slate-400" />
                          {student.email}
                        </span>
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-royal/10 text-brand-royal">
                          <BookOpen size={12} />
                          {studentEnrollments.length} subjects
                        </span>
                      </td>
                      <td>
                        <StatusBadge
                          status={student.is_active !== false ? 'Active' : 'Inactive'}
                          type={student.is_active !== false ? 'success' : 'neutral'}
                        />
                      </td>
                      <td className="text-xs text-slate-500">
                        {student.created_at ? new Date(student.created_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => setSelectedStudent(student)}
                          className="btn btn-secondary btn-sm text-xs py-1 px-2.5"
                        >
                          <Eye size={14} className="mr-1" />
                          Inspect
                        </button>
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
    </div>
  );
};
