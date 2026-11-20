import React, { useEffect } from 'react';
import { User, PredictionRecord } from '../../types';
import { StatusBadge } from './StatusBadge';
import { Button } from '../forms/Button';
import {
  X,
  Sparkles,
  Hash,
  Mail,
  ShieldCheck,
  TrendingUp,
  BrainCircuit,
  Info,
  Phone,
  GraduationCap,
  MapPin,
  HeartHandshake,
  FileText,
  Edit,
} from 'lucide-react';

interface StudentProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  student: User | null;
  latestPrediction?: PredictionRecord | null;
  onAssessClick?: (student: User) => void;
  onEditClick?: (student: User) => void;
}

export const StudentProfileDrawer: React.FC<StudentProfileDrawerProps> = ({
  isOpen,
  onClose,
  student,
  latestPrediction,
  onAssessClick,
  onEditClick,
}) => {
  // Close on Escape key
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

  if (!isOpen || !student) return null;

  const personal = student.personal_info || {};
  const contact = student.contact_info || {};
  const guardian = student.guardian_info || {};
  const academic = student.academic_info || {};
  const docs = student.documents || [];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-navy-950/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-lg bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-drawer-in">
          {/* Drawer Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center gap-3">
              {student.avatar_url ? (
                <img
                  src={student.avatar_url}
                  alt={student.full_name}
                  className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shadow-sm shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-royal via-brand-ocean to-brand-mint text-white flex items-center justify-center font-extrabold text-base shadow-glow-brand shrink-0">
                  {student.full_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <h3 className="text-base font-extrabold text-navy-900 leading-snug">
                  {student.full_name}
                </h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="badge badge-student text-[10px] py-0 px-2 font-semibold">
                    Assigned Learner
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    ID: {student.student_id || student.id.slice(-8)}
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
            {/* Identity & Account Metadata */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Institutional Credentials
              </h4>
              <div className="grid grid-cols-1 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-3">
                  <Mail size={16} className="text-slate-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase block">Institutional Email</span>
                    <span className="text-xs font-mono font-medium text-slate-800 truncate block">
                      {student.email}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2.5">
                    <Hash size={16} className="text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase block">Admission ID</span>
                      <span className="text-xs font-mono font-semibold text-slate-800 truncate block">
                        {student.student_id || student.id.slice(-8)}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2.5">
                    <ShieldCheck size={16} className="text-emerald-500 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase block">Status</span>
                      <span className="text-xs font-semibold text-emerald-700 block">
                        {student.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>

                {student.contact_number && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2.5">
                    <Phone size={16} className="text-slate-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase block">Contact Number</span>
                      <span className="text-xs font-medium text-slate-800 truncate block">
                        {student.contact_number}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Academic Profile */}
            {(academic.program_course || academic.department || academic.class_grade) && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <GraduationCap size={14} className="text-brand-royal" />
                  <span>Academic Profile</span>
                </h4>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs">
                  {academic.program_course && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Degree / Program</span>
                      <span className="font-bold text-navy-900">{academic.program_course}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {academic.department && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Department</span>
                        <span className="text-slate-700">{academic.department}</span>
                      </div>
                    )}
                    {academic.class_grade && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Cohort / Grade</span>
                        <span className="text-slate-700">{academic.class_grade}</span>
                      </div>
                    )}
                  </div>
                  {(academic.academic_year || academic.academic_term) && (
                    <div className="grid grid-cols-2 gap-2">
                      {academic.academic_year && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Academic Year</span>
                          <span className="text-slate-700">{academic.academic_year}</span>
                        </div>
                      )}
                      {academic.academic_term && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Academic Term</span>
                          <span className="font-mono text-brand-royal font-bold">{academic.academic_term}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Parent / Guardian Information */}
            {(guardian.guardian_full_name || guardian.guardian_contact_number) && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <HeartHandshake size={14} className="text-brand-ocean" />
                  <span>Parent / Guardian Information</span>
                </h4>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Guardian Name</span>
                    <span className="font-semibold text-navy-900">
                      {guardian.guardian_full_name} {guardian.relationship ? `(${guardian.relationship})` : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {guardian.guardian_contact_number && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Phone</span>
                        <span className="text-slate-700">{guardian.guardian_contact_number}</span>
                      </div>
                    )}
                    {guardian.emergency_contact_number && (
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Emergency Phone</span>
                        <span className="text-rose-600 font-bold">{guardian.emergency_contact_number}</span>
                      </div>
                    )}
                  </div>
                  {guardian.guardian_email && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Email</span>
                      <span className="text-slate-700">{guardian.guardian_email}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Personal & Address Details */}
            {(personal.date_of_birth || personal.gender || contact.residential_address) && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <MapPin size={14} className="text-slate-400" />
                  <span>Personal & Address Details</span>
                </h4>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                  <div className="grid grid-cols-3 gap-2">
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
                  {(contact.residential_address || contact.city) && (
                    <div className="pt-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Residential Address</span>
                      <span className="text-slate-700">
                        {[contact.residential_address, contact.city, contact.country].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Documents List */}
            {docs.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <FileText size={14} className="text-brand-royal" />
                  <span>Attached Documents</span>
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

            {/* AI Performance Telemetry Card */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <BrainCircuit size={13} className="text-brand-royal" />
                  <span>AI Predictive Telemetry</span>
                </h4>
                {latestPrediction && (
                  <span className="text-[10px] text-slate-400 font-medium">
                    {new Date(latestPrediction.created_at).toLocaleDateString()}
                  </span>
                )}
              </div>

              {latestPrediction ? (
                <div className="card p-4 space-y-3.5 border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <span className="text-xs font-bold text-navy-900 block">
                        {latestPrediction.subject}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Milestone {latestPrediction.milestone} Evaluation
                      </span>
                    </div>
                    <StatusBadge status={latestPrediction.predicted_status} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">
                        Projected Mark
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-extrabold text-navy-950 font-mono">
                          {latestPrediction.predicted_marks.toFixed(1)}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">/ 100</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] font-semibold text-slate-400 block mb-0.5">
                        Model Confidence
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-extrabold text-navy-950 font-mono">
                          {(latestPrediction.top_confidence * 100).toFixed(0)}%
                        </span>
                        <span className="text-xs text-slate-400 font-mono">prob</span>
                      </div>
                    </div>
                  </div>

                  {latestPrediction.uncertainty_warning && (
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                      <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
                      <span>{latestPrediction.uncertainty_message || 'Model uncertainty flag: close decision boundary.'}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="card p-5 text-center space-y-2 border-dashed border-slate-200 bg-slate-50/50">
                  <TrendingUp size={24} className="mx-auto text-slate-300" />
                  <div className="text-xs font-bold text-slate-700">No Assessment Record</div>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    This assigned student has not been evaluated through the ML prediction engine yet.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Drawer Footer Actions */}
          <div className="p-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3 shrink-0">
            {onEditClick && (
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  onClose();
                  onEditClick(student);
                }}
                leftIcon={<Edit size={14} />}
              >
                Edit Profile
              </Button>
            )}
            {onAssessClick && (
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  onClose();
                  onAssessClick(student);
                }}
                leftIcon={<Sparkles size={15} />}
                className="flex-1 bg-gradient-to-r from-brand-royal via-brand-ocean to-brand-mint hover:opacity-95 text-white"
              >
                Launch AI Assessment
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
