import React, { useEffect, useState } from 'react';
import { CreditCard, CheckCircle2, AlertTriangle } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { platformApi } from '../../services/api';
import type { SubscriptionPlan, SubscriptionRecord } from '../../types';

export const AdminBilling: React.FC = () => {
  const [sub, setSub] = useState<SubscriptionRecord | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await platformApi.getMySubscription();
      setSub(res.subscription);
      setPlans(res.plans || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load institution billing information.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handlePlanChange = async (tier: string) => {
    setMessage(null);
    setError(null);
    try {
      const res = await platformApi.changeMyPlan(tier);
      setSub(res.subscription);
      setMessage(`Subscription updated to ${res.subscription.plan_name || tier}.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to update subscription plan.');
    }
  };

  const handleCancel = async () => {
    setMessage(null);
    setError(null);
    try {
      const res = await platformApi.cancelMyPlan();
      setSub(res.subscription);
      setMessage('Subscription cancelled.');
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel subscription.');
    }
  };

  if (loading) return <LoadingState title="Loading Billing & Quotas..." description="Fetching institution subscription..." />;
  if (error && !sub) return <ErrorState title="Billing Unavailable" message={error} onRetry={load} />;
  if (!sub) return null;

  const isExpiredOrCancelled = sub.billing_status === 'expired' || sub.billing_status === 'cancelled';
  const isQuotaExceeded = sub.predictions_used >= sub.prediction_quota_monthly;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Institution Billing & Plan Quotas"
        subtitle={`Organization: ${sub.organization_id} · Server-enforced entitlements and usage quotas`}
        icon={<CreditCard size={24} className="text-brand-600" />}
      />

      {message && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">{message}</div>}
      {error && <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">{error}</div>}
      {isExpiredOrCancelled && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-2">
          <AlertTriangle size={18} />
          <span>Subscription is {sub.billing_status}. Upgrade or reactivate a plan to restore prediction quotas.</span>
        </div>
      )}
      {isQuotaExceeded && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-2">
          <AlertTriangle size={18} />
          <span>Monthly prediction quota reached ({sub.predictions_used}/{sub.prediction_quota_monthly}).</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Current Plan" value={sub.plan_name || sub.plan_tier.toUpperCase()} subtitle={`Status: ${sub.billing_status}`} icon={<CreditCard size={18} />} />
        <StatCard title="Seat Usage" value={`${sub.seats_used ?? 0} / ${sub.seat_limit}`} subtitle="Active institutional users" icon={<CheckCircle2 size={18} />} />
        <StatCard title="Prediction Quota" value={`${sub.predictions_used} / ${sub.prediction_quota_monthly}`} subtitle="Monthly inference usage" icon={<CheckCircle2 size={18} />} />
        <StatCard title="Monthly Price" value={`$${sub.price_monthly_usd ?? 0}`} subtitle="Current billing cycle" icon={<CreditCard size={18} />} />
      </div>

      <SectionCard title="Available Plans & Feature Entitlements" subtitle="Upgrade or downgrade your institution subscription.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p) => {
            const isCurrent = p.plan_tier === sub.plan_tier && sub.billing_status !== 'cancelled';
            return (
              <div key={p.plan_tier} className={`p-4 rounded-xl border ${isCurrent ? 'border-brand-500 bg-brand-50/30' : 'border-slate-200 bg-white'} space-y-3`}>
                <div>
                  <h4 className="font-bold text-slate-900">{p.name}</h4>
                  <p className="text-lg font-bold text-brand-600">${p.price_monthly_usd}/mo</p>
                  <p className="text-xs text-slate-500">{p.seat_limit} seats · {p.prediction_quota_monthly} predictions/mo</p>
                </div>
                <ul className="text-xs text-slate-600 space-y-1">
                  {p.features.map((f) => <li key={f}>• {f}</li>)}
                </ul>
                <button
                  disabled={isCurrent}
                  onClick={() => handlePlanChange(p.plan_tier)}
                  className="w-full py-2 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {isCurrent ? 'Current Plan' : `Switch to ${p.name}`}
                </button>
              </div>
            );
          })}
        </div>
        {sub.billing_status !== 'cancelled' && (
          <div className="mt-4 pt-4 border-t border-slate-200 flex justify-end">
            <button onClick={handleCancel} className="px-3 py-1.5 text-xs font-medium text-rose-700 border border-rose-300 rounded-lg hover:bg-rose-50">
              Cancel Subscription
            </button>
          </div>
        )}
      </SectionCard>
    </div>
  );
};
