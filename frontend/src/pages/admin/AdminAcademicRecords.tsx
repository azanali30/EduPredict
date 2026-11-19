import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { User, SubjectItem, PredictionRecord } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { EmptyState } from '../../components/common/EmptyState';
import {
  BookMarked,
  Search,
  Filter,
  GraduationCap,
  Award,
  BookOpen,
} from 'lucide-react';

export const AdminAcademicRecords: React.FC = () => {
  const [students, setStudents] = useState<User[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, subjsRes, predsRes] = await Promise.all([
          api.getAdminUsers('student'),
          api.adminListSubjects(),
          api.listPredictions({ limit: 100 }),
        ]);
        setStudents(usersRes.users || []);
        setSubjects(subjsRes.subjects || []);
        setPredictions(predsRes.predictions || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to retrieve academic records.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredPredictions = predictions.filter((p) => {
    const matchesSubject = !subjectFilter || p.subject === subjectFilter;
    const matchesSearch =
      !search ||
      p.subject.toLowerCase().includes(search.toLowerCase()) ||
      p.predicted_status.toLowerCase().includes(search.toLowerCase());
    return matchesSubject && matchesSearch;
  });

  if (loading) {
    return <LoadingState title="Loading Institutional Academic Records..." description="Aggregating student milestone records." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Institutional Academic Records"
        subtitle="Global governance over student academic milestones, subject evaluations, and curricular performance history."
        icon={<BookMarked size={24} className="text-brand-royal" />}
      />

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Student Academic Profiles"
          value={students.length}
          subtitle="Enrolled student records"
          icon={<GraduationCap size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Active Curriculums"
          value={subjects.length}
          subtitle="Subject disciplines monitored"
          icon={<BookOpen size={20} className="text-brand-ocean" />}
        />
        <StatCard
          title="Recorded Academic Milestones"
          value={predictions.length}
          subtitle="Total milestone evaluations on file"
          icon={<Award size={20} className="text-brand-mint" />}
        />
      </div>

      {/* Academic Records Table */}
      <SectionCard
        title="Student Academic Milestone Evaluations"
        subtitle="Review recorded milestone scores, evaluation scales, and status classifications."
      >
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by subject or status..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 text-xs sm:text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="input py-1.5 px-3 text-xs sm:text-sm w-44"
            >
              <option value="">All Subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <span className="text-xs text-slate-500 font-medium ml-auto">
            Showing {filteredPredictions.length} evaluations
          </span>
        </div>

        {filteredPredictions.length === 0 ? (
          <EmptyState
            title="No Academic Records Found"
            description="No milestone evaluations match your filter criteria."
            icon={<BookMarked size={32} />}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Evaluation Milestone</th>
                  <th>Academic Term</th>
                  <th>Predicted / Target Grade</th>
                  <th>Academic Risk Status</th>
                  <th>Recorded At</th>
                </tr>
              </thead>
              <tbody>
                {filteredPredictions.map((pred) => (
                  <tr key={pred.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="font-bold text-navy-900">{pred.subject}</td>
                    <td>
                      <span className="badge bg-slate-100 text-slate-700 text-xs">
                        Milestone {pred.milestone} ({pred.milestone === 0 ? 'Early Warning' : pred.milestone === 1 ? 'Mid-Term' : 'Pre-Final'})
                      </span>
                    </td>
                    <td className="font-mono text-xs">{pred.academic_term || '2026-T1'}</td>
                    <td className="font-semibold text-brand-royal text-sm">
                      {(pred.predicted_final_grade ?? pred.predicted_marks ?? 0).toFixed(1)} / 20.0
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          pred.predicted_status === 'High Risk'
                            ? 'bg-rose-100 text-rose-800'
                            : pred.predicted_status === 'Moderate Risk'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        } text-[10px] font-bold`}
                      >
                        {pred.predicted_status}
                      </span>
                    </td>
                    <td className="text-xs text-slate-500">
                      {new Date(pred.created_at).toLocaleDateString()}
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
