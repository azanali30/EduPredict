import React, { useEffect, useState, useCallback } from 'react';
import { api, attendanceApi } from '../../services/api';
import {
  AttendanceSessionItem,
  AttendanceStatus,
  PredictionRecord,
  TeacherAttendanceSummaryResponse,
  User,
} from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { EmptyState } from '../../components/common/EmptyState';
import { Button } from '../../components/forms/Button';
import { useTeacherSubject } from '../../context/TeacherSubjectContext';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  Info,
  PlusCircle,
  Save,
  Users,
} from 'lucide-react';

const STATUS_OPTIONS: AttendanceStatus[] = ['Present', 'Absent', 'Late', 'Excused'];

const statusPillClass = (status: AttendanceStatus, active: boolean) => {
  if (!active) {
    return 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50';
  }
  switch (status) {
    case 'Present':
      return 'bg-emerald-600 text-white border-emerald-600';
    case 'Late':
      return 'bg-amber-500 text-white border-amber-500';
    case 'Excused':
      return 'bg-sky-600 text-white border-sky-600';
    case 'Absent':
    default:
      return 'bg-rose-600 text-white border-rose-600';
  }
};

export const TeacherAttendance: React.FC = () => {
  const {
    selectedSubject,
    selectedSubjectId,
    hasNoAssignments,
    loading: subjectsLoading,
  } = useTeacherSubject();

  const todayIso = new Date().toISOString().slice(0, 10);

  const [students, setStudents] = useState<User[]>([]);
  const [sessions, setSessions] = useState<AttendanceSessionItem[]>([]);
  const [summary, setSummary] = useState<TeacherAttendanceSummaryResponse | null>(null);
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Create session form state
  const [sessionDate, setSessionDate] = useState<string>(todayIso);
  const [academicTerm, setAcademicTerm] = useState<string>('2026-T1');
  const [sessionTitle, setSessionTitle] = useState<string>('');
  const [sessionNotes, setSessionNotes] = useState<string>('');
  const [marks, setMarks] = useState<Record<string, { status: AttendanceStatus; remarks: string }>>({});
  const [submitting, setSubmitting] = useState(false);

  // Edit existing session state
  const [editingSession, setEditingSession] = useState<AttendanceSessionItem | null>(null);
  const [editMarks, setEditMarks] = useState<
    Record<string, { name: string; email: string; status: AttendanceStatus; remarks: string }>
  >({});
  const [editNotes, setEditNotes] = useState<string>('');
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (selectedSubject?.academic_term) {
      setAcademicTerm(selectedSubject.academic_term);
    }
  }, [selectedSubject]);

  const selectedSubjectName = selectedSubject?.name;
  const selectedSubjectTerm = selectedSubject?.academic_term;

  const loadData = useCallback(async () => {
    if (!selectedSubjectId) return;
    setLoading(true);
    setError(null);
    try {
      const termFilter = selectedSubjectTerm || undefined;
      const [studentsRes, sessionsRes, summaryRes, predsRes] = await Promise.all([
        api.getTeacherStudents({ subject_id: selectedSubjectId, academic_term: termFilter }),
        attendanceApi.listSessions({ subject_id: selectedSubjectId, academic_term: termFilter, limit: 50 }),
        attendanceApi.getSummary({ subject_id: selectedSubjectId, academic_term: termFilter }),
        api.listPredictions({ subject: selectedSubjectName, limit: 100 }),
      ]);
      const studentList = studentsRes.students || [];
      setStudents(studentList);
      setSessions(sessionsRes.sessions || []);
      setSummary(summaryRes);
      setPredictions(predsRes.predictions || []);

      const initialMarks: Record<string, { status: AttendanceStatus; remarks: string }> = {};
      studentList.forEach((st) => {
        initialMarks[st.id] = { status: 'Present', remarks: '' };
      });
      setMarks(initialMarks);
    } catch (err: any) {
      setError(err?.message || 'Failed to retrieve attendance register data.');
    } finally {
      setLoading(false);
    }
  }, [selectedSubjectId, selectedSubjectName, selectedSubjectTerm]);

  useEffect(() => {
    if (subjectsLoading) return;
    if (hasNoAssignments || !selectedSubjectId) {
      setStudents([]);
      setSessions([]);
      setSummary(null);
      setPredictions([]);
      setLoading(false);
      return;
    }
    loadData();
  }, [selectedSubjectId, subjectsLoading, hasNoAssignments, loadData]);

  const handleMarkAll = (status: AttendanceStatus) => {
    const next: Record<string, { status: AttendanceStatus; remarks: string }> = {};
    students.forEach((st) => {
      next[st.id] = { status, remarks: marks[st.id]?.remarks || '' };
    });
    setMarks(next);
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId || !selectedSubject) return;

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const recordsPayload = students.map((st) => ({
        student_id: st.id,
        status: marks[st.id]?.status || 'Present',
        remarks: marks[st.id]?.remarks?.trim() || undefined,
      }));

      await attendanceApi.createSession({
        subject_id: selectedSubjectId,
        academic_term: academicTerm.trim() || selectedSubject.academic_term || '2026-T1',
        session_date: sessionDate,
        session_title: sessionTitle.trim() || undefined,
        notes: sessionNotes.trim() || undefined,
        records: recordsPayload.length > 0 ? recordsPayload : undefined,
      });

      setSuccessMsg(
        `Attendance session saved for ${selectedSubject.name} (${sessionDate}). Verified Institutional Attendance updated without altering ML proxy baselines.`
      );
      setSessionTitle('');
      setSessionNotes('');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to save attendance session.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditSession = async (sessionId: string) => {
    setLoadingDetail(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await attendanceApi.getSessionDetail(sessionId);
      setEditingSession(res.session);
      setEditNotes(res.session.notes || '');
      const mapped: Record<
        string,
        { name: string; email: string; status: AttendanceStatus; remarks: string }
      > = {};
      res.roster.forEach((r) => {
        mapped[r.student_id] = {
          name: r.student_name,
          email: r.student_email,
          status: (r.status as AttendanceStatus) || 'Present',
          remarks: r.remarks || '',
        };
      });
      setEditMarks(mapped);
    } catch (err: any) {
      setError(err?.message || 'Failed to load session roster.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSaveEditedSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession) return;
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const payloadRecords = Object.entries(editMarks).map(([studentId, entry]) => ({
        student_id: studentId,
        status: entry.status,
        remarks: entry.remarks.trim() || undefined,
      }));
      await attendanceApi.markSessionRecords(editingSession.id, {
        notes: editNotes.trim(),
        records: payloadRecords,
      });
      setSuccessMsg(`Updated roll-call marks for ${editingSession.session_date}.`);
      setEditingSession(null);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update session marks.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || subjectsLoading) {
    return (
      <LoadingState
        title="Loading Attendance Register..."
        description="Retrieving subject roll-call sessions and enrolled student roster."
      />
    );
  }

  const overall = summary?.overall;
  const verifiedRateLabel =
    overall && overall.attendance_percentage !== null && overall.attendance_percentage !== undefined
      ? `${overall.attendance_percentage.toFixed(1)}%`
      : 'No sessions';

  // Separate ML prediction proxy overview ONLY for students who have an evaluation
  const mlProxyRows = students.map((st) => {
    const latest = predictions.find((p) => p.student_id === st.id);
    const feat = latest?.features_summary;
    const absencesVal = feat?.absences?.value;
    const proxyPct = feat?.attendance_percentage?.value;
    return {
      id: st.id,
      name: st.full_name,
      hasEvaluation: Boolean(latest && typeof absencesVal === 'number'),
      absences: typeof absencesVal === 'number' ? absencesVal : null,
      proxyPct: typeof proxyPct === 'number' ? proxyPct : null,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Institutional Attendance Register"
        subtitle={
          selectedSubject
            ? `Record and inspect verified class roll-call sessions for ${selectedSubject.name} (${selectedSubject.academic_term || '2026-T1'})`
            : 'Record and inspect verified class roll-call sessions'
        }
        icon={<Clock size={24} className="text-brand-royal" />}
        actions={
          selectedSubject && (
            <span className="badge badge-info text-xs font-semibold px-3 py-1.5">
              Subject: {selectedSubject.name} ({selectedSubject.code || 'ACTIVE'})
            </span>
          )
        }
      />

      {error && <ErrorAlert message={error} onDismiss={() => setError(null)} />}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-700 font-bold hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Proxy Separation Notice */}
      <div className="p-4 rounded-xl bg-sky-50/80 border border-sky-200 text-navy-900 text-xs flex items-start gap-3">
        <Info size={16} className="text-brand-royal shrink-0 mt-0.5" />
        <div>
          <div className="font-bold text-navy-900">
            Verified Institutional Attendance vs. Estimated ML Attendance Proxy
          </div>
          <p className="mt-0.5 leading-relaxed text-slate-700">
            Roll-call records saved here measure <strong>Verified Institutional Attendance</strong>{' '}
            (Present, Absent, Late, Excused) and remain strictly isolated from the{' '}
            <strong>Estimated ML Attendance Proxy</strong> (<code className="font-mono">max(0, 100 - (absences / 60) * 100)</code>)
            so historical ML feature pipelines stay statistically consistent.
          </p>
        </div>
      </div>

      {hasNoAssignments ? (
        <EmptyState
          icon={<Users size={28} />}
          title="No Subject Assignments Found"
          description="You do not currently have an active subject teaching assignment. Contact an administrator to configure subject assignments before marking roll call."
        />
      ) : (
        <>
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Verified Attendance Rate"
              value={verifiedRateLabel}
              subtitle="Present + Late over non-excused marks"
              badgeText={overall?.has_records ? 'Verified Roll Call' : 'No Sessions'}
              badgeVariant={overall?.has_records ? 'success' : 'info'}
              icon={<CheckCircle2 size={20} className="text-emerald-600" />}
            />
            <StatCard
              title="Recorded Sessions"
              value={overall?.total_sessions ?? 0}
              subtitle="Completed class roll calls"
              icon={<Calendar size={20} className="text-brand-royal" />}
            />
            <StatCard
              title="Enrolled Roster"
              value={students.length}
              subtitle="Students in selected subject"
              icon={<Users size={20} className="text-brand-ocean" />}
            />
            <StatCard
              title="Marks Breakdown"
              value={`${overall?.present_count ?? 0}P / ${overall?.absent_count ?? 0}A`}
              subtitle={`${overall?.late_count ?? 0} Late · ${overall?.excused_count ?? 0} Excused`}
              icon={<Clock size={20} className="text-amber-600" />}
            />
          </div>

          {/* Create New Roll-Call Session */}
          <SectionCard
            title="Take Roll Call (Create Attendance Session)"
            subtitle="Select date, optional topic title, and record status for each enrolled student."
            icon={<PlusCircle size={18} className="text-brand-royal" />}
            rightAction={
              students.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleMarkAll('Present')}
                  >
                    Mark All Present
                  </Button>
                </div>
              )
            }
          >
            {students.length === 0 ? (
              <EmptyState
                icon={<Users size={24} />}
                title="No Students Enrolled"
                description="No active students are enrolled in this subject and term yet."
              />
            ) : (
              <form onSubmit={handleCreateSession} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="label text-xs font-semibold text-slate-600 block mb-1">
                      Session Date
                    </label>
                    <input
                      type="date"
                      required
                      max={todayIso}
                      value={sessionDate}
                      onChange={(e) => setSessionDate(e.target.value)}
                      className="input w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="label text-xs font-semibold text-slate-600 block mb-1">
                      Academic Term
                    </label>
                    <input
                      type="text"
                      required
                      value={academicTerm}
                      onChange={(e) => setAcademicTerm(e.target.value)}
                      placeholder="2026-T1"
                      className="input w-full text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="label text-xs font-semibold text-slate-600 block mb-1">
                      Session Title (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      value={sessionTitle}
                      onChange={(e) => setSessionTitle(e.target.value)}
                      placeholder="e.g., Lecture 04 / Lab A"
                      className="input w-full text-sm"
                    />
                  </div>
                  <div>
                    <label className="label text-xs font-semibold text-slate-600 block mb-1">
                      Session Notes (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={300}
                      value={sessionNotes}
                      onChange={(e) => setSessionNotes(e.target.value)}
                      placeholder="Optional class notes"
                      className="input w-full text-sm"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Status</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((st) => {
                        const entry = marks[st.id] || { status: 'Present', remarks: '' };
                        return (
                          <tr key={st.id}>
                            <td>
                              <div className="font-bold text-navy-900 text-xs">{st.full_name}</div>
                              <div className="text-[11px] text-slate-500">{st.email}</div>
                            </td>
                            <td>
                              <div className="flex flex-wrap gap-1.5">
                                {STATUS_OPTIONS.map((opt) => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() =>
                                      setMarks((prev) => ({
                                        ...prev,
                                        [st.id]: { ...entry, status: opt },
                                      }))
                                    }
                                    className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors ${statusPillClass(
                                      opt,
                                      entry.status === opt
                                    )}`}
                                  >
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </td>
                            <td>
                              <input
                                type="text"
                                maxLength={200}
                                value={entry.remarks}
                                onChange={(e) =>
                                  setMarks((prev) => ({
                                    ...prev,
                                    [st.id]: { ...entry, remarks: e.target.value },
                                  }))
                                }
                                placeholder="Optional note..."
                                className="input text-xs py-1 px-2 w-full min-w-[160px]"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={submitting}
                    leftIcon={<Save size={16} />}
                  >
                    Save Roll-Call Session
                  </Button>
                </div>
              </form>
            )}
          </SectionCard>

          {/* Edit Existing Session Modal/Inline Panel */}
          {(loadingDetail || editingSession) && (
            <SectionCard
              title={
                editingSession
                  ? `Editing Session: ${editingSession.session_date} ${editingSession.session_title ? `— ${editingSession.session_title}` : ''
                  }`
                  : 'Loading Session...'
              }
              subtitle="Update previously recorded attendance marks for this session."
              icon={<Edit3 size={18} className="text-brand-royal" />}
              rightAction={
                editingSession && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingSession(null)}
                  >
                    Close Editor
                  </Button>
                )
              }
            >
              {loadingDetail ? (
                <LoadingState title="Loading Session Roster..." description="Fetching recorded statuses." />
              ) : (
                editingSession && (
                  <form onSubmit={handleSaveEditedSession} className="space-y-4">
                    <div>
                      <label className="label text-xs font-semibold text-slate-600 block mb-1">
                        Session Notes
                      </label>
                      <input
                        type="text"
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        className="input w-full text-sm"
                        placeholder="Optional session notes"
                      />
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Student</th>
                            <th>Status</th>
                            <th>Remarks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(editMarks).map(([studentId, entry]) => (
                            <tr key={studentId}>
                              <td>
                                <div className="font-bold text-navy-900 text-xs">{entry.name}</div>
                                <div className="text-[11px] text-slate-500">{entry.email}</div>
                              </td>
                              <td>
                                <div className="flex flex-wrap gap-1.5">
                                  {STATUS_OPTIONS.map((opt) => (
                                    <button
                                      key={opt}
                                      type="button"
                                      onClick={() =>
                                        setEditMarks((prev) => ({
                                          ...prev,
                                          [studentId]: { ...entry, status: opt },
                                        }))
                                      }
                                      className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${statusPillClass(
                                        opt,
                                        entry.status === opt
                                      )}`}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              </td>
                              <td>
                                <input
                                  type="text"
                                  value={entry.remarks}
                                  onChange={(e) =>
                                    setEditMarks((prev) => ({
                                      ...prev,
                                      [studentId]: { ...entry, remarks: e.target.value },
                                    }))
                                  }
                                  placeholder="Optional remark..."
                                  className="input text-xs py-1 px-2 w-full"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="submit" variant="primary" isLoading={submitting} leftIcon={<Save size={16} />}>
                        Update Attendance Marks
                      </Button>
                    </div>
                  </form>
                )
              )}
            </SectionCard>
          )}

          {/* Recorded Sessions History */}
          <SectionCard
            title="Verified Roll-Call Session History"
            subtitle="Inspect or edit past attendance sessions conducted for this subject."
            icon={<Calendar size={18} className="text-brand-royal" />}
          >
            {sessions.length === 0 ? (
              <EmptyState
                icon={<Calendar size={28} />}
                title="No attendance sessions recorded"
                description="Use the roll-call form above to record your first class attendance session."
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Title</th>
                      <th>Term</th>
                      <th>Marked</th>
                      <th>Present</th>
                      <th>Absent</th>
                      <th>Late</th>
                      <th>Excused</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.id}>
                        <td className="font-mono text-xs font-bold text-navy-900">{s.session_date}</td>
                        <td className="text-xs font-semibold text-slate-700">
                          {s.session_title || 'Regular Session'}
                        </td>
                        <td className="font-mono text-xs">{s.academic_term}</td>
                        <td className="text-xs font-semibold">{s.total_students}</td>
                        <td className="text-xs font-semibold text-emerald-700">{s.present_count}</td>
                        <td className="text-xs font-semibold text-rose-700">{s.absent_count}</td>
                        <td className="text-xs font-semibold text-amber-700">{s.late_count}</td>
                        <td className="text-xs font-semibold text-sky-700">{s.excused_count}</td>
                        <td>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            leftIcon={<Edit3 size={13} />}
                            onClick={() => handleOpenEditSession(s.id)}
                          >
                            Review / Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          {/* Secondary Reference: Estimated ML Proxy (Strictly Separated & Honest) */}
          <SectionCard
            title="Estimated ML Attendance Proxy Reference (Model Feature Only)"
            subtitle="Read-only absences baseline extracted from persisted ML predictions (never fabricated when unscreened)."
            icon={<Info size={18} className="text-slate-500" />}
          >
            {mlProxyRows.filter((r) => r.hasEvaluation).length === 0 ? (
              <EmptyState
                icon={<Info size={24} />}
                title="No ML Evaluation Proxy Data"
                description="Run a predictive assessment in AI Predictions to view a student's 60-session absence proxy alongside verified roll call."
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Source Label</th>
                      <th>Absences Feature</th>
                      <th>Estimated ML Proxy (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mlProxyRows.map((row) => (
                      <tr key={row.id}>
                        <td className="font-bold text-xs text-navy-900">{row.name}</td>
                        <td className="text-xs text-slate-600">
                          {row.hasEvaluation ? 'Estimated ML Attendance Proxy' : 'Not Evaluated'}
                        </td>
                        <td className="font-mono text-xs">
                          {row.absences !== null ? `${row.absences} sessions` : '--'}
                        </td>
                        <td className="font-mono text-xs font-semibold">
                          {row.proxyPct !== null ? `${row.proxyPct.toFixed(1)}%` : 'Unavailable'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
};
