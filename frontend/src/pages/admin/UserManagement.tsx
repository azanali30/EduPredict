import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { User, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/forms/Button';
import { Users, Search, Shield, CheckCircle2, ShieldAlert } from 'lucide-react';

export const UserManagement: React.FC = () => {
  const { user: currentAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit Role Modal State
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [newRole, setNewRole] = useState<UserRole>('student');
  const [roleUpdating, setRoleUpdating] = useState(false);
  const [roleSuccessMsg, setRoleSuccessMsg] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await api.getAdminUsers(roleFilter === 'all' ? undefined : roleFilter);
      setUsers(res.users || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [roleFilter]);

  const handleOpenRoleModal = (u: User) => {
    setSelectedUser(u);
    setNewRole(u.role);
    setRoleError(null);
    setRoleSuccessMsg(null);
  };

  const handleUpdateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setRoleError(null);
    setRoleSuccessMsg(null);

    setRoleUpdating(true);
    try {
      const res = await api.updateUserRole(selectedUser.id, newRole);
      setRoleSuccessMsg(res.message || 'Role updated successfully.');
      setTimeout(() => {
        setSelectedUser(null);
        loadUsers();
      }, 1200);
    } catch (err: any) {
      setRoleError(err?.message || 'Failed to update user role.');
    } finally {
      setRoleUpdating(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">
            Institutional User Governance
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Directory of registered students, instructors, and system administrators
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="badge badge-admin text-xs py-1 px-3">
            Admin Root Authority
          </span>
        </div>
      </div>

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* Filter and Search Bar */}
      <div className="card p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by full name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-slate-200 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {['all', 'student', 'teacher', 'admin'].map((role) => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${roleFilter === role
                  ? 'bg-white text-navy-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
                  }`}
              >
                {role}
              </button>
            ))}
          </div>

          <span className="text-xs font-semibold text-slate-500 shrink-0 hidden md:inline">
            {filteredUsers.length} Users
          </span>
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="card p-6 space-y-3">
          <LoadingSkeleton height="44px" />
          <LoadingSkeleton height="44px" />
          <LoadingSkeleton height="44px" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="card p-8">
          <EmptyState
            icon={<Users size={40} className="text-brand-500" />}
            title="No Users Found"
            description="No user records matched your search query and role filter criteria."
          />
        </div>
      ) : (
        <div className="data-table-container shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>User Account</th>
                <th>Institutional Email</th>
                <th>Assigned Role</th>
                <th>Account Registered</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const isSelf = currentAdmin?.id === u.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center border border-slate-200">
                          {u.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-semibold text-navy-900 block leading-tight">
                            {u.full_name}
                          </span>
                          {isSelf && (
                            <span className="text-[10px] text-brand-600 font-bold">
                              (Your Account)
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-xs text-slate-600">{u.email}</td>
                    <td>
                      <span className={`badge badge-${u.role} text-[10px]`}>{u.role}</span>
                    </td>
                    <td className="text-slate-500 text-xs">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenRoleModal(u)}
                        leftIcon={<Shield size={14} />}
                      >
                        Modify Role
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Role Modification Modal */}
      <Modal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title="Modify Role & Governance Privileges"
      >
        {selectedUser && (
          <form onSubmit={handleUpdateRole} className="space-y-4">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <span className="text-slate-400 block">Target Account</span>
              <span className="font-bold text-navy-900 text-sm block">{selectedUser.full_name}</span>
              <span className="font-mono text-slate-500">{selectedUser.email}</span>
            </div>

            {roleSuccessMsg && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{roleSuccessMsg}</span>
              </div>
            )}
            <ErrorAlert message={roleError || ''} onDismiss={() => setRoleError(null)} />

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-navy-900 block mb-2">
                Select New Role Privilege
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {(['student', 'teacher', 'admin'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setNewRole(r)}
                    className={`p-3 rounded-xl border text-xs font-semibold capitalize transition-all cursor-pointer ${newRole === r
                      ? 'border-brand-500 bg-sky-50 text-brand-700 ring-2 ring-brand-500/20'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                      }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {currentAdmin?.id === selectedUser.id && newRole !== 'admin' && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                <ShieldAlert size={16} className="text-amber-600 shrink-0" />
                <span>You cannot demote your own active administrator account.</span>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedUser(null)}
                type="button"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                isLoading={roleUpdating}
                disabled={currentAdmin?.id === selectedUser.id && newRole !== 'admin'}
              >
                Save Role Assignment
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
