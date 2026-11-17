import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { User, LogOut, Menu } from 'lucide-react';
import { Button } from '../forms/Button';

interface NavbarProps {
  onToggleSidebar?: () => void;
  title?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, title }) => {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header
      style={{
        height: 'var(--header-height)',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.5rem',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            style={{
              display: 'flex',
              alignItems: 'center',
              color: 'var(--text-muted)',
              padding: '0.4rem',
              borderRadius: 'var(--radius-sm)',
            }}
            aria-label="Toggle navigation menu"
          >
            <Menu size={20} />
          </button>
        )}
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{title || 'EduPredict Analytics'}</h2>
      </div>

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {user && (
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--accent-light)',
                border: '2px solid var(--accent-cyan)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--brand-blue)',
                fontWeight: 700,
                fontSize: '0.9rem',
              }}
            >
              {user.full_name ? user.full_name.charAt(0).toUpperCase() : <User size={18} />}
            </div>

            <div style={{ display: 'none', flexDirection: 'column', textAlign: 'left' }} className="user-details-md">
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-main)' }}>
                {user.full_name}
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {user.email}
              </span>
            </div>

            <span className={`badge badge-${user.role}`}>{user.role}</span>
          </div>
        )}

        {dropdownOpen && (
          <div
            className="card"
            style={{
              position: 'absolute',
              top: 'calc(100% + 0.5rem)',
              right: 0,
              width: '220px',
              padding: '0.5rem',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              backgroundColor: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              zIndex: 101,
            }}
            onMouseLeave={() => setDropdownOpen(false)}
          >
            <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-light)', marginBottom: '0.25rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{user?.full_name}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.email}</div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              leftIcon={<LogOut size={16} />}
              style={{ justifyContent: 'flex-start', color: 'var(--status-danger)' }}
              onClick={() => {
                setDropdownOpen(false);
                logout();
              }}
            >
              Sign Out
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};
