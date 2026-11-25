import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  GraduationCap,
  LayoutDashboard,
  UserCheck,
  BookOpen,
  Users,
  UserPlus,
  LogOut,
  Sparkles,
  BarChart3,
  AlertTriangle,
  FileText,
  Settings,
  X,
  ChevronLeft,
  ChevronRight,
  BookMarked,
  Layers,
  GraduationCap as StudentIcon,
  Shield,
  Activity,
  Database,
  Bell,
  MessageSquare,
  TrendingUp,
  Clock,
  Compass,
  FileSpreadsheet,
  PieChart,
  LineChart,
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface NavCategory {
  title?: string;
  items: NavItem[];
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen = true,
  onClose,
  isCollapsed: controlledCollapsed,
  onToggleCollapse: controlledToggle,
}) => {
  const { user, logout } = useAuth();
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;
  const toggleCollapse = controlledToggle || (() => setInternalCollapsed(!internalCollapsed));

  const getNavCategories = (): NavCategory[] => {
    switch (user?.role) {
      case 'admin':
        return [
          {
            title: 'Executive Overview',
            items: [
              { to: '/admin', label: 'Overview', icon: <LayoutDashboard size={18} /> },
            ],
          },
          {
            title: 'User & Faculty Directory',
            items: [
              { to: '/admin/users', label: 'User Management', icon: <Users size={18} /> },
              { to: '/admin/students', label: 'Student Management', icon: <StudentIcon size={18} /> },
              { to: '/admin/teachers', label: 'Teacher Management', icon: <UserCheck size={18} /> },
            ],
          },
          {
            title: 'Curriculum & Allocations',
            items: [
              { to: '/admin/curriculum', label: 'Subject & Curriculum', icon: <BookOpen size={18} /> },
              { to: '/admin/enrollments', label: 'Student Enrollments', icon: <Layers size={18} /> },
              { to: '/admin/assignments', label: 'Teacher Assignments', icon: <UserPlus size={18} /> },
            ],
          },
          {
            title: 'Academic & AI Intelligence',
            items: [
              { to: '/admin/academic-records', label: 'Academic Records', icon: <BookMarked size={18} /> },
              { to: '/admin/analytics', label: 'Performance Analytics', icon: <BarChart3 size={18} /> },
              { to: '/admin/predictions', label: 'AI Predictions Hub', icon: <Sparkles size={18} />, badge: 'AI' },
              { to: '/admin/demand-forecasting', label: 'Demand Forecasting', icon: <TrendingUp size={18} />, badge: '8B' },
              { to: '/admin/model-evaluation', label: 'Model Evaluation', icon: <BarChart3 size={18} />, badge: '8C' },
              { to: '/admin/risk-monitoring', label: 'Risk & Anomaly Monitor', icon: <AlertTriangle size={18} /> },
            ],
          },
          {
            title: 'System & Governance',
            items: [
              { to: '/admin/reports', label: 'Reports & Exports', icon: <FileText size={18} /> },
              { to: '/admin/data-management', label: 'Data Management', icon: <Database size={18} /> },
              { to: '/admin/notifications', label: 'Notifications & Alerts', icon: <Bell size={18} /> },
              { to: '/admin/feedback', label: 'Feedback & Support', icon: <MessageSquare size={18} /> },
              { to: '/admin/logs', label: 'System Monitoring', icon: <Shield size={18} /> },
              { to: '/admin/settings', label: 'Profile & Settings', icon: <Settings size={18} /> },
            ],
          },
        ];

      case 'teacher':
        return [
          {
            title: 'Classroom Workspace',
            items: [
              { to: '/teacher', label: 'Overview', icon: <LayoutDashboard size={18} /> },
              { to: '/teacher/subjects', label: 'My Subjects', icon: <BookOpen size={18} /> },
              { to: '/teacher/students', label: 'My Students', icon: <Users size={18} /> },
            ],
          },
          {
            title: 'Academic Analytics',
            items: [
              { to: '/teacher/academic-records', label: 'Academic Records', icon: <BookMarked size={18} /> },
              { to: '/teacher/performance', label: 'Performance Analytics', icon: <BarChart3 size={18} /> },
              { to: '/teacher/predictions', label: 'AI Predictions', icon: <Sparkles size={18} />, badge: 'AI' },
              { to: '/teacher/at-risk', label: 'At-Risk Students', icon: <AlertTriangle size={18} /> },
              { to: '/teacher/anomalies', label: 'Anomaly Monitoring', icon: <Activity size={18} /> },
              { to: '/teacher/demand-forecasting', label: 'Demand Forecasting', icon: <TrendingUp size={18} /> },
              { to: '/teacher/attendance', label: 'Attendance Records', icon: <Clock size={18} /> },
            ],
          },
          {
            title: 'Support & Settings',
            items: [
              { to: '/teacher/reports', label: 'Reports', icon: <FileText size={18} /> },
              { to: '/teacher/notifications', label: 'Notifications', icon: <Bell size={18} /> },
              { to: '/teacher/feedback', label: 'Feedback & Support', icon: <MessageSquare size={18} /> },
              { to: '/teacher/profile', label: 'My Profile', icon: <UserCheck size={18} /> },
              { to: '/teacher/settings', label: 'Settings', icon: <Settings size={18} /> },
            ],
          },
        ];

      case 'student':
        return [
          {
            title: 'My Student Hub',
            items: [
              { to: '/student', label: 'Overview', icon: <LayoutDashboard size={18} /> },
              { to: '/student/profile', label: 'My Profile', icon: <UserCheck size={18} /> },
              { to: '/student/subjects', label: 'My Subjects', icon: <BookOpen size={18} /> },
            ],
          },
          {
            title: 'Learning & Analytics',
            items: [
              { to: '/student/records', label: 'Academic Records', icon: <BookMarked size={18} /> },
              { to: '/student/performance', label: 'Performance Analytics', icon: <BarChart3 size={18} /> },
              { to: '/student/predictions', label: 'AI Predictions', icon: <Sparkles size={18} />, badge: 'AI' },
              { to: '/student/progress', label: 'My Progress & Trends', icon: <TrendingUp size={18} /> },
              { to: '/student/recommendations', label: 'Recommendations', icon: <Compass size={18} /> },
              { to: '/student/attendance', label: 'Attendance Records', icon: <Clock size={18} /> },
            ],
          },
          {
            title: 'Account & Support',
            items: [
              { to: '/student/notifications', label: 'Notifications', icon: <Bell size={18} /> },
              { to: '/student/feedback', label: 'Feedback & Support', icon: <MessageSquare size={18} /> },
              { to: '/student/settings', label: 'Settings', icon: <Settings size={18} /> },
            ],
          },
        ];

      case 'analyst':
        return [
          {
            title: 'Institutional Research',
            items: [
              { to: '/analyst', label: 'Overview', icon: <LayoutDashboard size={18} /> },
              { to: '/analyst/institutional', label: 'Institutional Analytics', icon: <PieChart size={18} /> },
              { to: '/analyst/curriculum', label: 'Curriculum Analytics', icon: <BookOpen size={18} /> },
            ],
          },
          {
            title: 'Trends & Diagnostics',
            items: [
              { to: '/analyst/trends', label: 'Performance Trends', icon: <LineChart size={18} /> },
              { to: '/analyst/demand-forecasting', label: 'Demand Forecasting', icon: <TrendingUp size={18} /> },
              { to: '/analyst/model-evaluation', label: 'Model Evaluation', icon: <BarChart3 size={18} />, badge: '8C' },
              { to: '/analyst/risk', label: 'Academic Risk Analytics', icon: <AlertTriangle size={18} /> },
              { to: '/analyst/anomalies', label: 'Anomaly Analysis', icon: <Activity size={18} /> },
              { to: '/analyst/data-quality', label: 'Data Quality & Insights', icon: <Database size={18} /> },
            ],
          },
          {
            title: 'Governance & Settings',
            items: [
              { to: '/analyst/reports', label: 'Reports & Exports', icon: <FileSpreadsheet size={18} /> },
              { to: '/analyst/settings', label: 'Profile & Settings', icon: <Settings size={18} /> },
            ],
          },
        ];

      default:
        return [];
    }
  };

  const navCategories = getNavCategories();

  const getRoleDisplayName = () => {
    switch (user?.role) {
      case 'admin':
        return 'System Governance';
      case 'teacher':
        return 'Instructor Suite';
      case 'student':
        return 'Student Hub';
      case 'analyst':
        return 'Institutional Analytics';
      default:
        return 'Workspace';
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-navy-950/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Main Sidebar Container */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 lg:z-30 h-screen bg-gradient-to-b from-navy-950 via-navy-900 to-navy-950 text-white flex flex-col border-r border-navy-800/80 shadow-2xl transition-all duration-300 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-royal via-brand-ocean to-brand-mint p-0.5 shadow-glow-brand flex items-center justify-center shrink-0 overflow-hidden">
              <img
                src="/brand/edupredict-emblem.jpg"
                alt="EduPredict"
                className="w-full h-full object-cover rounded-[10px]"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <GraduationCap size={20} className="text-white hidden only:block" />
            </div>

            {!isCollapsed && (
              <div className="min-w-0 animate-in fade-in duration-200">
                <div className="text-base font-extrabold text-white tracking-tight flex items-center gap-1.5 leading-none">
                  <span>Edu</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-ocean to-brand-mint">
                    Predict
                  </span>
                  <span className="w-2 h-2 rounded-full bg-brand-mint animate-pulse" title="System Operational" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase truncate block">
                  {getRoleDisplayName()}
                </span>
              </div>
            )}
          </div>

          {/* Desktop Collapse Toggle / Mobile Close */}
          <div className="flex items-center gap-1">
            <button
              onClick={toggleCollapse}
              className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              aria-label="Toggle sidebar width"
            >
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            </button>

            <button
              onClick={onClose}
              className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* User Role Banner */}
        {!isCollapsed && (
          <div className="px-5 py-2.5 bg-navy-900/60 border-b border-white/5 flex items-center justify-between shrink-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Workspace Role
            </span>
            <span className={`badge badge-${user?.role} text-[10px] py-0.5 px-2 capitalize`}>
              {user?.role}
            </span>
          </div>
        )}

        {/* Navigation Categories and Links */}
        <nav className="flex-1 py-3 px-2 space-y-4 overflow-y-auto custom-scrollbar">
          {navCategories.map((category, catIdx) => (
            <div key={catIdx} className="space-y-1">
              {!isCollapsed && category.title && (
                <div className="px-3 pt-2 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400/80">
                  {category.title}
                </div>
              )}

              {category.items.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === '/student' || link.to === '/teacher' || link.to === '/admin' || link.to === '/analyst'}
                  className={({ isActive }) =>
                    `flex items-center ${
                      isCollapsed ? 'justify-center p-2.5' : 'justify-between px-3.5 py-2'
                    } rounded-xl text-xs sm:text-sm font-medium transition-all duration-150 group relative ${
                      isActive
                        ? 'bg-gradient-to-r from-brand-royal/40 to-brand-mint/15 text-white font-semibold border-l-[3px] border-brand-mint shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-white/5 border-l-[3px] border-transparent'
                    }`
                  }
                  onClick={onClose}
                  title={isCollapsed ? link.label : undefined}
                >
                  <div className={`flex items-center gap-3 min-w-0 ${isCollapsed ? 'justify-center' : ''}`}>
                    <span className="text-slate-400 group-hover:text-brand-mint transition-colors shrink-0">
                      {link.icon}
                    </span>
                    {!isCollapsed && <span className="truncate">{link.label}</span>}
                  </div>

                  {!isCollapsed && link.badge && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-royal/30 text-sky-200 border border-brand-royal/40 shrink-0">
                      {link.badge}
                    </span>
                  )}

                  {/* Tooltip on collapsed mode */}
                  {isCollapsed && (
                    <span className="absolute left-full ml-2 px-2.5 py-1 bg-navy-950 text-white text-xs rounded-lg shadow-xl border border-white/10 opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                      {link.label}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer User Info & Sign Out */}
        <div className="p-3 border-t border-white/10 shrink-0 space-y-2 bg-navy-950/80">
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5 px-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-royal to-brand-mint text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">
                {user?.full_name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-white truncate">{user?.full_name}</div>
                <div className="text-[10px] text-slate-400 truncate">{user?.email}</div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div
                className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-royal to-brand-mint text-white flex items-center justify-center text-xs font-bold shadow-sm"
                title={`${user?.full_name} (${user?.email})`}
              >
                {user?.full_name?.charAt(0).toUpperCase() || 'U'}
              </div>
            </div>
          )}

          <button
            onClick={logout}
            className={`flex items-center justify-center gap-2 w-full ${
              isCollapsed ? 'p-2' : 'px-3 py-1.5'
            } rounded-xl text-xs font-semibold text-rose-300 hover:text-rose-100 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer`}
            title={isCollapsed ? 'Sign Out' : undefined}
          >
            <LogOut size={14} />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
