import React from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { SectionCard } from '../../components/common/SectionCard';
import { Button } from '../../components/forms/Button';
import { FileText, ArrowLeft, ArrowRight, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

export const TeacherReports: React.FC = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Telemetry & Reports Suite"
        subtitle="Exportable cohort summaries, at-risk rosters, and verifiable prediction audit documentation."
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
        title="Reporting & Export Engine — Scheduled for Phase 5D-E"
        subtitle="Pre-built institutional report generation and auditable CSV telemetry exports."
        icon={<FileText size={18} />}
        rightAction={
          <span className="badge badge-brand text-[10px] font-bold">
            Phase 5D-E Development Target
          </span>
        }
      >
        <div className="py-8 px-4 text-center max-w-xl mx-auto space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-sky-50 text-brand-royal flex items-center justify-center mx-auto border border-sky-100 shadow-sm">
            <Clock size={28} />
          </div>

          <div>
            <h3 className="text-lg font-bold text-navy-900">
              Institutional Reporting Suite
            </h3>
            <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
              In Phase 5D-E, this section will generate official cohort summary reports, at-risk intervention rosters, and full prediction audit logs in CSV and printable PDF formats with official EduPredict branding.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-center gap-3">
            <Link to="/teacher">
              <Button variant="primary" size="sm" rightIcon={<ArrowRight size={14} />}>
                View Overview Telemetry
              </Button>
            </Link>
          </div>
        </div>
      </SectionCard>
    </div>
  );
};
