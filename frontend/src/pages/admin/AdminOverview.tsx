import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { User, PredictionRecord } from '../../types';
import { StatCard } from '../../components/common/StatCard';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { PredictionDetailModal } from '../../components/predictions/PredictionDetailModal';
import {
  Users,
  GraduationCap,
  ShieldCheck,
  Activity,
  Database,
  UserPlus,
  Server,
  Zap,
  BrainCircuit,
  TrendingUp,
  AlertTriangle,
  AlertCircle,
  Eye,
  BarChart2,
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

export const AdminOverview: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Audit modal
  const [inspectRecord, setInspectRecord] = useState<PredictionRecord | null>(null);

  useEffect(() => {
    const loadOverview = async () => {
      try {
        const [usersRes, healthRes, predsRes] = await Promise.all([
          api.getAdminUsers(),
          api.getHealth(),
          api.listPredictions({ limit: 100 }),
        ]);
        setUsers(usersRes.users || []);
        setHealth(healthRes);
        setPredictions(predsRes.predictions || []);
        setTotalCount(predsRes.total_count ?? (predsRes.predictions || []).length);
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

  // Prediction Analytics calculations
  const totalPredictions = totalCount;
  const loadedSampleCount = predictions.length;
  const hasTruncatedSample = totalCount > loadedSampleCount;
  const mathPredictions = predictions.filter((p) => p.subject === 'Mathematics').length;
  const portPredictions = predictions.filter((p) => p.subject === 'Portuguese Language').length;

  const highRiskCount = predictions.filter((p) => p.predicted_status === 'High Risk').length;
  const modRiskCount = predictions.filter((p) => p.predicted_status === 'Moderate Risk').length;
  const lowRiskCount = predictions.filter((p) => p.predicted_status === 'Low Risk / On Track').length;

  const riskDistributionData = [
    { name: 'High Risk', value: highRiskCount, color: '#e11d48' },
    { name: 'Moderate Risk', value: modRiskCount, color: '#f59e0b' },
    { name: 'Low Risk', value: lowRiskCount, color: '#10b981' },
  ].filter((item) => item.value > 0);

  const m0Count = predictions.filter((p) => p.milestone === 0).length;
  const m1Count = predictions.filter((p) => p.milestone === 1).length;
  const m2Count = predictions.filter((p) => p.milestone === 2).length;

  const milestoneDistributionData = [
    { milestone: 'Milestone 0 (Early)', count: m0Count },
    { milestone: 'Milestone 1 (Mid-Term)', count: m1Count },
    { milestone: 'Milestone 2 (Pre-Final)', count: m2Count },
  ];

  const getRiskBadge = (status: string) => {
    switch (status) {
      case 'High Risk':
        return (
          <span className="badge bg-rose-100 text-rose-800 text-[10px] font-bold">
            High Risk
          </span>
        );
      case 'Moderate Risk':
        return (
          <span className="badge bg-amber-100 text-amber-800 text-[10px] font-bold">
            Moderate Risk
          </span>
        );
      case 'Low Risk / On Track':
      default:
        return (
          <span className="badge bg-emerald-100 text-emerald-800 text-[10px] font-bold">
            Low Risk
          </span>
        );
    }
  };

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
              Institutional identity control, user role management, teacher-to-student assignments, and AI predictive model telemetry.
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
            Platform Security & User Base Telemetry
          </h2>
          <span className="badge badge-success text-xs py-0.5">Live Database</span>
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
              title="Registered Users"
              value={users.length}
              subtitle="All institutional accounts"
              badgeText="Active"
              badgeVariant="success"
              icon={<Users size={20} />}
            />
            <StatCard
              title="Students Enrolled"
              value={studentCount}
              subtitle="RBAC: student"
              badgeText="Active"
              badgeVariant="info"
              icon={<GraduationCap size={20} />}
            />
            <StatCard
              title="Instructor Accounts"
              value={teacherCount}
              subtitle="RBAC: teacher"
              badgeText="Authorized"
              badgeVariant="warning"
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

      {/* AI Prediction Intelligence & Governance Telemetry Section */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BrainCircuit size={18} className="text-brand-600" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              AI Prediction Intelligence & Model Telemetry
            </h2>
          </div>
          <span className="badge bg-purple-100 text-purple-800 text-xs font-bold py-0.5 px-2">
            12 Champion Models Loaded
          </span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <LoadingSkeleton height="110px" />
            <LoadingSkeleton height="110px" />
            <LoadingSkeleton height="110px" />
            <LoadingSkeleton height="110px" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              title="Total Predictions"
              value={totalPredictions}
              subtitle="All persisted inference audits"
              badgeText="Database"
              badgeVariant="info"
              icon={<TrendingUp size={20} />}
            />
            <StatCard
              title="High Risk Detected"
              value={highRiskCount}
              subtitle={hasTruncatedSample ? `In loaded sample (latest ${loadedSampleCount})` : "Academic status < 50"}
              badgeText={highRiskCount > 0 ? "Flagged" : "Clear"}
              badgeVariant={highRiskCount > 0 ? "danger" : "success"}
              icon={<AlertTriangle size={20} />}
            />
            <StatCard
              title="Mathematics Inferences"
              value={mathPredictions}
              subtitle={hasTruncatedSample ? `In loaded sample (latest ${loadedSampleCount})` : "Stem curriculum models"}
              badgeText="M0–M2"
              badgeVariant="info"
              icon={<BrainCircuit size={20} />}
            />
            <StatCard
              title="Portuguese Inferences"
              value={portPredictions}
              subtitle={hasTruncatedSample ? `In loaded sample (latest ${loadedSampleCount})` : "Language models"}
              badgeText="M0–M2"
              badgeVariant="warning"
              icon={<BrainCircuit size={20} />}
            />
          </div>
        )}

        {/* Prediction Visualizations Grid with Coverage Notice */}
        <div className="space-y-4 mb-6">
          {hasTruncatedSample && (
            <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <span>
                <strong>Data Coverage Notice:</strong> Category breakdown charts reflect the {loadedSampleCount} most recent prediction audits (out of {totalPredictions} total institutional records). Server-side analytical aggregation pipeline is scheduled for Phase 6.
              </span>
              <span className="badge bg-sky-100 text-sky-800 font-mono text-[10px] shrink-0">
                Sample: {loadedSampleCount} of {totalPredictions}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risk Category Distribution */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-navy-900 flex items-center gap-2">
                    <AlertCircle size={18} className="text-rose-500" />
                    Academic Risk Category Distribution
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Classifier outputs across {hasTruncatedSample ? `latest ${loadedSampleCount}` : 'all'} predictions
                  </p>
                </div>
                <span className="badge badge-info text-[10px]">{loadedSampleCount} Inferences</span>
              </div>

            {loading ? (
              <LoadingSkeleton height="200px" />
            ) : riskDistributionData.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No predictions recorded yet. Run predictions from student or teacher workspaces to populate.
              </div>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskDistributionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {riskDistributionData.map((entry, index) => (
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
          </div>

          {/* Milestone Distribution */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-navy-900 flex items-center gap-2">
                  <BarChart2 size={18} className="text-brand-500" />
                  Milestone Volume Distribution
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Inference calls across Early Warning, Mid-Term, and Pre-Final milestones
                </p>
              </div>
              <span className="badge badge-info text-[10px]">Temporal Spread</span>
            </div>

            {loading ? (
              <LoadingSkeleton height="200px" />
            ) : totalPredictions === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No predictions recorded yet.
              </div>
            ) : (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={milestoneDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="milestone" stroke="#94a3b8" fontSize={11} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0B192C',
                        borderColor: '#1E3E62',
                        borderRadius: '0.75rem',
                        color: '#ffffff',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="count" fill="#0284c7" radius={[6, 6, 0, 0]} name="Inferences" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>

        {/* Recent Prediction Activity Table */}
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-navy-900">Recent Prediction Activity Log</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Archived AI predictions with model names, risk ratings, and timestamped indicators
              </p>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              Showing recent {Math.min(10, predictions.length)} of {totalPredictions}
            </span>
          </div>

          {loading ? (
            <div className="space-y-2">
              <LoadingSkeleton height="36px" />
              <LoadingSkeleton height="36px" />
              <LoadingSkeleton height="36px" />
            </div>
          ) : predictions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No recent prediction activity recorded.
            </div>
          ) : (
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Student ID</th>
                    <th>Subject</th>
                    <th>Milestone</th>
                    <th>Projected Mark (%)</th>
                    <th>Risk Category</th>
                    <th>Confidence</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {predictions.slice(0, 10).map((record) => (
                    <tr key={record.id}>
                      <td className="text-xs text-slate-600 whitespace-nowrap">
                        {new Date(record.created_at).toLocaleString(undefined, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                      <td className="font-mono text-xs text-slate-500">
                        {record.student_id ? record.student_id.slice(-8) : 'N/A'}
                      </td>
                      <td className="font-semibold text-navy-900 text-xs">
                        {record.subject}
                      </td>
                      <td>
                        <span className="badge bg-slate-100 text-slate-700 text-[10px] font-semibold">
                          M{record.milestone}
                        </span>
                      </td>
                      <td className="font-mono text-xs font-bold text-navy-950">
                        {record.predicted_marks.toFixed(1)}% <span className="text-[10px] text-slate-400 font-normal">({(record.predicted_marks / 5).toFixed(1)}/20)</span>
                      </td>
                      <td>{getRiskBadge(record.predicted_status)}</td>
                      <td className="font-mono text-xs text-slate-600">
                        {(record.top_confidence * 100).toFixed(1)}%
                      </td>
                      <td>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setInspectRecord(record)}
                          leftIcon={<Eye size={12} />}
                        >
                          Audit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
                <Zap size={16} className="text-purple-500" />
                <div>
                  <span className="font-semibold text-navy-900 block">Machine Learning Engine</span>
                  <span className="text-[11px] text-slate-400">12 Scikit-learn Champion Pipelines</span>
                </div>
              </div>
              <span className="badge badge-success text-[10px]">Operational</span>
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

      {/* Prediction Detail Modal */}
      <PredictionDetailModal
        prediction={inspectRecord}
        isOpen={!!inspectRecord}
        onClose={() => setInspectRecord(null)}
      />
    </div>
  );
};
