import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { StatCard } from '../../components/common/StatCard';
import { EmptyState } from '../../components/common/EmptyState';
import {
  CalendarCheck,
  Clock,
  CheckCircle,
  Award,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/forms/Button';

export const StudentOverview: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome Hero Banner */}
      <div className="card bg-gradient-to-br from-navy-900 to-navy-800 text-white p-6 sm:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-soft">
        <div>
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="badge bg-sky-400/20 text-sky-400 font-semibold tracking-wider text-[11px]">
              Student Portal
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white mb-1.5">
            Welcome back, {user?.full_name}!
          </h2>
          <p className="text-slate-300 text-sm max-w-xl">
            Track your coursework indicators, monitor academic consistency, and view AI-driven expected grade estimates.
          </p>
        </div>

        <Link to="/student/records">
          <Button
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10 shrink-0"
            leftIcon={<BookOpen size={16} />}
          >
            Manage Academic Data
          </Button>
        </Link>
      </div>

      {/* Primary KPI Metrics */}
      <div>
        <h3 className="text-base font-bold text-navy-900 mb-4">Academic Indicators</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Attendance Rate"
            value="--"
            subtitle="No term record logged yet"
            icon={<CalendarCheck size={20} />}
          />
          <StatCard
            title="Weekly Study Hours"
            value="--"
            subtitle="Awaiting input"
            icon={<Clock size={20} />}
          />
          <StatCard
            title="Assignment Rate"
            value="--"
            subtitle="No assignments submitted"
            icon={<CheckCircle size={20} />}
          />
          <StatCard
            title="Quiz Average"
            value="--"
            subtitle="Term quizzes pending"
            icon={<Award size={20} />}
          />
        </div>
      </div>

      {/* AI Prediction & Recommendations Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={20} className="text-brand-500" />
            <h4 className="text-base font-bold text-navy-900">Predicted Academic Results</h4>
          </div>
          <EmptyState
            icon={<Sparkles size={26} className="text-brand-500" />}
            title="Prediction Pipeline Ready"
            description="Expected marks and academic risk classifications will be calculated automatically once your term records are submitted and the ML models are trained in Phase 4."
            actionText="View AI Predictions Hub"
            onAction={() => {}}
          />
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Award size={20} className="text-amber-500" />
            <h4 className="text-base font-bold text-navy-900">Actionable Recommendations</h4>
          </div>
          <EmptyState
            icon={<BookOpen size={26} className="text-slate-400" />}
            title="No Active Recommendations"
            description="Personalized improvement strategies will highlight specific subject weak points and attendance adjustments based on your feature weight analysis."
          />
        </div>
      </div>
    </div>
  );
};
