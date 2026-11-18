import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../../services/api';
import { User, PredictionRecord } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { SectionCard } from '../../components/common/SectionCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { PredictionDetailModal } from '../../components/predictions/PredictionDetailModal';
import { TeacherPredictionModal } from '../../components/predictions/TeacherPredictionModal';
import { Button } from '../../components/forms/Button';
import {
  Sparkles,
  Eye,
  RotateCcw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  BrainCircuit,
  History,
} from 'lucide-react';

const PAGE_SIZE = 15;

export const TeacherPredictions: React.FC = () => {
  const [students, setStudents] = useState<User[]>([]);
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedStudentId, setSelectedStudentId] = useState<string>('ALL');
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [selectedMilestone, setSelectedMilestone] = useState<string>('ALL');
  const [selectedRisk, setSelectedRisk] = useState<string>('ALL');

  // Modal states
  const [inspectingPrediction, setInspectingPrediction] = useState<PredictionRecord | null>(null);
  const [predictingStudent, setPredictingStudent] = useState<User | null>(null);

  // Load students once
  useEffect(() => {
    api.getTeacherStudents()
      .then((res) => setStudents(res.students || []))
      .catch((err) => console.error('Failed to load assigned students:', err));
  }, []);

  // Map of studentId -> User
  const studentMap = useMemo(() => {
    const map = new Map<string, User>();
    students.forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

  // Load predictions for current page & filters
  const loadPredictions = async () => {
    setLoading(true);
    setError(null);
    try {
      const skip = (currentPage - 1) * PAGE_SIZE;
      const params: any = {
        limit: PAGE_SIZE,
        skip,
      };

      if (selectedStudentId !== 'ALL') params.student_id = selectedStudentId;
      if (selectedSubject !== 'ALL') params.subject = selectedSubject;
      if (selectedMilestone !== 'ALL') params.milestone = parseInt(selectedMilestone, 10);

      const res = await api.listPredictions(params);
      let list = res.predictions || [];

      // Apply client-side risk status filter if selected
      if (selectedRisk !== 'ALL') {
        list = list.filter((p) => p.predicted_status === selectedRisk);
      }

      setPredictions(list);
      setTotalCount(res.total_count || 0);
    } catch (err: any) {
      console.error('Failed to retrieve prediction records:', err);
      setError(err?.message || 'Failed to retrieve prediction records from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPredictions();
  }, [currentPage, selectedStudentId, selectedSubject, selectedMilestone, selectedRisk]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const handleResetFilters = () => {
    setSelectedStudentId('ALL');
    setSelectedSubject('ALL');
    setSelectedMilestone('ALL');
    setSelectedRisk('ALL');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Predictions Intelligence Hub"
        subtitle="Auditable machine learning evaluation history, estimator telemetry, confidence metrics, and milestone assessments."
        badgeText="Model Governance"
        badgeVariant="brand"
        actions={
          <div className="flex items-center gap-2">
            {students.length > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setPredictingStudent(students[0])}
                leftIcon={<Sparkles size={14} />}
                className="bg-brand-royal hover:bg-brand-royal/90 text-white"
              >
                Run New Assessment
              </Button>
            )}
          </div>
        }
      />

      {/* Filter Toolbar */}
      <SectionCard noPadding>
        <div className="p-4 flex flex-col lg:flex-row items-center justify-between gap-4 bg-white">
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Student Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-slate-400">Student:</span>
              <select
                value={selectedStudentId}
                onChange={(e) => {
                  setSelectedStudentId(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:border-brand-royal max-w-[180px] truncate"
              >
                <option value="ALL">All Assigned Students</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-slate-400">Subject:</span>
              <select
                value={selectedSubject}
                onChange={(e) => {
                  setSelectedSubject(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:border-brand-royal"
              >
                <option value="ALL">All Subjects</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Portuguese Language">Portuguese</option>
              </select>
            </div>

            {/* Milestone Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-slate-400">Milestone:</span>
              <select
                value={selectedMilestone}
                onChange={(e) => {
                  setSelectedMilestone(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:border-brand-royal"
              >
                <option value="ALL">All Milestones</option>
                <option value="0">Milestone 0 (Initial)</option>
                <option value="1">Milestone 1 (Mid-Term)</option>
                <option value="2">Milestone 2 (Pre-Final)</option>
              </select>
            </div>

            {/* Risk Status Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-slate-400">Risk:</span>
              <select
                value={selectedRisk}
                onChange={(e) => {
                  setSelectedRisk(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:border-brand-royal"
              >
                <option value="ALL">All Risk Tiers</option>
                <option value="High Risk">High Risk</option>
                <option value="Moderate Risk">Moderate Risk</option>
                <option value="Low Risk / On Track">Low Risk</option>
              </select>
            </div>

            {(selectedStudentId !== 'ALL' || selectedSubject !== 'ALL' || selectedMilestone !== 'ALL' || selectedRisk !== 'ALL') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                leftIcon={<RotateCcw size={12} />}
                className="text-slate-500 hover:text-navy-900 text-xs"
              >
                Reset
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <History size={14} className="text-slate-400" />
            <span>
              {totalCount} Total Recorded {totalCount === 1 ? 'Assessment' : 'Assessments'}
            </span>
          </div>
        </div>
      </SectionCard>

      {/* Main Predictions Table */}
      {loading ? (
        <LoadingState title="Loading Prediction Records..." description="Retrieving historical model assessments and feature payloads." />
      ) : error ? (
        <ErrorState title="Failed to Load Prediction Records" message={error} onRetry={loadPredictions} />
      ) : predictions.length === 0 ? (
        <EmptyState
          icon={<BrainCircuit size={36} className="text-brand-royal" />}
          title="No Prediction Records Found"
          description="There are no machine learning assessment records matching your current filter criteria."
          actionText={selectedStudentId !== 'ALL' || selectedSubject !== 'ALL' || selectedMilestone !== 'ALL' ? 'Reset Filters' : undefined}
          onAction={handleResetFilters}
        />
      ) : (
        <div className="data-table-container shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Course Subject</th>
                <th>Milestone</th>
                <th>Projected Mark</th>
                <th>Risk Tier</th>
                <th>Model Confidence</th>
                <th>Estimator Provenance</th>
                <th>Date Evaluated</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {predictions.map((p) => {
                const student = studentMap.get(p.student_id);
                const studentName = student ? student.full_name : `ID: ${p.student_id.slice(-8)}`;

                return (
                  <tr key={p.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-sky-50 text-brand-royal font-bold text-xs flex items-center justify-center border border-sky-100 shrink-0">
                          {studentName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-semibold text-navy-900 text-xs block leading-tight">
                            {studentName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            ID: {p.student_id.slice(-8)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="text-xs text-slate-700 font-medium">{p.subject}</td>
                    <td>
                      <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        M{p.milestone}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-baseline gap-1 font-mono text-xs font-bold text-navy-950">
                        <span>{p.predicted_marks.toFixed(1)}</span>
                        <span className="text-[10px] text-slate-400">/ 100</span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={p.predicted_status} />
                    </td>
                    <td>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1 font-mono text-xs font-semibold text-slate-800">
                          <span>{(p.top_confidence * 100).toFixed(0)}%</span>
                          <span className="text-[10px] text-slate-400 font-sans">prob</span>
                        </div>
                        {p.uncertainty_warning && (
                          <span className="badge badge-warning text-[9px] py-0 px-1 font-bold inline-flex items-center gap-0.5">
                            <AlertTriangle size={9} /> Uncertainty
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="text-[11px] font-mono text-slate-500 leading-tight">
                        <span className="block truncate max-w-[130px]" title={p.regressor_model}>
                          R: {p.regressor_model || 'Champion Regressor'}
                        </span>
                        <span className="block truncate max-w-[130px] text-slate-400" title={p.classifier_model}>
                          C: {p.classifier_model || 'Champion Classifier'}
                        </span>
                      </div>
                    </td>
                    <td className="text-xs text-slate-500">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setInspectingPrediction(p)}
                        leftIcon={<Eye size={13} />}
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between text-xs text-slate-600">
              <span>
                Page {currentPage} of {totalPages} ({totalCount} total assessments)
              </span>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  leftIcon={<ChevronLeft size={14} />}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  rightIcon={<ChevronRight size={14} />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Prediction Detail Modal */}
      <PredictionDetailModal
        prediction={inspectingPrediction}
        isOpen={!!inspectingPrediction}
        onClose={() => setInspectingPrediction(null)}
      />

      {/* Teacher Prediction Assessment Modal */}
      <TeacherPredictionModal
        student={predictingStudent}
        isOpen={!!predictingStudent}
        onClose={() => setPredictingStudent(null)}
        onPredictionCreated={loadPredictions}
      />
    </div>
  );
};
