import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { SubjectItem, User, UserDocument } from '../../types';
import { Modal } from '../common/Modal';
import { Button } from '../forms/Button';
import { InputField } from '../forms/InputField';
import { ErrorAlert } from '../common/ErrorAlert';
import {
  User as UserIcon,
  Briefcase,
  FileText,
  Upload,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  BookOpen,
  Eye,
  EyeOff,
  Save,
  Trash2,
} from 'lucide-react';

interface TeacherRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (createdUser: User) => void;
}

const DEPARTMENTS = [
  'STEM & Mathematics',
  'Humanities & Languages',
  'Natural Sciences',
  'Social Sciences',
  'Computer Science & Data Analytics',
];

const GENDER_OPTIONS = [
  'Prefer not to say',
  'Female',
  'Male',
  'Non-binary',
  'Other',
];

const EMPLOYMENT_TYPES = [
  'Full-time',
  'Part-time',
  'Contract',
  'Adjunct',
  'Visiting Scholar',
];

const EMPLOYMENT_STATUSES = [
  'Active',
  'On Leave',
  'Probation',
];

const DRAFT_KEY = 'edupredict_teacher_reg_draft';

export const TeacherRegistrationModal: React.FC<TeacherRegistrationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 6;

  // Step 1: Personal Info
  const [fullName, setFullName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('Prefer not to say');
  const [nationality, setNationality] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Step 2: Contact Info
  const [email, setEmail] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [altContactNumber, setAltContactNumber] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

  // Step 3: Professional Info
  const [department, setDepartment] = useState('STEM & Mathematics');
  const [jobTitle, setJobTitle] = useState('Senior Lecturer');
  const [highestQualification, setHighestQualification] = useState('Ph.D. in Computational Sciences');
  const [specialization, setSpecialization] = useState('Machine Learning & Applied Statistics');
  const [experienceYears, setExperienceYears] = useState('8');
  const [prevInstitution, setPrevInstitution] = useState('');
  const [bio, setBio] = useState('');

  // Step 4: Employment Info
  const [joiningDate, setJoiningDate] = useState('2026-08-15');
  const [employmentType, setEmploymentType] = useState('Full-time');
  const [employmentStatus, setEmploymentStatus] = useState('Active');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [internalNotes, setInternalNotes] = useState('');

  // Step 5: Documents & Course Allocations
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [docCategory, setDocCategory] = useState<'cv' | 'qualification_certificate'>('cv');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [availableSubjects, setAvailableSubjects] = useState<SubjectItem[]>([]);

  // Step 6: Account Setup
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [mustChangePassword, setMustChangePassword] = useState(true);

  // Status and Validation
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.adminListSubjects(true)
        .then((res) => setAvailableSubjects(res.subjects || []))
        .catch(() => {});
      checkDraft();
    }
  }, [isOpen]);

  const checkDraft = () => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        setHasDraft(true);
      }
    } catch {}
  };

  const handleRestoreDraft = () => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.fullName) setFullName(d.fullName);
      if (d.employeeId) setEmployeeId(d.employeeId);
      if (d.dateOfBirth) setDateOfBirth(d.dateOfBirth);
      if (d.gender) setGender(d.gender);
      if (d.nationality) setNationality(d.nationality);
      if (d.avatarUrl) {
        setAvatarUrl(d.avatarUrl);
        setAvatarPreview(d.avatarUrl);
      }
      if (d.email) setEmail(d.email);
      if (d.personalEmail) setPersonalEmail(d.personalEmail);
      if (d.contactNumber) setContactNumber(d.contactNumber);
      if (d.altContactNumber) setAltContactNumber(d.altContactNumber);
      if (d.address) setAddress(d.address);
      if (d.city) setCity(d.city);
      if (d.country) setCountry(d.country);
      if (d.department) setDepartment(d.department);
      if (d.jobTitle) setJobTitle(d.jobTitle);
      if (d.highestQualification) setHighestQualification(d.highestQualification);
      if (d.specialization) setSpecialization(d.specialization);
      if (d.experienceYears) setExperienceYears(d.experienceYears);
      if (d.prevInstitution) setPrevInstitution(d.prevInstitution);
      if (d.bio) setBio(d.bio);
      if (d.joiningDate) setJoiningDate(d.joiningDate);
      if (d.employmentType) setEmploymentType(d.employmentType);
      if (d.employmentStatus) setEmploymentStatus(d.employmentStatus);
      if (d.academicYear) setAcademicYear(d.academicYear);
      if (d.internalNotes) setInternalNotes(d.internalNotes);
      if (d.documents) setDocuments(d.documents);
      if (d.step) setCurrentStep(d.step);
      setHasDraft(false);
    } catch (e) {
      console.error('Failed to restore faculty registration draft', e);
    }
  };

  const handleSaveDraft = () => {
    try {
      const draftData = {
        fullName,
        employeeId,
        dateOfBirth,
        gender,
        nationality,
        avatarUrl,
        email,
        personalEmail,
        contactNumber,
        altContactNumber,
        address,
        city,
        country,
        department,
        jobTitle,
        highestQualification,
        specialization,
        experienceYears,
        prevInstitution,
        bio,
        joiningDate,
        employmentType,
        employmentStatus,
        academicYear,
        internalNotes,
        documents,
        step: currentStep,
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
      setHasDraft(false);
      alert('Draft progress saved successfully to this browser.');
    } catch {}
  };

  // Avatar Upload Handler
  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFormError('Profile photo size must be less than 5 MB.');
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext || '')) {
      setFormError('Allowed photo formats: PNG, JPG, JPEG, WEBP.');
      return;
    }

    setFormError(null);
    setAvatarPreview(URL.createObjectURL(file));

    setUploadingAvatar(true);
    try {
      const res = await api.uploadFile(file, 'avatar');
      setAvatarUrl(res.file_url);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to upload photo to server.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    setAvatarUrl('');
  };

  // Document Upload Handler
  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setFormError('Document size must be less than 5 MB.');
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'doc', 'docx', 'png', 'jpg', 'jpeg'].includes(ext || '')) {
      setFormError('Allowed document formats: PDF, DOC, DOCX, PNG, JPG.');
      return;
    }

    setFormError(null);
    setUploadingDoc(true);
    try {
      const res = await api.uploadFile(file, 'document');
      const newDoc: UserDocument = {
        id: `doc-${Date.now()}`,
        name: file.name,
        file_url: res.file_url,
        file_type: res.file_type,
        category: docCategory,
        size: res.size,
        uploaded_at: new Date().toISOString(),
      };
      setDocuments((prev) => [...prev, newDoc]);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to upload document.');
    } finally {
      setUploadingDoc(false);
      e.target.value = '';
    }
  };

  const handleRemoveDoc = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pwd);
  };

  const validateCurrentStep = (): boolean => {
    setFormError(null);

    if (currentStep === 1) {
      if (!fullName.trim()) {
        setFormError('Full name is required.');
        return false;
      }
      if (!employeeId.trim()) {
        setFormError('Teacher / Employee ID is required.');
        return false;
      }
    } else if (currentStep === 2) {
      if (!email.trim()) {
        setFormError('Institutional faculty email is required.');
        return false;
      }
      if (!email.includes('@') || !email.includes('.')) {
        setFormError('Please enter a valid faculty email address.');
        return false;
      }
    } else if (currentStep === 6) {
      if (!password.trim()) {
        setFormError('Initial account password is required.');
        return false;
      }
      if (password.length < 8) {
        setFormError('Password must be at least 8 characters long.');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
    }
  };

  const handleBack = () => {
    setFormError(null);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCurrentStep()) return;

    setSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        full_name: fullName.trim(),
        employee_id: employeeId.trim(),
        email: email.trim(),
        password: password.trim(),
        role: 'teacher' as const,
        is_active: isActive,
        department: department.trim() || undefined,
        contact_number: contactNumber.trim() || undefined,
        avatar_url: avatarUrl || undefined,
        must_change_password: mustChangePassword,
        personal_info: {
          date_of_birth: dateOfBirth || undefined,
          gender: gender || undefined,
          nationality: nationality.trim() || undefined,
        },
        contact_info: {
          personal_email: personalEmail.trim() || undefined,
          contact_number: contactNumber.trim() || undefined,
          alternate_contact_number: altContactNumber.trim() || undefined,
          residential_address: address.trim() || undefined,
          city: city.trim() || undefined,
          country: country.trim() || undefined,
        },
        professional_info: {
          department: department.trim() || undefined,
          job_title: jobTitle.trim() || undefined,
          highest_qualification: highestQualification.trim() || undefined,
          specialization: specialization.trim() || undefined,
          experience_years: experienceYears ? parseInt(experienceYears, 10) || experienceYears : undefined,
          previous_institution: prevInstitution.trim() || undefined,
          bio: bio.trim() || undefined,
        },
        employment_info: {
          joining_date: joiningDate || undefined,
          employment_type: employmentType || undefined,
          employment_status: employmentStatus || undefined,
          academic_year: academicYear.trim() || undefined,
          internal_notes: internalNotes.trim() || undefined,
        },
        documents: documents,
      };

      const res = await api.adminCreateUser(payload);
      localStorage.removeItem(DRAFT_KEY);
      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create faculty account.');
    } finally {
      setSubmitting(false);
    }
  };

  const stepTitles = [
    'Personal Identity',
    'Contact Details',
    'Professional Info',
    'Employment Info',
    'Docs & Allocations',
    'Security & Setup',
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Faculty Registration & Workload Provisioning"
      maxWidth="max-w-4xl"
    >
      <div className="space-y-6">
        {/* Step Progress Tracker */}
        <div className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-royal flex items-center gap-1.5">
              <Briefcase size={14} />
              Step {currentStep} of {totalSteps}: {stepTitles[currentStep - 1]}
            </span>
            <div className="flex items-center gap-2">
              {hasDraft && (
                <>
                  <button
                    type="button"
                    onClick={handleRestoreDraft}
                    className="text-xs font-semibold text-brand-ocean hover:underline flex items-center gap-1"
                  >
                    <Save size={12} />
                    Restore Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.removeItem(DRAFT_KEY);
                      setHasDraft(false);
                    }}
                    className="text-xs text-rose-500 hover:underline flex items-center gap-1"
                  >
                    <Trash2 size={12} />
                    Discard
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={handleSaveDraft}
                className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
                title="Save current progress locally"
              >
                <Save size={12} />
                Save Draft
              </button>
            </div>
          </div>

          <div className="grid grid-cols-6 gap-2">
            {stepTitles.map((title, idx) => {
              const stepNum = idx + 1;
              const isPassed = stepNum < currentStep;
              const isCurrent = stepNum === currentStep;
              return (
                <div key={title} className="flex flex-col gap-1">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      isPassed
                        ? 'bg-emerald-500'
                        : isCurrent
                        ? 'bg-brand-royal'
                        : 'bg-slate-200'
                    }`}
                  />
                  <span
                    className={`text-[10px] truncate font-medium ${
                      isCurrent
                        ? 'text-brand-royal font-bold'
                        : isPassed
                        ? 'text-slate-600'
                        : 'text-slate-400'
                    }`}
                  >
                    {stepNum}. {title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <ErrorAlert message={formError || ''} onDismiss={() => setFormError(null)} />

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* STEP 1: PERSONAL INFORMATION */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-2xl bg-white border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden shadow-2xs">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Avatar preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-center p-2 text-slate-400 flex flex-col items-center">
                        <UserIcon size={32} className="stroke-1 text-slate-400" />
                        <span className="text-[10px] mt-1">Photo</span>
                      </div>
                    )}
                  </div>
                  {avatarPreview && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md hover:bg-rose-600"
                      title="Remove photo"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="space-y-1.5 flex-1 text-center sm:text-left">
                  <h4 className="text-sm font-bold text-navy-900">
                    Faculty Profile Photo
                  </h4>
                  <p className="text-xs text-slate-500">
                    PNG, JPG, JPEG, or WEBP. Max file size: 5 MB.
                  </p>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer shadow-2xs mt-2">
                    <Upload size={13} className="text-brand-royal" />
                    <span>{uploadingAvatar ? 'Uploading...' : avatarPreview ? 'Change Photo' : 'Upload Photo'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleAvatarSelect}
                      className="hidden"
                      disabled={uploadingAvatar}
                    />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Full Name *"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Dr. Catherine Mitchell"
                  required
                />
                <InputField
                  label="Teacher / Employee ID *"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="e.g. FAC-STEM-0012"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1.5">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="input w-full"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1.5">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="input w-full"
                  >
                    {GENDER_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <InputField
                  label="Nationality"
                  value={nationality}
                  onChange={(e) => setNationality(e.target.value)}
                  placeholder="e.g. American, British"
                />
              </div>
            </div>
          )}

          {/* STEP 2: CONTACT INFORMATION */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Institutional Email *"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. faculty@edupredict.edu"
                  required
                />
                <InputField
                  label="Personal Email (Optional)"
                  type="email"
                  value={personalEmail}
                  onChange={(e) => setPersonalEmail(e.target.value)}
                  placeholder="e.g. catherine.mitchell@gmail.com"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Primary Contact Number"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="e.g. +1 (555) 345-6789"
                />
                <InputField
                  label="Alternate Contact Number"
                  value={altContactNumber}
                  onChange={(e) => setAltContactNumber(e.target.value)}
                  placeholder="e.g. +1 (555) 345-6790"
                />
              </div>

              <InputField
                label="Residential Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 10 University Avenue, Suite 400"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Cambridge"
                />
                <InputField
                  label="Country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g. United States"
                />
              </div>
            </div>
          )}

          {/* STEP 3: PROFESSIONAL INFORMATION */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1.5">
                    Faculty Department *
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="input w-full"
                  >
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>

                <InputField
                  label="Job Title / Designation"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g. Associate Professor"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <InputField
                  label="Highest Qualification"
                  value={highestQualification}
                  onChange={(e) => setHighestQualification(e.target.value)}
                  placeholder="e.g. Ph.D. in Mathematics"
                />
                <InputField
                  label="Academic Specialization"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder="e.g. Applied Probability"
                />
                <InputField
                  label="Years of Experience"
                  type="number"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                  placeholder="e.g. 10"
                />
              </div>

              <InputField
                label="Previous Academic Institution"
                value={prevInstitution}
                onChange={(e) => setPrevInstitution(e.target.value)}
                placeholder="e.g. MIT, Stanford University"
              />

              <div>
                <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1.5">
                  Professional Biography
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  className="input w-full py-2 text-xs"
                  placeholder="Summary of research focus, teaching pedagogy, and academic milestones..."
                />
              </div>
            </div>
          )}

          {/* STEP 4: EMPLOYMENT INFORMATION */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1.5">
                    Official Joining Date
                  </label>
                  <input
                    type="date"
                    value={joiningDate}
                    onChange={(e) => setJoiningDate(e.target.value)}
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1.5">
                    Employment Type
                  </label>
                  <select
                    value={employmentType}
                    onChange={(e) => setEmploymentType(e.target.value)}
                    className="input w-full"
                  >
                    {EMPLOYMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1.5">
                    Employment Status
                  </label>
                  <select
                    value={employmentStatus}
                    onChange={(e) => setEmploymentStatus(e.target.value)}
                    className="input w-full"
                  >
                    {EMPLOYMENT_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <InputField
                label="Academic Year"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="e.g. 2026-2027"
              />

              <div>
                <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1.5">
                  Administrator-only Internal Notes
                </label>
                <textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={3}
                  className="input w-full py-2 text-xs"
                  placeholder="Confidential administrative notes, contract terms, or departmental committee assignments..."
                />
              </div>
            </div>
          )}

          {/* STEP 5: DOCUMENTS & ALLOCATION CATALOG */}
          {currentStep === 5 && (
            <div className="space-y-6">
              {/* Document Upload Section */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-navy-900">
                      Curriculum Vitae & Qualification Certificates
                    </h4>
                    <p className="text-xs text-slate-500">
                      Upload faculty CV, teaching certifications, or degree attestations (PDF, DOC, DOCX, PNG, JPG). Max 5 MB each.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={docCategory}
                      onChange={(e) => setDocCategory(e.target.value as any)}
                      className="text-xs rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 font-medium"
                    >
                      <option value="cv">Curriculum Vitae (CV)</option>
                      <option value="qualification_certificate">Qualification Certificate</option>
                    </select>

                    <label className="btn btn-primary text-xs py-1.5 px-3 cursor-pointer flex items-center gap-1.5">
                      <Upload size={13} />
                      <span>{uploadingDoc ? 'Uploading...' : 'Upload Doc'}</span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                        onChange={handleDocumentUpload}
                        className="hidden"
                        disabled={uploadingDoc}
                      />
                    </label>
                  </div>
                </div>

                {documents.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                    No documents uploaded yet. Documents can also be added after account creation.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText size={16} className="text-brand-royal shrink-0" />
                          <div className="truncate">
                            <span className="font-bold text-navy-900 block truncate">{doc.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono uppercase">
                              {doc.category.replace('_', ' ')} • {doc.file_type}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveDoc(doc.id)}
                          className="text-rose-500 hover:text-rose-700 p-1"
                          title="Remove document"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Informational Subject Allocation Catalog */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen size={16} className="text-brand-ocean" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-navy-900">
                      Institutional Curriculum Catalog (Informational)
                    </h4>
                  </div>
                  <span className="badge badge-neutral text-[10px]">
                    Decoupled Allocation Architecture
                  </span>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  To protect the integrity of subject-based authorization rules, faculty registration only provisions
                  user identity and departmental credentials. Assigning courses to this instructor is performed
                  in <strong>Faculty Allocations</strong> with designated academic term boundaries.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  {availableSubjects.map((s) => (
                    <div
                      key={s.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-brand-royal" />
                        <span className="font-bold text-navy-900">{s.name}</span>
                        <span className="text-[10px] font-mono text-slate-400">({s.code})</span>
                      </div>
                      <span className="text-[10px] text-slate-500">{s.department || 'All Departments'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: ACCOUNT SETUP & FINAL REVIEW */}
          {currentStep === 6 && (
            <div className="space-y-6">
              {/* Security Credentials */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-navy-900">
                  Account Credentials & Governance
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1.5">
                      Initial Secure Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        className="input w-full pr-20"
                        required
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="text-slate-400 hover:text-slate-600 p-1"
                        >
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={handleGeneratePassword}
                          className="text-[10px] font-bold text-brand-royal hover:underline px-1 py-0.5 bg-sky-50 rounded"
                          title="Generate random password"
                        >
                          Generate
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1.5">
                      Account Status
                    </label>
                    <select
                      value={isActive ? 'true' : 'false'}
                      onChange={(e) => setIsActive(e.target.value === 'true')}
                      className="input w-full"
                    >
                      <option value="true">Active (Immediate Portal Access)</option>
                      <option value="false">Inactive (Suspended / Pending Verification)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={mustChangePassword}
                      onChange={(e) => setMustChangePassword(e.target.checked)}
                      className="rounded text-brand-royal focus:ring-brand-royal/20"
                    />
                    <span className="text-xs font-medium text-slate-700">
                      Require password change upon first faculty authentication
                    </span>
                  </label>
                </div>
              </div>

              {/* Comprehensive Review Card */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-royal flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  Review Faculty Registration Profile
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Faculty Member</span>
                    <span className="font-bold text-navy-900 block">{fullName || '—'}</span>
                    <span className="font-mono text-slate-500 text-[11px]">{employeeId || '—'}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Department & Title</span>
                    <span className="font-bold text-navy-900 block">{department}</span>
                    <span className="text-slate-500 text-[11px]">{jobTitle || 'Faculty'}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Institutional Email</span>
                    <span className="font-semibold text-navy-900 block truncate">{email || '—'}</span>
                    <span className="text-slate-500 text-[11px]">{contactNumber || 'No phone'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Employment Profile</span>
                    <span className="font-medium text-navy-900 block">{employmentType} • {employmentStatus}</span>
                    <span className="text-slate-500 text-[11px]">Joined: {joiningDate} • Year: {academicYear}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Credentials & Documents</span>
                    <span className="font-medium text-navy-900 block">{documents.length} Document(s) attached</span>
                    <span className="text-slate-500 text-[11px]">Password: {password ? '••••••••' : 'Missing'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Form Actions / Navigation Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <div>
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleBack}
                  leftIcon={<ArrowLeft size={14} />}
                >
                  Back
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
              >
                Cancel
              </Button>

              {currentStep < totalSteps ? (
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleNext}
                  rightIcon={<ArrowRight size={14} />}
                >
                  Continue to Step {currentStep + 1}
                </Button>
              ) : (
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={submitting}
                  leftIcon={<CheckCircle2 size={14} />}
                >
                  Confirm & Create Faculty Account
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};
