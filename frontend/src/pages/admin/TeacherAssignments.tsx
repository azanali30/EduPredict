import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { User } from '../../types';
import { Button } from '../../components/forms/Button';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { UserPlus, CheckCircle2, Shield } from 'lucide-react';

export const TeacherAssignments: React.FC = () => {
  const [teachers, setTeachers] = useState<User[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [tRes, sRes] = await Promise.all([
        api.getAdminUsers('teacher'),
        api.getAdminUsers('student'),
      ]);
      setTeachers(tRes.users || []);
      setStudents(sRes.users || []);
      if (tRes.users?.length > 0) setSelectedTeacher(tRes.users[0].id);
      if (sRes.users?.length > 0) setSelectedStudent(sRes.users[0].id);
    } catch (err: any) {
      setError(err?.message || 'Failed to load teachers and students.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!selectedTeacher || !selectedStudent) {
      setError('Please select both an instructor and a student.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createTeacherAssignment(selectedTeacher, selectedStudent);
      setSuccessMsg(res.message || 'Teacher successfully assigned to student.');
    } catch (err: any) {
      setError(err?.message || 'Failed to create teacher-student assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">
            Teacher-Student Cohort Linkages
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure instructional mappings granting teachers permission to review student records
          </p>
        </div>

        <span className="badge badge-admin text-xs py-1 px-3">
          RBAC Security Bound
        </span>
      </div>

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {successMsg && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold shadow-sm">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form Card */}
        <div className="lg:col-span-2">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-6 pb-3 border-b border-slate-100">
              <UserPlus size={18} className="text-brand-500" />
              <h2 className="text-base font-bold text-navy-900">Create New Instructional Link</h2>
            </div>

            {loading ? (
              <div className="space-y-4">
                <LoadingSkeleton height="50px" />
                <LoadingSkeleton height="50px" />
                <LoadingSkeleton height="40px" width="160px" />
              </div>
            ) : (
              <form onSubmit={handleAssign} className="space-y-5">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-navy-900 block mb-2">
                    1. Select Authorized Instructor
                  </label>
                  {teachers.length === 0 ? (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                      No teacher accounts found. Please promote a user to 'teacher' in User Governance first.
                    </div>
                  ) : (
                    <select
                      value={selectedTeacher}
                      onChange={(e) => setSelectedTeacher(e.target.value)}
                      className="w-full py-2.5 px-3.5 text-sm rounded-xl border border-slate-200 bg-white text-navy-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all cursor-pointer"
                    >
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name} ({t.email})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-navy-900 block mb-2">
                    2. Select Assigned Student
                  </label>
                  {students.length === 0 ? (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                      No student accounts found. Awaiting student registration.
                    </div>
                  ) : (
                    <select
                      value={selectedStudent}
                      onChange={(e) => setSelectedStudent(e.target.value)}
                      className="w-full py-2.5 px-3.5 text-sm rounded-xl border border-slate-200 bg-white text-navy-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all cursor-pointer"
                    >
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.full_name} ({s.email})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={submitting}
                    disabled={teachers.length === 0 || students.length === 0}
                    leftIcon={<UserPlus size={16} />}
                  >
                    Confirm Cohort Assignment
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Right Info Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card p-6 bg-slate-50 border-slate-200">
            <div className="flex items-center gap-2 mb-3 font-bold text-navy-900 text-xs uppercase tracking-wider">
              <Shield size={16} className="text-brand-500" />
              <span>RBAC Governance Policy</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              EduPredict enforces strict data isolation. Instructors can <strong>only</strong> view academic records, attendance indicators, and early warning risk tags for students explicitly mapped via this console.
            </p>

            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Active Instructors</span>
                <span className="font-bold text-navy-900">{teachers.length}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Available Students</span>
                <span className="font-bold text-navy-900">{students.length}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Index Enforcement</span>
                <span className="badge badge-success text-[9px] py-0 px-2">Unique Compound</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
