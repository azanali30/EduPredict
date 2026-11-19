import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import {
  User,
  SubjectItem,
  TeacherSubjectAssignmentItem,
  StudentSubjectEnrollmentItem,
} from '../../types';
import { Button } from '../../components/forms/Button';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import {
  BookOpen,
  UserCheck,
  GraduationCap,
  CheckCircle2,
  Plus,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Filter,
} from 'lucide-react';

const COMMON_TERMS = ['2026-T1', '2026-T2', '2026-T3', '2025-T1', '2025-T2'];

export const TeacherAssignments: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'teacher_allocations' | 'student_enrollments' | 'catalog'>('teacher_allocations');

  // Master Data
  const [teachers, setTeachers] = useState<User[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherSubjectAssignmentItem[]>([]);
  const [studentEnrollments, setStudentEnrollments] = useState<StudentSubjectEnrollmentItem[]>([]);

  // Loading & Action states
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State: Teacher Subject Allocation
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedSubjectIdForTeacher, setSelectedSubjectIdForTeacher] = useState('');
  const [selectedTermForTeacher, setSelectedTermForTeacher] = useState('2026-T1');

  // Form State: Student Enrollment
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedSubjectIdForStudent, setSelectedSubjectIdForStudent] = useState('');
  const [selectedTermForStudent, setSelectedTermForStudent] = useState('2026-T1');

  // Form State: Subject Creation
  const [newSubjCode, setNewSubjCode] = useState('');
  const [newSubjName, setNewSubjName] = useState('');
  const [newSubjKey, setNewSubjKey] = useState('');
  const [newSubjDept, setNewSubjDept] = useState('');
  const [newSubjDesc, setNewSubjDesc] = useState('');
  const [newSubjScale, setNewSubjScale] = useState('0 - 100');

  // Filters
  const [filterTerm, setFilterTerm] = useState('ALL');

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tRes, sRes, subjRes, tAssignRes, sEnrollRes] = await Promise.all([
        api.getAdminUsers('teacher'),
        api.getAdminUsers('student'),
        api.adminListSubjects(),
        api.adminListTeacherSubjects(),
        api.adminListStudentEnrollments(),
      ]);

      const tList = tRes.users || [];
      const sList = sRes.users || [];
      const subjs = subjRes.subjects || [];

      setTeachers(tList);
      setStudents(sList);
      setSubjects(subjs);
      setTeacherAssignments(tAssignRes.assignments || []);
      setStudentEnrollments(sEnrollRes.enrollments || []);

      if (tList.length > 0 && !selectedTeacherId) setSelectedTeacherId(tList[0].id);
      if (sList.length > 0 && !selectedStudentId) setSelectedStudentId(sList[0].id);
      if (subjs.length > 0) {
        if (!selectedSubjectIdForTeacher) setSelectedSubjectIdForTeacher(subjs[0].id);
        if (!selectedSubjectIdForStudent) setSelectedSubjectIdForStudent(subjs[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load allocation data:', err);
      setError(err?.message || 'Failed to synchronize course allocations from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Handlers
  const handleAssignTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacherId || !selectedSubjectIdForTeacher || !selectedTermForTeacher) {
      setError('Please select an instructor, subject, and academic term.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.adminAssignTeacherSubject({
        teacher_id: selectedTeacherId,
        subject_id: selectedSubjectIdForTeacher,
        academic_term: selectedTermForTeacher,
      });
      setSuccessMsg(res.message || 'Instructor allocated to subject successfully.');
      const updated = await api.adminListTeacherSubjects();
      setTeacherAssignments(updated.assignments || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to assign instructor to subject.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleTeacherAssignmentStatus = async (item: TeacherSubjectAssignmentItem) => {
    const newStatus = item.status === 'active' ? 'inactive' : 'active';
    setError(null);
    try {
      await api.adminUpdateTeacherSubjectStatus(item.id, newStatus);
      setTeacherAssignments((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, status: newStatus } : a))
      );
      setSuccessMsg(`Assignment for ${item.teacher_name} updated to ${newStatus}.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to update assignment status.');
    }
  };

  const handleEnrollStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !selectedSubjectIdForStudent || !selectedTermForStudent) {
      setError('Please select a student, subject, and academic term.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.adminEnrollStudent({
        student_id: selectedStudentId,
        subject_id: selectedSubjectIdForStudent,
        academic_term: selectedTermForStudent,
      });
      setSuccessMsg(res.message || 'Student enrolled into subject successfully.');
      const updated = await api.adminListStudentEnrollments();
      setStudentEnrollments(updated.enrollments || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to enroll student in subject.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStudentEnrollmentStatus = async (
    enrollmentId: string,
    newStatus: 'active' | 'dropped' | 'completed'
  ) => {
    setError(null);
    try {
      await api.adminUpdateStudentEnrollmentStatus(enrollmentId, newStatus);
      setStudentEnrollments((prev) =>
        prev.map((e) => (e.id === enrollmentId ? { ...e, status: newStatus } : e))
      );
      setSuccessMsg(`Student enrollment updated to '${newStatus}'.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to update enrollment status.');
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjCode.trim() || !newSubjName.trim() || !newSubjKey.trim()) {
      setError('Code, Name, and Canonical Key are required for subject creation.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await api.adminCreateSubject({
        code: newSubjCode.trim().toUpperCase(),
        name: newSubjName.trim(),
        canonical_key: newSubjKey.trim().toLowerCase(),
        department: newSubjDept.trim(),
        description: newSubjDesc.trim(),
        target_scale: newSubjScale,
      });
      setSuccessMsg(res.message || 'New academic subject registered successfully.');
      setNewSubjCode('');
      setNewSubjName('');
      setNewSubjKey('');
      setNewSubjDept('');
      setNewSubjDesc('');
      const updated = await api.adminListSubjects();
      setSubjects(updated.subjects || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to create subject.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSubjectStatus = async (subj: SubjectItem) => {
    const newActive = !subj.is_active;
    setError(null);
    try {
      await api.adminUpdateSubjectStatus(subj.id, newActive);
      setSubjects((prev) =>
        prev.map((s) => (s.id === subj.id ? { ...s, is_active: newActive } : s))
      );
      setSuccessMsg(`Subject '${subj.name}' status updated to ${newActive ? 'active' : 'inactive'}.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to update subject status.');
    }
  };

  const filteredTeacherAssignments = teacherAssignments.filter((a) =>
    filterTerm === 'ALL' ? true : a.academic_term === filterTerm
  );

  const filteredStudentEnrollments = studentEnrollments.filter((e) =>
    filterTerm === 'ALL' ? true : e.academic_term === filterTerm
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">
            Academic Course Allocations & Subject Catalog
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Administer institutional subjects, instructor course assignments, and term student enrollments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadAllData}
            isLoading={loading}
            leftIcon={<RefreshCw size={14} />}
          >
            Refresh
          </Button>
          <span className="badge badge-admin text-xs py-1.5 px-3">
            Institutional RBAC Console
          </span>
        </div>
      </div>

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {successMsg && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold shadow-sm animate-in fade-in">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('teacher_allocations')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'teacher_allocations'
              ? 'border-brand-royal text-brand-royal'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <UserCheck size={16} />
          <span>Instructor Allocations ({teacherAssignments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('student_enrollments')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'student_enrollments'
              ? 'border-brand-royal text-brand-royal'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <GraduationCap size={16} />
          <span>Student Enrollments ({studentEnrollments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'catalog'
              ? 'border-brand-royal text-brand-royal'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen size={16} />
          <span>Subject Catalog ({subjects.length})</span>
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <LoadingSkeleton height="80px" />
          <LoadingSkeleton height="260px" />
        </div>
      ) : (
        <>
          {/* ============================================================= */}
          {/* TAB 1: INSTRUCTOR ALLOCATIONS                                 */}
          {/* ============================================================= */}
          {activeTab === 'teacher_allocations' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form Column */}
              <div className="lg:col-span-1">
                <div className="card p-6">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                    <UserCheck size={18} className="text-brand-500" />
                    <h2 className="text-sm font-bold text-navy-900">Assign Teacher to Subject</h2>
                  </div>

                  <form onSubmit={handleAssignTeacher} className="space-y-4">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                        Select Instructor
                      </label>
                      <select
                        value={selectedTeacherId}
                        onChange={(e) => setSelectedTeacherId(e.target.value)}
                        className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 bg-white text-navy-900 outline-none focus:border-brand-royal"
                      >
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.full_name} ({t.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                        Target Subject
                      </label>
                      <select
                        value={selectedSubjectIdForTeacher}
                        onChange={(e) => setSelectedSubjectIdForTeacher(e.target.value)}
                        className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 bg-white text-navy-900 outline-none focus:border-brand-royal"
                      >
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                        Academic Term
                      </label>
                      <select
                        value={selectedTermForTeacher}
                        onChange={(e) => setSelectedTermForTeacher(e.target.value)}
                        className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 bg-white text-navy-900 outline-none focus:border-brand-royal"
                      >
                        {COMMON_TERMS.map((term) => (
                          <option key={term} value={term}>
                            {term}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="pt-2">
                      <Button
                        type="submit"
                        variant="primary"
                        className="w-full"
                        isLoading={submitting}
                        disabled={teachers.length === 0 || subjects.length === 0}
                        leftIcon={<Plus size={16} />}
                      >
                        Assign Instructor
                      </Button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Table Column */}
              <div className="lg:col-span-2 space-y-4">
                <div className="card p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter size={14} className="text-slate-400" />
                    <span className="text-xs font-semibold text-slate-600">Filter Term:</span>
                    <select
                      value={filterTerm}
                      onChange={(e) => setFilterTerm(e.target.value)}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs bg-white cursor-pointer"
                    >
                      <option value="ALL">All Terms</option>
                      {COMMON_TERMS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <span className="text-xs text-slate-500">
                    Showing {filteredTeacherAssignments.length} allocation(s)
                  </span>
                </div>

                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Instructor</th>
                          <th>Assigned Subject</th>
                          <th>Term</th>
                          <th>Status</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTeacherAssignments.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-8 text-slate-400 text-xs">
                              No instructor allocations found for this filter.
                            </td>
                          </tr>
                        ) : (
                          filteredTeacherAssignments.map((a) => (
                            <tr key={a.id}>
                              <td>
                                <div className="font-bold text-navy-900 text-xs">{a.teacher_name || 'Instructor'}</div>
                                <div className="text-[11px] text-slate-400">{a.teacher_email}</div>
                              </td>
                              <td>
                                <span className="font-semibold text-xs text-slate-800">{a.subject_name}</span>
                                {a.subject_code && (
                                  <span className="ml-1.5 text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                    {a.subject_code}
                                  </span>
                                )}
                              </td>
                              <td className="font-mono text-xs font-bold text-slate-700">{a.academic_term}</td>
                              <td>
                                <span
                                  className={`badge text-[10px] ${
                                    a.status === 'active' ? 'badge-success' : 'badge-danger'
                                  }`}
                                >
                                  {a.status}
                                </span>
                              </td>
                              <td className="text-right">
                                <button
                                  type="button"
                                  onClick={() => handleToggleTeacherAssignmentStatus(a)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer"
                                  title="Toggle active status"
                                >
                                  {a.status === 'active' ? (
                                    <>
                                      <ToggleRight size={16} className="text-emerald-500" />
                                      <span>Deactivate</span>
                                    </>
                                  ) : (
                                    <>
                                      <ToggleLeft size={16} className="text-slate-400" />
                                      <span>Activate</span>
                                    </>
                                  )}
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 2: STUDENT ENROLLMENTS                                    */}
          {/* ============================================================= */}
          {activeTab === 'student_enrollments' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form Column */}
              <div className="lg:col-span-1">
                <div className="card p-6">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                    <GraduationCap size={18} className="text-brand-500" />
                    <h2 className="text-sm font-bold text-navy-900">Enroll Student into Subject</h2>
                  </div>

                  <form onSubmit={handleEnrollStudent} className="space-y-4">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                        Select Learner
                      </label>
                      <select
                        value={selectedStudentId}
                        onChange={(e) => setSelectedStudentId(e.target.value)}
                        className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 bg-white text-navy-900 outline-none focus:border-brand-royal"
                      >
                        {students.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.full_name} ({s.email})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                        Enrolled Subject
                      </label>
                      <select
                        value={selectedSubjectIdForStudent}
                        onChange={(e) => setSelectedSubjectIdForStudent(e.target.value)}
                        className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 bg-white text-navy-900 outline-none focus:border-brand-royal"
                      >
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                        Academic Term
                      </label>
                      <select
                        value={selectedTermForStudent}
                        onChange={(e) => setSelectedTermForStudent(e.target.value)}
                        className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 bg-white text-navy-900 outline-none focus:border-brand-royal"
                      >
                        {COMMON_TERMS.map((term) => (
                          <option key={term} value={term}>
                            {term}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="pt-2">
                      <Button
                        type="submit"
                        variant="primary"
                        className="w-full"
                        isLoading={submitting}
                        disabled={students.length === 0 || subjects.length === 0}
                        leftIcon={<Plus size={16} />}
                      >
                        Confirm Enrollment
                      </Button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Table Column */}
              <div className="lg:col-span-2 space-y-4">
                <div className="card p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter size={14} className="text-slate-400" />
                    <span className="text-xs font-semibold text-slate-600">Filter Term:</span>
                    <select
                      value={filterTerm}
                      onChange={(e) => setFilterTerm(e.target.value)}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs bg-white cursor-pointer"
                    >
                      <option value="ALL">All Terms</option>
                      {COMMON_TERMS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <span className="text-xs text-slate-500">
                    Showing {filteredStudentEnrollments.length} enrollment(s)
                  </span>
                </div>

                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Learner</th>
                          <th>Subject</th>
                          <th>Term</th>
                          <th>Status</th>
                          <th className="text-right">Lifecycle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStudentEnrollments.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-8 text-slate-400 text-xs">
                              No student enrollments found for this filter.
                            </td>
                          </tr>
                        ) : (
                          filteredStudentEnrollments.map((e) => (
                            <tr key={e.id}>
                              <td>
                                <div className="font-bold text-navy-900 text-xs">{e.student_name || 'Student'}</div>
                                <div className="text-[11px] text-slate-400">{e.student_email}</div>
                              </td>
                              <td>
                                <span className="font-semibold text-xs text-slate-800">{e.subject_name}</span>
                                {e.subject_code && (
                                  <span className="ml-1.5 text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                    {e.subject_code}
                                  </span>
                                )}
                              </td>
                              <td className="font-mono text-xs font-bold text-slate-700">{e.academic_term}</td>
                              <td>
                                <span
                                  className={`badge text-[10px] ${
                                    e.status === 'active'
                                      ? 'badge-success'
                                      : e.status === 'completed'
                                      ? 'badge-student'
                                      : 'badge-danger'
                                  }`}
                                >
                                  {e.status}
                                </span>
                              </td>
                              <td className="text-right">
                                <select
                                  value={e.status}
                                  onChange={(ev) =>
                                    handleUpdateStudentEnrollmentStatus(
                                      e.id,
                                      ev.target.value as 'active' | 'dropped' | 'completed'
                                    )
                                  }
                                  className="px-2 py-1 rounded-lg border border-slate-200 text-xs bg-white text-slate-700 outline-none focus:border-brand-royal cursor-pointer"
                                >
                                  <option value="active">Active</option>
                                  <option value="dropped">Dropped</option>
                                  <option value="completed">Completed</option>
                                </select>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================= */}
          {/* TAB 3: SUBJECT CATALOG                                        */}
          {/* ============================================================= */}
          {activeTab === 'catalog' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form Column */}
              <div className="lg:col-span-1">
                <div className="card p-6">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                    <BookOpen size={18} className="text-brand-500" />
                    <h2 className="text-sm font-bold text-navy-900">Register New Subject</h2>
                  </div>

                  <form onSubmit={handleCreateSubject} className="space-y-3.5">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Course Code
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. MATH, PORT, CS"
                        value={newSubjCode}
                        onChange={(e) => setNewSubjCode(e.target.value)}
                        className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 uppercase outline-none focus:border-brand-royal"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Display Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Mathematics"
                        value={newSubjName}
                        onChange={(e) => setNewSubjName(e.target.value)}
                        className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 outline-none focus:border-brand-royal"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Canonical Key
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. mathematics"
                        value={newSubjKey}
                        onChange={(e) => setNewSubjKey(e.target.value)}
                        className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 lowercase outline-none focus:border-brand-royal"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Department
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. STEM, Humanities"
                        value={newSubjDept}
                        onChange={(e) => setNewSubjDept(e.target.value)}
                        className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 outline-none focus:border-brand-royal"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                        Target Scale
                      </label>
                      <input
                        type="text"
                        value={newSubjScale}
                        onChange={(e) => setNewSubjScale(e.target.value)}
                        className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 outline-none focus:border-brand-royal"
                      />
                    </div>

                    <div className="pt-2">
                      <Button
                        type="submit"
                        variant="primary"
                        className="w-full"
                        isLoading={submitting}
                        leftIcon={<Plus size={16} />}
                      >
                        Register Subject
                      </Button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Table Column */}
              <div className="lg:col-span-2">
                <div className="card overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-navy-900">Institutional Catalog</span>
                    <span className="text-xs text-slate-500">{subjects.length} registered course(s)</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Subject</th>
                          <th>Canonical Key</th>
                          <th>Department</th>
                          <th>Scale</th>
                          <th>Status</th>
                          <th className="text-right">Governance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subjects.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center py-8 text-slate-400 text-xs">
                              No subjects registered in catalog yet.
                            </td>
                          </tr>
                        ) : (
                          subjects.map((s) => (
                            <tr key={s.id}>
                              <td>
                                <div className="font-bold text-navy-900 text-xs">{s.name}</div>
                                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                  {s.code}
                                </span>
                              </td>
                              <td className="font-mono text-xs text-slate-600">{s.canonical_key}</td>
                              <td className="text-xs text-slate-600">{s.department || '—'}</td>
                              <td className="font-mono text-xs text-slate-600">{s.target_scale || '0 - 100'}</td>
                              <td>
                                <span
                                  className={`badge text-[10px] ${
                                    s.is_active ? 'badge-success' : 'badge-danger'
                                  }`}
                                >
                                  {s.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="text-right">
                                <button
                                  type="button"
                                  onClick={() => handleToggleSubjectStatus(s)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200 hover:bg-slate-50 text-slate-700 cursor-pointer"
                                >
                                  {s.is_active ? (
                                    <>
                                      <ToggleRight size={16} className="text-emerald-500" />
                                      <span>Deactivate</span>
                                    </>
                                  ) : (
                                    <>
                                      <ToggleLeft size={16} className="text-slate-400" />
                                      <span>Activate</span>
                                    </>
                                  )}
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
