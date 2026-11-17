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
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = true, onClose }) => {
  const { user, logout } = useAuth();

  const getNavLinks = () => {
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
    <aside
      className={`w-64 h-screen sticky top-0 z-40 bg-navy-900 text-white flex-col shadow-lg transition-transform duration-200 ${
        isOpen ? 'flex' : 'hidden'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-6 border-b border-white/10 shrink-0">
        <div className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center text-white shadow-sm">
          <GraduationCap size={22} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white leading-tight">EduPredict</h1>
          <span className="text-[10px] font-bold text-sky-400 tracking-widest uppercase">
            Academic AI
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-5 px-3 flex flex-col gap-1 overflow-y-auto">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 pb-2">
          {user?.role ? `${user.role} workspace` : 'Navigation'}
        </div>

        {navLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/student' || link.to === '/teacher' || link.to === '/admin'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-navy-800 text-white font-semibold border-l-[3px] border-sky-400 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-navy-800/60 border-l-[3px] border-transparent'
              }`
            }
            onClick={onClose}
          >
            {link.icon}
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-white/10 shrink-0">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-sm font-medium w-full text-left transition-colors cursor-pointer"
        >
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
