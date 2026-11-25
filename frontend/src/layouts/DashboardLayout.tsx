import React, { useState, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/common/Sidebar';
import { Navbar } from '../components/common/Navbar';
import { LoadingState } from '../components/common/LoadingState';

export const DashboardLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;

    // Student Routes
    if (path === '/student/profile') return 'My Profile & Background';
    if (path === '/student/subjects') return 'My Enrolled Subjects';
    if (path === '/student/records') return 'Academic Records & History';
    if (path === '/student/performance') return 'Performance Analytics & Benchmarks';
    if (path === '/student/predictions') return 'AI Performance Predictions';
    if (path === '/student/progress') return 'My Progress & Learning Velocity';
    if (path === '/student/recommendations') return 'AI Improvement Recommendations';
    if (path === '/student/attendance') return 'Attendance Records & Discipline Proxy';
    if (path === '/student/notifications') return 'Student Notifications & Reminders';
    if (path === '/student/feedback') return 'Feedback & Academic Support';
    if (path === '/student/settings') return 'Student Workspace Settings';
    if (path === '/student') return 'Student Performance Dashboard';

    // Teacher Routes
    if (path === '/teacher/subjects') return 'My Assigned Subjects & Curriculum';
    if (path === '/teacher/students') return 'Assigned Students Roster';
    if (path === '/teacher/academic-records') return 'Student Academic Records';
    if (path === '/teacher/performance') return 'Classroom Performance Analytics';
    if (path === '/teacher/predictions') return 'AI Performance Predictions Hub';
    if (path === '/teacher/at-risk') return 'At-Risk Students Early-Warning Triage';
    if (path === '/teacher/anomalies') return 'Classroom Anomaly & Discrepancy Monitor';
    if (path === '/teacher/demand-forecasting') return 'Assigned Subject Demand Forecasting';
    if (path === '/teacher/attendance') return 'Attendance Records & Velocity Proxy';
    if (path === '/teacher/reports') return 'Academic Reports & Roster Exports';
    if (path === '/teacher/notifications') return 'Teacher Classroom Notifications';
    if (path === '/teacher/feedback') return 'Feedback & Faculty Support';
    if (path === '/teacher/profile') return 'Instructor Profile & Allocations';
    if (path === '/teacher/settings') return 'Teacher Workspace Settings';
    if (path === '/teacher') return 'Teacher AI Teaching Intelligence Workspace';

    // Admin Routes
    if (path === '/admin/users') return 'User Management Directory';
    if (path === '/admin/students') return 'Student Governance Directory';
    if (path === '/admin/teachers') return 'Teacher Management & Faculty Allocations';
    if (path === '/admin/curriculum') return 'Subject & Curriculum Catalog';
    if (path === '/admin/enrollments') return 'Student Course Enrollments Matrix';
    if (path === '/admin/assignments') return 'Teacher Faculty Subject Allocations';
    if (path === '/admin/academic-records') return 'Institutional Academic Records';
    if (path === '/admin/analytics') return 'Executive Performance Analytics';
    if (path === '/admin/predictions') return 'Global AI Predictions Intelligence';
    if (path === '/admin/risk-monitoring') return 'Institutional Risk & Anomaly Monitoring';
    if (path === '/admin/demand-forecasting') return 'Course & Subject Demand Forecasting';
    if (path === '/admin/model-evaluation') return 'Model Evaluation, Comparison & Registry';
    if (path === '/admin/reports') return 'Administrative Reports & Exports';
    if (path === '/admin/data-management') return 'Data Management & Import Pipeline';
    if (path === '/admin/notifications') return 'Administrative Notifications & Broadcasts';
    if (path === '/admin/feedback') return 'Feedback, Inquiries & Support Tickets';
    if (path === '/admin/logs') return 'System Monitoring & Security Audit Logs';
    if (path === '/admin/billing') return 'Institution Billing & Plan Quotas';
    if (path === '/admin/settings') return 'System Administrator Settings & Security';
    if (path === '/admin') return 'AI Institutional Intelligence Command Center';

    // Platform Super Admin Routes (Phase 9)
    if (path === '/platform/overview') return 'Platform Super Admin Overview';
    if (path === '/platform/institutions') return 'Institution Directory';
    if (path.startsWith('/platform/institutions/')) return 'Institution Details';
    if (path === '/platform/onboarding') return 'Onboard New Institution';
    if (path === '/platform/subscriptions') return 'SaaS Plans & Tenant Subscriptions';
    if (path === '/platform/audit-logs') return 'Global Platform Audit Logs';

    // Analyst Routes
    if (path === '/analyst/institutional') return 'Institutional Analytics & Demographic Distribution';
    if (path === '/analyst/curriculum') return 'Subject & Curriculum Analytics (SDC Compliant)';
    if (path === '/analyst/trends') return 'Performance Trends & Term Trajectories';
    if (path === '/analyst/demand-forecasting') return 'Course Demand Forecasting Analytics';
    if (path === '/analyst/model-evaluation') return 'Model Evaluation & Comparison';
    if (path === '/analyst/risk') return 'Academic Risk & Vulnerability Analytics';
    if (path === '/analyst/anomalies') return 'Model Anomaly Analysis & Diagnostics';
    if (path === '/analyst/data-quality') return 'Data Quality, Completeness & Provenance';
    if (path === '/analyst/reports') return 'Statistical Reports & SDC Exports';
    if (path === '/analyst/settings') return 'Analyst Profile & Session Settings';
    if (path === '/analyst') return 'Institutional Research & Analytics Overview';

    return 'EduPredict Workspace';
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-body text-slate-900">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          title={getPageTitle()}
          isSidebarCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          <Suspense fallback={<LoadingState title="Loading Workspace View..." description="Synchronizing analytics telemetry..." />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
};
