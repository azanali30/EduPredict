import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { User, PredictionRecord } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { EmptyState } from '../../components/common/EmptyState';
import { StudentProfileDrawer } from '../../components/common/StudentProfileDrawer';
import { useTeacherSubject } from '../../context/TeacherSubjectContext';
import {
  BookMarked,
  Search,
  Users,
  Award,
  Eye,
} from 'lucide-react';

export const TeacherAcademicRecords: React.FC = () => {
  const { selectedSubject, selectedSubjectId, hasNoAssignments, loading: subjectsLoading } = useTeacherSubject();
  const [students, setStudents] = useState<User[]>([]);
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);

  useEffect(() => {
    if (subjectsLoading) return;
    if (hasNoAssignments || !selectedSubjectId) {
      setStudents([]);
      setPredictions([]);
      setLoading(false);
      return;
    }

    const loadRecords = async () => {
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
        setError(err?.message || 'Failed to load classroom academic records.');
      } finally {
        setLoading(false);
      }
    };
    loadRecords();
  }, [selectedSubjectId, subjectsLoading, hasNoAssignments, selectedSubject]);

  if (loading || subjectsLoading) {
    return <LoadingState title="Loading Classroom Academic Records..." description="Synchronizing student records and evaluations." />;
  }

  const filteredStudents = students.filter(
    (s) =>
      s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Classroom Academic Records — ${selectedSubject?.name || 'Subject'}`}
        subtitle="Review evaluation histories, milestone grades, and academic performance records for actively enrolled students."
        icon={<BookMarked size={24} className="text-brand-royal" />}
      />

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Enrolled Students"
          value={students.length}
          subtitle={`Actively registered in ${selectedSubject?.code || 'course'}`}
          icon={<Users size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Milestone Evaluations"
          value={predictions.length}
          subtitle="Model predictions recorded"
          icon={<Award size={20} className="text-brand-ocean" />}
        />
        <StatCard
          title="Curriculum Scale"
          value={selectedSubject?.target_scale || '0–20 Scale'}
          subtitle="Portuguese Standard Assessment"
          icon={<BookMarked size={20} className="text-brand-mint" />}
        />
      </div>

      {/* Records Table */}
      <SectionCard
        title="Student Academic Evaluation Ledger"
        subtitle="Authorized students and their recorded performance metrics."
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search student by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 text-xs sm:text-sm"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Showing {filteredStudents.length} of {students.length} students
          </span>
        </div>

        {filteredStudents.length === 0 ? (
          <EmptyState
            title="No Enrolled Students"
            description="No student records found matching the active subject enrollment."
            icon={<BookMarked size={32} />}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Email</th>
                  <th>Evaluations on File</th>
                  <th>Latest Predicted Grade</th>
                  <th>Risk Classification</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((st) => {
                  const studentPreds = predictions.filter((p) => p.student_id === st.id);
                  const latestPred = studentPreds[0];
                  return (
                    <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="font-bold text-navy-900">{st.full_name}</td>
                      <td className="text-slate-500 text-xs">{st.email}</td>
                      <td>
                        <span className="badge bg-slate-100 text-slate-700 text-xs">
                          {studentPreds.length} recorded
                        </span>
                      </td>
                      <td className="font-semibold text-brand-royal text-sm">
                        {latestPred
                          ? `${(latestPred.predicted_final_grade ?? latestPred.predicted_marks ?? 0).toFixed(1)} / 20.0`
                          : 'Pending'}
                      </td>
                      <td>
                        {latestPred ? (
                          <span
                            className={`badge ${
                              latestPred.predicted_status === 'High Risk'
                                ? 'bg-rose-100 text-rose-800'
                                : latestPred.predicted_status === 'Moderate Risk'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            } text-[10px] font-bold`}
                          >
                            {latestPred.predicted_status}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No prediction yet</span>
                        )}
                      </td>
                      <td className="text-right">
                        <button
                          onClick={() => setSelectedStudent(st)}
                          className="btn btn-secondary btn-sm text-xs py-1 px-2.5"
                        >
                          <Eye size={14} className="mr-1" />
                          View Profile
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <StudentProfileDrawer
        student={selectedStudent}
        isOpen={Boolean(selectedStudent)}
        onClose={() => setSelectedStudent(null)}
      />
    </div>
  );
};
