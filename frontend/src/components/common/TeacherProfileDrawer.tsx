import React, { useEffect } from 'react';
import { User, TeacherSubjectAssignmentItem } from '../../types';
import { Button } from '../forms/Button';
import {
  X,
  Hash,
  Mail,
  ShieldCheck,
  Phone,
  Briefcase,
  Award,
  FileText,
  MapPin,
  BookOpen,
  Edit,
} from 'lucide-react';

interface TeacherProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: User | null;
  assignments?: TeacherSubjectAssignmentItem[];
  onEditClick?: (teacher: User) => void;
}

export const TeacherProfileDrawer: React.FC<TeacherProfileDrawerProps> = ({
  isOpen,
  onClose,
  teacher,
  assignments = [],
  onEditClick,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !teacher) return null;

  const personal = teacher.personal_info || {};
  const contact = teacher.contact_info || {};
  const professional = teacher.professional_info || {};
  const employment = teacher.employment_info || {};
  const docs = teacher.documents || [];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="fixed inset-0 bg-navy-950/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-lg bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-drawer-in">
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center gap-3">
              {teacher.avatar_url ? (
                <img
                  src={teacher.avatar_url}
                  alt={teacher.full_name}
                  className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shadow-sm shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-royal via-brand-ocean to-brand-mint text-white flex items-center justify-center font-extrabold text-lg shadow-glow-brand shrink-0">
                  {teacher.full_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h3 className="text-base font-extrabold text-navy-900 leading-snug">
                  {teacher.full_name}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="badge badge-teacher text-[10px] py-0 px-2 font-semibold">
                    Faculty Member
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    ID: {teacher.employee_id || teacher.id.slice(-8)}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl text-slate-400 hover:text-navy-900 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close drawer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
            {/* 1. Account Credentials & Status */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Institutional Credentials
              </h4>
              <div className="grid grid-cols-1 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
                  <Mail size={16} className="text-slate-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase block">Faculty Email</span>
                    <span className="text-xs font-mono font-medium text-slate-800 truncate block">
                      {teacher.email}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2.5">
                    <Hash size={16} className="text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase block">Employee ID</span>
                      <span className="text-xs font-mono font-semibold text-slate-800 truncate block">
                        {teacher.employee_id || '—'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2.5">
                    <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase block">Status</span>
                      <span className="text-xs font-semibold text-emerald-700 block">
                        {teacher.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Professional & Academic Workload */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Briefcase size={13} className="text-brand-royal" />
                <span>Professional & Academic Profile</span>
              </h4>
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Department</span>
                    <span className="font-semibold text-navy-900">{teacher.department || professional.department || 'STEM & Mathematics'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Designation</span>
                    <span className="font-semibold text-navy-900">{professional.job_title || 'Faculty Member'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Highest Qualification</span>
                    <span className="text-slate-700">{professional.highest_qualification || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Specialization</span>
                    <span className="text-slate-700">{professional.specialization || '—'}</span>
                  </div>
                </div>

                {professional.experience_years && (
                  <div className="text-xs">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Experience</span>
                    <span className="text-slate-700">{professional.experience_years} years teaching experience</span>
                  </div>
                )}

                {professional.bio && (
                  <div className="text-xs pt-1 border-t border-slate-200/60">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Biography</span>
                    <p className="text-slate-600 italic text-[11px] leading-relaxed">{professional.bio}</p>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Employment Information */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Award size={13} className="text-brand-ocean" />
                <span>Institutional Employment</span>
              </h4>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Employment Type</span>
                  <span className="text-xs font-bold text-slate-800">{employment.employment_type || 'Full-time'}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Joining Date</span>
                  <span className="text-xs font-medium text-slate-800">{employment.joining_date || '—'}</span>
                </div>
              </div>
            </div>

            {/* 4. Contact & Personal Details */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Contact & Personal Details
              </h4>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                {(personal.date_of_birth || personal.gender || personal.nationality) && (
                  <div className="grid grid-cols-3 gap-2 pb-2 border-b border-slate-200/60">
                    {personal.date_of_birth && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">DOB</span>
                        <span className="text-slate-700">{personal.date_of_birth}</span>
                      </div>
                    )}
                    {personal.gender && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Gender</span>
                        <span className="text-slate-700">{personal.gender}</span>
                      </div>
                    )}
                    {personal.nationality && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Nationality</span>
                        <span className="text-slate-700">{personal.nationality}</span>
                      </div>
                    )}
                  </div>
                )}
                {teacher.contact_number && (
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-slate-400" />
                    <span className="text-slate-700">{teacher.contact_number}</span>
                  </div>
                )}
                {contact.personal_email && (
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-slate-400" />
                    <span className="text-slate-700">{contact.personal_email}</span>
                  </div>
                )}
                {(contact.residential_address || contact.city) && (
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                    <span className="text-slate-700">
                      {[contact.residential_address, contact.city, contact.country].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* 5. Assigned Courses */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <BookOpen size={13} className="text-brand-royal" />
                <span>Assigned Course Workload</span>
              </h4>
              {assignments.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                  No active course allocations assigned yet. Course allocations are managed in Faculty Allocations.
                </div>
              ) : (
                <div className="space-y-2">
                  {assignments.map((a) => (
                    <div
                      key={a.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="font-bold text-navy-900">{a.subject_name || 'Subject'}</span>
                        <span className="text-[10px] font-mono text-slate-400">({a.subject_code || 'CODE'})</span>
                      </div>
                      <span className="font-mono text-[10px] text-brand-royal font-bold">{a.academic_term}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 6. Documents & Certifications */}
            {docs.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Attached Documents & CV
                </h4>
                <div className="space-y-2">
                  {docs.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText size={15} className="text-brand-royal shrink-0" />
                        <span className="font-medium text-navy-900 truncate">{d.name}</span>
                      </div>
                      <a
                        href={d.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-royal hover:underline font-bold text-[11px] shrink-0"
                      >
                        View
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3 shrink-0">
            {onEditClick && (
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  onClose();
                  onEditClick(teacher);
                }}
                leftIcon={<Edit size={14} />}
                className="flex-1"
              >
                Edit Faculty Profile
              </Button>
            )}
            <Button variant="outline" size="md" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
