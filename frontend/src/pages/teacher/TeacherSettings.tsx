import React, { useState } from 'react';
import { api } from '../../services/api';
import { PageHeader } from '../../components/common/PageHeader';
import { SectionCard } from '../../components/common/SectionCard';
import { InputField } from '../../components/forms/InputField';
import { Button } from '../../components/forms/Button';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { Lock, ShieldCheck, ArrowLeft, KeyRound } from 'lucide-react';
import { Link } from 'react-router-dom';

export const TeacherSettings: React.FC = () => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword || !newPassword) {
      setError('Please provide your current password and a new password.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setSuccess(res.message || 'Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err?.message || 'Failed to change password. Please check your current password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teacher Workspace Settings"
        subtitle="Configure account security credentials, password, and workspace session preferences."
        badgeText="Security Center"
        badgeVariant="brand"
        actions={
          <Link to="/teacher">
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft size={14} />}>
              Back to Overview
            </Button>
          </Link>
        }
      />

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Security Overview */}
        <SectionCard
          title="Security Overview"
          subtitle="Authentication & access governance"
          icon={<ShieldCheck size={18} />}
          className="lg:col-span-1"
        >
          <div className="space-y-4 text-xs text-slate-600">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="font-bold text-navy-900 block">Encrypted Passwords</span>
              <p className="text-slate-500 leading-relaxed">
                Credentials are salted and hashed using industry-standard bcrypt before storage in MongoDB 6.x.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="font-bold text-navy-900 block">CSRF Protection</span>
              <p className="text-slate-500 leading-relaxed">
                All mutating operations (password updates, prediction generation) require verified cryptographic CSRF tokens.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
              <span className="font-bold text-navy-900 block">Role-Based Scope</span>
              <p className="text-slate-500 leading-relaxed">
                Instructor access is strictly scoped to assigned learners via MongoDB assignment collections.
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Right Column: Password Change Form */}
        <SectionCard
          title="Change Account Password"
          subtitle="Ensure your instructor account is protected with a strong, unique password."
          icon={<Lock size={18} />}
          className="lg:col-span-2"
        >
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <InputField
              label="Current Password"
              type="password"
              isPassword
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            <InputField
              label="New Password"
              type="password"
              isPassword
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              helperText="Must be at least 8 characters with letters, numbers, and symbols."
              autoComplete="new-password"
            />

            <InputField
              label="Confirm New Password"
              type="password"
              isPassword
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />

            <div className="pt-2 flex justify-end">
              <Button
                type="submit"
                variant="primary"
                isLoading={loading}
                leftIcon={<KeyRound size={15} />}
                className="bg-brand-royal hover:bg-brand-royal/90 text-white"
              >
                Update Password
              </Button>
            </div>
          </form>
        </SectionCard>
      </div>
    </div>
  );
};
