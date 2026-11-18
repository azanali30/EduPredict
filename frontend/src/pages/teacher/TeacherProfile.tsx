import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { PageHeader } from '../../components/common/PageHeader';
import { SectionCard } from '../../components/common/SectionCard';
import { InputField } from '../../components/forms/InputField';
import { Button } from '../../components/forms/Button';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { UserCheck, Save, ArrowLeft, ShieldCheck, Users, Calendar, Mail, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export const TeacherProfile: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [assignedCount, setAssignedCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user?.full_name) {
      setFullName(user.full_name);
    }
    // Load assigned students count
    api.getTeacherStudents()
      .then((res) => setAssignedCount(res.count ?? (res.students?.length || 0)))
      .catch(() => setAssignedCount(null));
  }, [user]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Display name cannot be empty.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await api.updateProfile({ full_name: fullName.trim() });
      await refreshUser();
      setSuccess('Profile updated successfully.');
    } catch (err: any) {
      setError(err?.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Instructor Profile"
        subtitle="Manage personal instructor details, institutional credentials, and assigned cohort status."
        badgeText="Verified Instructor"
        badgeVariant="teacher"
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
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Avatar & Summary */}
        <SectionCard className="lg:col-span-1 text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-brand-royal via-brand-ocean to-brand-mint text-white flex items-center justify-center font-extrabold text-2xl mx-auto shadow-glow-brand mb-4">
            {user?.full_name?.charAt(0).toUpperCase() || 'T'}
          </div>

          <h3 className="text-lg font-bold text-navy-900">{user?.full_name}</h3>
          <p className="text-xs text-slate-500 font-mono mt-0.5">{user?.email}</p>

          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="badge badge-teacher text-xs py-0.5 px-2.5 font-bold">
              Teacher Workspace
            </span>
            <span className="badge badge-success text-[10px] py-0.5 px-2 font-bold">
              Active
            </span>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100 text-left space-y-3.5 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-slate-400 flex items-center gap-1.5">
                <ShieldCheck size={14} /> Account Role
              </span>
              <span className="font-semibold text-navy-900 capitalize">{user?.role}</span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Users size={14} /> Assigned Cohort
              </span>
              <span className="font-semibold text-brand-royal">
                {assignedCount !== null ? `${assignedCount} Students` : 'Loading...'}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Mail size={14} /> Database ID
              </span>
              <span className="font-mono text-[11px] text-slate-700">{user?.id?.slice(-8)}</span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Calendar size={14} /> Account Created
              </span>
              <span className="font-semibold text-slate-700">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>
        </SectionCard>

        {/* Right Column: Edit Profile Form */}
        <SectionCard
          title="Account Details"
          subtitle="Update your full display name across the EduPredict analytics suite."
          icon={<UserCheck size={18} />}
          className="lg:col-span-2"
        >
          <form onSubmit={handleUpdate} className="space-y-4">
            <InputField
              label="Full Display Name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              helperText="This display name will appear on all student prediction reports, assessment audits, and classroom exports."
            />

            <InputField
              label="Institutional Email Address"
              type="email"
              value={user?.email || ''}
              disabled
              helperText="Institutional email addresses are managed through administrator governance and cannot be modified directly."
            />

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
              <strong>Account Governance:</strong> Only your display name can be self-administered. Role promotions, email changes, and student roster assignments must be configured by an institutional administrator.
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="submit"
                variant="primary"
                isLoading={loading}
                leftIcon={<Save size={15} />}
                className="bg-brand-royal hover:bg-brand-royal/90 text-white"
              >
                Save Changes
              </Button>
            </div>
          </form>
        </SectionCard>
      </div>
    </div>
  );
};
