import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { User, LogOut, Menu, ShieldCheck, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../forms/Button';

interface NavbarProps {
  onToggleSidebar?: () => void;
  title?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, title }) => {
  const { user, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-6 lg:px-8 shadow-sm">
      {/* Left Title & Mobile Menu Trigger */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-xl text-slate-500 hover:text-navy-900 hover:bg-slate-100 transition-colors lg:hidden"
            aria-label="Toggle navigation menu"
          >
            <Menu size={20} />
          </button>
        )}
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-navy-900 tracking-tight">
            {title || 'EduPredict Analytics'}
          </h2>
          <span className="hidden sm:inline-block text-[11px] text-slate-400 font-medium">
            AI-Driven Academic Early Warning System
          </span>
        </div>
      </div>

      {/* Right Controls & User Profile */}
      <div className="relative flex items-center gap-3 sm:gap-4">
        {/* System Health Status Indicator (Desktop) */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold">
          <ShieldCheck size={14} className="text-emerald-500" />
          <span>MongoDB Operational</span>
        </div>

        {user && (
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all select-none cursor-pointer"
              aria-haspopup="true"
              aria-expanded={dropdownOpen}
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-500 to-sky-400 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                {user.full_name ? user.full_name.charAt(0).toUpperCase() : <User size={16} />}
              </div>

              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-bold text-navy-900 leading-tight">
                  {user.full_name}
                </span>
                <span className="text-[10px] text-slate-500">
                  {user.email}
                </span>
              </div>

              <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div
                className="absolute top-full right-0 mt-2 w-60 p-2 rounded-2xl bg-white shadow-card border border-slate-200 flex flex-col gap-1 z-30 animate-in fade-in zoom-in-95 duration-150"
                onMouseLeave={() => setDropdownOpen(false)}
              >
                <div className="px-3 py-2.5 border-b border-slate-100 mb-1">
                  <div className="text-xs font-extrabold text-navy-900">{user.full_name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
                  <div className="mt-1.5">
                    <span className={`badge badge-${user.role} text-[10px] py-0.5 px-2`}>
                      {user.role} workspace
                    </span>
                  </div>
                </div>

                {user.role === 'student' && (
                  <Link
                    to="/student/profile"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <User size={14} className="text-brand-500" />
                    <span>My Profile</span>
                  </Link>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<LogOut size={14} />}
                  className="w-full justify-start text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl"
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
        )}
      </div>
    </header>
  );
};
