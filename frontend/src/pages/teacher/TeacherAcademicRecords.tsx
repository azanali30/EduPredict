import React, { useCallback, useEffect, useState } from 'react';
import { api, academicRecordsApi } from '../../services/api';
import {
  AcademicRecordCsvImportSummary,
  AcademicRecordItem,
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
  BookOpen,
  CheckCircle2,
  Download,
  Edit3,
  FileSpreadsheet,
  PlusCircle,
  Save,
  Upload,
  Users,
} from 'lucide-react';

export const TeacherAcademicRecords: React.FC = () => {
  const {
    selectedSubject,
    selectedSubjectId,
    hasNoAssignments,
    loading: subjectsLoading,
  } = useTeacherSubject();

  const [students, setStudents] = useState<User[]>([]);
  const [records, setRecords] = useState<AcademicRecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Create / Edit record form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string>('');
  const [term, setTerm] = useState<string>('2026-T1');
  const [g1, setG1] = useState<string>('');
  const [g2, setG2] = useState<string>('');
  const [finalMarks, setFinalMarks] = useState<string>('');
  const [assignmentRate, setAssignmentRate] = useState<string>('');
  const [quizAvg, setQuizAvg] = useState<string>('');
  const [studyHours, setStudyHours] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Bulk CSV Import
  const [csvText, setCsvText] = useState<string>('');
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<AcademicRecordCsvImportSummary | null>(null);

  useEffect(() => {
    if (selectedSubject?.academic_term) {
      setTerm(selectedSubject.academic_term);
    }
  }, [selectedSubject]);

  const selectedSubjectTerm = selectedSubject?.academic_term;

  const loadData = useCallback(async () => {
    if (!selectedSubjectId) return;
    setLoading(true);
    setError(null);
    try {
      const termFilter = selectedSubjectTerm || undefined;
      const [studentsRes, recsRes] = await Promise.all([
        api.getTeacherStudents({ subject_id: selectedSubjectId, academic_term: termFilter }),
        academicRecordsApi.list({ subject_id: selectedSubjectId, term: termFilter, limit: 100 }),
      ]);
      const studentList = studentsRes.students || [];
      setStudents(studentList);
      setRecords(recsRes.records || []);
      if (studentList.length > 0) {
        setStudentId((prev) => prev || studentList[0].id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to retrieve coursework records.');
    } finally {
      setLoading(false);
    }
  }, [selectedSubjectId, selectedSubjectTerm]);

  useEffect(() => {
    if (subjectsLoading) return;
    if (hasNoAssignments || !selectedSubjectId) {
      setStudents([]);
      setRecords([]);
      setLoading(false);
      return;
    }
    loadData();
  }, [selectedSubjectId, subjectsLoading, hasNoAssignments, loadData]);

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

  const handleEditRow = (rec: AcademicRecordItem) => {
    setEditingId(rec.id);
    setStudentId(rec.student_id || '');
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
    setSuccessMsg(null);
  };

  const toOptionalNum = (val: string) => (val.trim() === '' ? undefined : Number(val));

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjectId || !selectedSubject) return;
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
        setSuccessMsg('Updated institutional coursework record.');
      } else {
        await academicRecordsApi.create({
          student_id: studentId,
          subject_id: selectedSubjectId,
          term: term.trim() || selectedSubject.academic_term || '2026-T1',
          g1: toOptionalNum(g1),
          g2: toOptionalNum(g2),
          final_exam_marks: toOptionalNum(finalMarks),
          assignment_completion_rate: toOptionalNum(assignmentRate),
          quiz_average: toOptionalNum(quizAvg),
          study_hours_per_week: toOptionalNum(studyHours),
          notes: notes.trim() || undefined,
        });
        setSuccessMsg('Saved new institutional coursework record.');
      }
      resetForm();
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to save coursework record.');
    } finally {
      setSaving(false);
    }
  };

  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const text = await file.text();
    setCsvText(text);
  };

  const handleDownloadSampleCsv = () => {
    const sampleEmail = students[0]?.email || 'student@edupredict.com';
    const subjName = selectedSubject?.name || 'Mathematics';
    const termName = term || selectedSubject?.academic_term || '2026-T1';
    const sample = [
      'student_email,subject,term,g1,g2,final_exam_marks,assignment_completion_rate,quiz_average,study_hours_per_week,notes',
      `${sampleEmail},${subjName},${termName},14,15,15.5,92,86,11.5,Verified midterm entry`,
    ].join('\n');
    const blob = new Blob([sample], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'academic_records_template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCsv = async () => {
    if (!csvText.trim()) {
      setError('Select a CSV file or paste CSV rows before importing.');
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
        `CSV import processed: ${res.summary.successful} created, ${res.summary.duplicate} duplicates skipped, ${res.summary.rejected} rejected.`
      );
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'CSV import failed.');
    } finally {
      setImporting(false);
    }
  };

  if (loading || subjectsLoading) {
    return (
      <LoadingState
        title="Loading Academic Records..."
        description="Retrieving coursework grades and assessment entries for your roster."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Coursework Records"
        subtitle={
          selectedSubject
            ? `Ingest, validate, and manage real assessment scores for ${selectedSubject.name} (${selectedSubject.academic_term || '2026-T1'})`
            : 'Manage student academic coursework and assessment records'
        }
        icon={<BookOpen size={24} className="text-brand-royal" />}
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

      {hasNoAssignments ? (
        <EmptyState
          icon={<Users size={28} />}
          title="No Subject Assignments Found"
          description="Contact an administrator to configure your active subject teaching assignments before recording coursework grades."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Persisted Coursework Records"
              value={records.length}
              subtitle="Stored in academic_records"
              icon={<BookOpen size={20} className="text-brand-royal" />}
            />
            <StatCard
              title="Enrolled Students"
              value={students.length}
              subtitle="Active in selected subject"
              icon={<Users size={20} className="text-brand-ocean" />}
            />
            <StatCard
              title="Active Academic Term"
              value={selectedSubject?.academic_term || term}
              subtitle="Distinct from ML predictions"
              icon={<FileSpreadsheet size={20} className="text-emerald-600" />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Manual Entry / Edit Form */}
            <SectionCard
              title={editingId ? 'Update Academic Record' : 'Record Student Coursework & Marks'}
              subtitle="Enter verified G1/G2/final exam grades (0–20) or assignment/quiz metrics (0–100%)."
              icon={<PlusCircle size={18} className="text-brand-royal" />}
              rightAction={
                editingId && (
                  <Button type="button" variant="outline" size="sm" onClick={resetForm}>
                    Cancel Edit
                  </Button>
                )
              }
            >
              {students.length === 0 ? (
                <EmptyState
                  icon={<Users size={24} />}
                  title="No Enrolled Students"
                  description="Enroll students in this subject first to record coursework entries."
                />
              ) : (
                <form onSubmit={handleSaveRecord} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs font-semibold text-slate-600 block mb-1">
                        Student
                      </label>
                      <select
                        value={studentId}
                        disabled={Boolean(editingId)}
                        onChange={(e) => setStudentId(e.target.value)}
                        className="input w-full text-sm"
                        required
                      >
                        {students.map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.full_name} ({st.email})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label text-xs font-semibold text-slate-600 block mb-1">
                        Academic Term
                      </label>
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
                      <label className="label text-xs font-semibold text-slate-600 block mb-1">
                        G1 Score (0–20)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="20"
                        value={g1}
                        onChange={(e) => setG1(e.target.value)}
                        placeholder="e.g. 14"
                        className="input w-full text-sm"
                      />
                    </div>
                    <div>
                      <label className="label text-xs font-semibold text-slate-600 block mb-1">
                        G2 Score (0–20)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="20"
                        value={g2}
                        onChange={(e) => setG2(e.target.value)}
                        placeholder="e.g. 15"
                        className="input w-full text-sm"
                      />
                    </div>
                    <div>
                      <label className="label text-xs font-semibold text-slate-600 block mb-1">
                        Final Exam (0–20)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="20"
                        value={finalMarks}
                        onChange={(e) => setFinalMarks(e.target.value)}
                        placeholder="Optional"
                        className="input w-full text-sm"
                      />
                    </div>
                    <div>
                      <label className="label text-xs font-semibold text-slate-600 block mb-1">
                        Assignments (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={assignmentRate}
                        onChange={(e) => setAssignmentRate(e.target.value)}
                        placeholder="0–100"
                        className="input w-full text-sm"
                      />
                    </div>
                    <div>
                      <label className="label text-xs font-semibold text-slate-600 block mb-1">
                        Quiz Average (%)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={quizAvg}
                        onChange={(e) => setQuizAvg(e.target.value)}
                        placeholder="0–100"
                        className="input w-full text-sm"
                      />
                    </div>
                    <div>
                      <label className="label text-xs font-semibold text-slate-600 block mb-1">
                        Study Hrs / Week
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="60"
                        value={studyHours}
                        onChange={(e) => setStudyHours(e.target.value)}
                        placeholder="0–60"
                        className="input w-full text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label text-xs font-semibold text-slate-600 block mb-1">
                      Coursework Notes (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={300}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Assessment notes or remarks"
                      className="input w-full text-sm"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button type="submit" variant="primary" isLoading={saving} leftIcon={<Save size={16} />}>
                      {editingId ? 'Save Changes' : 'Save Academic Record'}
                    </Button>
                  </div>
                </form>
              )}
            </SectionCard>

            {/* CSV Bulk Ingestion */}
            <SectionCard
              title="CSV Bulk Ingestion"
              subtitle="Upload or paste CSV rows with row-level range and enrollment validation."
              icon={<FileSpreadsheet size={18} className="text-emerald-600" />}
              rightAction={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  leftIcon={<Download size={14} />}
                  onClick={handleDownloadSampleCsv}
                >
                  Sample CSV
                </Button>
              }
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
                    <Upload size={14} />
                    <span>{csvFileName || 'Choose .csv File'}</span>
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleCsvFileChange}
                      className="hidden"
                    />
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Required: student_email or student_id, plus g1/g2/final_exam_marks/quiz_average
                  </span>
                </div>

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
                    Validate & Import CSV
                  </Button>
                </div>

                {importSummary && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                    <div className="grid grid-cols-4 gap-2 text-center font-semibold">
                      <div className="p-2 bg-white rounded-lg border border-slate-100">
                        <div className="text-[10px] text-slate-400">Total</div>
                        <div className="text-navy-900">{importSummary.total_rows}</div>
                      </div>
                      <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100 text-emerald-800">
                        <div className="text-[10px]">Successful</div>
                        <div>{importSummary.successful}</div>
                      </div>
                      <div className="p-2 bg-amber-50 rounded-lg border border-amber-100 text-amber-800">
                        <div className="text-[10px]">Duplicate</div>
                        <div>{importSummary.duplicate}</div>
                      </div>
                      <div className="p-2 bg-rose-50 rounded-lg border border-rose-100 text-rose-800">
                        <div className="text-[10px]">Rejected</div>
                        <div>{importSummary.rejected}</div>
                      </div>
                    </div>

                    {importSummary.errors.length > 0 && (
                      <div className="max-h-32 overflow-y-auto space-y-1 text-[11px] text-rose-700">
                        {importSummary.errors.map((errItem, idx) => (
                          <div key={idx}>
                            Row {errItem.row} ({errItem.status}): {errItem.reason}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </SectionCard>
          </div>

          {/* Persisted Records Table */}
          <SectionCard
            title="Persisted Student Academic Records"
            subtitle="Institutional coursework grades separated from ML predictions and roll-call attendance."
            icon={<BookOpen size={18} className="text-brand-royal" />}
          >
            {records.length === 0 ? (
              <EmptyState
                icon={<BookOpen size={28} />}
                title="No academic coursework records recorded yet"
                description="Use the manual entry form or CSV bulk importer above to record verified student coursework."
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Term</th>
                      <th>G1 / 20</th>
                      <th>G2 / 20</th>
                      <th>Final / 20</th>
                      <th>Assign %</th>
                      <th>Quiz %</th>
                      <th>Study Hrs</th>
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
                        <td className="font-mono text-xs">{rec.study_hours_per_week ?? '--'}</td>
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
        </>
      )}
    </div>
  );
};
