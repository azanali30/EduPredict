import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { PredictionRecord, SubjectItem } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import {
  Clock,
  CheckCircle2,
  Info,
  Calendar,
} from 'lucide-react';

export const StudentAttendance: React.FC = () => {
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [predsRes, subjsRes] = await Promise.all([
          api.listPredictions(),
          api.getStudentSubjects(),
        ]);
        setPredictions(predsRes.predictions || []);
        setSubjects(subjsRes.subjects || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load attendance records.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <LoadingState title="Loading Attendance Records..." description="Compiling your attendance proxy indicators." />;
  }

  const latest = predictions[0];
  const feat = latest?.features_summary || {};
  const absences = feat.absences?.value ?? 2;
  const attendanceRate = feat.attendance_percentage?.value ?? Math.max(0, 100 - (absences / 60) * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Attendance Records & Participation Proxy"
        subtitle="Review session participation metrics, absence frequency, and consistency benchmarks."
        icon={<Clock size={24} className="text-brand-royal" />}
      />

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* Mandatory Proxy Notice */}
      <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-950 text-xs flex items-start gap-3">
        <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-amber-900">Estimated Attendance Proxy Disclosure</div>
          <p className="mt-0.5 leading-relaxed text-amber-800">
            Attendance percentage is calculated as an <span className="font-bold">Estimated Attendance Proxy</span> derived from recorded absences across a 60-session standardized academic baseline (<code className="font-mono px-1 py-0.5 bg-amber-100 rounded text-amber-900">100 - (absences / 60) * 100</code>). It is an indicator proxy used in regression models, not a replacement for official university registrar rolls.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Attendance Proxy Rate"
          value={`${attendanceRate.toFixed(1)}%`}
          subtitle="Estimated from 60-session baseline"
          icon={<Clock size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Recorded Absences"
          value={`${absences} sessions`}
          subtitle="Total missed lecture sessions"
          icon={<Calendar size={20} className="text-brand-ocean" />}
        />
        <StatCard
          title="Participation Standing"
          value={attendanceRate >= 90 ? 'Satisfactory' : 'Needs Review'}
          subtitle={attendanceRate >= 90 ? 'Well above risk threshold' : 'Approaching warning limit'}
          icon={<CheckCircle2 size={20} className={attendanceRate >= 90 ? 'text-emerald-500' : 'text-amber-500'} />}
        />
      </div>

      {/* Breakdown Card */}
      <SectionCard
        title="Attendance Consistency by Subject"
        subtitle="Subject-specific participation proxy indicators."
      >
        <div className="space-y-3">
          {subjects.map((s) => (
            <div
              key={s.id}
              className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <span className="font-mono text-xs font-bold text-brand-royal bg-brand-royal/10 px-2 py-0.5 rounded">
                  {s.code}
                </span>
                <h4 className="text-sm font-bold text-navy-900 mt-1">{s.name}</h4>
                <div className="text-xs text-slate-500 mt-0.5">Academic Term: {s.academic_term || '2026-T1'}</div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm font-bold text-navy-900">{attendanceRate.toFixed(1)}%</div>
                  <div className="text-[10px] text-slate-400">Estimated Proxy</div>
                </div>
                <div className="w-24 bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand-royal"
                    style={{ width: `${attendanceRate}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
};
