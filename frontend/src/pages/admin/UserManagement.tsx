import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { User, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingSkeleton } from '../../components/common/LoadingSkeleton';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/forms/Button';
import { Users, Search, Shield, Filter, CheckCircle2 } from 'lucide-react';

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
      }, 1000);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>User Management & Governance</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Inspect user accounts, manage role permissions, and govern platform credentials
        </p>
      </div>

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '1rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, minWidth: '280px' }}>
          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
            <Search size={18} style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.55rem 0.85rem 0.55rem 2.25rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-light)',
                outline: 'none',
                fontSize: '0.875rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={18} style={{ color: 'var(--text-muted)' }} />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              style={{
                padding: '0.55rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-light)',
                backgroundColor: '#ffffff',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            >
              <option value="all">All Roles</option>
              <option value="student">Students</option>
              <option value="teacher">Teachers</option>
              <option value="admin">Administrators</option>
            </select>
          </div>
        </div>

        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          {filteredUsers.length} Users Found
        </span>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <LoadingSkeleton height="40px" />
          <LoadingSkeleton height="40px" />
          <LoadingSkeleton height="40px" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          icon={<Users size={36} color="var(--brand-blue)" />}
          title="No Users Found"
          description="Try broadening your search or resetting the role filter."
        />
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Full Name</th>
                <th>Email Address</th>
                <th>Assigned Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => {
                const isSelf = u.id === currentAdmin?.id;
                return (
                  <tr key={u.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {u.id.slice(-6)}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {u.full_name} {isSelf && <span style={{ fontSize: '0.7rem', color: 'var(--brand-blue)' }}>(You)</span>}
                    </td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`badge badge-${u.role}`}>{u.role}</span>
                    </td>
                    <td>
                      <span className="badge badge-success">Active</span>
                    </td>
                    <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}</td>
                    <td>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenRoleModal(u)}
                        leftIcon={<Shield size={14} />}
                      >
                        Change Role
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Role Management Modal */}
      <Modal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title="Modify User Role & Privileges"
      >
        {selectedUser && (
          <form onSubmit={handleUpdateRole} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <ErrorAlert message={roleError || ''} onDismiss={() => setRoleError(null)} />
            {roleSuccessMsg && (
              <div
                style={{
                  padding: '0.75rem',
                  backgroundColor: 'var(--status-success-bg)',
                  color: 'var(--status-success)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <CheckCircle2 size={16} />
                <span>{roleSuccessMsg}</span>
              </div>
            )}

            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Target User:</span>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>{selectedUser.full_name}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedUser.email}</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-navy)' }}>
                Select Role:
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                style={{
                  padding: '0.65rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-light)',
                  outline: 'none',
                  fontSize: '0.9rem',
                }}
              >
                <option value="student">Student (Standard User)</option>
                <option value="teacher">Teacher (Instructor & Cohort Viewer)</option>
                <option value="admin">Administrator (Full System Control)</option>
              </select>
            </div>

            {selectedUser.id === currentAdmin?.id && (
              <div style={{ fontSize: '0.8rem', color: 'var(--status-warning)', backgroundColor: 'var(--status-warning-bg)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                Note: Administrators cannot remove their own administrator privileges.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
              <Button type="button" variant="secondary" size="sm" onClick={() => setSelectedUser(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={roleUpdating}>
                Update Role
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
