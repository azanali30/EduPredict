import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { User } from '../../types';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/forms/Button';
import { Users, Search, UserCheck, ShieldAlert } from 'lucide-react';

export const TeacherStudents: React.FC = () => {
  const [students, setStudents] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected Student Modal State
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const res = await api.getTeacherStudents();
        setStudents(res.students || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to fetch assigned students.');
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  const handleInspectStudent = async (studentId: string) => {
    setModalLoading(true);
    try {
      const res = await api.getStudentDetails(studentId);
      setSelectedStudent(res.student);
    } catch (err: any) {
      setError(err?.message || 'Failed to retrieve student details.');
    } finally {
      setModalLoading(false);
    }
  };

  const filteredStudents = students.filter(
    (s) =>
      s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">
            Assigned Students Directory
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Cohort management, individual learner profile review, and diagnostic tracking
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="badge badge-teacher text-xs py-1 px-3">
            Instructor Authorized Access
          </span>
        </div>
      </div>

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* Search & Actions Bar */}
      <div className="card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:max-w-md">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by student name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all placeholder:text-slate-400"
          />
        </div>

        <span className="text-xs font-semibold text-slate-500">
          Showing {filteredStudents.length} of {students.length} assigned learners
        </span>
      </div>

      {/* Roster Table */}
      {loading ? (
        <div className="card p-6 space-y-3">
          <LoadingSkeleton height="44px" />
          <LoadingSkeleton height="44px" />
          <LoadingSkeleton height="44px" />
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon={<Users size={40} className="text-brand-500" />}
            title={students.length === 0 ? 'No Students Assigned Yet' : 'No Students Match Filter'}
            description={
              students.length === 0
                ? 'Your instructor account does not currently have any student assignments. When an administrator links students in the Admin Console, they will appear here.'
                : 'Try adjusting your search query.'
            }
          />
        </div>
      ) : (
        <div className="data-table-container shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student ID</th>
                <th>Full Name</th>
                <th>Institutional Email</th>
                <th>Account Status</th>
                <th>Enrollment Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s) => (
                <tr key={s.id}>
                  <td className="font-mono text-xs text-slate-400">
                    {s.id.slice(-8)}
                  </td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-sky-50 text-sky-700 font-bold text-xs flex items-center justify-center border border-sky-200">
                        {s.full_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-navy-900">{s.full_name}</span>
                    </div>
                  </td>
                  <td className="text-slate-600 font-mono text-xs">{s.email}</td>
                  <td>
                    <span className="badge badge-success text-[10px]">Active</span>
                  </td>
                  <td className="text-slate-500 text-xs">
                    {s.created_at ? new Date(s.created_at).toLocaleDateString() : 'N/A'}
                  </td>
                  <td>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleInspectStudent(s.id)}
                      leftIcon={<UserCheck size={14} />}
                    >
                      Inspect Profile
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Student Inspection Modal */}
      <Modal
        isOpen={!!selectedStudent || modalLoading}
        onClose={() => {
          setSelectedStudent(null);
          setModalLoading(false);
        }}
        title="Student Profile Inspection"
      >
        {modalLoading ? (
          <div className="space-y-4 py-4">
            <LoadingSkeleton height="35px" width="50%" />
            <LoadingSkeleton height="80px" />
          </div>
        ) : selectedStudent ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-sky-400 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                {selectedStudent.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 className="text-base font-bold text-navy-900">{selectedStudent.full_name}</h4>
                <p className="text-xs text-slate-500">{selectedStudent.email}</p>
                <div className="mt-1">
                  <span className="badge badge-student text-[9px] py-0 px-2">
                    Verified Student
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-400 block mb-0.5">Database ID</span>
                <span className="font-mono text-slate-800 text-[11px] truncate block">{selectedStudent.id}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-slate-400 block mb-0.5">Registered</span>
                <span className="font-semibold text-slate-800">
                  {selectedStudent.created_at ? new Date(selectedStudent.created_at).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-sky-50/60 border border-sky-100 text-xs text-slate-600 space-y-1">
              <div className="font-bold text-navy-900 flex items-center gap-1.5">
                <ShieldAlert size={14} className="text-brand-500" />
                <span>Academic Record Attachment Notice</span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Detailed term records and early warning flags for this student will become available once coursework indicators are linked in Phase 4.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" size="sm" onClick={() => setSelectedStudent(null)}>
                Close
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};
