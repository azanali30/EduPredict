import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { User, PredictionRecord } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { EmptyState } from '../../components/common/EmptyState';
import { useTeacherSubject } from '../../context/TeacherSubjectContext';
import {
  Activity,
  AlertTriangle,
  Info,
  CheckCircle2,
  TrendingDown,
} from 'lucide-react';

export const TeacherAnomalies: React.FC = () => {
  const { selectedSubject, selectedSubjectId, hasNoAssignments, loading: subjectsLoading } = useTeacherSubject();
  const [students, setStudents] = useState<User[]>([]);
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (subjectsLoading) return;
    if (hasNoAssignments || !selectedSubjectId) {
      setStudents([]);
      setPredictions([]);
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [studentsRes, predsRes] = await Promise.all([
          api.getTeacherStudents({ subject_id: selectedSubjectId }),
          api.listPredictions({ subject: selectedSubject?.name, limit: 100 }),
        ]);
        setStudents(studentsRes.students || []);
        setPredictions(predsRes.predictions || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to retrieve anomaly monitoring records.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [selectedSubjectId, subjectsLoading, hasNoAssignments, selectedSubject]);

  if (loading || subjectsLoading) {
    return <LoadingState title="Loading Anomaly Monitor..." description="Auditing student performance trajectories." />;
  }

  // Detect advisory anomalies based on empirical feature heuristics
  const flaggedAnomalies = predictions
    .map((pred) => {
      const student = students.find((s) => s.id === pred.student_id);
      const features = pred.features_summary || {};
      const studyHours = features.study_hours_per_week?.value ?? 0;
      const absences = features.absences?.value ?? 0;
      const grade = pred.predicted_final_grade ?? pred.predicted_marks ?? 0;

      let anomalyReason = '';
      let severity: 'low' | 'medium' | 'high' = 'low';

      // Discrepancy 1: High study hours (> 7 hrs) but predicted low grade (< 10)
      if (studyHours >= 7 && grade < 10) {
        anomalyReason = 'High study effort but low predicted performance (Learning friction discrepancy)';
        severity = 'medium';
      }
      // Discrepancy 2: High absences (> 10) and low predicted grade (< 9)
      else if (absences >= 10 && grade < 9) {
        anomalyReason = 'Elevated absenteeism correlated with severe performance drop';
        severity = 'high';
      }
      // Discrepancy 3: Predicted High Risk despite early milestone passing
      else if (pred.predicted_status === 'High Risk' && grade < 8) {
        anomalyReason = 'Steep negative performance trajectory identified by predictive model';
        severity = 'high';
      }

      if (!anomalyReason) return null;

      return {
        id: pred.id,
        studentName: student?.full_name || 'Enrolled Student',
        studentEmail: student?.email || 'N/A',
        milestone: pred.milestone,
        predictedGrade: grade,
        studyHours,
        absences,
        anomalyReason,
        severity,
        recordedAt: pred.created_at,
      };
    })
    .filter(Boolean);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Classroom Anomaly & Discrepancy Monitor — ${selectedSubject?.name || 'Subject'}`}
        subtitle="Detect unusual learning patterns, effort-to-outcome discrepancies, and sudden academic trajectory shifts."
        icon={<Activity size={24} className="text-brand-royal" />}
      />

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* Advisory Disclosure Banner */}
      <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-100 text-blue-950 text-xs flex items-start gap-3">
        <Info size={16} className="text-brand-royal shrink-0 mt-0.5" />
        <div>
          <div className="font-bold">Transparent Advisory Indicator Notice</div>
          <p className="mt-0.5 leading-relaxed text-blue-900">
            Anomaly alerts identify unusual patterns between recorded study effort, absences, and predicted milestone outcomes. These alerts are advisory heuristic indicators designed to guide teacher mentorship, not definitive behavioral judgments.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Monitored Students"
          value={students.length}
          subtitle={`Active in ${selectedSubject?.code || 'course'}`}
          icon={<Activity size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Flagged Discrepancies"
          value={flaggedAnomalies.length}
          subtitle="Learning friction alerts"
          icon={<AlertTriangle size={20} className="text-amber-500" />}
        />
        <StatCard
          title="Anomaly Index"
          value={students.length > 0 ? `${((flaggedAnomalies.length / students.length) * 100).toFixed(0)}%` : '0%'}
          subtitle="Percentage of cohort flagged"
          icon={<TrendingDown size={20} className="text-rose-500" />}
        />
      </div>

      {/* Anomalies Table */}
      <SectionCard
        title="Detected Trajectory Discrepancies"
        subtitle="Review identified performance discrepancies within your assigned classroom."
      >
        {flaggedAnomalies.length === 0 ? (
          <EmptyState
            title="Zero Learning Anomalies Detected"
            description="All student trajectories align normally with baseline effort and performance expectations."
            icon={<CheckCircle2 size={32} className="text-emerald-500" />}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Milestone</th>
                  <th>Predicted Grade</th>
                  <th>Study Effort</th>
                  <th>Absences</th>
                  <th>Discrepancy Rationale</th>
                  <th>Severity</th>
                </tr>
              </thead>
              <tbody>
                {flaggedAnomalies.map((anom: any) => (
                  <tr key={anom.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="font-bold text-navy-900">{anom.studentName}</td>
                    <td className="font-mono text-xs">M{anom.milestone}</td>
                    <td className="font-semibold text-rose-600 text-sm">
                      {anom.predictedGrade.toFixed(1)} / 20.0
                    </td>
                    <td className="text-xs text-slate-600 font-medium">
                      {anom.studyHours} hrs/wk
                    </td>
                    <td className="text-xs text-slate-600">
                      {anom.absences} sessions
                    </td>
                    <td className="text-xs text-slate-700 max-w-xs leading-snug">
                      {anom.anomalyReason}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          anom.severity === 'high'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        } text-[10px] font-bold uppercase`}
                      >
                        {anom.severity} priority
                      </span>
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
