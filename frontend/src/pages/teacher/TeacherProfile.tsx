import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { PageHeader } from '../../components/common/PageHeader';
import { InputField } from '../../components/forms/InputField';
import { Button } from '../../components/forms/Button';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import {
  User as UserIcon,
  Save,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  BookOpen,
  Award,
  Briefcase,
  MapPin,
  Lock,
  Camera,
  Upload,
  AlertCircle,
  Building,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTeacherSubject } from '../../context/TeacherSubjectContext';

type TeacherTab = 'personal' | 'professional' | 'employment' | 'security';

export const TeacherProfile: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const { assignedSubjects } = useTeacherSubject();
  const [activeTab, setActiveTab] = useState<TeacherTab>('personal');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states initialized from user
  const [fullName, setFullName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Personal Info
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [nationality, setNationality] = useState('');

  // Contact Info
  const [primaryPhone, setPrimaryPhone] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

  // Professional Info
  const [qualification, setQualification] = useState('');
  const [institution, setInstitution] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [experienceYears, setExperienceYears] = useState<string | number>('');
  const [researchInterests, setResearchInterests] = useState('');

  // Employment Info (Office room editable)
  const [officeRoom, setOfficeRoom] = useState('');

  // Assigned student count
  const [assignedCount, setAssignedCount] = useState<number | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [isUpdatingPwd, setIsUpdatingPwd] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setContactNumber(user.contact_number || user.contact_info?.contact_number || '');
      setAvatarUrl(user.avatar_url || '');

      const p = user.personal_info || {};
      setDob(p.date_of_birth || '');
      setGender(p.gender || '');
      setNationality(p.nationality || '');

      const c = user.contact_info || {};
      setPrimaryPhone(c.contact_number || (c as any).primary_phone || user.contact_number || '');
      setEmergencyPhone((c as any).emergency_phone || (c as any).alternate_contact_number || '');
      setAddress(c.residential_address || '');
      setCity(c.city || '');
      setCountry(c.country || '');

      const prof = user.professional_info || {};
      setQualification(prof.highest_qualification || '');
      setInstitution(prof.previous_institution || (prof as any).institution_graduated || '');
      setSpecialization(prof.specialization || '');
      setExperienceYears(prof.experience_years || (prof as any).total_experience_years || '');
      setResearchInterests(prof.bio || (prof as any).research_interests || '');

      const emp = user.employment_info || {};
      setOfficeRoom((emp as any).office_room || '');
    }

    // Load assigned students count
    api.getTeacherStudents()
      .then((res) => setAssignedCount(res.count ?? (res.students?.length || 0)))
      .catch(() => setAssignedCount(null));
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (PNG, JPG, JPEG, WEBP).');
      return;
    }

    setUploadingAvatar(true);
    setError(null);
    try {
      const res = await api.uploadFile(file, 'avatar');
      setAvatarUrl(res.file_url);
      await api.updateProfile({ avatar_url: res.file_url });
      await refreshUser();
      setSuccess('Profile picture updated successfully.');
    } catch (err: any) {
      setError(err?.message || 'Failed to upload profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

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
      const payload = {
        full_name: fullName.trim(),
        contact_number: contactNumber.trim() || primaryPhone.trim(),
        avatar_url: avatarUrl || undefined,
        personal_info: {
          date_of_birth: dob.trim(),
          gender: gender.trim(),
          nationality: nationality.trim(),
        },
        contact_info: {
          contact_number: primaryPhone.trim() || contactNumber.trim(),
          emergency_phone: emergencyPhone.trim(),
          residential_address: address.trim(),
          city: city.trim(),
          country: country.trim(),
        },
        professional_info: {
          highest_qualification: qualification.trim(),
          previous_institution: institution.trim(),
          specialization: specialization.trim(),
          experience_years: experienceYears,
          bio: researchInterests.trim(),
        },
        employment_info: {
          office_room: officeRoom.trim(),
        },
      };

      await api.updateProfile(payload);
      await refreshUser();
      setSuccess('Instructor profile updated successfully.');
    } catch (err: any) {
      setError(err?.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
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
      setPwdError(err?.message || 'Failed to change password. Please verify your current password.');
    } finally {
      setIsUpdatingPwd(false);
    }
  };

  const emp = user?.employment_info || {};
  const prof = user?.professional_info || {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Instructor Profile & Credentials"
        subtitle="Manage personal instructor details, professional credentials, and review assigned course allocations."
        badgeText="Verified Faculty"
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
        <div className="lg:col-span-1 space-y-6">
          <div className="card p-6 text-center">
            {/* Avatar with Upload */}
            <div className="relative inline-block mx-auto mb-4">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={user?.full_name}
                  className="w-24 h-24 rounded-3xl object-cover border-2 border-slate-200 shadow-md"
                />
              ) : (
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-brand-royal via-brand-ocean to-brand-mint text-white flex items-center justify-center font-extrabold text-3xl shadow-glow-brand">
                  {user?.full_name?.charAt(0).toUpperCase() || 'T'}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1.5 -right-1.5 p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-brand-royal hover:border-brand-royal shadow-sm transition-all"
                title="Upload Profile Picture"
              >
                {uploadingAvatar ? (
                  <Upload size={14} className="animate-spin text-brand-royal" />
                ) : (
                  <Camera size={14} />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>

            <h3 className="text-lg font-bold text-navy-900">{user?.full_name}</h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{user?.email}</p>

            <div className="mt-3 flex items-center justify-center gap-1.5">
              <span className="badge badge-teacher text-xs py-0.5 px-2.5 font-bold">
                Faculty Workspace
              </span>
              <span className="badge badge-success text-[10px] py-0.5 px-2 font-bold">
                Active
              </span>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 text-left space-y-2.5 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Employee ID</span>
                <span className="font-mono font-bold text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                  {user?.employee_id || 'Not Assigned'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Department</span>
                <span className="font-semibold text-slate-700">
                  {user?.department || (prof as any).department || 'Academic Faculty'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Assigned Courses</span>
                <span className="font-bold text-brand-royal">
                  {assignedSubjects.length} Active Courses
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Enrolled Cohort</span>
                <span className="font-semibold text-slate-700">
                  {assignedCount !== null ? `${assignedCount} Students` : 'Loading...'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Security</span>
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <ShieldCheck size={12} /> Active & Verified
                </span>
              </div>
            </div>
          </div>

          {/* Tab Navigation Menu */}
          <div className="card p-2 space-y-1">
            <button
              type="button"
              onClick={() => setActiveTab('personal')}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                activeTab === 'personal'
                  ? 'bg-brand-50 text-brand-royal shadow-sm border border-brand-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <UserIcon size={16} className={activeTab === 'personal' ? 'text-brand-royal' : 'text-slate-400'} />
              <span>Personal & Contact</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('professional')}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                activeTab === 'professional'
                  ? 'bg-brand-50 text-brand-royal shadow-sm border border-brand-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Award size={16} className={activeTab === 'professional' ? 'text-brand-royal' : 'text-slate-400'} />
              <span>Professional & Academic</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('employment')}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                activeTab === 'employment'
                  ? 'bg-brand-50 text-brand-royal shadow-sm border border-brand-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Briefcase size={16} className={activeTab === 'employment' ? 'text-brand-royal' : 'text-slate-400'} />
              <span>Employment & Courses</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                activeTab === 'security'
                  ? 'bg-brand-50 text-brand-royal shadow-sm border border-brand-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Lock size={16} className={activeTab === 'security' ? 'text-brand-royal' : 'text-slate-400'} />
              <span>Security & Password</span>
            </button>
          </div>
        </div>

        {/* Right Column: Tabbed Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* TAB 1: Personal & Contact */}
          {activeTab === 'personal' && (
            <form onSubmit={handleUpdate} className="card p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <UserIcon size={18} className="text-brand-royal" />
                  <h3 className="text-base font-bold text-navy-900">Personal & Contact Details</h3>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">Self-Service Editable</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Full Name & Title"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
                <InputField
                  label="Institutional Email (Locked)"
                  value={user?.email || ''}
                  disabled
                  helperText="Managed by institutional administration."
                />
                <InputField
                  label="Date of Birth"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                />
                <InputField
                  label="Gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  placeholder="e.g. Female, Male, Non-binary"
                />
                <InputField
                  label="Nationality"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  placeholder="e.g. American, British, Portuguese"
                />
              </div>

              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <MapPin size={14} className="text-brand-royal" />
                  Contact & Residence Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="Primary Phone Number"
                    value={primaryPhone}
                    onChange={(e) => setPrimaryPhone(e.target.value)}
                    placeholder="+1-555-0800"
                  />
                  <InputField
                    label="Emergency Phone Number"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    placeholder="+1-555-0899"
                  />
                  <div className="sm:col-span-2">
                    <InputField
                      label="Residential Street Address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Street name, suite or residential address"
                    />
                  </div>
                  <InputField
                    label="City"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Cambridge, Boston"
                  />
                  <InputField
                    label="Country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="e.g. United States, United Kingdom"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={loading}
                  leftIcon={<Save size={16} />}
                >
                  Save Personal Changes
                </Button>
              </div>
            </form>
          )}

          {/* TAB 2: Professional & Academic */}
          {activeTab === 'professional' && (
            <form onSubmit={handleUpdate} className="card p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Award size={18} className="text-brand-royal" />
                  <h3 className="text-base font-bold text-navy-900">Professional Qualifications & Expertise</h3>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">Self-Service Editable</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Highest Qualification"
                  value={qualification}
                  onChange={(e) => setQualification(e.target.value)}
                  placeholder="e.g. Ph.D. in Applied Mathematics"
                />
                <InputField
                  label="Graduating / Previous Institution"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="e.g. MIT, Stanford, Oxford"
                />
                <InputField
                  label="Academic Specialization"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder="e.g. Statistical Learning, Educational Data Mining"
                />
                <InputField
                  label="Years of Teaching Experience"
                  type="number"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                  placeholder="e.g. 8"
                />
                <div className="sm:col-span-2">
                  <InputField
                    label="Research Interests & Academic Bio"
                    value={researchInterests}
                    onChange={(e) => setResearchInterests(e.target.value)}
                    placeholder="Summarize research directions, publications, and curriculum interests"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={loading}
                  leftIcon={<Save size={16} />}
                >
                  Save Professional Details
                </Button>
              </div>
            </form>
          )}

          {/* TAB 3: Employment & Course Allocations */}
          {activeTab === 'employment' && (
            <div className="space-y-6">
              {/* Institutional Employment Card */}
              <div className="card p-6 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Building size={18} className="text-brand-royal" />
                    <h3 className="text-base font-bold text-navy-900">Institutional Employment Ledger</h3>
                  </div>
                  <span className="badge badge-primary text-[10px] py-0.5 px-2">Official Record</span>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2.5 leading-relaxed">
                  <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Institutional Employment Data:</span> Employee ID, faculty appointment designations, and departmental allocations are maintained by Human Resources. Office room can be updated below.
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Employee ID</div>
                    <div className="text-sm font-bold text-slate-800 font-mono mt-0.5">{user?.employee_id || 'Not Assigned'}</div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Faculty Department</div>
                    <div className="text-sm font-bold text-slate-800 mt-0.5">{user?.department || 'Department of Mathematics & Sciences'}</div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Appointment Type</div>
                    <div className="text-sm font-bold text-slate-800 mt-0.5">{emp.employment_type || 'Full-Time Tenured Faculty'}</div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Joining Date</div>
                    <div className="text-sm font-bold text-slate-800 mt-0.5">{emp.joining_date || '2022-08-15'}</div>
                  </div>
                </div>

                {/* Office Room Self-Service Update */}
                <form onSubmit={handleUpdate} className="pt-4 border-t border-slate-100 flex items-end gap-4">
                  <div className="flex-1">
                    <InputField
                      label="Office Room / Location"
                      value={officeRoom}
                      onChange={(e) => setOfficeRoom(e.target.value)}
                      placeholder="e.g. Science Hall 402, Building B"
                      helperText="Specify where students can find you for academic office hours."
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={loading}
                    leftIcon={<Save size={15} />}
                  >
                    Save Office Location
                  </Button>
                </form>
              </div>

              {/* Active Subject Allocations Card */}
              <div className="card p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen size={18} className="text-brand-royal" />
                    <h3 className="text-base font-bold text-navy-900">Active Course Allocations</h3>
                  </div>
                  <span className="text-xs font-semibold text-slate-500 font-mono">Term: 2026-T1</span>
                </div>

                {assignedSubjects.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3">No active course assignments recorded. Please contact an administrator.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {assignedSubjects.map((subj) => (
                      <div
                        key={subj.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 transition-all flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-extrabold text-navy-900">{subj.name}</div>
                          <div className="text-[11px] font-mono text-slate-500 mt-0.5">{subj.code}</div>
                        </div>
                        <span className="badge badge-success text-[10px] py-0.5 px-2 font-bold">
                          Active Allocation
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: Security & Password */}
          {activeTab === 'security' && (
            <div className="card p-6 space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Lock size={18} className="text-brand-royal" />
                <h3 className="text-base font-bold text-navy-900">Faculty Password & Security Management</h3>
              </div>

              {pwdMsg && (
                <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
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
                    placeholder="Min 8 chars, 1 letter, 1 digit"
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

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    isLoading={isUpdatingPwd}
                    leftIcon={<Lock size={16} />}
                  >
                    Update Password
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
