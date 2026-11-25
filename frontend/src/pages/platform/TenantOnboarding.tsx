import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { SectionCard } from '../../components/common/SectionCard';
import { platformApi } from '../../services/api';

export const TenantOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [planTier, setPlanTier] = useState('starter');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await platformApi.createInstitution({
        name,
        slug,
        admin_name: adminName,
        admin_email: adminEmail,
        admin_password: adminPassword,
        plan_tier: planTier,
        status: 'active',
      });
      navigate(`/platform/institutions/${res.institution.id}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to provision institution.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Onboard New Institution"
        subtitle="Provision a tenant institution, initial Admin, canonical subjects, and subscription."
        icon={<Building2 size={24} className="text-brand-600" />}
      />

      <SectionCard title="Institution Provisioning Form" subtitle="Compensating rollback protects against partial provisioning.">
        {error && <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Institution Name</label>
            <input required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" placeholder="Harvard University" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Subdomain Slug</label>
            <input required value={slug} onChange={(e) => setSlug(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" placeholder="harvard" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Initial Admin Name</label>
            <input required value={adminName} onChange={(e) => setAdminName(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" placeholder="Dean Admin" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Initial Admin Email</label>
            <input required type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" placeholder="admin@harvard.edu" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Initial Admin Password</label>
            <input required type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Plan Tier</label>
            <select value={planTier} onChange={(e) => setPlanTier(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white">
              <option value="starter">Starter ($0/mo · 25 seats)</option>
              <option value="growth">Growth ($199/mo · 150 seats)</option>
              <option value="enterprise">Enterprise ($599/mo · 1000 seats)</option>
            </select>
          </div>
          <button disabled={submitting} type="submit" className="px-4 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50">
            {submitting ? 'Provisioning...' : 'Provision Institution'}
          </button>
        </form>
      </SectionCard>
    </div>
  );
};
