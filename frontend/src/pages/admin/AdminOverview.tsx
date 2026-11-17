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
    <div className="flex flex-col gap-6">
      {/* Admin Hero */}
      <div className="card bg-gradient-to-br from-navy-900 to-navy-800 text-white p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-soft">
        <div>
          <span className="badge bg-amber-400/20 text-amber-300 font-semibold tracking-wider text-[11px] mb-2 inline-block">
            System Administration
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white mb-1.5">
            Governance & System Control Center
          </h2>
          <p className="text-slate-300 text-sm max-w-xl">
            Centralized telemetry for user access management, role provisioning, teacher-student linkages, and audit logs.
          </p>
        </div>

        <Link to="/admin/users">
          <Button
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10 shrink-0"
            rightIcon={<ArrowRight size={16} />}
          >
            Manage User Directory
          </Button>
        </Link>
      </div>

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* KPI Cards */}
      <div>
        <h3 className="text-base font-bold text-navy-900 mb-4">Platform Telemetry</h3>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <LoadingSkeleton height="110px" />
            <LoadingSkeleton height="110px" />
            <LoadingSkeleton height="110px" />
            <LoadingSkeleton height="110px" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base font-bold text-navy-900 flex items-center gap-2">
              <Users size={18} className="text-brand-500" />
              Recent User Registrations
            </h4>
            <Link to="/admin/users" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              View All
            </Link>
          </div>

          {loading ? (
            <LoadingSkeleton height="120px" />
          ) : (
            <div className="flex flex-col gap-2.5">
              {users.slice(0, 5).map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg text-sm"
                >
                  <div>
                    <span className="font-semibold text-navy-900 block">{u.full_name}</span>
                    <span className="text-xs text-slate-500">{u.email}</span>
                  </div>
                  <span className={`badge badge-${u.role}`}>{u.role}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-base font-bold text-navy-900 flex items-center gap-2">
              <Activity size={18} className="text-emerald-500" />
              Operational Health & Services
            </h4>
            <Link to="/admin/logs" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              Inspect Logs
            </Link>
          </div>

          <div className="flex flex-col gap-2 text-sm divide-y divide-slate-100">
            <div className="flex justify-between py-2.5">
              <span className="text-slate-500">Flask Application Server</span>
              <span className="badge badge-success">Operational</span>
            </div>
            <div className="flex justify-between py-2.5">
              <span className="text-slate-500">MongoDB 6.0.29 Service</span>
              <span className="badge badge-success">Port 27017 Active</span>
            </div>
            <div className="flex justify-between py-2.5">
              <span className="text-slate-500">CSRF & Session Security</span>
              <span className="badge badge-success">Enforced</span>
            </div>
            <div className="flex justify-between py-2.5">
              <span className="text-slate-500">Predictive ML Engine</span>
              <span className="badge badge-warning">Awaiting Phase 4</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
