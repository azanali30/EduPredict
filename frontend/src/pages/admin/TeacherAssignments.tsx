import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { User } from '../../types';
import { Button } from '../../components/forms/Button';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { UserPlus, CheckCircle2, UserCheck, Shield } from 'lucide-react';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '800px' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Teacher-Student Link Management</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Assign learners to authorized instructors to permit cohort tracking and progress inspection
        </p>
      </div>

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />
      {successMsg && (
        <div
          style={{
            padding: '0.75rem 1rem',
            backgroundColor: 'var(--status-success-bg)',
            color: 'var(--status-success)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <LoadingSkeleton height="48px" />
          <LoadingSkeleton height="48px" />
          <LoadingSkeleton height="40px" width="160px" />
        </div>
      ) : (
        <div className="card">
          <h4 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UserPlus size={18} color="var(--brand-blue)" />
            Create Authorization Assignment
          </h4>

          {teachers.length === 0 ? (
            <div style={{ padding: '1rem', backgroundColor: 'var(--status-warning-bg)', color: 'var(--status-warning)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
              No teachers found. Please promote at least one user to the 'teacher' role in the User Directory before creating assignments.
            </div>
          ) : students.length === 0 ? (
            <div style={{ padding: '1rem', backgroundColor: 'var(--status-warning-bg)', color: 'var(--status-warning)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
              No students found. Student registrations will appear here for assignment.
            </div>
          ) : (
            <form onSubmit={handleAssign} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-navy)' }}>
                  Select Assigned Teacher:
                </label>
                <select
                  value={selectedTeacher}
                  onChange={(e) => setSelectedTeacher(e.target.value)}
                  style={{
                    padding: '0.65rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                  required
                >
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} ({t.email})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-navy)' }}>
                  Select Student to Assign:
                </label>
                <select
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  style={{
                    padding: '0.65rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    fontSize: '0.9rem',
                    outline: 'none',
                  }}
                  required
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name} ({s.email})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                <Shield size={14} style={{ display: 'inline', marginRight: '4px' }} />
                Assigning grants the instructor explicit authorization to view this student's records while protecting peer privacy across all other classrooms.
              </div>

              <div>
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={submitting}
                  leftIcon={<UserCheck size={16} />}
                >
                  Confirm Assignment
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
