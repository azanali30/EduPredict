import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { User, PredictionRecord } from '../../types';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { SectionCard } from '../../components/common/SectionCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState } from '../../components/common/LoadingState';
import { ErrorState } from '../../components/common/ErrorState';
import { EmptyState } from '../../components/common/EmptyState';
import { Button } from '../../components/forms/Button';
import { Link } from 'react-router-dom';
import {
  FileText,
  Download,
  Printer,
  ArrowLeft,
  BarChart3,
  ShieldAlert,
  History,
  Info,
  Calendar,
  Users,
  Search,
  CheckCircle,
  Lock,
} from 'lucide-react';
import { useTeacherSubject, TeacherSubjectSelector } from '../../context/TeacherSubjectContext';

type ReportCategory = 'COHORT_SUMMARY' | 'AT_RISK' | 'PREDICTION_AUDIT';

export const TeacherReports: React.FC = () => {
  const { user } = useAuth();
  const { assignedSubjects, selectedSubject, selectedSubjectId, hasNoAssignments, loading: subjectsLoading } = useTeacherSubject();
  const [students, setStudents] = useState<User[]>([]);
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Report Tab
  const [activeTab, setActiveTab] = useState<ReportCategory>('COHORT_SUMMARY');

  // Filters within reports
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('ALL');
  const [milestoneFilter, setMilestoneFilter] = useState('ALL');

  // Export status notification
  const [exportNotice, setExportNotice] = useState<string | null>(null);

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
    try {
      const [studentsRes, predsRes] = await Promise.all([
        api.getTeacherStudents({ subject_id: selectedSubjectId }),
        api.listPredictions({ subject: selectedSubject?.name, limit: 100 }),
      ]);
      setStudents(studentsRes.students || []);
      setPredictions(predsRes.predictions || []);
    } catch (err: any) {
      console.error('Failed to load telemetry reports data:', err);
      setError(err?.message || 'Failed to retrieve academic report telemetry from server.');
      setStudents([]);
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!subjectsLoading) {
      loadData();
    }
  }, [selectedSubjectId, subjectsLoading, hasNoAssignments]);

  // Map studentId -> User
  const studentMap = useMemo(() => {
    const map = new Map<string, User>();
    students.forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

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

  // Cohort Aggregates
  const cohortMetrics = useMemo(() => {
    const totalAssigned = students.length;
    let evaluated = 0;
    let highRisk = 0;
    let modRisk = 0;
    let lowRisk = 0;
    let markSum = 0;

    // Milestone breakdown
    const m0 = { count: 0, markSum: 0 };
    const m1 = { count: 0, markSum: 0 };
    const m2 = { count: 0, markSum: 0 };

    students.forEach((s) => {
      const pred = latestPredMap.get(s.id);
      if (pred) {
        evaluated++;
        markSum += pred.predicted_marks;

        if (pred.predicted_status === 'High Risk') highRisk++;
        else if (pred.predicted_status === 'Moderate Risk') modRisk++;
        else lowRisk++;

        if (pred.milestone === 0) {
          m0.count++;
          m0.markSum += pred.predicted_marks;
        } else if (pred.milestone === 1) {
          m1.count++;
          m1.markSum += pred.predicted_marks;
        } else if (pred.milestone === 2) {
          m2.count++;
          m2.markSum += pred.predicted_marks;
        }
      }
    });

    // Dynamic subject breakdown for assigned subjects
    const subjectBreakdown = assignedSubjects.map((s) => {
      let count = 0;
      let sMarkSum = 0;
      let sHigh = 0;
      let sMod = 0;
      let sLow = 0;

      students.forEach((stud) => {
        const pred = latestPredMap.get(stud.id);
        if (pred && pred.subject === s.name) {
          count++;
          sMarkSum += pred.predicted_marks;
          if (pred.predicted_status === 'High Risk') sHigh++;
          else if (pred.predicted_status === 'Moderate Risk') sMod++;
          else sLow++;
        }
      });

      return {
        id: s.id,
        code: s.code,
        name: s.name,
        count,
        avg: count > 0 ? (sMarkSum / count).toFixed(1) : 'N/A',
        high: sHigh,
        mod: sMod,
        low: sLow,
      };
    });

    const unscreened = totalAssigned - evaluated;
    const avgMark = evaluated > 0 ? (markSum / evaluated).toFixed(1) : 'N/A';

    return {
      totalAssigned,
      evaluated,
      unscreened,
      highRisk,
      modRisk,
      lowRisk,
      avgMark,
      subjectBreakdown,
      milestones: {
        m0: { count: m0.count, avg: m0.count > 0 ? (m0.markSum / m0.count).toFixed(1) : 'N/A' },
        m1: { count: m1.count, avg: m1.count > 0 ? (m1.markSum / m1.count).toFixed(1) : 'N/A' },
        m2: { count: m2.count, avg: m2.count > 0 ? (m2.markSum / m2.count).toFixed(1) : 'N/A' },
      },
    };
  }, [students, latestPredMap, assignedSubjects]);

  // At-Risk Students list
  const atRiskList = useMemo(() => {
    const list: Array<{ student: User; pred: PredictionRecord }> = [];
    students.forEach((s) => {
      const pred = latestPredMap.get(s.id);
      if (pred && (pred.predicted_status === 'High Risk' || pred.predicted_status === 'Moderate Risk')) {
        list.push({ student: s, pred });
      }
    });

    // Sort by High Risk first, then lowest predicted marks
    list.sort((a, b) => {
      if (a.pred.predicted_status === 'High Risk' && b.pred.predicted_status !== 'High Risk') return -1;
      if (b.pred.predicted_status === 'High Risk' && a.pred.predicted_status !== 'High Risk') return 1;
      return a.pred.predicted_marks - b.pred.predicted_marks;
    });

    // Filter by search query
    return list.filter(({ student, pred }) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        student.full_name.toLowerCase().includes(q) ||
        student.email.toLowerCase().includes(q) ||
        student.id.toLowerCase().includes(q);

      if (!matchesSearch) return false;
      if (subjectFilter !== 'ALL' && pred.subject !== subjectFilter) return false;
      if (milestoneFilter !== 'ALL' && pred.milestone !== Number(milestoneFilter)) return false;
      return true;
    });
  }, [students, latestPredMap, searchQuery, subjectFilter, milestoneFilter]);

  // Prediction Audit list
  const auditList = useMemo(() => {
    return predictions.filter((p) => {
      const student = studentMap.get(p.student_id);
      const studentName = student ? student.full_name.toLowerCase() : '';
      const studentEmail = student ? student.email.toLowerCase() : '';
      const q = searchQuery.toLowerCase().trim();

      const matchesSearch =
        !q ||
        p.id.toLowerCase().includes(q) ||
        p.student_id.toLowerCase().includes(q) ||
        studentName.includes(q) ||
        studentEmail.includes(q);

      if (!matchesSearch) return false;
      if (subjectFilter !== 'ALL' && p.subject !== subjectFilter) return false;
      if (milestoneFilter !== 'ALL' && p.milestone !== Number(milestoneFilter)) return false;
      return true;
    });
  }, [predictions, studentMap, searchQuery, subjectFilter, milestoneFilter]);

  // Print Report Handler
  const handlePrint = () => {
    window.print();
  };

  // CSV Generator Helper (RFC 4180 compliant with UTF-8 BOM)
  const escapeCsvField = (val: any): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const handleExportCsv = () => {
    const today = new Date().toISOString().split('T')[0];
    let csvRows: string[] = [];
    let filename = '';

    if (activeTab === 'COHORT_SUMMARY') {
      filename = `edupredict_cohort_summary_${today}.csv`;
      csvRows.push('EduPredict Educational Analytics - Cohort Summary Report');
      csvRows.push(`Generated By: ${escapeCsvField(user?.full_name || 'Instructor')}`);
      csvRows.push(`Generation Date: ${escapeCsvField(new Date().toLocaleString())}`);
      csvRows.push(`Notice: Evaluated sample coverage from authenticated teacher assigned cohort.`);
      csvRows.push('');
      csvRows.push('Metric,Value,Notes');
      csvRows.push(`Total Assigned Students,${cohortMetrics.totalAssigned},Total roster size mapped to instructor`);
      csvRows.push(`Evaluated Learners,${cohortMetrics.evaluated},Learners with at least one assessment`);
      csvRows.push(`Unscreened Learners,${cohortMetrics.unscreened},Awaiting baseline evaluation (Never low risk)`);
      csvRows.push(`Cohort Average Projected Mark,${cohortMetrics.avgMark} / 100,Continuous regression projection`);
      csvRows.push(`High Risk Learners,${cohortMetrics.highRisk},Projected mark < 50%`);
      csvRows.push(`Moderate Risk Learners,${cohortMetrics.modRisk},Projected mark 50% - 69%`);
      csvRows.push(`Low Risk / On Track,${cohortMetrics.lowRisk},Projected mark >= 70%`);
      csvRows.push('');
      csvRows.push('Subject,Evaluated Students,Average Mark (0-100),High Risk,Moderate Risk,Low Risk');
      cohortMetrics.subjectBreakdown.forEach((sb) => {
        csvRows.push(`${escapeCsvField(sb.name)},${sb.count},${sb.avg},${sb.high},${sb.mod},${sb.low}`);
      });
      csvRows.push('');
      csvRows.push('Milestone,Assessment Count,Average Projected Mark (0-100)');
      csvRows.push(`Milestone 0 (Pre-Enrollment),${cohortMetrics.milestones.m0.count},${cohortMetrics.milestones.m0.avg}`);
      csvRows.push(`Milestone 1 (Mid-Term),${cohortMetrics.milestones.m1.count},${cohortMetrics.milestones.m1.avg}`);
      csvRows.push(`Milestone 2 (Pre-Final),${cohortMetrics.milestones.m2.count},${cohortMetrics.milestones.m2.avg}`);
    } else if (activeTab === 'AT_RISK') {
      filename = `edupredict_at_risk_students_${today}.csv`;
      csvRows.push('Student ID,Student Name,Email,Subject,Milestone,Predicted Mark (0-100),Risk Status,Confidence Pct,Uncertainty Warning,Recommended Action,Assessment Date');
      atRiskList.forEach(({ student, pred }) => {
        csvRows.push([
          escapeCsvField(student.id),
          escapeCsvField(student.full_name),
          escapeCsvField(student.email),
          escapeCsvField(pred.subject),
          escapeCsvField(`M${pred.milestone}`),
          escapeCsvField(pred.predicted_marks.toFixed(1)),
          escapeCsvField(pred.predicted_status),
          escapeCsvField(`${((pred.top_confidence || 0) * 100).toFixed(0)}%`),
          escapeCsvField(pred.uncertainty_warning ? 'YES' : 'NO'),
          escapeCsvField(pred.early_warning_advisory?.recommended_action || 'Review academic progress'),
          escapeCsvField(new Date(pred.created_at).toLocaleDateString()),
        ].join(','));
      });
    } else {
      filename = `edupredict_prediction_audit_${today}.csv`;
      csvRows.push('Prediction ID,Student ID,Student Name,Subject,Milestone,Predicted Mark (0-100),Risk Status,Top Confidence,Uncertainty Warning,Regressor Model,Classifier Model,Created At');
      auditList.forEach((p) => {
        const student = studentMap.get(p.student_id);
        csvRows.push([
          escapeCsvField(p.id),
          escapeCsvField(p.student_id),
          escapeCsvField(student?.full_name || 'Unknown Student'),
          escapeCsvField(p.subject),
          escapeCsvField(`M${p.milestone}`),
          escapeCsvField(p.predicted_marks.toFixed(1)),
          escapeCsvField(p.predicted_status),
          escapeCsvField(`${((p.top_confidence || 0) * 100).toFixed(0)}%`),
          escapeCsvField(p.uncertainty_warning ? 'YES' : 'NO'),
          escapeCsvField(p.regressor_model || 'HistGradientBoostingRegressor'),
          escapeCsvField(p.classifier_model || 'HistGradientBoostingClassifier'),
          escapeCsvField(p.created_at),
        ].join(','));
      });
    }

    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setExportNotice(`Exported ${filename} successfully.`);
    setTimeout(() => setExportNotice(null), 4000);
  };

  if (loading || subjectsLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Academic Telemetry & Reports Suite"
          subtitle="Generate exportable cohort summaries, at-risk rosters, and verifiable prediction audit documentation."
          badgeText="Active Reports"
          badgeVariant="brand"
        />
        <LoadingState
          title="Compiling Academic Reports..."
          description="Aggregating cohort performance telemetry and assessment history."
        />
      </div>
    );
  }

  if (hasNoAssignments) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Academic Telemetry & Reports Suite"
          subtitle="Generate exportable cohort summaries, at-risk rosters, and verifiable prediction audit documentation."
          badgeText="Instructor Analytics"
          badgeVariant="brand"
        />
        <EmptyState
          icon={<Lock size={36} className="text-amber-500" />}
          title="No Academic Subjects Assigned"
          description="Your instructor account does not currently have any active subject assignments. Please contact an institution administrator to assign you to academic subjects and terms in the Admin Workspace."
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Academic Telemetry & Reports Suite"
          subtitle="Generate exportable cohort summaries, at-risk rosters, and verifiable prediction audit documentation."
          badgeText="Telemetry Error"
          badgeVariant="warning"
        />
        <ErrorState message={error} onRetry={loadData} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Printable Report Header (Visible only in print layout) */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-slate-900">EduPredict Analytics Report</h1>
            <p className="text-xs text-slate-600 mt-0.5">
              Authorized Teacher Workspace • Educational Early Intervention Intelligence
            </p>
          </div>
          <div className="text-right text-xs text-slate-600">
            <div><strong>Instructor:</strong> {user?.full_name}</div>
            <div><strong>Email:</strong> {user?.email}</div>
            <div><strong>Date:</strong> {new Date().toLocaleString()}</div>
          </div>
        </div>
        <div className="mt-2 text-[11px] text-slate-500 italic">
          Report Category: {activeTab === 'COHORT_SUMMARY' ? 'Cohort Telemetry Summary' : activeTab === 'AT_RISK' ? 'At-Risk Intervention Roster' : 'Prediction Audit Record'}
        </div>
      </div>

      {/* Screen Page Header */}
      <div className="no-print">
        <PageHeader
          title="Academic Telemetry & Reports Suite"
          subtitle="Exportable cohort summaries, at-risk intervention registries, and verifiable AI assessment audits."
          badgeText="Verified Telemetry"
          badgeVariant="brand"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <TeacherSubjectSelector showLabel={false} />
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Printer size={14} />}
                onClick={handlePrint}
                title="Print current report view"
              >
                Print Report
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Download size={14} />}
                onClick={handleExportCsv}
                className="bg-brand-royal hover:bg-brand-royal/90 text-white"
              >
                Export CSV
              </Button>
              <Link to="/teacher">
                <Button variant="secondary" size="sm" leftIcon={<ArrowLeft size={14} />}>
                  Overview
                </Button>
              </Link>
            </div>
          }
        />
      </div>

      {/* Export notification toast */}
      {exportNotice && (
        <div className="no-print p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle size={16} className="text-emerald-600 shrink-0" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* Report Category Switcher Tabs */}
      <div className="no-print flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('COHORT_SUMMARY')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'COHORT_SUMMARY'
            ? 'bg-brand-royal text-white shadow-sm'
            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
        >
          <BarChart3 size={15} />
          <span>1. Cohort Summary</span>
        </button>

        <button
          onClick={() => setActiveTab('AT_RISK')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'AT_RISK'
            ? 'bg-rose-600 text-white shadow-sm'
            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
        >
          <ShieldAlert size={15} />
          <span>2. At-Risk Students Report</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20">
            {cohortMetrics.highRisk + cohortMetrics.modRisk}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('PREDICTION_AUDIT')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'PREDICTION_AUDIT'
            ? 'bg-navy-900 text-white shadow-sm'
            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
        >
          <History size={15} />
          <span>3. Prediction Audit Log</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20">
            {predictions.length}
          </span>
        </button>
      </div>

      {/* Pedagogical Notice & Scope Disclaimer */}
      <div className="p-4 rounded-xl bg-sky-50/80 border border-sky-200 text-xs text-sky-950 flex items-start gap-2.5 shadow-2xs">
        <Info size={16} className="text-brand-royal shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold block">
            Scope & Pedagogical Transparency Notice:
          </span>
          <p className="text-slate-600 leading-relaxed text-[11px]">
            This report represents the authorized assigned cohort of <strong>{user?.full_name}</strong> and loaded historical assessments. Predicted marks are regression estimates (0–100% scale), not official final transcript grades. Unscreened students are awaiting baseline diagnostic assessment and must never be classified as low risk.
          </p>
        </div>
      </div>

      {/* =========================================================================
          REPORT 1: COHORT SUMMARY
         ========================================================================= */}
      {activeTab === 'COHORT_SUMMARY' && (
        <div className="space-y-6">
          {/* Top 4 KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Assigned Cohort"
              value={cohortMetrics.totalAssigned}
              subtitle="Registered students in class roster"
              icon={<Users size={20} />}
              badgeText="Roster"
              badgeVariant="info"
              iconBg="bg-sky-50 text-brand-royal border border-sky-100"
            />
            <StatCard
              title="Evaluated Learners"
              value={cohortMetrics.evaluated}
              subtitle={`${((cohortMetrics.evaluated / (cohortMetrics.totalAssigned || 1)) * 100).toFixed(0)}% cohort screening coverage`}
              icon={<CheckCircle size={20} />}
              badgeText="Evaluated"
              badgeVariant="success"
              iconBg="bg-emerald-50 text-emerald-600 border border-emerald-100"
            />
            <StatCard
              title="Unscreened Learners"
              value={cohortMetrics.unscreened}
              subtitle="Awaiting baseline evaluation"
              icon={<Calendar size={20} />}
              badgeText="Pending"
              badgeVariant="warning"
              iconBg="bg-amber-50 text-amber-600 border border-amber-100"
            />
            <StatCard
              title="Cohort Average Projected Mark"
              value={cohortMetrics.avgMark !== 'N/A' ? `${cohortMetrics.avgMark} / 100` : 'N/A'}
              subtitle="Continuous regression mean"
              icon={<BarChart3 size={20} />}
              badgeText="Score Mean"
              badgeVariant="brand"
              iconBg="bg-indigo-50 text-indigo-600 border border-indigo-100"
            />
          </div>

          {/* Risk Distribution Summary */}
          <SectionCard
            title="Cohort Risk Distribution"
            subtitle="Categorized by latest academic diagnostic projection."
            icon={<ShieldAlert size={18} className="text-rose-500" />}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-rose-900 uppercase tracking-wide">High Risk</span>
                  <span className="badge badge-danger text-xs font-bold">{cohortMetrics.highRisk}</span>
                </div>
                <div className="text-2xl font-black text-rose-700">
                  {cohortMetrics.evaluated > 0
                    ? `${((cohortMetrics.highRisk / cohortMetrics.evaluated) * 100).toFixed(0)}%`
                    : '0%'}
                </div>
                <p className="text-[11px] text-slate-600 leading-normal">
                  Projected continuous mark &lt;50%. Immediate remedial intervention required.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-900 uppercase tracking-wide">Moderate Risk</span>
                  <span className="badge badge-warning text-xs font-bold">{cohortMetrics.modRisk}</span>
                </div>
                <div className="text-2xl font-black text-amber-700">
                  {cohortMetrics.evaluated > 0
                    ? `${((cohortMetrics.modRisk / cohortMetrics.evaluated) * 100).toFixed(0)}%`
                    : '0%'}
                </div>
                <p className="text-[11px] text-slate-600 leading-normal">
                  Projected continuous mark 50–69%. Proactive check-ins recommended.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide">Low Risk / On Track</span>
                  <span className="badge badge-success text-xs font-bold">{cohortMetrics.lowRisk}</span>
                </div>
                <div className="text-2xl font-black text-emerald-700">
                  {cohortMetrics.evaluated > 0
                    ? `${((cohortMetrics.lowRisk / cohortMetrics.evaluated) * 100).toFixed(0)}%`
                    : '0%'}
                </div>
                <p className="text-[11px] text-slate-600 leading-normal">
                  Projected continuous mark &ge;70%. Student on track for standard mastery.
                </p>
              </div>
            </div>
          </SectionCard>

          {/* Subject & Milestone Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Subject Summary Table */}
            <SectionCard
              title="Curriculum Subject Statistics"
              subtitle="Performance comparisons across registered subject models."
              icon={<FileText size={18} />}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Subject</th>
                      <th className="py-2.5 px-3">Evaluated</th>
                      <th className="py-2.5 px-3">Mean Mark</th>
                      <th className="py-2.5 px-3 text-right">Risk Split (H / M / L)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cohortMetrics.subjectBreakdown.map((sb) => (
                      <tr key={sb.id}>
                        <td className="py-3 px-3 font-bold text-navy-900">{sb.name}</td>
                        <td className="py-3 px-3">{sb.count}</td>
                        <td className="py-3 px-3 font-semibold text-brand-royal">
                          {sb.avg !== 'N/A' ? `${sb.avg} / 100` : 'N/A'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-[11px]">
                          <span className="text-rose-600 font-bold">{sb.high}</span> /{' '}
                          <span className="text-amber-600 font-bold">{sb.mod}</span> /{' '}
                          <span className="text-emerald-600 font-bold">{sb.low}</span>
                        </td>
                      </tr>
                    ))}
                    {cohortMetrics.subjectBreakdown.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-400">
                          No subjects assigned
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            {/* Milestone Summary Table */}
            <SectionCard
              title="Temporal Milestone Telemetry"
              subtitle="Distribution of assessments across academic evaluation gates."
              icon={<Calendar size={18} />}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Milestone Gate</th>
                      <th className="py-2.5 px-3">Assessments</th>
                      <th className="py-2.5 px-3 text-right">Mean Projected Mark</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-3 px-3">
                        <span className="font-bold text-navy-900 block">Milestone 0: Early Warning</span>
                        <span className="text-[10px] text-slate-400">Pre-enrollment demographic indicators</span>
                      </td>
                      <td className="py-3 px-3">{cohortMetrics.milestones.m0.count}</td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-800">
                        {cohortMetrics.milestones.m0.avg !== 'N/A' ? `${cohortMetrics.milestones.m0.avg} / 100` : 'N/A'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-3">
                        <span className="font-bold text-navy-900 block">Milestone 1: Mid-Term</span>
                        <span className="text-[10px] text-slate-400">First period academic examination (G1)</span>
                      </td>
                      <td className="py-3 px-3">{cohortMetrics.milestones.m1.count}</td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-800">
                        {cohortMetrics.milestones.m1.avg !== 'N/A' ? `${cohortMetrics.milestones.m1.avg} / 100` : 'N/A'}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-3">
                        <span className="font-bold text-navy-900 block">Milestone 2: Pre-Final</span>
                        <span className="text-[10px] text-slate-400">Cumulative first & second periods (G1 + G2)</span>
                      </td>
                      <td className="py-3 px-3">{cohortMetrics.milestones.m2.count}</td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-800">
                        {cohortMetrics.milestones.m2.avg !== 'N/A' ? `${cohortMetrics.milestones.m2.avg} / 100` : 'N/A'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {/* =========================================================================
          REPORT 2: AT-RISK STUDENTS REPORT
         ========================================================================= */}
      {activeTab === 'AT_RISK' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="no-print p-4 rounded-xl bg-white border border-slate-200 shadow-2xs grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by student name or ID..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-royal/20"
              />
            </div>

            <div>
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-medium"
              >
                <option value="ALL">All Assigned Subjects</option>
                {assignedSubjects.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={milestoneFilter}
                onChange={(e) => setMilestoneFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-medium"
              >
                <option value="ALL">All Milestones</option>
                <option value="0">Milestone 0: Enrollment</option>
                <option value="1">Milestone 1: Mid-Term</option>
                <option value="2">Milestone 2: Pre-Final</option>
              </select>
            </div>
          </div>

          {atRiskList.length === 0 ? (
            <EmptyState
              title="No Flagged Learners Found"
              description="No assigned students match the current at-risk criteria or search filter."
            />
          ) : (
            <SectionCard
              title={`At-Risk Learners Registry (${atRiskList.length})`}
              subtitle="Prioritized intervention queue with empirical model advisories."
              icon={<ShieldAlert size={18} className="text-rose-500" />}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3">Student Identity</th>
                      <th className="py-3 px-3">Curriculum Subject</th>
                      <th className="py-3 px-3">Milestone</th>
                      <th className="py-3 px-3">Projected Mark</th>
                      <th className="py-3 px-3">Risk Tier</th>
                      <th className="py-3 px-3">Model Confidence</th>
                      <th className="py-3 px-3">Assessment Date</th>
                      <th className="py-3 px-3">Recommended Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {atRiskList.map(({ student, pred }) => (
                      <tr key={student.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-3">
                          <div className="font-bold text-navy-900">{student.full_name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{student.email}</div>
                          <div className="text-[10px] text-slate-400 font-mono">ID: {student.id.slice(-6)}</div>
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-700">{pred.subject}</td>
                        <td className="py-3 px-3">
                          <span className="badge badge-brand text-[10px]">M{pred.milestone}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`font-black text-sm ${pred.predicted_marks < 50 ? 'text-rose-600' : 'text-amber-600'
                              }`}
                          >
                            {pred.predicted_marks.toFixed(1)}
                          </span>
                          <span className="text-[10px] text-slate-400"> / 100</span>
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge status={pred.predicted_status} />
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-slate-800">
                            {((pred.top_confidence || 0) * 100).toFixed(0)}%
                          </span>
                          {pred.uncertainty_warning && (
                            <span className="badge badge-warning text-[9px] block mt-0.5 w-max">
                              Uncertainty Alert
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                          {new Date(pred.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-3 max-w-xs text-slate-600 leading-normal text-[11px]">
                          {pred.early_warning_advisory?.recommended_action ||
                            (pred.predicted_status === 'High Risk'
                              ? 'Schedule diagnostic review and assign targeted problem sets.'
                              : 'Initiate supportive check-in regarding study habits.')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* =========================================================================
          REPORT 3: PREDICTION AUDIT LOG
         ========================================================================= */}
      {activeTab === 'PREDICTION_AUDIT' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="no-print p-4 rounded-xl bg-white border border-slate-200 shadow-2xs grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by student, ID, or prediction ID..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-royal/20"
              />
            </div>

            <div>
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-medium"
              >
                <option value="ALL">All Assigned Subjects</option>
                {assignedSubjects.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={milestoneFilter}
                onChange={(e) => setMilestoneFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-700 font-medium"
              >
                <option value="ALL">All Milestones</option>
                <option value="0">Milestone 0: Enrollment</option>
                <option value="1">Milestone 1: Mid-Term</option>
                <option value="2">Milestone 2: Pre-Final</option>
              </select>
            </div>
          </div>

          {auditList.length === 0 ? (
            <EmptyState
              title="No Prediction Records Found"
              description="No historical assessments match the current search or filter parameters."
            />
          ) : (
            <SectionCard
              title={`Verifiable Assessment Audit Log (${auditList.length} Records)`}
              subtitle="Auditable cryptographic and model provenance trail."
              icon={<History size={18} />}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-3">Record ID</th>
                      <th className="py-3 px-3">Student</th>
                      <th className="py-3 px-3">Subject & Gate</th>
                      <th className="py-3 px-3">Projected Mark</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3">Confidence</th>
                      <th className="py-3 px-3">Audited Models</th>
                      <th className="py-3 px-3 text-right">Created At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditList.map((p) => {
                      const student = studentMap.get(p.student_id);
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-3 font-mono text-[10px] text-slate-500">
                            {p.id.slice(-8)}
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-bold text-navy-900">
                              {student ? student.full_name : 'Unknown Student'}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400">
                              ID: {p.student_id.slice(-6)}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-slate-800">{p.subject}</div>
                            <span className="badge badge-brand text-[9px] mt-0.5">M{p.milestone}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-black text-sm text-navy-900">
                              {p.predicted_marks.toFixed(1)}
                            </span>
                            <span className="text-[10px] text-slate-400"> / 100</span>
                          </td>
                          <td className="py-3 px-3">
                            <StatusBadge status={p.predicted_status} />
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-slate-800">
                              {((p.top_confidence || 0) * 100).toFixed(0)}%
                            </span>
                            {p.uncertainty_warning && (
                              <span className="badge badge-warning text-[9px] block mt-0.5 w-max">
                                Alert
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-[10px] font-mono text-slate-500 leading-tight">
                            <div>R: {p.regressor_model || 'HistGBR'}</div>
                            <div>C: {p.classifier_model || 'HistGBC'}</div>
                          </td>
                          <td className="py-3 px-3 text-right text-slate-500 whitespace-nowrap">
                            {new Date(p.created_at).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </div>
      )}
    </div>
  );
};
