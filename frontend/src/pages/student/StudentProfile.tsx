import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { InputField } from '../../components/forms/InputField';
import { Button } from '../../components/forms/Button';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { User, Lock, Save, CheckCircle2, ShieldCheck } from 'lucide-react';

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

    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPwdError('New password must have 8+ characters, at least one letter, and at least one number.');
      return;
    }

    setIsUpdatingPwd(true);
    try {
      const res = await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPwdMsg(res.message || 'Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwdError(err?.message || 'Failed to change password. Please verify current password.');
    } finally {
      setIsUpdatingPwd(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">
          Personal Profile & Security Settings
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage your verified institutional name, review account role credentials, and update password
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card p-6 text-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-brand-600 to-sky-400 text-white flex items-center justify-center font-extrabold text-2xl mx-auto mb-4 shadow-glow">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'S'}
            </div>
            <h2 className="text-lg font-bold text-navy-900">{user?.full_name}</h2>
            <p className="text-xs text-slate-500 mb-3">{user?.email}</p>
            <span className={`badge badge-${user?.role} uppercase tracking-wider text-[10px]`}>
              {user?.role} Account
            </span>

            <div className="mt-6 pt-6 border-t border-slate-100 text-left space-y-3 text-xs text-slate-600">
              <div className="flex justify-between">
                <span className="text-slate-400">Account ID</span>
                <span className="font-mono text-slate-700 text-[11px] truncate max-w-[140px]">{user?.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Security</span>
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <ShieldCheck size={12} /> Active
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* General Profile Information */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <User size={18} className="text-brand-500" />
              <h3 className="text-base font-bold text-navy-900">General Information</h3>
            </div>

            {profileMsg && (
              <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{profileMsg}</span>
              </div>
            )}
            <ErrorAlert message={profileError || ''} onDismiss={() => setProfileError(null)} />

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <InputField
                label="Full Legal Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />

              <InputField
                label="Institutional Email Address"
                value={user?.email || ''}
                disabled
                helperText="Email is bound to your academic enrollment and cannot be modified directly."
              />

              <Button
                type="submit"
                variant="primary"
                isLoading={isUpdatingProfile}
                leftIcon={<Save size={16} />}
              >
                Save Profile Changes
              </Button>
            </form>
          </div>

          {/* Password Security Form */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <Lock size={18} className="text-brand-500" />
              <h3 className="text-base font-bold text-navy-900">Security & Credentials</h3>
            </div>

            {pwdMsg && (
              <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>{pwdMsg}</span>
              </div>
            )}
            <ErrorAlert message={pwdError || ''} onDismiss={() => setPwdError(null)} />

            <form onSubmit={handleChangePassword} className="space-y-4">
              <InputField
                label="Current Password"
                type="password"
                isPassword
                placeholder="Enter current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="New Password"
                  type="password"
                  isPassword
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />

                <InputField
                  label="Confirm New Password"
                  type="password"
                  isPassword
                  placeholder="Re-type new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                variant="outline"
                isLoading={isUpdatingPwd}
                leftIcon={<Lock size={16} />}
              >
                Update Password
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
