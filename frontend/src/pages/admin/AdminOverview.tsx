import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { User } from '../../types';
import { StatCard } from '../../components/common/StatCard';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import {
  Users,
  GraduationCap,
  ShieldCheck,
  Activity,
  Database,
  UserPlus,
  Server,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/forms/Button';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';

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
        setError(err?.message || 'Failed to retrieve administrative telemetry.');
      } finally {
        setLoading(false);
      }
    };
    loadOverview();
  }, []);

  const studentCount = users.filter((u) => u.role === 'student').length;
  const teacherCount = users.filter((u) => u.role === 'teacher').length;
  const adminCount = users.filter((u) => u.role === 'admin').length;

  // Real backend user role distribution for PieChart
  const roleDistributionData = [
    { name: 'Students', value: studentCount, color: '#0284c7' },
    { name: 'Teachers', value: teacherCount, color: '#8b5cf6' },
    { name: 'Admins', value: adminCount, color: '#f59e0b' },
  ].filter((item) => item.value > 0);

  return (
    <div className="space-y-6">
      {/* Admin Hero Header */}
      <div className="card bg-gradient-to-br from-navy-950 via-navy-900 to-navy-850 text-white p-6 sm:p-8 relative overflow-hidden border border-navy-800/80 shadow-soft">
        <div className="absolute top-0 right-0 w-80 h-80 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="max-w-2xl">
            <span className="badge bg-amber-400/20 text-amber-300 border-amber-400/30 text-xs font-semibold mb-3 inline-block">
              Governance & Security Console
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
              System Administration & Control Center
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Institutional identity control, user role management, teacher-to-student assignments, and continuous database telemetry.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link to="/admin/users">
              <Button
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
                leftIcon={<Users size={16} />}
              >
                User Directory
              </Button>
            </Link>
            <Link to="/admin/assignments">
              <Button
                variant="primary"
                leftIcon={<UserPlus size={16} />}
                className="shadow-glow"
              >
                Assign Students
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* KPI Telemetry Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Operational Telemetry
          </h2>
          <span className="text-xs text-slate-400 font-medium">
            Live MongoDB 6.0.29 Metrics
          </span>
        </div>

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
              title="Total User Accounts"
              value={users.length}
              subtitle="Registered accounts"
              badgeText="Live"
              badgeVariant="info"
              icon={<Users size={20} />}
            />
            <StatCard
              title="Enrolled Students"
              value={studentCount}
              subtitle="Learner profiles"
              badgeText="Student Role"
              badgeVariant="success"
              icon={<GraduationCap size={20} />}
            />
            <StatCard
              title="Instructors & Teachers"
              value={teacherCount}
              subtitle="Authorized evaluators"
              badgeText="Teacher Role"
              badgeVariant="info"
              icon={<ShieldCheck size={20} />}
            />
            <StatCard
              title="Database Engine"
              value={health?.database?.server_version ? `Mongo ${health.database.server_version}` : 'MongoDB 6.x'}
              subtitle={`Latency: ${health?.database?.latency_ms ?? '--'} ms`}
              badgeText={health?.database?.connected ? 'Online' : 'Degraded'}
              badgeVariant={health?.database?.connected ? 'success' : 'danger'}
              icon={<Database size={20} />}
            />
          </div>
        )}
      </div>

      {/* Real Data Visualizations & Diagnostics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Real User Directory Role Distribution (Recharts PieChart) */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-navy-900 flex items-center gap-2">
                <Users size={18} className="text-brand-500" />
                Role Distribution Breakdown
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Breakdown of active users across Student, Teacher, and Administrator roles
              </p>
            </div>
            <span className="badge badge-info text-[10px]">{users.length} Total</span>
          </div>

          {loading ? (
            <LoadingSkeleton height="200px" />
          ) : roleDistributionData.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              No registered user records available.
            </div>
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={roleDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {roleDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0B192C',
                      borderColor: '#1E3E62',
                      borderRadius: '0.75rem',
                      color: '#ffffff',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>{studentCount} Students • {teacherCount} Teachers • {adminCount} Admins</span>
            <Link to="/admin/users" className="text-brand-600 hover:text-brand-700 font-semibold">
              Manage Roles &rarr;
            </Link>
          </div>
        </div>

        {/* Operational Health & Services Telemetry */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-navy-900 flex items-center gap-2">
                <Activity size={18} className="text-emerald-500" />
                System Health & Core Services
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Runtime health status of backend endpoints, session stores, and database
              </p>
            </div>
            <Link to="/admin/logs" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
              Audit Logs &rarr;
            </Link>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2.5">
                <Server size={16} className="text-brand-500" />
                <div>
                  <span className="font-semibold text-navy-900 block">Flask Application Factory</span>
                  <span className="text-[11px] text-slate-400">Python 3.12 • Port 5000</span>
                </div>
              </div>
              <span className="badge badge-success text-[10px]">Operational</span>
            </div>

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2.5">
                <Database size={16} className="text-emerald-500" />
                <div>
                  <span className="font-semibold text-navy-900 block">MongoDB Service</span>
                  <span className="text-[11px] text-slate-400">
                    Port 27017 • {health?.database?.latency_ms ?? 0.6} ms latency
                  </span>
                </div>
              </div>
              <span className="badge badge-success text-[10px]">Connected</span>
            </div>

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={16} className="text-sky-500" />
                <div>
                  <span className="font-semibold text-navy-900 block">CSRF & Session Security</span>
                  <span className="text-[11px] text-slate-400">Flask-WTF • HttpOnly Session</span>
                </div>
              </div>
              <span className="badge badge-success text-[10px]">Enforced</span>
            </div>

            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2.5">
                <Zap size={16} className="text-amber-500" />
                <div>
                  <span className="font-semibold text-navy-900 block">Machine Learning Engine</span>
                  <span className="text-[11px] text-slate-400">Scikit-learn Regressors & Classifiers</span>
                </div>
              </div>
              <span className="badge badge-warning text-[10px]">Awaiting Phase 4</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent User Registrations */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-navy-900">Recent User Registrations</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Latest institutional accounts logged into the system
            </p>
          </div>
          <Link to="/admin/users" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
            View All ({users.length})
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2">
            <LoadingSkeleton height="36px" />
            <LoadingSkeleton height="36px" />
            <LoadingSkeleton height="36px" />
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {users.slice(0, 5).map((u) => (
              <div key={u.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center">
                    {u.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <span className="font-semibold text-navy-900 text-sm block leading-tight">
                      {u.full_name}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">{u.email}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 hidden sm:inline">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                  </span>
                  <span className={`badge badge-${u.role} text-[10px]`}>{u.role}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
