import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../../services/api';
import { User, PredictionRecord } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { SectionCard } from '../../components/common/SectionCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { StudentProfileDrawer } from '../../components/common/StudentProfileDrawer';
import { TeacherPredictionModal } from '../../components/predictions/TeacherPredictionModal';
import { Button } from '../../components/forms/Button';
import {
  Users,
  Search,
  UserCheck,
  Sparkles,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

export const TeacherStudents: React.FC = () => {
  const [students, setStudents] = useState<User[]>([]);
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drawer & Modal state
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [predictingStudent, setPredictingStudent] = useState<User | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [studentsRes, predsRes] = await Promise.all([
        api.getTeacherStudents(),
        api.listPredictions({ limit: 100 }),
      ]);
      setStudents(studentsRes.students || []);
      setPredictions(predsRes.predictions || []);
    } catch (err: any) {
      console.error('Failed to load assigned students or predictions:', err);
      setError(err?.message || 'Failed to fetch assigned students or predictions from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Map studentId -> Latest PredictionRecord
  const latestPredictionByStudent = useMemo(() => {
    const map = new Map<string, PredictionRecord>();
    predictions.forEach((pred) => {
      const existing = map.get(pred.student_id);
      if (!existing || new Date(pred.created_at) > new Date(existing.created_at)) {
        map.set(pred.student_id, pred);
      }
    });
    return map;
  }, [predictions]);

  // Cohort Risk Counts
  const { highRiskCount, modRiskCount } = useMemo(() => {
    let high = 0;
    let mod = 0;
    students.forEach((s) => {
      const pred = latestPredictionByStudent.get(s.id);
      if (pred?.predicted_status === 'High Risk') high++;
      else if (pred?.predicted_status === 'Moderate Risk') mod++;
    });
    return { highRiskCount: high, modRiskCount: mod };
  }, [students, latestPredictionByStudent]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const query = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !query ||
        s.full_name.toLowerCase().includes(query) ||
        s.email.toLowerCase().includes(query) ||
        s.id.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      const pred = latestPredictionByStudent.get(s.id);

      // Risk Filter
      if (riskFilter !== 'ALL') {
        if (riskFilter === 'NO_PRED') {
          if (pred) return false;
        } else if (pred?.predicted_status !== riskFilter) {
          return false;
        }
      }

      // Subject Filter (supported based on actual recorded predictions)
      if (subjectFilter !== 'ALL') {
        if (!pred || pred.subject !== subjectFilter) {
          return false;
        }
      }

      return true;
    });
  }, [students, searchTerm, riskFilter, subjectFilter, latestPredictionByStudent]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setRiskFilter('ALL');
    setSubjectFilter('ALL');
  };

  if (loading) {
    return <LoadingState title="Loading Assigned Student Directory..." description="Synchronizing student records and latest prediction metrics." />;
  }

  if (error) {
    return <ErrorState title="Failed to Load Student Directory" message={error} onRetry={loadData} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Assigned Students Directory"
        subtitle="Manage learner records, monitor risk status, and trigger AI performance assessments."
        badgeText="Instructor Authorized"
        badgeVariant="teacher"
        actions={
          <span className="text-xs font-semibold text-slate-500">
            {students.length} Total Assigned {students.length === 1 ? 'Learner' : 'Learners'}
          </span>
        }
      />

      {/* Academic Attention Banner (if any student is flagged High or Moderate Risk) */}
      {(highRiskCount > 0 || modRiskCount > 0) && (
        <div className="p-4 rounded-2xl border border-amber-300 bg-amber-50/90 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="text-xs">
              <span className="font-bold text-amber-900 block text-sm">
                Learners Requiring Academic Attention
              </span>
              <span className="text-amber-800">
                {highRiskCount} {highRiskCount === 1 ? 'student' : 'students'} flagged High Risk,{' '}
                {modRiskCount} {modRiskCount === 1 ? 'student' : 'students'} flagged Moderate Risk. Early intervention recommended.
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRiskFilter(highRiskCount > 0 ? 'High Risk' : 'Moderate Risk');
              setSubjectFilter('ALL');
            }}
            className="bg-white border-amber-300 text-amber-900 hover:bg-amber-100 shrink-0 text-xs font-bold"
          >
            Filter Flagged Learners
          </Button>
        </div>
      )}

      {/* Search & Multi-Criteria Filter Bar */}
      <SectionCard noPadding>
        <div className="p-4 flex flex-col md:flex-row items-center justify-between gap-4 bg-white">
          <div className="relative w-full md:max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name, ID, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 outline-none focus:border-brand-royal focus:ring-2 focus:ring-brand-royal/20 transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            {/* Risk Status Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-slate-400">Risk:</span>
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:border-brand-royal cursor-pointer"
              >
                <option value="ALL">All Cohort</option>
                <option value="High Risk">High Risk</option>
                <option value="Moderate Risk">Moderate Risk</option>
                <option value="Low Risk / On Track">Low Risk / On Track</option>
                <option value="NO_PRED">Not Yet Screened</option>
              </select>
            </div>

            {/* Subject Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-slate-400">Subject:</span>
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:border-brand-royal cursor-pointer"
              >
                <option value="ALL">All Subjects</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Portuguese Language">Portuguese</option>
              </select>
            </div>

            {(searchTerm || riskFilter !== 'ALL' || subjectFilter !== 'ALL') && (
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

            <span className="text-xs font-semibold text-slate-500 shrink-0">
              {filteredStudents.length} of {students.length}
            </span>
          </div>
        </div>
      </SectionCard>

      {/* Student Roster Table */}
      {filteredStudents.length === 0 ? (
        <EmptyState
          icon={<Users size={36} className="text-brand-royal" />}
          title={students.length === 0 ? "No Assigned Students" : "No Students Match Filter"}
          description={
            students.length === 0
              ? "Your instructor account does not currently have any student assignments. When an administrator links students in the Admin Console, they will appear here."
              : "No student records matched your search query or filter selection. Try resetting your filters."
          }
          actionText={students.length > 0 ? "Reset Filters" : undefined}
          onAction={students.length > 0 ? handleResetFilters : undefined}
        />
      ) : (
        <div className="data-table-container shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Database ID</th>
                <th>Institutional Email</th>
                <th>Enrolled Date</th>
                <th>Course Subject</th>
                <th>Latest AI Status</th>
                <th>Projected Mark</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((s) => {
                const latestPred = latestPredictionByStudent.get(s.id);
                return (
                  <tr key={s.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-royal via-brand-ocean to-brand-mint text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                          {s.full_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-navy-900">{s.full_name}</span>
                      </div>
                    </td>
                    <td className="font-mono text-xs text-slate-400">
                      {s.id.slice(-8)}
                    </td>
                    <td className="font-mono text-xs text-slate-600">{s.email}</td>
                    <td className="text-xs text-slate-500">
                      {s.created_at ? new Date(s.created_at).toLocaleDateString() : 'Active'}
                    </td>
                    <td className="text-xs font-medium text-slate-700">
                      {latestPred?.subject || <span className="text-slate-400">—</span>}
                    </td>
                    <td>
                      <StatusBadge
                        status={latestPred?.predicted_status || 'Unscreened'}
                        label={latestPred ? undefined : 'Unscreened'}
                      />
                    </td>
                    <td>
                      {latestPred ? (
                        <div className="flex items-baseline gap-1 font-mono text-xs font-bold text-navy-950">
                          <span>{latestPred.predicted_marks.toFixed(1)}</span>
                          <span className="text-[10px] text-slate-400">/ 100</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedStudent(s)}
                          leftIcon={<UserCheck size={13} />}
                        >
                          Profile
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => setPredictingStudent(s)}
                          leftIcon={<Sparkles size={13} />}
                        >
                          {latestPred ? 'Assess AI' : 'Assess Initial'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Student Profile Slide-Over Drawer */}
      <StudentProfileDrawer
        isOpen={!!selectedStudent}
        onClose={() => setSelectedStudent(null)}
        student={selectedStudent}
        latestPrediction={selectedStudent ? latestPredictionByStudent.get(selectedStudent.id) : null}
        onAssessClick={(student) => setPredictingStudent(student)}
      />

      {/* Teacher Prediction Modal */}
      <TeacherPredictionModal
        student={predictingStudent}
        isOpen={!!predictingStudent}
        onClose={() => setPredictingStudent(null)}
        onPredictionCreated={loadData}
      />
    </div>
  );
};
