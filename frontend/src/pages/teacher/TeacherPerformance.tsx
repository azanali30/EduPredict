import React from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { SectionCard } from '../../components/common/SectionCard';
import { Button } from '../../components/forms/Button';
import { BarChart3, ArrowLeft, ArrowRight, Clock, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export const TeacherPerformance: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Performance Analytics"
        subtitle="In-depth academic mark distributions, grade band analysis, and cross-subject evaluation benchmarks."
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
        title="Performance Analytics Suite — Scheduled for Phase 5D-D"
        subtitle="This module is under planned development according to the Phase 5D architecture blueprint."
        icon={<BarChart3 size={18} />}
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
              Academic Telemetry & Grade Band Engine
            </h3>
            <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
              Phase 5D-D will implement interactive Recharts mark distributions, subject comparison matrices (Mathematics vs Portuguese Language), and longitudinal milestone progression tracking for assigned learners.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-center gap-3">
            <Link to="/teacher/students">
              <Button variant="primary" size="sm" rightIcon={<ArrowRight size={14} />}>
                Go to Student Roster
              </Button>
            </Link>
            <Link to="/teacher">
              <Button variant="secondary" size="sm" leftIcon={<Sparkles size={14} />}>
                Launch Predictions from Overview
              </Button>
            </Link>
          </div>
        </div>
      </SectionCard>
    </div>
  );
};
