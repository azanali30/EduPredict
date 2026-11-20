import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { SubjectItem, User, UserDocument } from '../../types';
import { Modal } from '../common/Modal';
import { Button } from '../forms/Button';
import { InputField } from '../forms/InputField';
import { ErrorAlert } from '../common/ErrorAlert';
import {
  User as UserIcon,
  FileText,
  Upload,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  BookOpen,
  Eye,
  EyeOff,
  Sparkles,
  Save,
  Trash2,
  Info,
} from 'lucide-react';

interface StudentRegistrationModalProps {
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

const GUARDIAN_RELATIONSHIPS = [
  'Father',
  'Mother',
  'Legal Guardian',
  'Grandparent',
  'Sibling',
  'Other',
];

const DRAFT_KEY = 'edupredict_student_reg_draft';

export const StudentRegistrationModal: React.FC<StudentRegistrationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 6;

  // Step 1: Personal Info
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
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

  // Step 3: Guardian Info
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState('Father');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  // Step 4: Academic Info
  const [admissionDate, setAdmissionDate] = useState('2026-09-01');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [academicTerm, setAcademicTerm] = useState('2026-T1');
  const [programCourse, setProgramCourse] = useState('B.Sc. Data Science & Analytics');
  const [department, setDepartment] = useState('STEM & Mathematics');
  const [classGrade, setClassGrade] = useState('Year 1');
  const [prevInstitution, setPrevInstitution] = useState('');
  const [prevQualification, setPrevQualification] = useState('');

  // Step 5: Documents & Enrollment Preview
  const [documents, setDocuments] = useState<UserDocument[]>([]);
  const [docCategory, setDocCategory] = useState<'admission_document' | 'academic_certificate'>('admission_document');
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

  // Load subject catalog for informational display in Step 5
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
      if (d.studentId) setStudentId(d.studentId);
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
      if (d.guardianName) setGuardianName(d.guardianName);
      if (d.guardianRelationship) setGuardianRelationship(d.guardianRelationship);
      if (d.guardianPhone) setGuardianPhone(d.guardianPhone);
      if (d.guardianEmail) setGuardianEmail(d.guardianEmail);
      if (d.emergencyPhone) setEmergencyPhone(d.emergencyPhone);
      if (d.admissionDate) setAdmissionDate(d.admissionDate);
      if (d.academicYear) setAcademicYear(d.academicYear);
      if (d.academicTerm) setAcademicTerm(d.academicTerm);
      if (d.programCourse) setProgramCourse(d.programCourse);
      if (d.department) setDepartment(d.department);
      if (d.classGrade) setClassGrade(d.classGrade);
      if (d.prevInstitution) setPrevInstitution(d.prevInstitution);
      if (d.prevQualification) setPrevQualification(d.prevQualification);
      if (d.documents) setDocuments(d.documents);
      if (d.step) setCurrentStep(d.step);
      setHasDraft(false);
    } catch (e) {
      console.error('Failed to restore student registration draft', e);
    }
  };

  const handleSaveDraft = () => {
    try {
      const draftData = {
        fullName,
        studentId,
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
        guardianName,
        guardianRelationship,
        guardianPhone,
        guardianEmail,
        emergencyPhone,
        admissionDate,
        academicYear,
        academicTerm,
        programCourse,
        department,
        classGrade,
        prevInstitution,
        prevQualification,
        documents,
        step: currentStep,
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
      setHasDraft(false);
      alert('Draft progress saved successfully to this browser.');
    } catch {}
  };

  const handleClearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setHasDraft(false);
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

    // Upload immediately to server
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
      // Reset input
      e.target.value = '';
    }
  };

  const handleRemoveDoc = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  // Generate strong initial password helper
  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pwd);
  };

  // Step Validation
  const validateCurrentStep = (): boolean => {
    setFormError(null);

    if (currentStep === 1) {
      if (!fullName.trim()) {
        setFormError('Full name is required.');
        return false;
      }
      if (!studentId.trim()) {
        setFormError('Student ID / Admission ID is required.');
        return false;
      }
    } else if (currentStep === 2) {
      if (!email.trim()) {
        setFormError('Institutional email is required.');
        return false;
      }
      if (!email.includes('@') || !email.includes('.')) {
        setFormError('Please enter a valid institutional email address.');
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
        student_id: studentId.trim(),
        email: email.trim(),
        password: password.trim(),
        role: 'student' as const,
        is_active: isActive,
        contact_number: contactNumber.trim() || undefined,
        department: department.trim() || undefined,
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
        guardian_info: {
          guardian_full_name: guardianName.trim() || undefined,
          relationship: guardianRelationship || undefined,
          guardian_contact_number: guardianPhone.trim() || undefined,
          guardian_email: guardianEmail.trim() || undefined,
          emergency_contact_number: emergencyPhone.trim() || undefined,
        },
        academic_info: {
          admission_date: admissionDate || undefined,
          academic_year: academicYear.trim() || undefined,
          academic_term: academicTerm.trim() || undefined,
          program_course: programCourse.trim() || undefined,
          department: department.trim() || undefined,
          class_grade: classGrade.trim() || undefined,
          previous_institution: prevInstitution.trim() || undefined,
          previous_qualification: prevQualification.trim() || undefined,
        },
        documents: documents,
      };

      const res = await api.adminCreateUser(payload);
      localStorage.removeItem(DRAFT_KEY);
      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create student account.');
    } finally {
      setSubmitting(false);
    }
  };

  const stepTitles = [
    'Personal Identity',
    'Contact Details',
    'Guardian Info',
    'Academic Profile',
    'Docs & Courses',
    'Security & Setup',
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Student Registration & Identity Provisioning"
      maxWidth="max-w-4xl"
    >
      <div className="space-y-6">
        {/* Step Progress Tracker */}
        <div className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-royal flex items-center gap-1.5">
              <Sparkles size={14} />
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
                    onClick={handleClearDraft}
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
                    Student Profile Photo
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
                  placeholder="e.g. Johnathan Doe"
                  required
                />
                <InputField
                  label="Student ID / Admission ID *"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="e.g. STU-2026-0042"
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
                  placeholder="e.g. American, Canadian"
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
                  placeholder="e.g. student@edupredict.edu"
                  required
                />
                <InputField
                  label="Personal Email (Optional)"
                  type="email"
                  value={personalEmail}
                  onChange={(e) => setPersonalEmail(e.target.value)}
                  placeholder="e.g. personal.email@gmail.com"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Primary Contact Number"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="e.g. +1 (555) 019-2834"
                />
                <InputField
                  label="Alternate Contact Number"
                  value={altContactNumber}
                  onChange={(e) => setAltContactNumber(e.target.value)}
                  placeholder="e.g. +1 (555) 019-2835"
                />
              </div>

              <InputField
                label="Residential Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 742 Evergreen Terrace, Apt 4"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Springfield"
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

          {/* STEP 3: PARENT / GUARDIAN INFORMATION */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-sky-50/60 border border-sky-100 flex items-start gap-3">
                <Info size={16} className="text-brand-ocean shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 leading-relaxed">
                  Provide primary guardian contact information for institutional academic advisories,
                  at-risk interventions, and official emergency communications.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Guardian Full Name"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder="e.g. Robert Doe"
                />
                <div>
                  <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1.5">
                    Relationship
                  </label>
                  <select
                    value={guardianRelationship}
                    onChange={(e) => setGuardianRelationship(e.target.value)}
                    className="input w-full"
                  >
                    {GUARDIAN_RELATIONSHIPS.map((rel) => (
                      <option key={rel} value={rel}>
                        {rel}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <InputField
                  label="Guardian Contact Number"
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                  placeholder="e.g. +1 (555) 012-3456"
                />
                <InputField
                  label="Guardian Email"
                  type="email"
                  value={guardianEmail}
                  onChange={(e) => setGuardianEmail(e.target.value)}
                  placeholder="e.g. parent@example.com"
                />
                <InputField
                  label="Emergency Contact Number"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  placeholder="e.g. +1 (555) 911-0000"
                />
              </div>
            </div>
          )}

          {/* STEP 4: ACADEMIC INFORMATION */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1.5">
                    Admission Date
                  </label>
                  <input
                    type="date"
                    value={admissionDate}
                    onChange={(e) => setAdmissionDate(e.target.value)}
                    className="input w-full"
                  />
                </div>
                <InputField
                  label="Academic Year"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  placeholder="e.g. 2026-2027"
                />
                <InputField
                  label="Academic Term"
                  value={academicTerm}
                  onChange={(e) => setAcademicTerm(e.target.value)}
                  placeholder="e.g. 2026-T1"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <InputField
                  label="Program / Degree Program"
                  value={programCourse}
                  onChange={(e) => setProgramCourse(e.target.value)}
                  placeholder="e.g. B.Sc. Data Science"
                />
                <div>
                  <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1.5">
                    Department
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
                  label="Class / Grade Cohort"
                  value={classGrade}
                  onChange={(e) => setClassGrade(e.target.value)}
                  placeholder="e.g. Year 1, Section A"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Previous Institution"
                  value={prevInstitution}
                  onChange={(e) => setPrevInstitution(e.target.value)}
                  placeholder="e.g. Springfield High School"
                />
                <InputField
                  label="Previous Qualification"
                  value={prevQualification}
                  onChange={(e) => setPrevQualification(e.target.value)}
                  placeholder="e.g. High School Diploma, GPA 3.8"
                />
              </div>
            </div>
          )}

          {/* STEP 5: DOCUMENTS & ENROLLMENT CATALOG */}
          {currentStep === 5 && (
            <div className="space-y-6">
              {/* Document Upload Section */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-navy-900">
                      Admission & Qualification Documents
                    </h4>
                    <p className="text-xs text-slate-500">
                      Upload transcripts, identification, or academic certificates (PDF, DOC, DOCX, PNG, JPG). Max 5 MB each.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={docCategory}
                      onChange={(e) => setDocCategory(e.target.value as any)}
                      className="text-xs rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 font-medium"
                    >
                      <option value="admission_document">Admission Document</option>
                      <option value="academic_certificate">Academic Certificate</option>
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

              {/* Informational Course Catalog */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen size={16} className="text-brand-ocean" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-navy-900">
                      Institutional Curriculum Catalog (Informational)
                    </h4>
                  </div>
                  <span className="badge badge-neutral text-[10px]">
                    Decoupled Enrollment Architecture
                  </span>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  In compliance with EduPredict Subject-Based Access Control (RBAC), registering a student
                  account provisions their institutional identity. Subject enrollments and course evaluations
                  are configured separately in <strong>Student Enrollments</strong> to ensure strict academic term boundary validation.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  {availableSubjects.map((s) => (
                    <div
                      key={s.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="font-bold text-navy-900">{s.name}</span>
                        <span className="text-[10px] font-mono text-slate-400">({s.code})</span>
                      </div>
                      <span className="text-[10px] text-slate-500">{s.target_scale || '0 - 100'}</span>
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
                      Require password change upon first student authentication
                    </span>
                  </label>
                </div>
              </div>

              {/* Comprehensive Review Card */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-royal flex items-center gap-1.5">
                  <CheckCircle2 size={16} className="text-emerald-500" />
                  Review Registration Profile
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Student</span>
                    <span className="font-bold text-navy-900 block">{fullName || '—'}</span>
                    <span className="font-mono text-slate-500 text-[11px]">{studentId || '—'}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Institutional Email</span>
                    <span className="font-semibold text-navy-900 block truncate">{email || '—'}</span>
                    <span className="text-slate-500 text-[11px]">{contactNumber || 'No phone'}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Program & Dept</span>
                    <span className="font-bold text-navy-900 block">{programCourse}</span>
                    <span className="text-slate-500 text-[11px]">{department}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Parent / Guardian</span>
                    <span className="font-medium text-navy-900 block">{guardianName ? `${guardianName} (${guardianRelationship})` : 'Not provided'}</span>
                    <span className="text-slate-500 text-[11px]">{guardianPhone || 'No guardian phone'}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Documents & Credentials</span>
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
                  Confirm & Create Student Account
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};
