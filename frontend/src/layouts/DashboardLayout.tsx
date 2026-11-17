import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/common/Sidebar';
import { Navbar } from '../components/common/Navbar';

export const DashboardLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  const getPageTitle = () => {
    const path = location.pathname;
    if (path.startsWith('/student/profile')) return 'Personal Student Profile';
    if (path.startsWith('/student/records')) return 'Student Academic Records';
    if (path.startsWith('/student/predictions')) return 'AI Performance Predictions & Risk Model';
    if (path.startsWith('/student')) return 'Student Performance Dashboard';
    if (path.startsWith('/teacher/students')) return 'Assigned Students Roster';
    if (path.startsWith('/teacher')) return 'Teacher Classroom Analytics';
    if (path.startsWith('/admin/users')) return 'User Governance Directory';
    if (path.startsWith('/admin/assignments')) return 'Teacher-Student Link Management';
    if (path.startsWith('/admin/logs')) return 'System Security & Audit Trail';
    if (path.startsWith('/admin')) return 'System Administration Console';
    return 'EduPredict Workspace';
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-page)' }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} title={getPageTitle()} />

        <main style={{ flex: 1, padding: '2rem', maxWidth: '1400px', width: '100%', margin: '0 auto' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
