import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { User } from '../../types';
import { StatCard } from '../../components/common/StatCard';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { Users, AlertCircle, Award, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/forms/Button';

export const TeacherOverview: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const res = await api.getTeacherStudents();
        setStudents(res.students || []);
      } catch (err) {
        console.error('Failed to load teacher students:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Teacher Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #1E3E62 0%, #0B192C 100%)',
          color: '#ffffff',
          padding: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <span className="badge badge-teacher" style={{ backgroundColor: 'rgba(167, 139, 250, 0.2)', color: '#c4b5fd', marginBottom: '0.5rem' }}>
            Teacher Workspace
          </span>
          <h2 style={{ fontSize: '1.6rem', color: '#ffffff', marginBottom: '0.35rem' }}>
            Instructor Dashboard – {user?.full_name}
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '600px' }}>
            Monitor academic metrics, track assigned cohorts, and inspect at-risk alerts as student assignments are logged.
          </p>
        </div>

        <Link to="/teacher/students">
          <Button
            variant="outline"
            style={{ borderColor: 'rgba(255, 255, 255, 0.25)', color: '#ffffff' }}
            rightIcon={<ArrowRight size={16} />}
          >
            View Student Roster
          </Button>
        </Link>
      </div>

      {/* Overview Stat Cards */}
      <div>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Cohort Overview</h3>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            <LoadingSkeleton height="110px" />
            <LoadingSkeleton height="110px" />
            <LoadingSkeleton height="110px" />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            <StatCard
              title="Assigned Students"
              value={students.length}
              subtitle="Active cohort learners"
              icon={<Users size={20} />}
            />
            <StatCard
              title="At-Risk Alerts"
              value="0"
              subtitle="Requires Phase 4 ML Classifier"
              icon={<AlertCircle size={20} />}
            />
            <StatCard
              title="Cohort Performance"
              value="--"
              subtitle="Awaiting exam submission"
              icon={<Award size={20} />}
            />
          </div>
        )}
      </div>

      {/* Roster Preview */}
      <div className="card">
        <h4 style={{ fontSize: '1.05rem', marginBottom: '1rem' }}>Assigned Students</h4>
        {loading ? (
          <LoadingSkeleton height="160px" />
        ) : students.length === 0 ? (
          <EmptyState
            icon={<Users size={32} color="var(--brand-blue)" />}
            title="No Students Assigned Yet"
            description="Your administrator has not mapped any student accounts to your instructor profile yet. Assignments will appear here automatically."
          />
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.full_name}</td>
                    <td>{s.email}</td>
                    <td>
                      <span className="badge badge-success">Active</span>
                    </td>
                    <td>
                      <Link to="/teacher/students">
                        <Button variant="outline" size="sm">
                          Inspect Details
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
