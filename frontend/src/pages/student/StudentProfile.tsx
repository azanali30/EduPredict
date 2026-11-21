import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { InputField } from '../../components/forms/InputField';
import { Button } from '../../components/forms/Button';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import {
  User as UserIcon,
  Lock,
  Save,
  CheckCircle2,
  ShieldCheck,
  GraduationCap,
  MapPin,
  HeartHandshake,
  Camera,
  Upload,
  AlertCircle,
} from 'lucide-react';

type ProfileTab = 'personal' | 'guardian' | 'academic' | 'security';

export const StudentProfile: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<ProfileTab>('personal');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form states initialized from user object
  const [fullName, setFullName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Personal Info
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [nationality, setNationality] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');

  // Contact Info
  const [primaryPhone, setPrimaryPhone] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

  // Guardian Info
  const [guardianName, setGuardianName] = useState('');
  const [guardianRel, setGuardianRel] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianOccupation, setGuardianOccupation] = useState('');

  // UI state
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

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
      setBloodGroup((p as any).blood_group || '');

      const c = user.contact_info || {};
      setPrimaryPhone(c.contact_number || (c as any).primary_phone || user.contact_number || '');
      setEmergencyPhone((c as any).emergency_phone || (c as any).alternate_contact_number || '');
      setAddress(c.residential_address || '');
      setCity(c.city || '');
      setCountry(c.country || '');

      const g = user.guardian_info || {};
      setGuardianName(g.guardian_full_name || (g as any).guardian_name || '');
      setGuardianRel(g.relationship || '');
      setGuardianEmail(g.guardian_email || '');
      setGuardianPhone(g.guardian_contact_number || (g as any).guardian_phone || '');
      setGuardianOccupation((g as any).occupation || '');
    }
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setProfileError('Please upload a valid image file (PNG, JPG, JPEG, WEBP).');
      return;
    }

    setIsUploadingAvatar(true);
    setProfileError(null);
    try {
      const res = await api.uploadFile(file, 'avatar');
      setAvatarUrl(res.file_url);
      await api.updateProfile({ avatar_url: res.file_url });
      await refreshUser();
      setProfileMsg('Profile picture updated successfully.');
    } catch (err: any) {
      setProfileError(err?.message || 'Failed to upload profile picture.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

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
      const payload = {
        full_name: fullName.trim(),
        contact_number: contactNumber.trim() || primaryPhone.trim(),
        avatar_url: avatarUrl || undefined,
        personal_info: {
          date_of_birth: dob.trim(),
          gender: gender.trim(),
          nationality: nationality.trim(),
          blood_group: bloodGroup.trim(),
        },
        contact_info: {
          contact_number: primaryPhone.trim() || contactNumber.trim(),
          emergency_phone: emergencyPhone.trim(),
          residential_address: address.trim(),
          city: city.trim(),
          country: country.trim(),
        },
        guardian_info: {
          guardian_full_name: guardianName.trim(),
          relationship: guardianRel.trim(),
          guardian_email: guardianEmail.trim(),
          guardian_contact_number: guardianPhone.trim(),
          occupation: guardianOccupation.trim(),
        },
      };

      const res = await api.updateProfile(payload);
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
      setPwdError(err?.message || 'Failed to change password. Please verify your current password.');
    } finally {
      setIsUpdatingPwd(false);
    }
  };

  const academic = user?.academic_info || {};

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-extrabold text-navy-900 tracking-tight">
          Student Profile & Identity Records
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          View official institutional student credentials and update your verified personal and contact details
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card p-6 text-center">
            {/* Avatar with Upload Trigger */}
            <div className="relative inline-block mx-auto mb-4">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={user?.full_name}
                  className="w-24 h-24 rounded-3xl object-cover border-2 border-slate-200 shadow-md"
                />
              ) : (
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-brand-600 via-sky-500 to-teal-400 text-white flex items-center justify-center font-extrabold text-3xl shadow-glow">
                  {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'S'}
                </div>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="absolute -bottom-1.5 -right-1.5 p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-brand-600 hover:border-brand-300 shadow-sm transition-all"
                title="Upload Profile Picture"
              >
                {isUploadingAvatar ? (
                  <Upload size={14} className="animate-spin text-brand-600" />
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

            <h2 className="text-lg font-bold text-navy-900">{user?.full_name}</h2>
            <p className="text-xs text-slate-500 mb-2.5 font-mono">{user?.email}</p>

            <div className="flex items-center justify-center gap-1.5">
              <span className="badge badge-student uppercase tracking-wider text-[10px]">
                Student
              </span>
              <span className="badge badge-success text-[10px]">
                Active Enrolled
              </span>
            </div>

            {/* Read-Only Institutional Identifiers */}
            <div className="mt-6 pt-5 border-t border-slate-100 text-left space-y-2.5 text-xs text-slate-600">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Student ID</span>
                <span className="font-mono font-bold text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                  {user?.student_id || 'Not Assigned'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Academic Status</span>
                <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {academic.academic_term || '2026-T1 Active'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Program</span>
                <span className="font-semibold text-slate-700 truncate max-w-[150px]">
                  {academic.program_course || academic.department || 'General Science'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-medium">Security</span>
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <ShieldCheck size={12} /> MFA Active
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs Pill Bar */}
          <div className="card p-2 space-y-1">
            <button
              type="button"
              onClick={() => setActiveTab('personal')}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                activeTab === 'personal'
                  ? 'bg-brand-50 text-brand-700 shadow-sm border border-brand-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <UserIcon size={16} className={activeTab === 'personal' ? 'text-brand-600' : 'text-slate-400'} />
              <span>Personal & Contact</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('guardian')}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                activeTab === 'guardian'
                  ? 'bg-brand-50 text-brand-700 shadow-sm border border-brand-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <HeartHandshake size={16} className={activeTab === 'guardian' ? 'text-brand-600' : 'text-slate-400'} />
              <span>Guardian Details</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('academic')}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                activeTab === 'academic'
                  ? 'bg-brand-50 text-brand-700 shadow-sm border border-brand-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <GraduationCap size={16} className={activeTab === 'academic' ? 'text-brand-600' : 'text-slate-400'} />
              <span>Academic Info (Read-Only)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left ${
                activeTab === 'security'
                  ? 'bg-brand-50 text-brand-700 shadow-sm border border-brand-200'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Lock size={16} className={activeTab === 'security' ? 'text-brand-600' : 'text-slate-400'} />
              <span>Security & Password</span>
            </button>
          </div>
        </div>

        {/* Right Column: Tabbed Content */}
        <div className="lg:col-span-2 space-y-6">
          {profileMsg && (
            <div className="flex items-center gap-2 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{profileMsg}</span>
            </div>
          )}
          <ErrorAlert message={profileError || ''} onDismiss={() => setProfileError(null)} />

          {/* TAB 1: Personal & Contact */}
          {activeTab === 'personal' && (
            <form onSubmit={handleUpdateProfile} className="card p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <UserIcon size={18} className="text-brand-600" />
                  <h3 className="text-base font-bold text-navy-900">Personal & Contact Details</h3>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">Self-Service Editable</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Full Legal Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
                <InputField
                  label="Institutional Email (Locked)"
                  value={user?.email || ''}
                  disabled
                  helperText="Managed by institutional registrar."
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
                  placeholder="e.g. American, Portuguese"
                />
                <InputField
                  label="Blood Group"
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  placeholder="e.g. O+, A-, B+"
                />
              </div>

              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-xs font-bold text-navy-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <MapPin size={14} className="text-brand-600" />
                  Residential & Contact Information
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="Primary Phone Number"
                    value={primaryPhone}
                    onChange={(e) => setPrimaryPhone(e.target.value)}
                    placeholder="+1-555-0100"
                  />
                  <InputField
                    label="Emergency Contact Phone"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    placeholder="+1-555-0199"
                  />
                  <div className="sm:col-span-2">
                    <InputField
                      label="Residential Street Address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Street name, apartment, or campus dorm"
                    />
                  </div>
                  <InputField
                    label="City"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Boston, Lisbon"
                  />
                  <InputField
                    label="Country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="e.g. United States, Portugal"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isUpdatingProfile}
                  leftIcon={<Save size={16} />}
                >
                  Save Personal Changes
                </Button>
              </div>
            </form>
          )}

          {/* TAB 2: Guardian Details */}
          {activeTab === 'guardian' && (
            <form onSubmit={handleUpdateProfile} className="card p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <HeartHandshake size={18} className="text-brand-600" />
                  <h3 className="text-base font-bold text-navy-900">Parent & Guardian Information</h3>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">Self-Service Editable</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Guardian Full Name"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder="e.g. Sarah Doe"
                />
                <InputField
                  label="Relationship to Student"
                  value={guardianRel}
                  onChange={(e) => setGuardianRel(e.target.value)}
                  placeholder="e.g. Mother, Father, Legal Guardian"
                />
                <InputField
                  label="Guardian Email Address"
                  type="email"
                  value={guardianEmail}
                  onChange={(e) => setGuardianEmail(e.target.value)}
                  placeholder="guardian@example.com"
                />
                <InputField
                  label="Guardian Phone Number"
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                  placeholder="+1-555-0155"
                />
                <div className="sm:col-span-2">
                  <InputField
                    label="Guardian Occupation"
                    value={guardianOccupation}
                    onChange={(e) => setGuardianOccupation(e.target.value)}
                    placeholder="e.g. Teacher, Engineer, Healthcare"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isUpdatingProfile}
                  leftIcon={<Save size={16} />}
                >
                  Save Guardian Details
                </Button>
              </div>
            </form>
          )}

          {/* TAB 3: Academic Records (Strictly Read-Only) */}
          {activeTab === 'academic' && (
            <div className="card p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <GraduationCap size={18} className="text-brand-600" />
                  <h3 className="text-base font-bold text-navy-900">Institutional Academic Record</h3>
                </div>
                <span className="badge badge-primary text-[10px] py-0.5 px-2">Read-Only Official Record</span>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2.5 leading-relaxed">
                <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Official Registrar Ledger:</span> Institutional credentials, Student ID, academic cohort terms, and program enrollments are institutionally governed. To request corrections, contact the Registrar Office.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Admission ID</div>
                  <div className="text-sm font-bold text-slate-800 font-mono mt-0.5">{user?.student_id || 'Not Assigned'}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Admission Date</div>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">{academic.admission_date || '2026-09-01'}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Enrolled Program</div>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">{academic.program_course || academic.department || 'Secondary / Higher Secondary'}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Academic Term</div>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">{academic.academic_term || '2026-T1 (Active)'}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Class Standing</div>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">{academic.class_grade || 'Standard Cohort'}</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Previous Institution</div>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">{academic.previous_institution || 'Gabriel Pereira / Mousinho da Silveira'}</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Security & Password Form */}
          {activeTab === 'security' && (
            <div className="card p-6 space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Lock size={18} className="text-brand-600" />
                <h3 className="text-base font-bold text-navy-900">Security & Password Management</h3>
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
                  placeholder="Enter your current password"
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
