import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  User,
  LogOut,
  Menu,
  ShieldCheck,
  ChevronDown,
  Settings,
  UserCheck,
  Bell,
  CheckCircle2,
  Info,
  AlertTriangle,
  X,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../forms/Button';
import { api, notificationsApi } from '../../services/api';
import { NotificationRecord } from '../../types';
import { TeacherSubjectSelector } from '../../context/TeacherSubjectContext';

interface NavbarProps {
  onToggleSidebar?: () => void;
  title?: string;
  isSidebarCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleSidebar,
  title,
}) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [dbStatus, setDbStatus] = useState<string>('MongoDB Operational');
  const [isHealthy, setIsHealthy] = useState<boolean>(true);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const canAccessNotifications = Boolean(user && user.role !== 'analyst');

  const loadNavbarNotifications = React.useCallback(async () => {
    if (!canAccessNotifications || typeof notificationsApi?.list !== 'function') {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    try {
      const res = await notificationsApi.list({ limit: 5 });
      if (res) {
        setNotifications(res.notifications || []);
        setUnreadCount(res.unread_count || 0);
      }
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [canAccessNotifications]);

  useEffect(() => {
    let isMounted = true;
    if (!canAccessNotifications || typeof notificationsApi?.list !== 'function') {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    notificationsApi
      .list({ limit: 5 })
      .then((res) => {
        if (isMounted && res) {
          setNotifications(res.notifications || []);
          setUnreadCount(res.unread_count || 0);
        }
      })
      .catch(() => {
        if (isMounted) {
          setNotifications([]);
          setUnreadCount(0);
        }
      });

    const handleSync = () => {
      if (isMounted) {
        void loadNavbarNotifications();
      }
    };
    window.addEventListener('edupredict:notifications-updated', handleSync);

    return () => {
      isMounted = false;
      window.removeEventListener('edupredict:notifications-updated', handleSync);
    };
  }, [canAccessNotifications, location.pathname, loadNavbarNotifications]);

  const handleMarkOneRead = async (id: string) => {
    if (typeof notificationsApi?.markAsRead !== 'function') return;
    try {
      await notificationsApi.markAsRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      await loadNavbarNotifications();
    } catch {
      // ignore non-critical header refresh errors
    }
  };

  useEffect(() => {
    let isMounted = true;
    api
      .getHealth()
      .then((res) => {
        if (isMounted) {
          if (res?.database?.connected || res?.status === 'healthy') {
            setDbStatus('MongoDB 6.x Connected');
            setIsHealthy(true);
          } else {
            setDbStatus('Database Disconnected');
            setIsHealthy(false);
          }
        }
      })
      .catch(() => {
        if (isMounted) {
          setDbStatus('Service Offline');
          setIsHealthy(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const getBreadcrumb = () => {
    const segments = location.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return 'Dashboard';
    return segments.map((s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, ' ')).join(' / ');
  };

  const getProfileLink = () => {
    if (user?.role === 'student') return '/student/profile';
    if (user?.role === 'teacher') return '/teacher/profile';
    if (user?.role === 'admin') return '/admin/settings';
    if (user?.role === 'analyst') return '/analyst/settings';
    return '/';
  };

  const getSettingsLink = () => {
    if (user?.role === 'student') return '/student/settings';
    if (user?.role === 'teacher') return '/teacher/settings';
    if (user?.role === 'admin') return '/admin/settings';
    if (user?.role === 'analyst') return '/analyst/settings';
    return '/';
  };

  return (
    <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-6 lg:px-8 shadow-sm">
      {/* Left Title, Breadcrumbs & Mobile Menu Trigger */}
      <div className="flex items-center gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-xl text-slate-500 hover:text-navy-900 hover:bg-slate-100 transition-colors lg:hidden cursor-pointer"
            aria-label="Toggle mobile navigation menu"
          >
            <Menu size={20} />
          </button>
        )}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-semibold tracking-wide uppercase">
            <span>EduPredict</span>
            <span>/</span>
            <span className="text-brand-royal font-bold">{getBreadcrumb()}</span>
          </div>
          <h2 className="text-base sm:text-lg font-extrabold text-navy-900 tracking-tight leading-tight">
            {title || 'EduPredict Workspace'}
          </h2>
        </div>
      </div>

      {/* Right Controls, Context & User Profile */}
      <div className="relative flex items-center gap-3 sm:gap-4">
        {/* Teacher Subject Context Selector */}
        {user?.role === 'teacher' && (
          <div className="hidden sm:block">
            <TeacherSubjectSelector showLabel={false} />
          </div>
        )}

        {/* System Health Status Indicator */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600 text-xs font-semibold select-none">
          <ShieldCheck
            size={14}
            className={isHealthy ? 'text-emerald-500' : 'text-rose-500'}
          />
          <span className="text-[11px] font-medium">{dbStatus}</span>
        </div>

        {/* Notification Center Trigger (Restricted to Admin, Teacher, Student) */}
        {canAccessNotifications && (
          <div className="relative">
            <button
              onClick={() => {
                setNotificationsOpen(!notificationsOpen);
                setDropdownOpen(false);
              }}
              className="relative p-2 rounded-xl text-slate-500 hover:text-navy-900 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-royal ring-2 ring-white" />
              )}
            </button>

            {/* Notification Center Modal / Dropdown */}
            {notificationsOpen && (
              <div
                className="absolute top-full right-0 mt-2 w-80 sm:w-96 p-3 rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col gap-2 z-30 animate-in fade-in zoom-in-95 duration-150"
                onMouseLeave={() => setNotificationsOpen(false)}
              >
                <div className="flex items-center justify-between px-2 pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Bell size={16} className="text-brand-royal" />
                    <span className="text-xs font-extrabold text-navy-900">Notifications</span>
                    <span className="text-[10px] bg-brand-royal/10 text-brand-royal px-1.5 py-0.5 rounded-full font-bold">
                      {unreadCount} unread
                    </span>
                  </div>
                  <button
                    onClick={() => setNotificationsOpen(false)}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 py-1">
                  {notifications.length === 0 ? (
                    <div className="text-center text-xs text-slate-500 py-6">No recent notifications.</div>
                  ) : (
                    notifications.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (!item.is_read) handleMarkOneRead(item.id);
                        }}
                        className={`p-2.5 rounded-xl transition-colors border flex items-start gap-2.5 cursor-pointer ${
                          item.is_read
                            ? 'bg-slate-50 border-slate-100'
                            : 'bg-blue-50/50 border-brand-royal/25'
                        }`}
                      >
                        {item.severity === 'success' && (
                          <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                        )}
                        {(item.severity === 'warning' || item.severity === 'critical') && (
                          <AlertTriangle
                            size={16}
                            className={`${item.severity === 'critical' ? 'text-rose-500' : 'text-amber-500'} shrink-0 mt-0.5`}
                          />
                        )}
                        {item.severity === 'info' && (
                          <Info size={16} className="text-brand-ocean shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-navy-900 flex items-center justify-between gap-2">
                            <span className="truncate">{item.title}</span>
                            {!item.is_read && (
                              <span className="text-[9px] font-bold text-brand-royal shrink-0">NEW</span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600 mt-0.5 leading-snug line-clamp-2">{item.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <Link
                  to={`/${user?.role || 'student'}/notifications`}
                  onClick={() => setNotificationsOpen(false)}
                  className="text-center text-[11px] font-bold text-brand-royal hover:underline pt-1 border-t border-slate-100"
                >
                  Open Notification Center
                </Link>
              </div>
            )}
          </div>
        )}

        {/* User Profile Trigger & Dropdown */}
        {user && (
          <div className="relative">
            <button
              onClick={() => {
                setDropdownOpen(!dropdownOpen);
                setNotificationsOpen(false);
              }}
              className="flex items-center gap-2.5 p-1.5 sm:px-3 sm:py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all select-none cursor-pointer"
              aria-haspopup="true"
              aria-expanded={dropdownOpen}
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-royal via-brand-ocean to-brand-mint text-white flex items-center justify-center font-bold text-xs shadow-sm">
                {user.full_name ? user.full_name.charAt(0).toUpperCase() : <User size={16} />}
              </div>

              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-bold text-navy-900 leading-tight">
                  {user.full_name}
                </span>
                <span className="text-[10px] text-slate-400 capitalize">
                  {user.role}
                </span>
              </div>

              <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div
                className="absolute top-full right-0 mt-2 w-64 p-2 rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col gap-1 z-30 animate-in fade-in zoom-in-95 duration-150"
                onMouseLeave={() => setDropdownOpen(false)}
              >
                <div className="px-3 py-2.5 border-b border-slate-100 mb-1">
                  <div className="text-xs font-extrabold text-navy-900">{user.full_name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className={`badge badge-${user.role} text-[10px] py-0.5 px-2 font-bold capitalize`}>
                      {user.role} workspace
                    </span>
                  </div>
                </div>

                <Link
                  to={getProfileLink()}
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <UserCheck size={14} className="text-brand-royal" />
                  <span>My Profile</span>
                </Link>

                <Link
                  to={getSettingsLink()}
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Settings size={14} className="text-brand-ocean" />
                  <span>Workspace Settings</span>
                </Link>

                <div className="border-t border-slate-100 mt-1 pt-1">
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
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
