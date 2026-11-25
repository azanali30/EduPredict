import React, { useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { platformApi } from '../../services/api';
import type { SubscriptionPlan, SubscriptionRecord } from '../../types';

export const SubscriptionPlans: React.FC = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subs, setSubs] = useState<SubscriptionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, sRes] = await Promise.all([platformApi.listPlans(), platformApi.listSubscriptions()]);
      setPlans(pRes.plans || []);
      setSubs(sRes.subscriptions || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load subscriptions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <LoadingState title="Loading Plans & Subscriptions..." description="Fetching billing catalog..." />;
  if (error) return <ErrorState title="Subscriptions Unavailable" message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader title="SaaS Plans & Tenant Subscriptions" subtitle="Centralized plan tiers, quotas, and active billing status." icon={<CreditCard size={24} className="text-brand-600" />} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((p) => (
          <SectionCard key={p.plan_tier} title={`${p.name} ($${p.price_monthly_usd}/mo)`} subtitle={`${p.seat_limit} seats · ${p.prediction_quota_monthly} predictions/mo`}>
            <ul className="text-xs text-slate-600 space-y-1">
              {p.features.map((f) => <li key={f}>• {f}</li>)}
            </ul>
          </SectionCard>
        ))}
      </div>

      <SectionCard title="Tenant Subscriptions" subtitle="Live usage across organizations.">
        {subs.length === 0 ? (
          <p className="text-sm text-slate-500">No tenant subscriptions recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2 pr-4">Organization ID</th>
                  <th className="py-2 px-3">Plan</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Seats</th>
                  <th className="py-2 px-3">Predictions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subs.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 pr-4 font-mono text-xs">{s.organization_id}</td>
                    <td className="py-2 px-3 uppercase text-xs font-semibold">{s.plan_tier}</td>
                    <td className="py-2 px-3">{s.billing_status}</td>
                    <td className="py-2 px-3">{s.seats_used ?? 0} / {s.seat_limit}</td>
                    <td className="py-2 px-3">{s.predictions_used} / {s.prediction_quota_monthly}</td>
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
