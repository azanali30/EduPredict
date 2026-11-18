import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../../services/api';
import { User, PredictionRecord } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { StudentProfileDrawer } from '../../components/common/StudentProfileDrawer';
import { TeacherPredictionModal } from '../../components/predictions/TeacherPredictionModal';
import { PredictionDetailModal } from '../../components/predictions/PredictionDetailModal';
import { Button } from '../../components/forms/Button';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ShieldAlert,
  Users,
  Search,
  RotateCcw,
  Eye,
  Sparkles,
  Mail,
  Clock,
  Activity,
  HelpCircle,
} from 'lucide-react';

export const TeacherAtRisk: React.FC = () => {
  const [students, setStudents] = useState<User[]>([]);
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedTab, setSelectedTab] = useState<'ALL' | 'HIGH' | 'MODERATE' | 'UNSCREENED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [milestoneFilter, setMilestoneFilter] = useState<string>('ALL');

  // Drawer / Modals state
  const [selectedStudent, setSelectedStudent] = useState<User | null>(null);
  const [predictingStudent, setPredictingStudent] = useState<User | null>(null);
  const [inspectingPrediction, setInspectingPrediction] = useState<PredictionRecord | null>(null);

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
      console.error('Failed to load at-risk intervention telemetry:', err);
      setError(err?.message || 'Failed to retrieve at-risk student records from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Map studentId -> Latest PredictionRecord
  const latestPredMap = useMemo(() => {
    const map = new Map<string, PredictionRecord>();
    predictions.forEach((p) => {
      const existing = map.get(p.student_id);
      if (!existing || new Date(p.created_at) > new Date(existing.created_at)) {
        map.set(p.student_id, p);
      }
    });
    return map;
  }, [predictions]);

  // Telemetry KPIs
  const { highRiskCount, modRiskCount, unscreenedCount, urgentAttentionCount } = useMemo(() => {
    let high = 0;
    let mod = 0;
    let unscreened = 0;
    let urgent = 0;

    students.forEach((s) => {
      const pred = latestPredMap.get(s.id);
      if (!pred) {
        unscreened++;
      } else if (pred.predicted_status === 'High Risk') {
        high++;
        urgent++;
      } else if (pred.predicted_status === 'Moderate Risk') {
        mod++;
        if (pred.uncertainty_warning || pred.predicted_marks < 10) {
          urgent++;
        }
      }
    });

    return {
      highRiskCount: high,
      modRiskCount: mod,
      unscreenedCount: unscreened,
      urgentAttentionCount: urgent,
    };
  }, [students, latestPredMap]);

  // Filtered List
  const filteredList = useMemo(() => {
    return students.filter((s) => {
      const query = searchTerm.toLowerCase().trim();
      const matchesSearch =
        !query ||
        s.full_name.toLowerCase().includes(query) ||
        s.email.toLowerCase().includes(query) ||
        s.id.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      const pred = latestPredMap.get(s.id);

      // Tab filtering
      if (selectedTab === 'HIGH') {
        if (pred?.predicted_status !== 'High Risk') return false;
      } else if (selectedTab === 'MODERATE') {
        if (pred?.predicted_status !== 'Moderate Risk') return false;
      } else if (selectedTab === 'UNSCREENED') {
        if (pred) return false;
      } else {
        // 'ALL' tab shows High Risk or Moderate Risk
        if (pred?.predicted_status !== 'High Risk' && pred?.predicted_status !== 'Moderate Risk') {
          return false;
        }
      }

      // Subject Filter
      if (subjectFilter !== 'ALL' && pred) {
        if (pred.subject !== subjectFilter) return false;
      }

      // Milestone Filter
      if (milestoneFilter !== 'ALL' && pred) {
        if (pred.milestone !== Number(milestoneFilter)) return false;
      }

      return true;
    });
  }, [students, latestPredMap, selectedTab, searchTerm, subjectFilter, milestoneFilter]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="At-Risk Intervention & Monitoring"
          subtitle="Proactive triage console for assigned students flagged as High Risk or Moderate Risk across your cohort."
          badgeText="Active Telemetry"
          badgeVariant="warning"
        />
        <LoadingState
          title="Retrieving At-Risk Telemetry..."
          description="Connecting to MongoDB predictive telemetry and active advisories."
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="At-Risk Intervention & Monitoring"
          subtitle="Proactive triage console for assigned students flagged as High Risk or Moderate Risk across your cohort."
          badgeText="Telemetry Error"
          badgeVariant="warning"
        />
        <ErrorState message={error} onRetry={loadData} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <PageHeader
        title="At-Risk Intervention & Monitoring"
        subtitle="Proactive triage workspace ranking assigned learners by risk urgency, displaying actionable guidance and mandatory Milestone 0 empirical holdout advisories."
        badgeText={`${highRiskCount + modRiskCount} Flagged Learners`}
        badgeVariant={highRiskCount > 0 ? 'warning' : 'info'}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/teacher/predictions">
              <Button variant="outline" size="sm" leftIcon={<Activity size={14} />}>
                Predictions Hub
              </Button>
            </Link>
            <Link to="/teacher/students">
              <Button variant="secondary" size="sm" leftIcon={<Users size={14} />}>
                All Students
              </Button>
            </Link>
          </div>
        }
      />

      {/* 2. Top Telemetry Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="High-Risk Queue"
          value={highRiskCount}
          subtitle="Immediate pedagogical intervention required (<10 / 20)"
          icon={<ShieldAlert size={20} />}
          badgeText="Critical"
          badgeVariant="danger"
          iconBg="bg-rose-50 text-rose-600 border border-rose-200"
        />
        <StatCard
          title="Moderate-Risk Queue"
          value={modRiskCount}
          subtitle="Proactive academic monitoring (10 - 13 / 20)"
          icon={<AlertTriangle size={20} />}
          badgeText="Monitor"
          badgeVariant="warning"
          iconBg="bg-amber-50 text-amber-600 border border-amber-200"
        />
        <StatCard
          title="Urgent Attention Index"
          value={urgentAttentionCount}
          subtitle="High risk or high uncertainty flags"
          icon={<Activity size={20} />}
          badgeText="Action"
          badgeVariant="brand"
          iconBg="bg-sky-50 text-brand-royal border border-sky-200"
        />
        <StatCard
          title="Unscreened Learners"
          value={unscreenedCount}
          subtitle="Awaiting initial baseline screening (Never low risk)"
          icon={<Clock size={20} />}
          badgeText="Pending"
          badgeVariant="info"
          iconBg="bg-slate-50 text-slate-600 border border-slate-200"
        />
      </div>

      {/* 3. Mandatory Milestone 0 Safety & Empirical False-Negative Disclosure Box */}
      <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/90 border-2 border-amber-300 text-amber-950 shadow-sm space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-200/80 text-amber-800 flex items-center justify-center shrink-0 border border-amber-300/80">
            <ShieldAlert size={22} />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-amber-950 uppercase tracking-wide">
                Mandatory Early Warning Diagnostic Advisory & Empirical Baselines
              </h3>
              <span className="badge badge-warning text-[10px] font-bold">
                Model Safety Requirement
              </span>
            </div>
            <p className="text-xs text-amber-900 mt-1 leading-relaxed">
              <strong>Milestone 0</strong> relies exclusively on pre-enrollment socio-demographic features before any classroom coursework or term grades exist. Teachers must evaluate predictions strictly in accordance with audited Phase 5A historical holdout performance benchmarks:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-white/90 border border-amber-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
              <span>Mathematics (Milestone 0 Holdout)</span>
              <span className="text-danger font-bold">61.54% False Negative Rate</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-normal">
              16 false negatives out of 26 failing students were not caught at enrollment (38.46% sensitivity). A "Low Risk" prediction at M0 does <strong>NOT</strong> guarantee passing.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white/90 border border-amber-200 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
              <span>Portuguese Language (Milestone 0 Holdout)</span>
              <span className="text-danger font-bold">75.00% False Negative Rate</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-normal">
              15 false negatives out of 20 failing students were not caught at enrollment (25.00% sensitivity). The AI model does <strong>NOT</strong> detect every student in need of academic support.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-amber-900 font-medium pt-1 border-t border-amber-200/70">
          <HelpCircle size={14} className="shrink-0 text-amber-700" />
          <span>
            <strong>Safety Protocol:</strong> Unscreened students must NEVER be classified as low risk. Predicted marks are continuous regression projections (0–20 scale), not transcript grades. Holistic teacher observation remains essential.
          </span>
        </div>
      </div>

      {/* 4. Filter & Search Controls */}
      <SectionCard
        title="Intervention Queue & Triage Controls"
        subtitle="Segment flagged learners by urgency tier, curriculum subject, or evaluation milestone."
        icon={<AlertTriangle size={18} className="text-amber-500" />}
      >
        <div className="space-y-4">
          {/* Tab Switcher */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
            <button
              onClick={() => setSelectedTab('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                selectedTab === 'ALL'
                  ? 'bg-navy-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>All At-Risk Learners</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20">
                {highRiskCount + modRiskCount}
              </span>
            </button>

            <button
              onClick={() => setSelectedTab('HIGH')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                selectedTab === 'HIGH'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              <ShieldAlert size={13} />
              <span>High Risk Only</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20">
                {highRiskCount}
              </span>
            </button>

            <button
              onClick={() => setSelectedTab('MODERATE')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                selectedTab === 'MODERATE'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
              }`}
            >
              <AlertTriangle size={13} />
              <span>Moderate Risk Only</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20">
                {modRiskCount}
              </span>
            </button>

            <button
              onClick={() => setSelectedTab('UNSCREENED')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                selectedTab === 'UNSCREENED'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Clock size={13} />
              <span>Unscreened Learners</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-200 text-slate-800">
                {unscreenedCount}
              </span>
            </button>
          </div>

          {/* Search and Dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2 relative">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by student name, email, or ID..."
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-800"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  Clear
                </button>
              )}
            </div>

            <div>
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-700 font-medium"
              >
                <option value="ALL">All Subjects</option>
                <option value="Mathematics">Mathematics</option>
                <option value="Portuguese Language">Portuguese Language</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={milestoneFilter}
                onChange={(e) => setMilestoneFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-700 font-medium"
              >
                <option value="ALL">All Milestones</option>
                <option value="0">Milestone 0 (Enrollment)</option>
                <option value="1">Milestone 1 (Mid-Term)</option>
                <option value="2">Milestone 2 (Pre-Final)</option>
              </select>

              {(searchTerm || subjectFilter !== 'ALL' || milestoneFilter !== 'ALL') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setSubjectFilter('ALL');
                    setMilestoneFilter('ALL');
                  }}
                  title="Reset filters"
                >
                  <RotateCcw size={14} />
                </Button>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* 5. Triage Queue List */}
      {filteredList.length === 0 ? (
        <EmptyState
          title={
            selectedTab === 'UNSCREENED'
              ? 'No Unscreened Students Found'
              : selectedTab === 'HIGH'
              ? 'No High-Risk Learners Flagged'
              : selectedTab === 'MODERATE'
              ? 'No Moderate-Risk Learners Flagged'
              : 'No At-Risk Learners Flagged'
          }
          description={
            searchTerm || subjectFilter !== 'ALL' || milestoneFilter !== 'ALL'
              ? 'No students match the current filters. Try resetting the search or filter options.'
              : selectedTab === 'UNSCREENED'
              ? 'All assigned students currently have at least one diagnostic prediction on file.'
              : 'All evaluated students in your cohort currently project passing marks (14+/20) or have not yet been evaluated.'
          }
          actionText={
            searchTerm || subjectFilter !== 'ALL' || milestoneFilter !== 'ALL'
              ? 'Reset Filter Criteria'
              : undefined
          }
          onAction={
            searchTerm || subjectFilter !== 'ALL' || milestoneFilter !== 'ALL'
              ? () => {
                  setSearchTerm('');
                  setSubjectFilter('ALL');
                  setMilestoneFilter('ALL');
                }
              : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium px-1">
            <span>
              Showing <strong>{filteredList.length}</strong> learner{filteredList.length === 1 ? '' : 's'} in{' '}
              {selectedTab === 'ALL'
                ? 'combined priority triage'
                : selectedTab === 'HIGH'
                ? 'high-risk critical queue'
                : selectedTab === 'MODERATE'
                ? 'moderate-risk monitoring queue'
                : 'unscreened queue'}
            </span>
            <span className="text-[11px] text-slate-400">
              Sorted by cohort registration
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {filteredList.map((student) => {
              const pred = latestPredMap.get(student.id);
              const isUnscreened = !pred;

              return (
                <div
                  key={student.id}
                  className={`p-5 rounded-2xl bg-white border transition-all duration-200 shadow-2xs hover:shadow-card ${
                    isUnscreened
                      ? 'border-slate-200 hover:border-slate-300'
                      : pred.predicted_status === 'High Risk'
                      ? 'border-rose-200 bg-rose-50/20 hover:border-rose-300'
                      : 'border-amber-200 bg-amber-50/20 hover:border-amber-300'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Student Basic Info */}
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                          isUnscreened
                            ? 'bg-slate-100 text-slate-600 border-slate-200'
                            : pred.predicted_status === 'High Risk'
                            ? 'bg-rose-100 text-rose-700 border-rose-200'
                            : 'bg-amber-100 text-amber-800 border-amber-200'
                        }`}
                      >
                        {student.full_name
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-bold text-navy-900 hover:text-primary transition-colors cursor-pointer" onClick={() => setSelectedStudent(student)}>
                            {student.full_name}
                          </h4>
                          <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            {student.id.slice(-6)}
                          </span>
                          {isUnscreened ? (
                            <span className="badge badge-neutral text-[10px] font-semibold">
                              Unscreened / Awaiting Assessment
                            </span>
                          ) : (
                            <StatusBadge status={pred.predicted_status} />
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Mail size={12} className="text-slate-400" />
                            {student.email}
                          </span>
                          {!isUnscreened && (
                            <>
                              <span className="text-slate-300">•</span>
                              <span className="font-medium text-slate-700">
                                {pred.subject}
                              </span>
                              <span className="text-slate-300">•</span>
                              <span className="badge badge-primary text-[10px]">
                                Milestone {pred.milestone}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Telemetry Metrics on the Right */}
                    <div className="flex flex-wrap items-center gap-4 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
                      {!isUnscreened ? (
                        <>
                          {/* Score Projection */}
                          <div className="text-right sm:text-left min-w-[100px]">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Projected Mark
                            </div>
                            <div className="flex items-baseline gap-1 mt-0.5">
                              <span
                                className={`text-lg font-black tracking-tight ${
                                  pred.predicted_marks < 10
                                    ? 'text-rose-600'
                                    : pred.predicted_marks < 14
                                    ? 'text-amber-600'
                                    : 'text-emerald-600'
                                }`}
                              >
                                {pred.predicted_marks.toFixed(1)}
                              </span>
                              <span className="text-xs text-slate-400 font-medium">/ 20</span>
                            </div>
                          </div>

                          {/* Confidence & Uncertainty */}
                          <div className="min-w-[120px]">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Model Confidence
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <div className="text-xs font-bold text-slate-700">
                                {((pred.top_confidence || 0) * 100).toFixed(0)}%
                              </div>
                              {pred.uncertainty_warning && (
                                <span
                                  className="badge badge-warning text-[9px] font-bold py-0.5 px-1.5"
                                  title={pred.uncertainty_message || 'High model prediction variance'}
                                >
                                  Uncertainty Alert
                                </span>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-slate-500 italic max-w-xs">
                          No assessment history. Run baseline evaluation to diagnose academic risk.
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5 ml-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedStudent(student)}
                          leftIcon={<Eye size={13} />}
                        >
                          Profile
                        </Button>

                        {!isUnscreened && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setInspectingPrediction(pred)}
                            leftIcon={<Activity size={13} />}
                          >
                            Inspect
                          </Button>
                        )}

                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => setPredictingStudent(student)}
                          leftIcon={<Sparkles size={13} />}
                        >
                          {isUnscreened ? 'Screen Now' : 'Re-Assess'}
                        </Button>

                        <a
                          href={`mailto:${student.email}?subject=EduPredict%20Academic%20Support%20Check-in&body=Hello%20${encodeURIComponent(
                            student.full_name
                          )},%0A%0AI%20would%20like%20to%20schedule%20a%20brief%20academic%20support%20session%20with%20you%20regarding%20your%20coursework.%0A%0ABest%20regards,%0AYour%20Instructor`}
                          className="btn btn-outline text-slate-600 hover:text-primary py-1.5 px-2 rounded-xl text-xs flex items-center gap-1"
                          title="Send direct email to student via mailto client"
                        >
                          <Mail size={13} />
                          <span className="hidden sm:inline">Email</span>
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Evidence-Based Advisory Callout */}
                  {!isUnscreened && (
                    <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-start gap-2 text-slate-700">
                        <span className="font-bold text-slate-900 shrink-0">
                          Recommended Action:
                        </span>
                        <span className="text-slate-600 leading-relaxed">
                          {pred.early_warning_advisory?.recommended_action ||
                            (pred.predicted_status === 'High Risk'
                              ? 'Schedule a mandatory 1-on-1 diagnostic review, verify attendance stability, and assign targeted remedial problem sets.'
                              : 'Initiate a supportive check-in regarding study routines and recommend peer tutoring or weekly problem-solving workshops.')}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 shrink-0 font-mono">
                        Audited by: {pred.classifier_model || 'HistGradientBoostingClassifier'}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. Modals & Drawers */}
      <StudentProfileDrawer
        isOpen={Boolean(selectedStudent)}
        onClose={() => setSelectedStudent(null)}
        student={selectedStudent}
        latestPrediction={selectedStudent ? latestPredMap.get(selectedStudent.id) : null}
        onAssessClick={(s) => {
          setSelectedStudent(null);
          setPredictingStudent(s);
        }}
      />

      <PredictionDetailModal
        isOpen={Boolean(inspectingPrediction)}
        onClose={() => setInspectingPrediction(null)}
        prediction={inspectingPrediction}
      />

      <TeacherPredictionModal
        isOpen={Boolean(predictingStudent)}
        onClose={() => setPredictingStudent(null)}
        student={predictingStudent}
        onPredictionCreated={() => {
          loadData();
        }}
      />
    </div>
  );
};
