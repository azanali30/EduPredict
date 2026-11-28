import React, { useCallback, useEffect, useState } from 'react';
import { api, academicRecordsApi } from '../../services/api';
import {
  AcademicRecordCsvImportSummary,
  AcademicRecordItem,
  SubjectItem,
  User,
} from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { EmptyState } from '../../components/common/EmptyState';
import { Button } from '../../components/forms/Button';
import {
  BookOpen,
  CheckCircle2,
  Edit3,
  FileSpreadsheet,
  PlusCircle,
  Save,
  Upload,
  Users,
} from 'lucide-react';

export const AdminAcademicRecords: React.FC = () => {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [records, setRecords] = useState<AcademicRecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [filterSubject, setFilterSubject] = useState<string>('');
  const [filterTerm, setFilterTerm] = useState<string>('');

  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [term, setTerm] = useState<string>('2026-T1');
  const [g1, setG1] = useState<string>('');
  const [g2, setG2] = useState<string>('');
  const [finalMarks, setFinalMarks] = useState<string>('');
  const [assignmentRate, setAssignmentRate] = useState<string>('');
  const [quizAvg, setQuizAvg] = useState<string>('');
  const [studyHours, setStudyHours] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // CSV Import
  const [csvText, setCsvText] = useState<string>('');
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<AcademicRecordCsvImportSummary | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [subjRes, stuRes, recsRes] = await Promise.all([
        api.adminListSubjects(true),
        api.getAdminUsers('student'),
        academicRecordsApi.list({
          subject_id: filterSubject || undefined,
          term: filterTerm.trim() || undefined,
          limit: 100,
        }),
      ]);
      const subjs = subjRes.subjects || [];
      const stus = stuRes.users || [];
      setSubjects(subjs);
      setStudents(stus);
      setRecords(recsRes.records || []);
      if (subjs.length > 0 && !selectedSubjectId) setSelectedSubjectId(subjs[0].id);
      if (stus.length > 0 && !selectedStudentId) setSelectedStudentId(stus[0].id);
    } catch (err: any) {
      setError(err?.message || 'Failed to load institutional academic records.');
    } finally {
      setLoading(false);
    }
  }, [filterSubject, filterTerm, selectedSubjectId, selectedStudentId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const resetForm = () => {
    setEditingId(null);
    setG1('');
    setG2('');
    setFinalMarks('');
    setAssignmentRate('');
    setQuizAvg('');
    setStudyHours('');
    setNotes('');
  };

  const toOptionalNum = (val: string) => (val.trim() === '' ? undefined : Number(val));

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      if (editingId) {
        await academicRecordsApi.update(editingId, {
          g1: g1.trim() === '' ? null : Number(g1),
          g2: g2.trim() === '' ? null : Number(g2),
          final_exam_marks: finalMarks.trim() === '' ? null : Number(finalMarks),
          assignment_completion_rate: assignmentRate.trim() === '' ? null : Number(assignmentRate),
          quiz_average: quizAvg.trim() === '' ? null : Number(quizAvg),
          study_hours_per_week: studyHours.trim() === '' ? null : Number(studyHours),
          notes: notes.trim() || null,
        });
        setSuccessMsg('Academic coursework record updated.');
      } else {
        await academicRecordsApi.create({
          student_id: selectedStudentId,
          subject_id: selectedSubjectId,
          term: term.trim(),
          g1: toOptionalNum(g1),
          g2: toOptionalNum(g2),
          final_exam_marks: toOptionalNum(finalMarks),
          assignment_completion_rate: toOptionalNum(assignmentRate),
          quiz_average: toOptionalNum(quizAvg),
          study_hours_per_week: toOptionalNum(studyHours),
          notes: notes.trim() || undefined,
        });
        setSuccessMsg('Academic coursework record created.');
      }
      resetForm();
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Failed to save academic record.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditRow = (rec: AcademicRecordItem) => {
    setEditingId(rec.id);
    if (rec.student_id) setSelectedStudentId(rec.student_id);
    if (rec.subject_id) setSelectedSubjectId(rec.subject_id);
    setTerm(rec.term);
    setG1(rec.g1 !== null && rec.g1 !== undefined ? String(rec.g1) : '');
    setG2(rec.g2 !== null && rec.g2 !== undefined ? String(rec.g2) : '');
    setFinalMarks(
      rec.final_exam_marks !== null && rec.final_exam_marks !== undefined
        ? String(rec.final_exam_marks)
        : ''
    );
    setAssignmentRate(
      rec.assignment_completion_rate !== null && rec.assignment_completion_rate !== undefined
        ? String(rec.assignment_completion_rate)
        : ''
    );
    setQuizAvg(rec.quiz_average !== null && rec.quiz_average !== undefined ? String(rec.quiz_average) : '');
    setStudyHours(
      rec.study_hours_per_week !== null && rec.study_hours_per_week !== undefined
        ? String(rec.study_hours_per_week)
        : ''
    );
    setNotes(rec.notes || '');
  };

  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    setCsvText(await file.text());
  };

  const handleImportCsv = async () => {
    if (!csvText.trim()) {
      setError('Select or paste CSV data before importing.');
      return;
    }
    setImporting(true);
    setError(null);
    setSuccessMsg(null);
    setImportSummary(null);
    try {
      const res = await academicRecordsApi.importCsvText({
        csv_content: csvText,
        subject_id: selectedSubjectId || undefined,
        term: term.trim() || undefined,
      });
      setImportSummary(res.summary);
      setSuccessMsg(
        `CSV import complete: ${res.summary.successful} inserted, ${res.summary.duplicate} duplicates, ${res.summary.rejected} rejected.`
      );
      await loadAll();
    } catch (err: any) {
      setError(err?.message || 'Institutional CSV import failed.');
    } finally {
      setImporting(false);
    }
  };

  if (loading && records.length === 0) {
    return (
      <LoadingState
        title="Loading Institutional Academic Records..."
        description="Fetching verified student coursework records across the institution."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Institutional Academic Records Registry"
        subtitle="Create, validate, bulk-import, and audit verified student coursework records across all subjects."
        icon={<BookOpen size={24} className="text-brand-royal" />}
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Institutional Records"
          value={records.length}
          subtitle="Verified coursework entries"
          icon={<BookOpen size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Registered Students"
          value={students.length}
          subtitle="Eligible student accounts"
          icon={<Users size={20} className="text-brand-ocean" />}
        />
        <StatCard
          title="Active Subjects"
          value={subjects.length}
          subtitle="Curriculum disciplines"
          icon={<FileSpreadsheet size={20} className="text-emerald-600" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard
          title={editingId ? 'Edit Academic Record' : 'Add Institutional Academic Record'}
          subtitle="Admin oversight creation and editing for any active student and subject."
          icon={<PlusCircle size={18} className="text-brand-royal" />}
          rightAction={
            editingId && (
              <Button type="button" variant="outline" size="sm" onClick={resetForm}>
                Cancel Edit
              </Button>
            )
          }
        >
          <form onSubmit={handleSaveRecord} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="label text-xs font-semibold text-slate-600 block mb-1">Student</label>
                <select
                  value={selectedStudentId}
                  disabled={Boolean(editingId)}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="input w-full text-sm"
                  required
                >
                  {students.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label text-xs font-semibold text-slate-600 block mb-1">Subject</label>
                <select
                  value={selectedSubjectId}
                  disabled={Boolean(editingId)}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="input w-full text-sm"
                  required
                >
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label text-xs font-semibold text-slate-600 block mb-1">Term</label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingId)}
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  className="input w-full text-sm font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="label text-xs font-semibold text-slate-600 block mb-1">G1 (0–20)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="20"
                  value={g1}
                  onChange={(e) => setG1(e.target.value)}
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="label text-xs font-semibold text-slate-600 block mb-1">G2 (0–20)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="20"
                  value={g2}
                  onChange={(e) => setG2(e.target.value)}
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="label text-xs font-semibold text-slate-600 block mb-1">Final (0–20)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="20"
                  value={finalMarks}
                  onChange={(e) => setFinalMarks(e.target.value)}
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="label text-xs font-semibold text-slate-600 block mb-1">Assign %</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={assignmentRate}
                  onChange={(e) => setAssignmentRate(e.target.value)}
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="label text-xs font-semibold text-slate-600 block mb-1">Quiz Avg %</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={quizAvg}
                  onChange={(e) => setQuizAvg(e.target.value)}
                  className="input w-full text-sm"
                />
              </div>
              <div>
                <label className="label text-xs font-semibold text-slate-600 block mb-1">Study Hrs</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="60"
                  value={studyHours}
                  onChange={(e) => setStudyHours(e.target.value)}
                  className="input w-full text-sm"
                />
              </div>
            </div>

            <div>
              <label className="label text-xs font-semibold text-slate-600 block mb-1">Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input w-full text-sm"
                placeholder="Optional institutional verification notes"
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" variant="primary" isLoading={saving} leftIcon={<Save size={16} />}>
                {editingId ? 'Update Record' : 'Create Record'}
              </Button>
            </div>
          </form>
        </SectionCard>

        <SectionCard
          title="Institutional CSV Bulk Import"
          subtitle="Validate and ingest institutional coursework CSV files across permitted students."
          icon={<FileSpreadsheet size={18} className="text-emerald-600" />}
        >
          <div className="space-y-3">
            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
              <Upload size={14} />
              <span>{csvFileName || 'Choose .csv File'}</span>
              <input type="file" accept=".csv,text/csv" onChange={handleCsvFileChange} className="hidden" />
            </label>
            <textarea
              rows={5}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="student_email,subject,term,g1,g2,final_exam_marks,assignment_completion_rate,quiz_average,study_hours_per_week"
              className="input w-full text-xs font-mono"
            />
            <div className="flex justify-end">
              <Button
                type="button"
                variant="primary"
                isLoading={importing}
                leftIcon={<Upload size={16} />}
                onClick={handleImportCsv}
              >
                Import CSV
              </Button>
            </div>
            {importSummary && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                <div className="font-bold text-navy-900">
                  Summary: {importSummary.successful} created · {importSummary.duplicate} duplicate · {importSummary.rejected} rejected
                </div>
                {importSummary.errors.map((e, i) => (
                  <div key={i} className="text-[11px] text-rose-700">
                    Row {e.row} ({e.status}): {e.reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* Institutional Records Table */}
      <SectionCard
        title="Academic Records Directory"
        subtitle="Verified coursework documents persisted in academic_records."
        icon={<BookOpen size={18} className="text-brand-royal" />}
        rightAction={
          <div className="flex items-center gap-2">
            <select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
              className="input text-xs py-1"
            >
              <option value="">All Subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={filterTerm}
              onChange={(e) => setFilterTerm(e.target.value)}
              placeholder="Filter term..."
              className="input text-xs py-1 w-28 font-mono"
            />
          </div>
        }
      >
        {records.length === 0 ? (
          <EmptyState
            icon={<BookOpen size={28} />}
            title="No academic records found"
            description="No coursework records match the active filter. Add records manually or via CSV above."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Subject</th>
                  <th>Term</th>
                  <th>G1</th>
                  <th>G2</th>
                  <th>Final</th>
                  <th>Assign %</th>
                  <th>Quiz %</th>
                  <th>Source</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => (
                  <tr key={rec.id}>
                    <td>
                      <div className="font-bold text-xs text-navy-900">{rec.student_name || rec.student_email}</div>
                      <div className="text-[11px] text-slate-400">{rec.student_email}</div>
                    </td>
                    <td className="text-xs font-semibold text-navy-900">{rec.subject}</td>
                    <td className="font-mono text-xs">{rec.term}</td>
                    <td className="font-mono text-xs">{rec.g1 ?? '--'}</td>
                    <td className="font-mono text-xs">{rec.g2 ?? '--'}</td>
                    <td className="font-mono text-xs font-bold">{rec.final_exam_marks ?? '--'}</td>
                    <td className="font-mono text-xs">
                      {rec.assignment_completion_rate !== null && rec.assignment_completion_rate !== undefined
                        ? `${rec.assignment_completion_rate}%`
                        : '--'}
                    </td>
                    <td className="font-mono text-xs">
                      {rec.quiz_average !== null && rec.quiz_average !== undefined ? `${rec.quiz_average}%` : '--'}
                    </td>
                    <td>
                      <span className="badge badge-info text-[10px]">{rec.source || 'manual_entry'}</span>
                    </td>
                    <td>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        leftIcon={<Edit3 size={12} />}
                        onClick={() => handleEditRow(rec)}
                      >
                        Edit
                      </Button>
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
