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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Welcome Hero Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #0B192C 0%, #1E3E62 100%)',
          color: '#ffffff',
          padding: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span className="badge badge-student" style={{ backgroundColor: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8' }}>
              Student Portal
            </span>
          </div>
          <h2 style={{ fontSize: '1.6rem', color: '#ffffff', marginBottom: '0.35rem' }}>
            Welcome back, {user?.full_name}!
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', maxWidth: '600px' }}>
            Track your coursework indicators, monitor academic consistency, and view AI-driven expected grade estimates.
          </p>
        </div>

        <Link to="/student/records">
          <Button
            variant="outline"
            style={{ borderColor: 'rgba(255, 255, 255, 0.25)', color: '#ffffff' }}
            leftIcon={<BookOpen size={16} />}
          >
            Manage Academic Data
          </Button>
        </Link>
      </div>

      {/* Primary KPI Metrics */}
      <div>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Academic Indicators</h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.25rem',
          }}
        >
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Sparkles size={20} color="var(--brand-blue)" />
            <h4 style={{ fontSize: '1.05rem' }}>Predicted Academic Results</h4>
          </div>
          <EmptyState
            icon={<Sparkles size={26} color="var(--brand-blue)" />}
            title="Prediction Pipeline Ready"
            description="Expected marks and academic risk classifications will be calculated automatically once your term records are submitted and the ML models are trained in Phase 4."
            actionText="View AI Predictions Hub"
            onAction={() => {}}
          />
        </div>

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Award size={20} color="var(--status-warning)" />
            <h4 style={{ fontSize: '1.05rem' }}>Actionable Recommendations</h4>
          </div>
          <EmptyState
            icon={<BookOpen size={26} color="var(--text-muted)" />}
            title="No Active Recommendations"
            description="Personalized improvement strategies will highlight specific subject weak points and attendance adjustments based on your feature weight analysis."
          />
        </div>
      </div>
    </div>
  );
};
