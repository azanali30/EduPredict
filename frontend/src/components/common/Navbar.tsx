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
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            aria-label="Toggle navigation menu"
          >
            <Menu size={20} />
          </button>
        )}
        <h2 className="text-lg font-bold text-navy-900">{title || 'EduPredict Analytics'}</h2>
      </div>

      <div className="relative flex items-center gap-4">
        {user && (
          <div
            className="flex items-center gap-3 cursor-pointer select-none group"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            <div className="w-9 h-9 rounded-full bg-sky-50 border-2 border-sky-400 flex items-center justify-center text-brand-600 font-bold text-sm shadow-sm group-hover:border-sky-500 transition-colors">
              {user.full_name ? user.full_name.charAt(0).toUpperCase() : <User size={18} />}
            </div>

            <div className="hidden sm:flex flex-col text-left">
              <span className="text-sm font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                {user.full_name}
              </span>
              <span className="text-xs text-slate-500">
                {user.email}
              </span>
            </div>

            <span className={`badge badge-${user.role}`}>{user.role}</span>
          </div>
        )}

        {dropdownOpen && (
          <div
            className="absolute top-full right-0 mt-2 w-56 p-2 rounded-xl bg-white shadow-card border border-slate-200 flex flex-col gap-1 z-40 animate-in fade-in zoom-in-95 duration-150"
            onMouseLeave={() => setDropdownOpen(false)}
          >
            <div className="px-3 py-2 border-b border-slate-100 mb-1">
              <div className="text-sm font-bold text-navy-900">{user?.full_name}</div>
              <div className="text-xs text-slate-500 truncate">{user?.email}</div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              leftIcon={<LogOut size={16} />}
              className="w-full justify-start text-rose-600 hover:text-rose-700 hover:bg-rose-50"
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
