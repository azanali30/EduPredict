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
import { useTeacherSubject, TeacherSubjectSelector } from '../../context/TeacherSubjectContext';
import { Button } from '../../components/forms/Button';
import {
  Users,
  Search,
  UserCheck,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  BookOpen,
  Lock,
} from 'lucide-react';

export const TeacherStudents: React.FC = () => {
  const { selectedSubject, selectedSubjectId, hasNoAssignments, loading: subjectsLoading } = useTeacherSubject();
  const [students, setStudents] = useState<User[]>([]);
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drawer & Modal state
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [predictingStudent, setPredictingStudent] = useState<User | null>(null);

  const loadData = async () => {
    if (hasNoAssignments || !selectedSubjectId) {
      setStudents([]);
      setPredictions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setStudents([]);
    setPredictions([]);
    setSelectedStudent(null);
    setPredictingStudent(null);
    try {
      const [studentsRes, predsRes] = await Promise.all([
        api.getTeacherStudents({ subject_id: selectedSubjectId }),
        api.listPredictions({ subject: selectedSubject?.name, limit: 100 }),
      ]);
      setStudents(studentsRes.students || []);
      setPredictions(predsRes.predictions || []);
    } catch (err: any) {
      console.error('Failed to load assigned students or predictions:', err);
      setError(err?.message || 'Failed to fetch assigned students from server.');
      setStudents([]);
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Clear open modals/drawers when selected subject changes
    setSelectedStudent(null);
    setPredictingStudent(null);
    setSearchTerm('');
    setRiskFilter('ALL');

    if (!subjectsLoading) {
      loadData();
    }
  }, [selectedSubjectId, subjectsLoading, hasNoAssignments]);

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

      return true;
    });
  }, [students, searchTerm, riskFilter, latestPredictionByStudent]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setRiskFilter('ALL');
  };

  if (subjectsLoading || (loading && !students.length && !hasNoAssignments)) {
    return (
      <LoadingState
        title="Loading Assigned Student Directory..."
        description="Synchronizing authorized course enrollments and prediction telemetry."
      />
    );
  }

  if (hasNoAssignments) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Assigned Students Directory"
          subtitle="Manage learner records, monitor risk status, and trigger AI performance assessments."
          badgeText="Instructor Authorized"
          badgeVariant="teacher"
        />
        <div className="card p-12 text-center bg-white border border-slate-200">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200 shadow-sm">
            <Lock size={28} />
          </div>
          <h2 className="text-xl font-extrabold text-navy-900 mb-2">No Active Subject Assignments</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed mb-6">
            No active subject assignments. Please contact an administrator to be allocated to academic subjects.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600">
            <span>Subject-Based RBAC Policy Enforced</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Failed to Load Student Directory" message={error} onRetry={loadData} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Assigned Students Directory"
        subtitle={`Learners actively enrolled in ${selectedSubject?.name || 'your assigned course'}.`}
        badgeText={selectedSubject ? `${selectedSubject.name} (${selectedSubject.code})` : 'Authorized'}
        badgeVariant="teacher"
        actions={
          <div className="flex items-center gap-3">
            <TeacherSubjectSelector showLabel={false} />
            <span className="text-xs font-semibold text-slate-500 hidden sm:inline">
              {students.length} Total {students.length === 1 ? 'Learner' : 'Learners'}
            </span>
          </div>
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
                Learners Requiring Academic Attention in {selectedSubject?.name}
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
            onClick={() => setRiskFilter(highRiskCount > 0 ? 'High Risk' : 'Moderate Risk')}
            className="bg-white border-amber-300 text-amber-900 hover:bg-amber-100 shrink-0 text-xs font-bold"
          >
            Filter Flagged Learners
          </Button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <SectionCard noPadding>
        <div className="p-4 flex flex-col md:flex-row items-center justify-between gap-4 bg-white">
          <div className="relative w-full md:max-w-md">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${selectedSubject?.name || ''} learners by name, ID, or email...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 outline-none focus:border-brand-royal focus:ring-2 focus:ring-brand-royal/20 transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            {/* Risk Status Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-slate-400">Risk Filter:</span>
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 outline-none focus:border-brand-royal cursor-pointer"
              >
                <option value="ALL">All Cohort</option>
                <option value="High Risk">High Risk</option>
                <option value="Moderate Risk">Moderate Risk</option>
                <option value="Low Risk / On Track">Low Risk / On Track</option>
                <option value="NO_PRED">Unscreened</option>
              </select>
            </div>

            {(searchTerm || riskFilter !== 'ALL') && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                leftIcon={<RotateCcw size={13} />}
                className="text-slate-500 hover:text-navy-900"
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      </SectionCard>

      {/* Main Student Table */}
      {filteredStudents.length === 0 ? (
        <EmptyState
          title={
            searchTerm || riskFilter !== 'ALL'
              ? 'No Matching Learners'
              : `No Students Enrolled in ${selectedSubject?.name || 'this Course'}`
          }
          description={
            searchTerm || riskFilter !== 'ALL'
              ? 'No learners match your current filter criteria. Try adjusting your search query or risk filter.'
              : `There are currently no students actively enrolled in ${selectedSubject?.name}. An administrator can enroll students via Course Allocations.`
          }
          icon={<Users size={32} className="text-slate-400" />}
          actionText={searchTerm || riskFilter !== 'ALL' ? 'Clear Active Filters' : undefined}
          onAction={searchTerm || riskFilter !== 'ALL' ? handleResetFilters : undefined}
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="table">
            <thead>
              <tr>
                <th>Learner Name</th>
                <th>Learner ID</th>
                <th>Institutional Email</th>
                <th>Enrolled Subject</th>
                <th>Risk Evaluation</th>
                <th>Predicted Marks</th>
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
                          {s.full_name ? s.full_name.charAt(0).toUpperCase() : 'S'}
                        </div>
                        <span className="font-semibold text-navy-900">{s.full_name}</span>
                      </div>
                    </td>
                    <td className="font-mono text-xs text-slate-400">
                      {s.id.slice(-8)}
                    </td>
                    <td className="font-mono text-xs text-slate-600">{s.email}</td>
                    <td>
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                        <BookOpen size={12} className="text-slate-500" />
                        <span>{selectedSubject?.name || 'Assigned Course'}</span>
                      </span>
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
        students={students}
        isOpen={!!predictingStudent}
        onClose={() => setPredictingStudent(null)}
        onPredictionCreated={loadData}
      />
    </div>
  );
};
