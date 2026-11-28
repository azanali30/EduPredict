import React, { useEffect, useState } from 'react';
import { attendanceApi } from '../../services/api';
import { AttendanceStatus, StudentAttendanceResponse } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { EmptyState } from '../../components/common/EmptyState';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Info,
} from 'lucide-react';

const badgeStyle = (status: AttendanceStatus) => {
  switch (status) {
    case 'Present':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'Late':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'Excused':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'Absent':
    default:
      return 'bg-rose-50 text-rose-700 border-rose-200';
  }
};

export const StudentAttendance: React.FC = () => {
  const [data, setData] = useState<StudentAttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const res = await attendanceApi.getMyAttendance({ limit: 50 });
        setData(res);
      } catch (err: any) {
        setError(err?.message || 'Failed to load verified attendance records.');
      } finally {
        setLoading(false);
      }
    };
    fetchAttendance();
  }, []);

  if (loading) {
    return (
      <LoadingState
        title="Loading Verified Attendance..."
        description="Retrieving your institutional roll-call history across enrolled subjects."
      />
    );
  }

  const verified = data?.verified_institutional_attendance;
  const mlProxy = data?.estimated_ml_proxy;
  const records = data?.records || [];

  const overallRateDisplay =
    verified &&
    verified.overall_attendance_percentage !== null &&
    verified.overall_attendance_percentage !== undefined
      ? `${verified.overall_attendance_percentage.toFixed(1)}%`
      : 'No sessions recorded';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Verified Institutional Attendance"
        subtitle="Inspect official subject-by-subject class roll call recorded by your instructors."
        icon={<Clock size={24} className="text-brand-royal" />}
      />

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}

      {/* Clear Distinction Disclosure */}
      <div className="p-4 rounded-xl bg-sky-50/80 border border-sky-200 text-navy-900 text-xs flex items-start gap-3">
        <Info size={16} className="text-brand-royal shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-navy-900">
            Verified Institutional Attendance vs. Estimated ML Attendance Proxy
          </div>
          <p className="mt-0.5 leading-relaxed text-slate-700">
            {data?.disclosure ||
              'Verified Institutional Attendance is calculated strictly from teacher-recorded roll-call sessions and never alters or overwrites the Estimated ML Attendance Proxy.'}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Verified Institutional Attendance"
          value={overallRateDisplay}
          subtitle={verified?.has_records ? verified.formula : 'No attendance sessions recorded'}
          badgeText={verified?.has_records ? 'Verified Roll Call' : 'Awaiting Roll Call'}
          badgeVariant={verified?.has_records ? 'success' : 'info'}
          icon={<CheckCircle2 size={20} className="text-emerald-600" />}
        />
        <StatCard
          title="Sessions Recorded"
          value={verified?.total_sessions ?? 0}
          subtitle={`${verified?.effective_sessions ?? 0} non-excused sessions`}
          icon={<Calendar size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Present & Late"
          value={`${verified?.present_count ?? 0} / ${verified?.late_count ?? 0}`}
          subtitle="Present · Late sessions"
          icon={<Clock size={20} className="text-brand-ocean" />}
        />
        <StatCard
          title="Absent & Excused"
          value={`${verified?.absent_count ?? 0} / ${verified?.excused_count ?? 0}`}
          subtitle="Absent · Excused sessions"
          icon={<Info size={20} className="text-amber-600" />}
        />
      </div>

      {/* Subject-Wise Breakdown */}
      <SectionCard
        title="Subject-Wise Verified Attendance Summary"
        subtitle="Roll-call percentages calculated strictly from recorded teacher sessions per enrolled course."
        icon={<Calendar size={18} className="text-brand-royal" />}
      >
        {!verified || verified.subject_summaries.length === 0 ? (
          <EmptyState
            icon={<Calendar size={28} />}
            title="No attendance sessions recorded"
            description="You have no active course enrollments or teacher roll-call sessions recorded yet."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Term</th>
                  <th>Sessions</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th>Late</th>
                  <th>Excused</th>
                  <th>Verified Rate</th>
                </tr>
              </thead>
              <tbody>
                {verified.subject_summaries.map((sub) => (
                  <tr key={`${sub.subject_id}-${sub.academic_term}`}>
                    <td>
                      <div className="font-bold text-xs text-navy-900">{sub.subject_name}</div>
                      {sub.subject_code && (
                        <div className="text-[11px] font-mono text-slate-400">{sub.subject_code}</div>
                      )}
                    </td>
                    <td className="font-mono text-xs">{sub.academic_term || '--'}</td>
                    <td className="text-xs font-semibold">{sub.total_sessions}</td>
                    <td className="text-xs font-semibold text-emerald-700">{sub.present_count}</td>
                    <td className="text-xs font-semibold text-rose-700">{sub.absent_count}</td>
                    <td className="text-xs font-semibold text-amber-700">{sub.late_count}</td>
                    <td className="text-xs font-semibold text-sky-700">{sub.excused_count}</td>
                    <td className="font-mono text-xs font-bold text-navy-900">
                      {sub.has_records && sub.attendance_percentage !== null
                        ? `${sub.attendance_percentage.toFixed(1)}%`
                        : 'No attendance sessions recorded'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Dated Roll-Call History */}
      <SectionCard
        title="Dated Roll-Call History"
        subtitle="Session-by-session log of your marked attendance entries."
        icon={<Clock size={18} className="text-brand-royal" />}
      >
        {records.length === 0 ? (
          <EmptyState
            icon={<Clock size={28} />}
            title="No attendance sessions recorded"
            description="Once your course instructors conduct and save roll-call sessions, each dated record will appear here."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="table">
              <thead>
                <tr>
                  <th>Session Date</th>
                  <th>Subject</th>
                  <th>Term</th>
                  <th>Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => (
                  <tr key={rec.id}>
                    <td className="font-mono text-xs font-bold text-navy-900">{rec.session_date}</td>
                    <td className="text-xs font-semibold text-slate-800">{rec.subject_name}</td>
                    <td className="font-mono text-xs">{rec.academic_term}</td>
                    <td>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgeStyle(
                          rec.status
                        )}`}
                      >
                        {rec.status}
                      </span>
                    </td>
                    <td className="text-xs text-slate-500">{rec.remarks || '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Separate Estimated ML Attendance Proxy Card */}
      <SectionCard
        title="Estimated ML Attendance Proxy (Separate Predictive Reference)"
        subtitle="Feature approximation used by ML prediction models across a 60-session baseline — distinct from verified roll call."
        icon={<Info size={18} className="text-slate-500" />}
      >
        {!mlProxy ? (
          <p className="text-xs text-slate-500">
            No ML prediction evaluations found yet. Prediction unavailable; verified roll-call attendance remains independent.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-slate-400 uppercase font-semibold tracking-wider text-[10px]">
                Reference Label
              </div>
              <div className="font-bold text-navy-900 mt-1">{mlProxy.label}</div>
              <div className="text-slate-500 mt-0.5">Subject: {mlProxy.subject || '--'}</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-slate-400 uppercase font-semibold tracking-wider text-[10px]">
                Proxy Calculation
              </div>
              <div className="font-extrabold text-lg text-navy-900 mt-1 font-mono">
                {mlProxy.estimated_attendance_percentage.toFixed(1)}%
              </div>
              <div className="text-slate-500 mt-0.5">
                Derived from {mlProxy.absences} absences / {mlProxy.assumed_sessions} baseline sessions
              </div>
            </div>
            <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200">
              <div className="text-amber-800 uppercase font-semibold tracking-wider text-[10px]">
                Model Formula
              </div>
              <div className="font-mono text-amber-950 font-semibold mt-1">{mlProxy.formula}</div>
              <div className="text-amber-800 mt-0.5">Non-registrar ML input reference only</div>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
};
