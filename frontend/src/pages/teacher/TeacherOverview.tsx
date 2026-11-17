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
    <div className="flex flex-col gap-6">
      {/* Teacher Banner */}
      <div className="card bg-gradient-to-br from-navy-800 to-navy-900 text-white p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-soft">
        <div>
          <span className="badge bg-purple-400/20 text-purple-300 font-semibold tracking-wider text-[11px] mb-2 inline-block">
            Teacher Workspace
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white mb-1.5">
            Instructor Dashboard – {user?.full_name}
          </h2>
          <p className="text-slate-300 text-sm max-w-xl">
            Monitor academic metrics, track assigned cohorts, and inspect at-risk alerts as student assignments are logged.
          </p>
        </div>

        <Link to="/teacher/students">
          <Button
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10 shrink-0"
            rightIcon={<ArrowRight size={16} />}
          >
            View Student Roster
          </Button>
        </Link>
      </div>

      {/* Overview Stat Cards */}
      <div>
        <h3 className="text-base font-bold text-navy-900 mb-4">Cohort Overview</h3>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <LoadingSkeleton height="110px" />
            <LoadingSkeleton height="110px" />
            <LoadingSkeleton height="110px" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
        <h4 className="text-base font-bold text-navy-900 mb-4">Assigned Students</h4>
        {loading ? (
          <LoadingSkeleton height="160px" />
        ) : students.length === 0 ? (
          <EmptyState
            icon={<Users size={32} className="text-brand-500" />}
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
                    <td className="font-semibold text-navy-900">{s.full_name}</td>
                    <td className="text-slate-600">{s.email}</td>
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
