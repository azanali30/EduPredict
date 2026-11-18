import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  GraduationCap,
  LayoutDashboard,
  UserCheck,
  BookOpen,
  Users,
  UserPlus,
  ShieldAlert,
  LogOut,
  Sparkles,
  BarChart3,
  AlertTriangle,
  FileText,
  Settings,
  X,
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = true, onClose }) => {
  const { user, logout } = useAuth();

  const getNavLinks = (): NavItem[] => {
    switch (user?.role) {
      case 'student':
        return [
          { to: '/student', label: 'Overview', icon: <LayoutDashboard size={18} /> },
          { to: '/student/profile', label: 'My Profile', icon: <UserCheck size={18} /> },
          { to: '/student/records', label: 'Academic Records', icon: <BookOpen size={18} /> },
          { to: '/student/predictions', label: 'AI Predictions', icon: <Sparkles size={18} /> },
        ];
      case 'teacher':
        return [
          { to: '/teacher', label: 'Overview', icon: <LayoutDashboard size={18} /> },
          { to: '/teacher/students', label: 'My Students', icon: <Users size={18} /> },
          { to: '/teacher/performance', label: 'Student Performance', icon: <BarChart3 size={18} /> },
          { to: '/teacher/predictions', label: 'AI Predictions', icon: <Sparkles size={18} /> },
          { to: '/teacher/at-risk', label: 'At-Risk Students', icon: <AlertTriangle size={18} /> },
          { to: '/teacher/reports', label: 'Reports', icon: <FileText size={18} /> },
          { to: '/teacher/profile', label: 'My Profile', icon: <UserCheck size={18} /> },
          { to: '/teacher/settings', label: 'Settings', icon: <Settings size={18} /> },
        ];
      case 'admin':
        return [
          { to: '/admin', label: 'Overview', icon: <LayoutDashboard size={18} /> },
          { to: '/admin/users', label: 'User Directory', icon: <Users size={18} /> },
          { to: '/admin/assignments', label: 'Teacher Assignments', icon: <UserPlus size={18} /> },
          { to: '/admin/logs', label: 'System Logs', icon: <ShieldAlert size={18} /> },
        ];
      default:
        return [];
    }
  };

  const navLinks = getNavLinks();

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
        className={`fixed lg:sticky top-0 left-0 z-50 lg:z-30 w-64 h-screen bg-gradient-to-b from-navy-950 via-navy-900 to-navy-950 text-white flex flex-col border-r border-navy-800/80 shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Official Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
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
            <div>
              <div className="text-base font-extrabold text-white tracking-tight flex items-center gap-1.5 leading-none">
                <span>Edu</span>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-ocean to-brand-mint">
                  Predict
                </span>
                <span className="w-2 h-2 rounded-full bg-brand-mint animate-pulse" title="System Operational" />
              </div>
              <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">
                {user?.role === 'teacher' ? 'Instructor Suite' : user?.role === 'admin' ? 'Governance' : 'Student Hub'}
              </span>
            </div>
          </div>

          {/* Close button for mobile */}
          <button
            onClick={onClose}
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* User Role Banner */}
        <div className="px-5 py-3 bg-navy-900/60 border-b border-white/5 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Workspace
          </span>
          <span className={`badge badge-${user?.role} text-[10px] py-0.5 px-2`}>
            {user?.role}
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 py-3 px-3 space-y-1 overflow-y-auto">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/student' || link.to === '/teacher' || link.to === '/admin'}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
                  isActive
                    ? 'bg-gradient-to-r from-brand-royal/30 to-brand-mint/10 text-white font-semibold border-l-[3px] border-brand-mint shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border-l-[3px] border-transparent'
                }`
              }
              onClick={onClose}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-slate-400 group-hover:text-brand-mint transition-colors shrink-0">
                  {link.icon}
                </span>
                <span className="truncate">{link.label}</span>
              </div>

              {link.badge && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-slate-300 border border-white/10 shrink-0">
                  {link.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer User Info & Sign Out */}
        <div className="p-4 border-t border-white/10 shrink-0 space-y-3 bg-navy-950/80">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-royal to-brand-mint text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">
              {user?.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">{user?.full_name}</div>
              <div className="text-[10px] text-slate-400 truncate">{user?.email}</div>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:text-rose-100 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
