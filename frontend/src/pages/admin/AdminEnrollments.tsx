import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { StudentSubjectEnrollmentItem, SubjectItem, User } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { EmptyState } from '../../components/common/EmptyState';
import { Button } from '../../components/forms/Button';
import { Modal } from '../../components/common/Modal';
import {
  Layers,
  Plus,
  Filter,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

export const AdminEnrollments: React.FC = () => {
  const [enrollments, setEnrollments] = useState<StudentSubjectEnrollmentItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [academicTerm, setAcademicTerm] = useState('2026-T1');
  const [submitting, setSubmitting] = useState(false);

  // Filter state
  const [termFilter, setTermFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const loadData = async () => {
    try {
      const [enrollRes, subjsRes, usersRes] = await Promise.all([
        api.adminListStudentEnrollments(),
        api.adminListSubjects(true),
        api.getAdminUsers('student'),
      ]);
      setEnrollments(enrollRes.enrollments || []);
      setSubjects(subjsRes.subjects || []);
      setStudents(usersRes.users || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load enrollment matrix.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !selectedSubjectId || !academicTerm) {
      setError('Student, Subject, and Academic Term are required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.adminEnrollStudent({
        student_id: selectedStudentId,
        subject_id: selectedSubjectId,
        academic_term: academicTerm.trim(),
      });
      setIsModalOpen(false);
      setSelectedStudentId('');
      setSelectedSubjectId('');
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to enroll student.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (enrollmentId: string, status: 'active' | 'dropped' | 'completed') => {
    try {
      await api.adminUpdateStudentEnrollmentStatus(enrollmentId, status);
      loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update enrollment status.');
    }
  };

  const filteredEnrollments = enrollments.filter((e) => {
    const matchesTerm = !termFilter || e.academic_term === termFilter;
    const matchesStatus = !statusFilter || e.status === statusFilter;
    return matchesTerm && matchesStatus;
  });

  const activeCount = enrollments.filter((e) => e.status === 'active').length;
  const droppedCount = enrollments.filter((e) => e.status === 'dropped').length;

  if (loading) {
    return <LoadingState title="Loading Student Enrollments..." description="Retrieving student-subject course registrations." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Student Course Enrollments Matrix"
          subtitle="Manage student course registrations across academic terms, govern active enrollment statuses, and ensure verified linkages."
          icon={<Layers size={24} className="text-brand-royal" />}
        />
        <Button
          variant="primary"
          leftIcon={<Plus size={16} />}
          onClick={() => setIsModalOpen(true)}
          className="shadow-glow shrink-0"
        >
          Enroll Student in Subject
        </Button>
      </div>

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Registrations"
          value={enrollments.length}
          subtitle="All recorded enrollments"
          icon={<Layers size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Active Enrollments"
          value={activeCount}
          subtitle="Current semester students"
          icon={<CheckCircle2 size={20} className="text-brand-ocean" />}
        />
        <StatCard
          title="Dropped / Inactive"
          value={droppedCount}
          subtitle="Withdrawn or archived enrollments"
          icon={<Calendar size={20} className="text-amber-500" />}
        />
      </div>

      {/* Filter Toolbar & Table */}
      <SectionCard
        title="Student-Subject Enrollment Directory"
        subtitle="Filter by academic term or registration status."
      >
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select
              value={termFilter}
              onChange={(e) => setTermFilter(e.target.value)}
              className="input py-1.5 px-3 text-xs sm:text-sm w-40"
            >
              <option value="">All Academic Terms</option>
              <option value="2026-T1">2026-T1</option>
              <option value="2026-T2">2026-T2</option>
              <option value="2025-T1">2025-T1</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input py-1.5 px-3 text-xs sm:text-sm w-36"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="dropped">Dropped</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <span className="text-xs text-slate-500 font-medium ml-auto">
            Showing {filteredEnrollments.length} of {enrollments.length} registrations
          </span>
        </div>

        {filteredEnrollments.length === 0 ? (
          <EmptyState
            title="No Enrollments Found"
            description="No student enrollments match the selected criteria."
            icon={<Layers size={32} />}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Student Email</th>
                  <th>Course / Subject</th>
                  <th>Academic Term</th>
                  <th>Status</th>
                  <th className="text-right">Manage Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredEnrollments.map((enr) => (
                  <tr key={enr.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="font-bold text-navy-900">{enr.student_name || 'Student'}</td>
                    <td className="text-slate-500 text-xs">{enr.student_email || 'N/A'}</td>
                    <td className="font-semibold text-brand-royal text-xs">
                      {enr.subject_name || enr.subject_code || 'Subject'}
                    </td>
                    <td className="font-mono text-xs">{enr.academic_term}</td>
                    <td>
                      <StatusBadge
                        status={enr.status.charAt(0).toUpperCase() + enr.status.slice(1)}
                        type={
                          enr.status === 'active'
                            ? 'success'
                            : enr.status === 'completed'
                            ? 'info'
                            : 'error'
                        }
                      />
                    </td>
                    <td className="text-right">
                      {enr.status === 'active' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUpdateStatus(enr.id, 'dropped')}
                          className="text-xs text-rose-600 hover:text-rose-700 py-1 px-2.5"
                        >
                          Drop
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleUpdateStatus(enr.id, 'active')}
                          className="text-xs py-1 px-2.5"
                        >
                          Reactivate
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Enroll Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Enroll Student in Subject"
      >
        <form onSubmit={handleEnroll} className="space-y-4">
          <div>
            <label className="label">Select Student</label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="input text-xs sm:text-sm"
              required
            >
              <option value="">-- Choose a Student --</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Select Academic Subject</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="input text-xs sm:text-sm"
              required
            >
              <option value="">-- Choose a Subject --</option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name} ({sub.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Academic Term</label>
            <input
              type="text"
              value={academicTerm}
              onChange={(e) => setAcademicTerm(e.target.value)}
              placeholder="e.g. 2026-T1"
              className="input text-xs sm:text-sm"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Confirm Enrollment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
