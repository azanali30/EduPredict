import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { User } from '../../types';
import { Modal } from '../common/Modal';
import { Button } from '../forms/Button';
import { InputField } from '../forms/InputField';
import { ErrorAlert } from '../common/ErrorAlert';
import { Save } from 'lucide-react';

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSuccess: (updatedUser: User) => void;
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

export const EditUserModal: React.FC<EditUserModalProps> = ({
  isOpen,
  onClose,
  user,
  onSuccess,
}) => {
  const [fullName, setFullName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [department, setDepartment] = useState('STEM & Mathematics');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Prefer not to say');
  const [nationality, setNationality] = useState('');
  const [personalEmail, setPersonalEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

  // Student specific
  const [programCourse, setProgramCourse] = useState('');
  const [classGrade, setClassGrade] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');

  // Teacher specific
  const [jobTitle, setJobTitle] = useState('');
  const [qualification, setQualification] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [experience, setExperience] = useState('');
  const [employmentType, setEmploymentType] = useState('Full-time');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || '');
      setIdentifier(user.role === 'student' ? user.student_id || '' : user.employee_id || '');
      setContactNumber(user.contact_number || user.contact_info?.contact_number || '');
      setDepartment(user.department || user.professional_info?.department || user.academic_info?.department || 'STEM & Mathematics');
      
      const p = user.personal_info || {};
      setDob(p.date_of_birth || '');
      setGender(p.gender || 'Prefer not to say');
      setNationality(p.nationality || '');

      const c = user.contact_info || {};
      setPersonalEmail(c.personal_email || '');
      setAddress(c.residential_address || '');
      setCity(c.city || '');
      setCountry(c.country || '');

      if (user.role === 'student') {
        const a = user.academic_info || {};
        setProgramCourse(a.program_course || '');
        setClassGrade(a.class_grade || '');
        const g = user.guardian_info || {};
        setGuardianName(g.guardian_full_name || '');
        setGuardianPhone(g.guardian_contact_number || '');
      } else if (user.role === 'teacher') {
        const prof = user.professional_info || {};
        setJobTitle(prof.job_title || '');
        setQualification(prof.highest_qualification || '');
        setSpecialization(prof.specialization || '');
        setExperience(String(prof.experience_years || ''));
        const emp = user.employment_info || {};
        setEmploymentType(emp.employment_type || 'Full-time');
      }
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Full name is required.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: any = {
        full_name: fullName.trim(),
        contact_number: contactNumber.trim() || undefined,
        department: department.trim() || undefined,
        personal_info: {
          date_of_birth: dob || undefined,
          gender: gender || undefined,
          nationality: nationality.trim() || undefined,
        },
        contact_info: {
          personal_email: personalEmail.trim() || undefined,
          contact_number: contactNumber.trim() || undefined,
          residential_address: address.trim() || undefined,
          city: city.trim() || undefined,
          country: country.trim() || undefined,
        },
      };

      if (user.role === 'student') {
        if (identifier.trim()) {
          payload.student_id = identifier.trim();
        }
        payload.academic_info = {
          program_course: programCourse.trim() || undefined,
          department: department.trim() || undefined,
          class_grade: classGrade.trim() || undefined,
        };
        payload.guardian_info = {
          guardian_full_name: guardianName.trim() || undefined,
          guardian_contact_number: guardianPhone.trim() || undefined,
        };
      } else if (user.role === 'teacher') {
        if (identifier.trim()) {
          payload.employee_id = identifier.trim();
        }
        payload.professional_info = {
          department: department.trim() || undefined,
          job_title: jobTitle.trim() || undefined,
          highest_qualification: qualification.trim() || undefined,
          specialization: specialization.trim() || undefined,
          experience_years: experience ? parseInt(experience, 10) || experience : undefined,
        };
        payload.employment_info = {
          employment_type: employmentType || undefined,
        };
      }

      const res = await api.adminUpdateUser(user.id, payload);
      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit ${user.role === 'student' ? 'Student' : 'Faculty'} Profile: ${user.full_name}`}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            label="Full Name *"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <InputField
            label={user.role === 'student' ? 'Student ID / Admission ID' : 'Employee ID'}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1.5">
              Department
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="input w-full"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <InputField
            label="Contact Number"
            value={contactNumber}
            onChange={(e) => setContactNumber(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-navy-900 uppercase tracking-wider mb-1.5">
              Date of Birth
            </label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
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
              {GENDER_OPTIONS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
          <InputField
            label="Nationality"
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            label="Personal Email"
            type="email"
            value={personalEmail}
            onChange={(e) => setPersonalEmail(e.target.value)}
          />
          <InputField
            label="Residential Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        {user.role === 'student' && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-royal">
              Student Specific Fields
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InputField
                label="Program / Course"
                value={programCourse}
                onChange={(e) => setProgramCourse(e.target.value)}
              />
              <InputField
                label="Class / Grade"
                value={classGrade}
                onChange={(e) => setClassGrade(e.target.value)}
              />
              <InputField
                label="Guardian Name"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
              />
              <InputField
                label="Guardian Phone"
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
              />
            </div>
          </div>
        )}

        {user.role === 'teacher' && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-royal">
              Faculty Specific Fields
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InputField
                label="Job Title / Designation"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
              <InputField
                label="Highest Qualification"
                value={qualification}
                onChange={(e) => setQualification(e.target.value)}
              />
              <InputField
                label="Academic Specialization"
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
              />
              <InputField
                label="Years of Experience"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={saving}
            leftIcon={<Save size={14} />}
          >
            Save Profile Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
};
