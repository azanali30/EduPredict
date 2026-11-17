import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { InputField } from '../../components/forms/InputField';
import { Button } from '../../components/forms/Button';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { User, Lock, Save, CheckCircle2 } from 'lucide-react';

export const StudentProfile: React.FC = () => {
  const { user, refreshUser } = useAuth();

  // Profile Edit State
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [isUpdatingPwd, setIsUpdatingPwd] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    setProfileError(null);

    if (!fullName.trim()) {
      setProfileError('Full name cannot be empty.');
      return;
    }

    setIsUpdatingProfile(true);
    try {
      const res = await api.updateProfile({ full_name: fullName.trim() });
      setProfileMsg(res.message || 'Profile updated successfully.');
      await refreshUser();
    } catch (err: any) {
      setProfileError(err?.message || 'Failed to update profile.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);
    setPwdError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwdError('All password fields are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwdError('New passwords do not match.');
      return;
    }

    setIsUpdatingPwd(true);
    try {
      const res = await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPwdMsg(res.message || 'Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwdError(err?.message || 'Failed to change password.');
    } finally {
      setIsUpdatingPwd(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '800px' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Account & Profile Settings</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Manage your personal identification details and account security credentials
        </p>
      </div>

      {/* Account Info Summary Card */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--accent-light)',
            color: 'var(--brand-blue)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            fontWeight: 700,
          }}
        >
          {user?.full_name?.charAt(0).toUpperCase() || <User size={28} />}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '1.15rem' }}>{user?.full_name}</h3>
            <span className={`badge badge-${user?.role}`}>{user?.role}</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{user?.email}</p>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)' }}>
            Account Created: {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
          </span>
        </div>
      </div>

      {/* Personal Information Form */}
      <div className="card">
        <h4 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <User size={18} color="var(--brand-blue)" />
          Personal Information
        </h4>

        <ErrorAlert message={profileError || ''} onDismiss={() => setProfileError(null)} />
        {profileMsg && (
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--status-success-bg)',
              color: 'var(--status-success)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <CheckCircle2 size={16} />
            <span>{profileMsg}</span>
          </div>
        )}

        <form onSubmit={handleUpdateProfile}>
          <InputField
            label="Registered Email (Immutable)"
            type="email"
            value={user?.email || ''}
            disabled
            helperText="Email address cannot be modified once verified."
          />

          <InputField
            label="Full Name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />

          <Button type="submit" variant="primary" isLoading={isUpdatingProfile} leftIcon={<Save size={16} />}>
            Save Changes
          </Button>
        </form>
      </div>

      {/* Security Credentials Form */}
      <div className="card">
        <h4 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Lock size={18} color="var(--status-danger)" />
          Security Credentials
        </h4>

        <ErrorAlert message={pwdError || ''} onDismiss={() => setPwdError(null)} />
        {pwdMsg && (
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--status-success-bg)',
              color: 'var(--status-success)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <CheckCircle2 size={16} />
            <span>{pwdMsg}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword}>
          <InputField
            label="Current Password"
            isPassword
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />

          <InputField
            label="New Password"
            isPassword
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            helperText="Minimum 8 characters with at least one letter and digit."
          />

          <InputField
            label="Confirm New Password"
            isPassword
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          <Button type="submit" variant="primary" isLoading={isUpdatingPwd} leftIcon={<Lock size={16} />}>
            Update Password
          </Button>
        </form>
      </div>
    </div>
  );
};
