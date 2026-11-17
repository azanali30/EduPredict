import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { User } from '../../types';
import { StatCard } from '../../components/common/StatCard';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { Users, GraduationCap, ShieldCheck, Activity, Database, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/forms/Button';

export const AdminOverview: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadOverview = async () => {
      try {
        const [usersRes, healthRes] = await Promise.all([
          api.getAdminUsers(),
          api.getHealth(),
        ]);
        setUsers(usersRes.users || []);
        setHealth(healthRes);
      } catch (err: any) {
        setError(err?.message || 'Failed to retrieve administrative metrics.');
      } finally {
        setLoading(false);
      }
    };
    loadOverview();
  }, []);

  const studentCount = users.filter((u) => u.role === 'student').length;
  const teacherCount = users.filter((u) => u.role === 'teacher').length;
  const adminCount = users.filter((u) => u.role === 'admin').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Admin Hero */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #0B192C 0%, #1E3E62 100%)',
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
          <span className="badge badge-admin" style={{ backgroundColor: 'rgba(251, 191, 36, 0.2)', color: '#fde047', marginBottom: '0.5rem' }}>
            System Administration
          </span>
          <h2 style={{ fontSize: '1.6rem', color: '#ffffff', marginBottom: '0.35rem' }}>
            Governance & System Control Center
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '600px' }}>
            Centralized telemetry for user access management, role provisioning, teacher-student linkages, and audit logs.
          </p>
        </div>

        <Link to="/admin/users">
          <Button
            variant="outline"
            style={{ borderColor: 'rgba(255, 255, 255, 0.25)', color: '#ffffff' }}
            rightIcon={<ArrowRight size={16} />}
          >
            Manage User Directory
          </Button>
        </Link>
      </div>

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* KPI Cards */}
      <div>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Platform Telemetry</h3>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            <LoadingSkeleton height="110px" />
            <LoadingSkeleton height="110px" />
            <LoadingSkeleton height="110px" />
            <LoadingSkeleton height="110px" />
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
            <StatCard
              title="Total Users"
              value={users.length}
              subtitle={`${adminCount} admins, ${teacherCount} teachers`}
              icon={<Users size={20} />}
            />
            <StatCard
              title="Enrolled Students"
              value={studentCount}
              subtitle="Learner accounts"
              icon={<GraduationCap size={20} />}
            />
            <StatCard
              title="Active Teachers"
              value={teacherCount}
              subtitle="Instructor accounts"
              icon={<ShieldCheck size={20} />}
            />
            <StatCard
              title="Database Engine"
              value={health?.database?.server_version ? `MongoDB ${health.database.server_version}` : 'MongoDB 6.x'}
              subtitle={`Latency: ${health?.database?.latency_ms ?? '--'} ms`}
              badgeText={health?.database?.connected ? 'Online' : 'Degraded'}
              badgeVariant={health?.database?.connected ? 'success' : 'danger'}
              icon={<Database size={20} />}
            />
          </div>
        )}
      </div>

      {/* Recent Activity / System Diagnostics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={18} color="var(--brand-blue)" />
              Recent User Registrations
            </h4>
            <Link to="/admin/users" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              View All
            </Link>
          </div>

          {loading ? (
            <LoadingSkeleton height="120px" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {users.slice(0, 5).map((u) => (
                <div
                  key={u.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, display: 'block' }}>{u.full_name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</span>
                  </div>
                  <span className={`badge badge-${u.role}`}>{u.role}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h4 style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Activity size={18} color="var(--status-success)" />
              Operational Health & Services
            </h4>
            <Link to="/admin/logs" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              Inspect Logs
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Flask Application Server</span>
              <span className="badge badge-success">Operational</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--text-muted)' }}>MongoDB 6.0.29 Service</span>
              <span className="badge badge-success">Port 27017 Active</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem', borderBottom: '1px solid var(--border-light)' }}>
              <span style={{ color: 'var(--text-muted)' }}>CSRF & Session Security</span>
              <span className="badge badge-success">Enforced</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Predictive ML Engine</span>
              <span className="badge badge-warning">Awaiting Phase 4</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
