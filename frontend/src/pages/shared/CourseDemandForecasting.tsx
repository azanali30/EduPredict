import React, { useEffect, useState, useMemo } from 'react';
import { demandApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { DemandOverviewResponse, CourseDemandForecastItem } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { EmptyState } from '../../components/common/EmptyState';
import { Button } from '../../components/forms/Button';
import {
  TrendingUp,
  BookOpen,
  Users,
  AlertCircle,
  CheckCircle2,
  Info,
  Cpu,
  Calendar,
  History,
  Save,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

export const CourseDemandForecasting: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canViewHistory = user?.role === 'admin' || user?.role === 'analyst';

  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
  const [periodsAhead, setPeriodsAhead] = useState<number>(1);
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [overview, setOverview] = useState<DemandOverviewResponse | null>(null);
  const [history, setHistory] = useState<CourseDemandForecastItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await demandApi.getOverview({
        periods_ahead: periodsAhead,
        department: departmentFilter || undefined,
      });
      setOverview(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to retrieve course demand forecasts.');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!canViewHistory) return;
    setHistoryLoading(true);
    try {
      const res = await demandApi.getHistory(1, 50);
      setHistory(res.history || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load forecast history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [periodsAhead, departmentFilter]);

  useEffect(() => {
    if (activeTab === 'history' && canViewHistory) {
      fetchHistory();
    }
  }, [activeTab]);

  const handleGenerateSnapshot = async () => {
    if (!isAdmin) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await demandApi.generateForecast({ periods_ahead: periodsAhead });
      setSuccessMsg(res.message || 'Forecast snapshot generated and persisted.');
      if (activeTab === 'history') {
        await fetchHistory();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to generate forecast snapshot.');
    } finally {
      setSaving(false);
    }
  };

  const departments = useMemo(() => {
    if (!overview?.department_summary) return [];
    return overview.department_summary.map((d) => d.department).filter(Boolean);
  }, [overview]);

  const comparisonChartData = useMemo(() => {
    if (!overview?.forecasts) return [];
    return overview.forecasts.slice(0, 8).map((f) => ({
      name: f.subject_code || f.subject_name.slice(0, 14),
      Actual: f.latest_actual_enrollment ?? 0,
      Predicted: Math.round(f.predicted_enrollment * 10) / 10,
    }));
  }, [overview]);

  const getSufficiencyBanner = (status?: string) => {
    if (status === 'sufficient') {
      return {
        bg: 'bg-emerald-50 border-emerald-200 text-emerald-900',
        label: 'Walk-Forward Evaluated / Experimental Multi-Term Series',
        detail:
          'At least 4 chronological terms observed for one or more subjects; common-origin walk-forward evaluation compares baselines and Ridge Lag models (>= 7 terms). Not yet institutionally validated.',
      };
    }
    if (status === 'baseline_only') {
      return {
        bg: 'bg-amber-50 border-amber-200 text-amber-900',
        label: 'Baseline Only (2–3 Terms Available)',
        detail:
          'Limited historical enrollment terms available. Forecasts use conservative Moving Average baselines rather than advanced ML models.',
      };
    }
    return {
      bg: 'bg-sky-50 border-sky-200 text-sky-900',
      label: 'Insufficient Historical Enrollment Data (< 2 Terms)',
      detail:
        'Historical term depth is insufficient for trend or time-series ML validation. Baseline single-point or zero estimates are displayed transparently without synthetic data.',
    };
  };

  if (loading && !overview) {
    return (
      <LoadingState
        title="Loading Course Demand Forecasting..."
        description="Aggregating historical term enrollments and running time-series validation."
      />
    );
  }

  const summary = overview?.summary;
  const suffBanner = getSufficiencyBanner(summary?.overall_data_sufficiency);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Course & Subject Demand Forecasting"
        subtitle="Time-series enrollment demand estimation, capacity planning, and term-over-term growth analysis."
        icon={<TrendingUp size={24} className="text-brand-royal" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs">
              <Calendar size={14} className="text-slate-500" />
              <span className="text-slate-500 font-medium">Horizon:</span>
              <select
                aria-label="Forecast Horizon"
                value={periodsAhead}
                onChange={(e) => setPeriodsAhead(Number(e.target.value))}
                className="bg-transparent font-semibold text-slate-800 focus:outline-none"
              >
                <option value={1}>+1 Term</option>
                <option value={2}>+2 Terms</option>
                <option value={3}>+3 Terms</option>
                <option value={4}>+4 Terms</option>
              </select>
            </div>

            {departments.length > 0 && (
              <select
                aria-label="Filter by Department"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            )}

            {isAdmin && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Save size={14} />}
                onClick={handleGenerateSnapshot}
                disabled={saving}
              >
                {saving ? 'Generating...' : 'Save Forecast Snapshot'}
              </Button>
            )}
          </div>
        }
      />

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="font-bold text-emerald-700">
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      {canViewHistory && (
        <div className="flex border-b border-slate-200 gap-4 text-sm font-semibold">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-3 px-2 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <TrendingUp size={16} />
            <span>Live Demand Forecasts</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 px-2 flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History size={16} />
            <span>Saved Forecast History</span>
          </button>
        </div>
      )}

      {activeTab === 'overview' && (
        <>
          {/* Data Sufficiency & Planning Disclaimer Banner */}
          <div className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${suffBanner.bg}`}>
            <Info size={16} className="shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold">{suffBanner.label}</div>
              <p className="leading-relaxed opacity-90">{suffBanner.detail}</p>
              <p className="font-semibold opacity-95">
                {overview?.disclaimer ||
                  'Estimated enrollment demand for academic planning only — not confirmed registration.'}
              </p>
            </div>
          </div>

          {/* KPI Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Subjects Analyzed"
              value={summary?.total_subjects_analyzed ?? 0}
              subtitle="Authorized active catalog"
              icon={<BookOpen size={20} className="text-brand-600" />}
            />
            <StatCard
              title="Latest Actual Enrollment"
              value={summary?.total_latest_actual_enrollment ?? 0}
              subtitle="Most recent observed term"
              icon={<Users size={20} className="text-sky-600" />}
            />
            <StatCard
              title={`Predicted Enrollment (+${periodsAhead}T)`}
              value={
                summary?.overall_data_sufficiency === 'insufficient' &&
                (summary?.total_latest_actual_enrollment ?? 0) === 0
                  ? 'Insufficient Data'
                  : Math.round(summary?.total_predicted_enrollment ?? 0)
              }
              subtitle="Heuristic estimate (not confirmed)"
              icon={<TrendingUp size={20} className="text-teal-600" />}
            />
            <StatCard
              title="High-Demand Courses"
              value={summary?.high_demand_count ?? 0}
              subtitle={`${summary?.low_demand_count ?? 0} low-demand subjects`}
              icon={<AlertCircle size={20} className="text-amber-500" />}
            />
          </div>

          {/* Charts */}
          {overview && overview.forecasts.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard
                title="Historical vs. Predicted Enrollment"
                subtitle="Latest observed term enrollment compared against forecasted demand."
              >
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="Actual" fill="#0284c7" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Predicted" fill="#0d9488" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>

              <SectionCard
                title="Historical Institutional Enrollment Trend"
                subtitle="Chronological aggregate enrollment volume across observed terms."
              >
                {overview.historical_timeline.length === 0 ? (
                  <EmptyState
                    title="No Historical Term Series"
                    description="No term-level enrollment records exist yet in the database."
                    icon={<Calendar size={28} className="text-slate-400" />}
                  />
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={overview.historical_timeline}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="academic_term" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="total_enrollment"
                          name="Total Enrollment"
                          stroke="#0284c7"
                          strokeWidth={2.5}
                          dot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </SectionCard>
            </div>
          ) : (
            <EmptyState
              title="No Subjects Available for Forecasting"
              description="No active subjects or assigned courses were found for your scope."
              icon={<BookOpen size={32} className="text-slate-400" />}
            />
          )}

          {/* High & Low Demand Lists */}
          {overview && overview.forecasts.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard
                title="High-Demand Courses"
                subtitle="Subjects with highest projected enrollment or >= 85% capacity utilization."
              >
                {overview.high_demand_courses.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4">No courses currently classified as High Demand.</p>
                ) : (
                  <div className="space-y-2.5">
                    {overview.high_demand_courses.map((c) => (
                      <div
                        key={c.subject_id}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm font-bold text-slate-800">
                            {c.subject_code} — {c.subject_name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {c.department || 'General'} • Period: {c.forecast_period}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-teal-700 font-mono">
                            {c.predicted_enrollment.toFixed(1)} est.
                          </p>
                          {c.utilization_pct !== null && (
                            <p className="text-[11px] text-slate-500">{c.utilization_pct}% capacity</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard
                title="Low-Demand Courses"
                subtitle="Subjects with low projected enrollment requiring scheduling or outreach review."
              >
                {overview.low_demand_courses.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4">No courses currently classified as Low Demand.</p>
                ) : (
                  <div className="space-y-2.5">
                    {overview.low_demand_courses.map((c) => (
                      <div
                        key={c.subject_id}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                      >
                        <div>
                          <p className="text-sm font-bold text-slate-800">
                            {c.subject_code} — {c.subject_name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {c.department || 'General'} • {c.terms_observed} term(s) observed
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-slate-700 font-mono">
                            {c.predicted_enrollment.toFixed(1)} est.
                          </p>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                            {c.validation_status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          {/* Detailed Subject Forecast Table */}
          {overview && overview.forecasts.length > 0 && (
            <SectionCard
              title="Subject-Wise Demand Forecast Matrix"
              subtitle="Detailed forecasts, confidence bounds, growth rates, and walk-forward validation metrics."
              icon={<Cpu size={18} className="text-brand-600" />}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase">
                      <th className="py-2.5 px-3">Subject / Course</th>
                      <th className="py-2.5 px-3">Terms</th>
                      <th className="py-2.5 px-3">Latest Actual</th>
                      <th className="py-2.5 px-3">Predicted ({overview.forecasts[0]?.forecast_period})</th>
                      <th className="py-2.5 px-3">Heuristic Range (Not Calibrated CI)</th>
                      <th className="py-2.5 px-3">Growth / Trend</th>
                      <th className="py-2.5 px-3">Demand Tier</th>
                      <th className="py-2.5 px-3">Model & Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {overview.forecasts.map((f) => (
                      <tr key={f.subject_id} className="hover:bg-slate-50">
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-800">{f.subject_name}</p>
                          <p className="text-[11px] text-slate-400 font-mono">
                            {f.subject_code} • {f.department || 'General'}
                          </p>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-700">{f.terms_observed}</td>
                        <td className="py-3 px-3 font-mono font-semibold text-slate-700">
                          {f.latest_actual_enrollment ?? '—'}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-brand-700">
                          {f.predicted_enrollment.toFixed(1)}
                        </td>
                        <td className="py-3 px-3 text-slate-600">
                          {f.confidence_lower !== null && f.confidence_upper !== null ? (
                            <span>
                              {f.confidence_lower.toFixed(0)} – {f.confidence_upper.toFixed(0)}{' '}
                              <span className="text-[10px] text-slate-400">({f.confidence_level})</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">Unavailable</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {f.growth_rate_pct !== null ? (
                            <span
                              className={`inline-flex items-center gap-1 font-semibold ${
                                f.trend_direction === 'Growth'
                                  ? 'text-emerald-600'
                                  : f.trend_direction === 'Decline'
                                  ? 'text-rose-600'
                                  : 'text-slate-600'
                              }`}
                            >
                              {f.trend_direction === 'Growth' && <ArrowUpRight size={13} />}
                              {f.trend_direction === 'Decline' && <ArrowDownRight size={13} />}
                              {f.growth_rate_pct > 0 ? '+' : ''}
                              {f.growth_rate_pct}% ({f.trend_direction})
                            </span>
                          ) : (
                            <span className="text-slate-400">Insufficient Data</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`badge text-[10px] font-bold ${
                              f.demand_tier === 'High Demand'
                                ? 'bg-teal-100 text-teal-800'
                                : f.demand_tier === 'Moderate Demand'
                                ? 'bg-sky-100 text-sky-800'
                                : f.demand_tier === 'Low Demand'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {f.demand_tier === 'Unclassified' ? 'Unclassified (No Capacity)' : f.demand_tier}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <p className="font-semibold text-slate-700">{f.model_used}</p>
                          <p className="text-[10px] text-slate-500">
                            Status: {f.validation_status}
                            {f.evaluation_metrics?.mae != null && ` • MAE: ${f.evaluation_metrics.mae}`}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </>
      )}

      {/* Saved Forecast History Tab */}
      {activeTab === 'history' && canViewHistory && (
        <SectionCard
          title="Persisted Forecast History"
          subtitle="Organization-scoped historical forecast snapshots saved for institutional auditability."
          icon={<History size={18} className="text-brand-600" />}
        >
          {historyLoading ? (
            <LoadingState title="Loading Forecast History..." description="Querying saved snapshots." />
          ) : history.length === 0 ? (
            <EmptyState
              title="No Saved Forecast Snapshots"
              description="Administrators can generate and save a forecast snapshot from the Live Demand Forecasts tab."
              icon={<History size={28} className="text-slate-400" />}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase">
                    <th className="py-2.5 px-3">Saved At</th>
                    <th className="py-2.5 px-3">Subject</th>
                    <th className="py-2.5 px-3">Target Period</th>
                    <th className="py-2.5 px-3">Predicted</th>
                    <th className="py-2.5 px-3">Model</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-slate-500">
                        {h.created_at ? new Date(h.created_at).toLocaleString() : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {h.subject_code} — {h.subject_name}
                      </td>
                      <td className="py-2.5 px-3 font-mono">{h.forecast_period}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-brand-700">
                        {h.predicted_enrollment.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-3">{h.model_used}</td>
                      <td className="py-2.5 px-3">
                        <span className="badge bg-slate-100 text-slate-700 text-[10px] font-semibold">
                          {h.validation_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
};
