import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { PageHeader } from '../../components/common/PageHeader';
import { SectionCard } from '../../components/common/SectionCard';
import { InputField } from '../../components/forms/InputField';
import { Button } from '../../components/forms/Button';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import {
  Settings,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';

export const AnalystSettings: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdLoading, setPwdLoading] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setProfileError('Full name cannot be empty.');
      return;
    }

    setProfileLoading(true);
    setProfileError(null);
    setProfileSuccess(false);
    try {
      await api.updateProfile({ full_name: fullName.trim() });
      await refreshUser();
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      setProfileError(err?.message || 'Failed to update profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwdError('All password fields are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwdError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setPwdError('New password must be at least 8 characters long.');
      return;
    }

    setPwdLoading(true);
    setPwdError(null);
    setPwdSuccess(false);
    try {
      await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPwdSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwdSuccess(false), 4000);
    } catch (err: any) {
      setPwdError(err?.message || 'Failed to change password.');
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analyst Profile & Session Settings"
        subtitle="Manage analyst identity, security credentials, and review statistical disclosure authorizations."
        icon={<Settings size={24} className="text-brand-royal" />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard
          title="Analyst Profile Information"
          subtitle="Your institutional analyst account details."
        >
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <ErrorAlert message={profileError || ''} onDismiss={() => setProfileError(null)} />

            {profileSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center gap-2 border border-emerald-200">
                <CheckCircle2 size={16} />
                <span>Profile updated successfully.</span>
              </div>
            )}

            <InputField
              label="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Analyst Name"
              required
            />

            <div>
              <label className="label">Registered Email Address</label>
              <input
                type="text"
                value={user?.email || ''}
                disabled
                className="input bg-slate-100 text-slate-500 cursor-not-allowed text-xs sm:text-sm"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Email cannot be modified directly.
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="text-xs font-bold text-navy-900 mb-1">Authorization Scope</div>
              <span className="badge badge-analyst text-xs py-0.5 px-2 capitalize">
                Institutional Research Analyst (Zero PII / SDC Enforced)
              </span>
            </div>

            <Button type="submit" variant="primary" isLoading={profileLoading} className="shadow-glow">
              Save Profile Changes
            </Button>
          </form>
        </SectionCard>

        <SectionCard
          title="Change Password"
          subtitle="Update your analyst credentials to maintain secure access."
        >
          <form onSubmit={handleChangePassword} className="space-y-4">
            <ErrorAlert message={pwdError || ''} onDismiss={() => setPwdError(null)} />

            {pwdSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center gap-2 border border-emerald-200">
                <CheckCircle2 size={16} />
                <span>Password changed successfully.</span>
              </div>
            )}

            <InputField
              label="Current Password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              required
            />

            <InputField
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
            />

            <InputField
              label="Confirm New Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              required
            />

            <Button type="submit" variant="secondary" isLoading={pwdLoading} leftIcon={<KeyRound size={14} />}>
              Update Password
            </Button>
          </form>
        </SectionCard>
      </div>
    </div>
  );
};
