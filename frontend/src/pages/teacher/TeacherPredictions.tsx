import React from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { SectionCard } from '../../components/common/SectionCard';
import { Button } from '../../components/forms/Button';
import { Sparkles, ArrowLeft, ArrowRight, Clock, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

export const TeacherPredictions: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Performance Predictions Hub"
        subtitle="Historical prediction records, model confidence telemetry, and multi-milestone evaluation audits."
        badgeText="Foundation Blueprint"
        badgeVariant="brand"
        actions={
          <Link to="/teacher">
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft size={14} />}>
              Back to Overview
            </Button>
          </Link>
        }
      />

      <SectionCard
        title="Prediction Intelligence Hub — Scheduled for Phase 5D-D"
        subtitle="Dedicated multi-milestone prediction management suite for assigned student evaluations."
        icon={<Sparkles size={18} />}
        rightAction={
          <span className="badge badge-brand text-[10px] font-bold">
            Phase 5D-D Development Target
          </span>
        }
      >
        <div className="py-8 px-4 text-center max-w-xl mx-auto space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-sky-50 text-brand-royal flex items-center justify-center mx-auto border border-sky-100 shadow-sm">
            <Clock size={28} />
          </div>

          <div>
            <h3 className="text-lg font-bold text-navy-900">
              Centralized Model Assessment Center
            </h3>
            <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
              In Phase 5D-D, this page will host a full paginated audit table of all student predictions, deep-inspection slide-over panels, model disagreement indicators, and confidence score distributions.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-center gap-2">
            <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
            <span>Currently, you can launch predictions directly from <strong>Overview</strong> or the <strong>Student Roster</strong>.</span>
          </div>

          <div className="pt-2 flex items-center justify-center gap-3">
            <Link to="/teacher/students">
              <Button variant="primary" size="sm" rightIcon={<ArrowRight size={14} />}>
                Assess Student from Roster
              </Button>
            </Link>
          </div>
        </div>
      </SectionCard>
    </div>
  );
};
