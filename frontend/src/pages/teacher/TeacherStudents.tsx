import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { User } from '../../types';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/forms/Button';
import { Users, Search, UserCheck } from 'lucide-react';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Assigned Students Roster</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Inspect academic indicators, view individual student profiles, and monitor progress
        </p>
      </div>

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* Search & Actions Bar */}
      <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px', display: 'flex', alignItems: 'center' }}>
          <Search size={18} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search by student name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.85rem 0.55rem 2.25rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-light)',
              outline: 'none',
              fontSize: '0.875rem',
            }}
          />
        </div>

        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          {filteredStudents.length} {filteredStudents.length === 1 ? 'Student' : 'Students'}
        </span>
      </div>

      {/* Roster Table */}
      {loading ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <LoadingSkeleton height="40px" />
          <LoadingSkeleton height="40px" />
          <LoadingSkeleton height="40px" />
        </div>
      ) : filteredStudents.length === 0 ? (
        <EmptyState
          icon={<Users size={36} color="var(--brand-blue)" />}
          title={students.length === 0 ? 'No Students Assigned Yet' : 'No Matching Students'}
          description={
            students.length === 0
              ? 'Your instructor account does not currently have any student assignments.'
              : 'Try adjusting your search criteria.'
          }
        />
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student ID</th>
                <th>Full Name</th>
                <th>Email Address</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {s.id.slice(-6)}
                  </td>
                  <td style={{ fontWeight: 600 }}>{s.full_name}</td>
                  <td>{s.email}</td>
                  <td>
                    <span className="badge badge-student">Student</span>
                  </td>
                  <td>{s.created_at ? new Date(s.created_at).toLocaleDateString() : 'N/A'}</td>
                  <td>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleInspectStudent(s.id)}
                      leftIcon={<UserCheck size={14} />}
                    >
                      View Profile
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
            <LoadingSkeleton height="40px" width="60%" />
            <LoadingSkeleton height="100px" />
          </div>
        ) : selectedStudent ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-light)' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--accent-light)',
                  color: 'var(--brand-blue)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '1.2rem',
                }}
              >
                {selectedStudent.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h4 style={{ fontSize: '1.1rem' }}>{selectedStudent.full_name}</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{selectedStudent.email}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.85rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>Student ID:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{selectedStudent.id}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>Account Status:</span>
                <span className="badge badge-success">Active</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>Role:</span>
                <span className="badge badge-student">Student</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', display: 'block' }}>Registered:</span>
                <span style={{ fontWeight: 600 }}>
                  {new Date(selectedStudent.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div
              style={{
                padding: '0.75rem',
                backgroundColor: 'var(--bg-subtle)',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
              }}
            >
              Academic term indicators and ML risk metrics will be linked here in Phase 4.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
