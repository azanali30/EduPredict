import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Building2 } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { platformApi } from '../../services/api';
import type { InstitutionRecord } from '../../types';

export const InstitutionDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [inst, setInst] = useState<InstitutionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await platformApi.getInstitution(id);
      setInst(res.institution);
    } catch (err: any) {
      setError(err?.message || 'Failed to load institution details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  if (loading) return <LoadingState title="Loading Institution Details..." description="Retrieving tenant metadata..." />;
  if (error || !inst) return <ErrorState title="Institution Not Found" message={error || 'Unknown institution'} onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={inst.name}
        subtitle={`Slug: ${inst.slug} · Canonical Organization ID: ${inst.organization_id}`}
        icon={<Building2 size={24} className="text-brand-600" />}
        actions={
          <Link to="/platform/institutions" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
            <ArrowLeft size={16} /> Back to Directory
          </Link>
        }
      />

      <SectionCard title="Tenant Summary" subtitle="Operational status, seat counts, and subscription details.">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div><p className="text-xs text-slate-500">Status</p><p className="font-bold">{inst.status}</p></div>
          <div><p className="text-xs text-slate-500">Plan Tier</p><p className="font-bold uppercase">{inst.plan_tier}</p></div>
          <div><p className="text-xs text-slate-500">Users</p><p className="font-bold">{inst.user_count ?? 0}</p></div>
          <div><p className="text-xs text-slate-500">Subjects</p><p className="font-bold">{inst.subject_count ?? 0}</p></div>
        </div>
      </SectionCard>
    </div>
  );
};
