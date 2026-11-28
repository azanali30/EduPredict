import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { AnalystTrendsResponse } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { EmptyState } from '../../components/common/EmptyState';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp, Calendar, Award, ShieldCheck } from 'lucide-react';
import { formatRaw20Grade } from '../../utils/gradeUtils';

export const AnalystTrends: React.FC = () => {
  const [trends, setTrends] = useState<AnalystTrendsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrends = async () => {
      try {
        const res = await api.getAnalystTrends();
        setTrends(res);
      } catch (err: any) {
        setError(err?.message || 'Failed to load curriculum performance trends.');
      } finally {
        setLoading(false);
      }
    };
    fetchTrends();
  }, []);

  if (loading) {
    return (
      <LoadingState
        title="Analyzing Longitudinal Cohort Trends..."
        description="Computing SDC-compliant term benchmarks without disclosing individual PII."
      />
    );
  }

  const termTrends = trends?.term_trends || [];
  const chartRows = termTrends.filter(
    (t) => !t.suppressed && t.institutional_avg_raw20 !== null
  );

  const avgDisplay = trends?.institutional_suppressed
    ? 'Suppressed (<5)'
    : trends?.institutional_avg_raw20 !== null && trends?.institutional_avg_raw20 !== undefined
    ? formatRaw20Grade(trends.institutional_avg_raw20)
    : 'Insufficient Data';

  const growthDisplay =
    trends?.trend_available &&
    trends.growth_delta_raw20 !== null &&
    trends.growth_delta_raw20 !== undefined
      ? `${trends.growth_delta_raw20 >= 0 ? '+' : ''}${trends.growth_delta_raw20.toFixed(2)} pts`
      : 'Not enough data to calculate a trend';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Institutional Performance Trends & Curriculum Health"
        subtitle="Longitudinal cohort benchmarking with N < 5 Statistical Disclosure Control (SDC) enforcement."
        icon={<TrendingUp size={24} className="text-brand-royal" />}
      />

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      <div className="p-4 rounded-xl bg-sky-50/80 border border-sky-200 text-xs text-navy-900 flex items-start gap-2.5">
        <ShieldCheck size={16} className="text-brand-royal shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Statistical Disclosure Control Active (N &lt; {trends?.sdc_threshold ?? 5}):</span>{' '}
          Cohorts with fewer than {trends?.sdc_threshold ?? 5} distinct students are suppressed automatically. Trends are computed strictly from unsuppressed persisted terms.
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Institutional Average"
          value={avgDisplay}
          subtitle={
            trends?.institutional_suppressed
              ? 'Suppressed below privacy threshold'
              : 'Persisted evaluation mean'
          }
          icon={<Award size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Multi-Term Change"
          value={growthDisplay}
          subtitle={trends?.trend_message || 'Not enough data to calculate a trend'}
          icon={<TrendingUp size={20} className="text-emerald-500" />}
        />
        <StatCard
          title="Monitored Terms"
          value={`${trends?.monitored_terms_count ?? 0} Term(s)`}
          subtitle={`${trends?.unsuppressed_terms_count ?? 0} unsuppressed for trend lines`}
          icon={<Calendar size={20} className="text-brand-ocean" />}
        />
      </div>

      {/* Line Chart */}
      <SectionCard
        title="Multi-Term Subject Performance Progression"
        subtitle="Mean outcome trajectories on 0–20 Portuguese standardized scale across unsuppressed cohorts."
      >
        {!trends?.trend_available || chartRows.length < 2 ? (
          <EmptyState
            icon={<TrendingUp size={32} />}
            title="Not enough data to calculate a trend"
            description="At least 2 unsuppressed academic terms (each with N ≥ 5 distinct students) are required to plot a valid cohort trajectory."
          />
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="term" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 20]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="math_avg_raw20"
                  name="Mathematics Mean (0–20)"
                  stroke="#0284c7"
                  strokeWidth={3}
                  dot={{ r: 5 }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="portuguese_avg_raw20"
                  name="Portuguese Mean (0–20)"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ r: 5 }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="institutional_avg_raw20"
                  name="Institutional Composite Mean"
                  stroke="#0B192C"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      {/* Term-by-Term Privacy & Suppression Table */}
      <SectionCard
        title="Term Cohort Suppression Ledger"
        subtitle="Audit log of monitored academic terms and privacy suppression decisions."
      >
        {termTrends.length === 0 ? (
          <EmptyState
            icon={<Calendar size={28} />}
            title="Insufficient historical data"
            description="No persisted predictions, academic records, or roll-call sessions exist yet across academic terms."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="table">
              <thead>
                <tr>
                  <th>Term</th>
                  <th>Cohort Size</th>
                  <th>Institutional Mean (0–20)</th>
                  <th>Math Mean</th>
                  <th>Portuguese Mean</th>
                  <th>Verified Attendance</th>
                  <th>Privacy Status</th>
                </tr>
              </thead>
              <tbody>
                {termTrends.map((t) => (
                  <tr key={t.term}>
                    <td className="font-mono text-xs font-bold text-navy-900">{t.term}</td>
                    <td className="font-mono text-xs">{t.display_count}</td>
                    <td className="font-mono text-xs">
                      {t.institutional_avg_raw20 !== null ? formatRaw20Grade(t.institutional_avg_raw20) : 'Suppressed / N/A'}
                    </td>
                    <td className="font-mono text-xs">
                      {t.math_avg_raw20 !== null ? formatRaw20Grade(t.math_avg_raw20) : 'Suppressed / N/A'}
                    </td>
                    <td className="font-mono text-xs">
                      {t.portuguese_avg_raw20 !== null ? formatRaw20Grade(t.portuguese_avg_raw20) : 'Suppressed / N/A'}
                    </td>
                    <td className="font-mono text-xs">
                      {t.attendance_rate_percentage !== null ? `${t.attendance_rate_percentage.toFixed(1)}%` : 'Suppressed / N/A'}
                    </td>
                    <td>
                      {t.suppressed ? (
                        <span className="badge bg-amber-100 text-amber-800 text-[10px] font-bold">
                          Suppressed (&lt;5)
                        </span>
                      ) : (
                        <span className="badge bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          Unsuppressed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
};
