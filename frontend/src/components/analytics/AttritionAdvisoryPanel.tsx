import React, { useCallback, useEffect, useState } from 'react';
import { Info, RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api';
import { AttritionAdvisorySummary } from '../../types';
import { SectionCard } from '../common/SectionCard';

export const AttritionAdvisoryPanel: React.FC = () => {
  const [data, setData] = useState<AttritionAdvisorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await api.getAttritionAdvisorySummary()); }
    catch (err: any) { setError(err?.message || 'Unable to load the advisory summary.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <SectionCard title="Academic Attrition Vulnerability Indicator" subtitle="Phase 7D · Transparent cohort-level heuristic"
    rightAction={<button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"><RefreshCw size={14} className={loading ? 'animate-spin' : ''}/> Refresh</button>}>
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs leading-relaxed text-amber-950"><div className="mb-1 flex items-center gap-2 font-bold"><Info size={15}/> Important methodology notice</div>This is not a trained dropout model, calibrated probability, or proof that a learner has withdrawn. It counts historical cohort records matching a transparent rule. It must not trigger penalties or automated intervention.</div>
      {loading && <p className="text-sm text-slate-500">Loading cohort advisory data…</p>}
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {!loading && !error && data && <>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {data.subjects.map(s => <div key={s.subject} className="rounded-xl border border-slate-200 p-4">
            <div className="mb-3 font-bold text-slate-800">{s.subject}</div>
            <div className="grid grid-cols-2 gap-3">
              <div><div className="text-[11px] uppercase tracking-wide text-slate-400">Eligible records</div><div className="mt-1 text-2xl font-bold text-slate-800">{s.eligible_records.display}</div></div>
              <div><div className="text-[11px] uppercase tracking-wide text-slate-400">Rule flags</div><div className="mt-1 text-2xl font-bold text-amber-700">{s.vulnerability_flags.display}</div></div>
            </div>
            <div className="mt-3 text-xs text-slate-500">{s.suppressed ? 'Small cohort: values suppressed (N < 5)' : `Cohort flag rate: ${s.flag_rate_pct ?? 0}%`}</div>
          </div>)}
          {data.subjects.length === 0 && <p className="text-sm text-slate-500">No eligible analytical records are available for your authorized scope.</p>}
        </div>
        <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-600"><div className="mb-2 flex items-center gap-2 font-semibold text-slate-800"><ShieldCheck size={15}/> Rule definition</div><p>Raw absences ≥ {data.indicator.high_absence_threshold} sessions AND Period 1 mark &lt; {data.indicator.period_mark_threshold_pct}% AND Period 2 mark &lt; {data.indicator.period_mark_threshold_pct}%.</p><p className="mt-2">{data.indicator.warning}</p></div>
      </>}
    </div>
  </SectionCard>;
};
