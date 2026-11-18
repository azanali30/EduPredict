import React from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { SectionCard } from '../../components/common/SectionCard';
import { Button } from '../../components/forms/Button';
import { AlertTriangle, ArrowLeft, ArrowRight, Clock, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

export const TeacherAtRisk: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="At-Risk Learners Triage"
        subtitle="Focused early warning console for students flagged as High Risk or Moderate Risk across your assigned cohort."
        badgeText="Foundation Blueprint"
        badgeVariant="warning"
        actions={
          <Link to="/teacher">
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft size={14} />}>
              Back to Overview
            </Button>
          </Link>
        }
      />

      <SectionCard
        title="Early Warning Triage Console — Scheduled for Phase 5D-D"
        subtitle="Prioritized intervention queue with empirical Milestone 0 false-negative advisories."
        icon={<AlertTriangle size={18} className="text-amber-500" />}
        rightAction={
          <span className="badge badge-warning text-[10px] font-bold">
            Phase 5D-D Development Target
          </span>
        }
      >
        <div className="py-8 px-4 text-center max-w-xl mx-auto space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200 shadow-sm">
            <Clock size={28} />
          </div>

          <div>
            <h3 className="text-lg font-bold text-navy-900">
              Targeted Academic Intervention Pipeline
            </h3>
            <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
              Phase 5D-D will implement a dedicated triage interface ranking at-risk learners by urgency, displaying model recommendations, and embedding Milestone 0 holdout advisories (61.54% Math, 75.00% Port false-negative baselines).
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-center justify-center gap-2">
            <ShieldAlert size={16} className="text-amber-600 shrink-0" />
            <span>You can currently filter High and Moderate risk students directly in the <strong>My Students</strong> directory.</span>
          </div>

          <div className="pt-2 flex items-center justify-center gap-3">
            <Link to="/teacher/students">
              <Button variant="primary" size="sm" rightIcon={<ArrowRight size={14} />}>
                Filter Flagged Students in Roster
              </Button>
            </Link>
          </div>
        </div>
      </SectionCard>
    </div>
  );
};
