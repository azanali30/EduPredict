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
      style={{
        width: 'var(--sidebar-width)',
        height: '100vh',
        backgroundColor: 'var(--primary-navy)',
        color: '#ffffff',
        display: isOpen ? 'flex' : 'none',
        flexDirection: 'column',
        position: 'sticky',
        top: 0,
        zIndex: 90,
        boxShadow: 'var(--shadow-md)',
        transition: 'transform 0.2s ease',
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          height: 'var(--header-height)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0 1.5rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--brand-blue)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
          }}
        >
          <GraduationCap size={22} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.15rem', color: '#ffffff', lineHeight: 1.2 }}>EduPredict</h1>
          <span style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', fontWeight: 600, letterSpacing: '0.05em' }}>
            ACADEMIC AI
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav style={{ flex: 1, padding: '1.25rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-subtle)', padding: '0 0.75rem 0.5rem', fontWeight: 700 }}>
          {user?.role ? `${user.role} workspace` : 'Navigation'}
        </div>

        {navLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/student' || link.to === '/teacher' || link.to === '/admin'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.65rem 0.85rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: isActive ? '#ffffff' : '#94a3b8',
              backgroundColor: isActive ? 'var(--primary-dark)' : 'transparent',
              borderLeft: isActive ? '3px solid var(--accent-cyan)' : '3px solid transparent',
              transition: 'all 0.15s ease',
            })}
            onClick={onClose}
          >
            {link.icon}
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Sidebar Footer */}
      <div
        style={{
          padding: '1rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <button
          onClick={logout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '0.65rem 0.85rem',
            borderRadius: 'var(--radius-md)',
            color: '#f87171',
            fontSize: '0.85rem',
            width: '100%',
            textAlign: 'left',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
