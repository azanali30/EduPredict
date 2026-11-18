import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/common/Sidebar';
import { Navbar } from '../components/common/Navbar';

export const DashboardLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/student/profile')) return 'Personal Student Profile';
    if (path.startsWith('/student/records')) return 'Student Academic Records';
    if (path.startsWith('/student/predictions')) return 'AI Performance Predictions & Risk Model';
    if (path.startsWith('/student')) return 'Student Performance Dashboard';
    if (path.startsWith('/teacher/students')) return 'Assigned Students Roster';
    if (path.startsWith('/teacher/performance')) return 'Student Performance Analytics';
    if (path.startsWith('/teacher/predictions')) return 'AI Performance Predictions Hub';
    if (path.startsWith('/teacher/at-risk')) return 'At-Risk Early Warning Triage';
    if (path.startsWith('/teacher/reports')) return 'Academic Reports & Telemetry Export';
    if (path.startsWith('/teacher/profile')) return 'Instructor Profile & Assignments';
    if (path.startsWith('/teacher/settings')) return 'Teacher Workspace Settings';
    if (path.startsWith('/teacher')) return 'Teacher Classroom Analytics';
    if (path.startsWith('/admin/users')) return 'User Governance Directory';
    if (path.startsWith('/admin/assignments')) return 'Teacher-Student Link Management';
    if (path.startsWith('/admin/logs')) return 'System Security & Audit Trail';
    if (path.startsWith('/admin')) return 'System Administration Console';
    return 'EduPredict Workspace';
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-body text-slate-900">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} title={getPageTitle()} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
