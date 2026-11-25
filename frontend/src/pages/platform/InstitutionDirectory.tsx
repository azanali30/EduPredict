import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, PlusCircle } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { platformApi } from '../../services/api';
import type { InstitutionRecord } from '../../types';

export const InstitutionDirectory: React.FC = () => {
  const [institutions, setInstitutions] = useState<InstitutionRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (status = statusFilter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await platformApi.listInstitutions({ status: status || undefined, limit: 50 });
      setInstitutions(res.institutions || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load institutions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(statusFilter);
  }, [statusFilter]);

  const handleLifecycle = async (instId: string, action: 'activate' | 'suspend' | 'reactivate') => {
    try {
      if (action === 'activate') await platformApi.activateInstitution(instId);
      else if (action === 'suspend') await platformApi.suspendInstitution(instId, 'Suspended by Platform Super Admin');
      else await platformApi.reactivateInstitution(instId);
      await load(statusFilter);
    } catch (err: any) {
      setError(err?.message || 'Action failed.');
    }
  };

  if (loading) return <LoadingState title="Loading Institution Directory..." description="Fetching tenant registry..." />;
  if (error) return <ErrorState title="Institution Directory Unavailable" message={error} onRetry={() => load(statusFilter)} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Institution Directory"
        subtitle="Manage tenant institutions, lifecycle status, and canonical organization IDs."
        icon={<Building2 size={24} className="text-brand-600" />}
        actions={
          <Link
            to="/platform/onboarding"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg bg-brand-600 text-white hover:bg-brand-700"
          >
            <PlusCircle size={16} />
            Onboard Institution
          </Link>
        }
      />

      <SectionCard
        title="Registered Tenant Institutions"
        subtitle="Filter by lifecycle status or inspect tenant details."
      >
        <div className="mb-4">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="suspended">Suspended</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {institutions.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">No institutions found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                  <th className="py-2.5 pr-4">Institution</th>
                  <th className="py-2.5 px-3">Slug / Org ID</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Plan</th>
                  <th className="py-2.5 pl-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {institutions.map((inst) => (
                  <tr key={inst.id}>
                    <td className="py-3 pr-4 font-medium text-slate-900">
                      <Link to={`/platform/institutions/${inst.id}`} className="text-brand-600 hover:underline">
                        {inst.name}
                      </Link>
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-slate-600">
                      {inst.slug} ({inst.organization_id})
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">
                        {inst.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 uppercase text-xs">{inst.plan_tier}</td>
                    <td className="py-3 pl-3 text-right space-x-2">
                      {inst.status !== 'active' ? (
                        <button
                          onClick={() => handleLifecycle(inst.id, inst.status === 'suspended' ? 'reactivate' : 'activate')}
                          className="px-2.5 py-1 text-xs rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          {inst.status === 'suspended' ? 'Reactivate' : 'Activate'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleLifecycle(inst.id, 'suspend')}
                          className="px-2.5 py-1 text-xs rounded-md border border-rose-300 text-rose-700 hover:bg-rose-50"
                        >
                          Suspend
                        </button>
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
