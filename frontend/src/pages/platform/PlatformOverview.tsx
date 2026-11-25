import React, { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Clock, CreditCard, ShieldAlert, TrendingUp } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { platformApi } from '../../services/api';
import type { PlatformOverviewResponse } from '../../types';

export const PlatformOverview: React.FC = () => {
  const [data, setData] = useState<PlatformOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await platformApi.getOverview();
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to load platform overview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingState title="Loading Platform Control Tower..." description="Fetching multi-institution telemetry..." />;
  if (error) return <ErrorState title="Platform Overview Unavailable" message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Super Admin Overview"
        subtitle="Multi-institution SaaS governance, tenant lifecycle, and subscription telemetry."
        icon={<Building2 size={24} className="text-brand-600" />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Institutions" value={data?.total_institutions ?? 0} subtitle="Provisioned tenants" icon={<Building2 size={18} />} />
        <StatCard title="Active Institutions" value={data?.active_institutions ?? 0} subtitle="Production active" icon={<CheckCircle2 size={18} />} />
        <StatCard title="Trial Institutions" value={data?.trial_institutions ?? 0} subtitle="14-day evaluation" icon={<Clock size={18} />} />
        <StatCard title="Suspended" value={data?.suspended_institutions ?? 0} subtitle="Access blocked" icon={<ShieldAlert size={18} />} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Active Subscriptions" value={data?.active_subscriptions ?? 0} subtitle="Paid & active plans" icon={<CreditCard size={18} />} />
        <StatCard title="Past-Due Subscriptions" value={data?.past_due_subscriptions ?? 0} subtitle="Requires billing action" icon={<ShieldAlert size={18} />} />
        <StatCard title="Monthly Predictions Used" value={data?.monthly_predictions_used ?? 0} subtitle="Across all institutions" icon={<TrendingUp size={18} />} />
      </div>

      <SectionCard title="Multi-Tenant Governance" subtitle="All tenant actions are logged to immutable global audit logs.">
        <p className="text-sm text-slate-600">
          Use the Platform navigation to onboard new institutions, manage subscription plans, suspend/reactivate tenants, and inspect global audit logs.
        </p>
      </SectionCard>
    </div>
  );
};
