import React, { useState } from 'react';
import {
  Sparkles,
  ShieldAlert,
  RotateCcw,
  Users,
  Heart,
  Clock,
  Award,
} from 'lucide-react';
import {
  PredictionSubject,
  PredictionMilestone,
  CreatePredictionPayload,
} from '../../types';
import { Button } from '../forms/Button';

interface PredictionFormProps {
  onSubmit: (payload: CreatePredictionPayload) => Promise<void>;
  loading: boolean;
  studentId?: string; // Optional if teacher/admin is generating for a student
  studentName?: string;
}

// Sensible baseline preset for rapid testing & evaluation
const DEFAULT_STUDENT_PROFILE: Record<string, any> = {
  // Demographics
  school: 'GP',
  sex: 'F',
  age: 16,
  address: 'U',
  famsize: 'GT3',
  Pstatus: 'T',
  Medu: 3,
  Fedu: 2,
  Mjob: 'services',
  Fjob: 'other',
  reason: 'course',
  guardian: 'mother',
  traveltime: 1,
  studytime: 2,
  failures: 0,
  schoolsup: 'no',
  famsup: 'yes',
  paid: 'no',
  activities: 'yes',
  nursery: 'yes',
  higher: 'yes',
  internet: 'yes',
  romantic: 'no',
  famrel: 4,
  freetime: 3,
  goout: 2,
  Dalc: 1,
  Walc: 1,
  health: 4,
  absences: 4,
  // Estimated Proxy Indicators
  study_hours_per_week: 15.0,
  attendance_percentage: 92.5,
  assignment_completion_rate: 85.0,
  // Milestone 1 & 2 Exam Marks
  previous_exam_marks: 65.0,
  quiz_scores: 70.0,
};

export const PredictionForm: React.FC<PredictionFormProps> = ({
  onSubmit,
  loading,
  studentId,
  studentName,
}) => {
  const [subject, setSubject] = useState<PredictionSubject>('Mathematics');
  const [milestone, setMilestone] = useState<PredictionMilestone>(0);
  const [formData, setFormData] = useState<Record<string, any>>(DEFAULT_STUDENT_PROFILE);
  const [activeSection, setActiveSection] = useState<'profile' | 'habits' | 'proxies' | 'exams'>('profile');

  // Handle field change
  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleReset = () => {
    setFormData(DEFAULT_STUDENT_PROFILE);
  };

  const handleQuickPreset = (presetType: 'struggling' | 'average' | 'excelling') => {
    if (presetType === 'struggling') {
      setFormData({
        ...DEFAULT_STUDENT_PROFILE,
        studytime: 1,
        failures: 2,
        schoolsup: 'yes',
        absences: 18,
        study_hours_per_week: 4.0,
        attendance_percentage: 68.0,
        assignment_completion_rate: 45.0,
        previous_exam_marks: 38.0,
        quiz_scores: 42.0,
      });
    } else if (presetType === 'excelling') {
      setFormData({
        ...DEFAULT_STUDENT_PROFILE,
        studytime: 3,
        failures: 0,
        higher: 'yes',
        absences: 1,
        study_hours_per_week: 25.0,
        attendance_percentage: 98.0,
        assignment_completion_rate: 96.0,
        previous_exam_marks: 85.0,
        quiz_scores: 88.0,
      });
    } else {
      setFormData(DEFAULT_STUDENT_PROFILE);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prepare features payload strictly according to milestone rules
    const features: Record<string, any> = {};

    // Base 33 Milestone 0 features
    const m0Fields = [
      'school', 'sex', 'age', 'address', 'famsize', 'Pstatus',
      'Medu', 'Fedu', 'Mjob', 'Fjob', 'reason', 'guardian',
      'traveltime', 'studytime', 'failures', 'schoolsup', 'famsup',
      'paid', 'activities', 'nursery', 'higher', 'internet', 'romantic',
      'famrel', 'freetime', 'goout', 'Dalc', 'Walc', 'health', 'absences',
      'study_hours_per_week', 'attendance_percentage', 'assignment_completion_rate',
    ];

    m0Fields.forEach((field) => {
      features[field] = formData[field];
    });

    // Milestone 1 adds previous_exam_marks
    if (milestone >= 1) {
      features['previous_exam_marks'] = Number(formData['previous_exam_marks'] ?? 50.0);
    }

    // Milestone 2 adds quiz_scores
    if (milestone === 2) {
      features['quiz_scores'] = Number(formData['quiz_scores'] ?? 50.0);
    }

    const payload: CreatePredictionPayload = {
      subject,
      milestone,
      features,
    };

    if (studentId) {
      payload.student_id = studentId;
    }

    await onSubmit(payload);
  };

  // Empirical False Negative Rates
  const mathFnRate = '61.54%';
  const portFnRate = '75.00%';
  const currentFnRate = subject === 'Mathematics' ? mathFnRate : portFnRate;
  const failingCount = subject === 'Mathematics' ? '8 of 13' : '9 of 12';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Target Student Header (if acting on behalf of student) */}
      {studentId && (
        <div className="card p-4 bg-sky-50/70 border-sky-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-sky-200 text-sky-800 font-bold flex items-center justify-center text-sm">
              {studentName ? studentName.charAt(0).toUpperCase() : 'S'}
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700">
                Authorized Target Learner
              </span>
              <h4 className="text-sm font-bold text-navy-950">
                {studentName || 'Target Student'}
              </h4>
              <span className="text-xs font-mono text-slate-500">ID: {studentId}</span>
            </div>
          </div>
          <span className="badge badge-teacher text-[10px]">Instructor Supervised</span>
        </div>
      )}

      {/* Step 1: Subject Selection */}
      <div className="card p-5 border-slate-200">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-3">
          1. Academic Course Subject
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setSubject('Mathematics')}
            className={`p-4 rounded-xl border text-left transition-all ${
              subject === 'Mathematics'
                ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-sm text-navy-900">Mathematics</span>
              <span className="badge bg-slate-100 text-slate-600 text-[10px]">395 Records</span>
            </div>
            <p className="text-xs text-slate-500">
              STEM curriculum evaluation model with continuous performance scaling (0 - 100).
            </p>
          </button>

          <button
            type="button"
            onClick={() => setSubject('Portuguese Language')}
            className={`p-4 rounded-xl border text-left transition-all ${
              subject === 'Portuguese Language'
                ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-sm text-navy-900">Portuguese Language</span>
              <span className="badge bg-slate-100 text-slate-600 text-[10px]">649 Records</span>
            </div>
            <p className="text-xs text-slate-500">
              Language & humanities evaluation model with continuous performance scaling (0 - 100).
            </p>
          </button>
        </div>
      </div>

      {/* Step 2: Milestone Selection */}
      <div className="card p-5 border-slate-200">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-3">
          2. Academic Evaluation Milestone
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Milestone 0 */}
          <button
            type="button"
            onClick={() => setMilestone(0)}
            className={`p-4 rounded-xl border text-left transition-all ${
              milestone === 0
                ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-sm text-navy-900">Milestone 0</span>
              <span className="badge bg-amber-100 text-amber-800 text-[10px] font-semibold">
                33 Features
              </span>
            </div>
            <div className="text-xs font-semibold text-brand-600 mb-1">Early Warning Screening</div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Behavioral & demographic screening conducted prior to any examination results.
            </p>
          </button>

          {/* Milestone 1 */}
          <button
            type="button"
            onClick={() => setMilestone(1)}
            className={`p-4 rounded-xl border text-left transition-all ${
              milestone === 1
                ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-sm text-navy-900">Milestone 1</span>
              <span className="badge bg-sky-100 text-sky-800 text-[10px] font-semibold">
                34 Features
              </span>
            </div>
            <div className="text-xs font-semibold text-brand-600 mb-1">Mid-Term Assessment</div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Behavioral indicators plus Period 1 Mid-Term examination marks.
            </p>
          </button>

          {/* Milestone 2 */}
          <button
            type="button"
            onClick={() => setMilestone(2)}
            className={`p-4 rounded-xl border text-left transition-all ${
              milestone === 2
                ? 'border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/20'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-sm text-navy-900">Milestone 2</span>
              <span className="badge bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                35 Features
              </span>
            </div>
            <div className="text-xs font-semibold text-brand-600 mb-1">Pre-Final Evaluation</div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Near-final evaluation incorporating both Period 1 Exam and Period 2 Quiz scores.
            </p>
          </button>
        </div>

        {/* Milestone 0 Prominent Early Warning Notice */}
        {milestone === 0 && (
          <div className="mt-4 p-4 rounded-xl border border-amber-300 bg-amber-50/80 text-amber-950">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-amber-900">
                    Milestone 0 Safety Advisory ({subject})
                  </span>
                  <span className="badge bg-amber-200 text-amber-900 border-amber-300 text-[10px] font-mono font-bold">
                    Empirical False Negative Rate: {currentFnRate}
                  </span>
                </div>
                <p className="text-amber-800 leading-relaxed text-[11px]">
                  In holdout evaluation, this early warning model failed to detect {failingCount} failing students because examination scores are not yet available. Behavioral indicators alone are insufficient for reliable failure diagnosis. Predictions must be confirmed with midterm exam results.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Step 3: Feature Sections */}
      <div className="card p-6 border-slate-200 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
              3. Student Academic Indicators ({milestone === 0 ? 33 : milestone === 1 ? 34 : 35} Features)
            </span>
            <span className="text-xs text-slate-400">
              Review and adjust the student's profile attributes below.
            </span>
          </div>

          {/* Quick Presets for fast testing */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-500 mr-1">Presets:</span>
            <button
              type="button"
              onClick={() => handleQuickPreset('struggling')}
              className="text-[11px] px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 font-medium border border-rose-200"
            >
              At Risk Profile
            </button>
            <button
              type="button"
              onClick={() => handleQuickPreset('average')}
              className="text-[11px] px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium border border-slate-200"
            >
              Average Profile
            </button>
            <button
              type="button"
              onClick={() => handleQuickPreset('excelling')}
              className="text-[11px] px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium border border-emerald-200"
            >
              Excelling Profile
            </button>
            <button
              type="button"
              onClick={handleReset}
              title="Reset to defaults"
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex border-b border-slate-200 text-xs font-semibold gap-1 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveSection('profile')}
            className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeSection === 'profile'
                ? 'bg-brand-50 text-brand-700'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Users size={14} />
            Demographics & Family (15)
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('habits')}
            className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeSection === 'habits'
                ? 'bg-brand-50 text-brand-700'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Heart size={14} />
            Study Habits & Social (15)
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('proxies')}
            className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeSection === 'proxies'
                ? 'bg-brand-50 text-brand-700'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Clock size={14} />
            Estimated Proxies (3)
          </button>
          {milestone >= 1 && (
            <button
              type="button"
              onClick={() => setActiveSection('exams')}
              className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeSection === 'exams'
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Award size={14} />
              Exam Marks ({milestone === 1 ? '1' : '2'})
            </button>
          )}
        </div>

        {/* Section 1: Demographics & Family */}
        {activeSection === 'profile' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            {/* School */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">School</label>
              <select
                value={formData.school}
                onChange={(e) => handleChange('school', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              >
                <option value="GP">GP - Gabriel Pereira</option>
                <option value="MS">MS - Mousinho da Silveira</option>
              </select>
            </div>

            {/* Sex */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Sex</label>
              <select
                value={formData.sex}
                onChange={(e) => handleChange('sex', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              >
                <option value="F">Female (F)</option>
                <option value="M">Male (M)</option>
              </select>
            </div>

            {/* Age */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Age (15–22)</label>
              <input
                type="number"
                min={15}
                max={22}
                value={formData.age}
                onChange={(e) => handleChange('age', parseInt(e.target.value) || 16)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              />
            </div>

            {/* Address */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Address Area</label>
              <select
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              >
                <option value="U">Urban (U)</option>
                <option value="R">Rural (R)</option>
              </select>
            </div>

            {/* Family Size */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Family Size</label>
              <select
                value={formData.famsize}
                onChange={(e) => handleChange('famsize', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              >
                <option value="GT3">Greater than 3 (&gt;3)</option>
                <option value="LE3">Less than or equal to 3 (&le;3)</option>
              </select>
            </div>

            {/* Parent Status */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Parent Cohabitation</label>
              <select
                value={formData.Pstatus}
                onChange={(e) => handleChange('Pstatus', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              >
                <option value="T">Living Together (T)</option>
                <option value="A">Apart (A)</option>
              </select>
            </div>

            {/* Mother Education */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Mother Education (Medu)</label>
              <select
                value={formData.Medu}
                onChange={(e) => handleChange('Medu', parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              >
                <option value={0}>0 - None</option>
                <option value={1}>1 - Primary (4th grade)</option>
                <option value={2}>2 - 5th to 9th grade</option>
                <option value={3}>3 - Secondary education</option>
                <option value={4}>4 - Higher education</option>
              </select>
            </div>

            {/* Father Education */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Father Education (Fedu)</label>
              <select
                value={formData.Fedu}
                onChange={(e) => handleChange('Fedu', parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              >
                <option value={0}>0 - None</option>
                <option value={1}>1 - Primary (4th grade)</option>
                <option value={2}>2 - 5th to 9th grade</option>
                <option value={3}>3 - Secondary education</option>
                <option value={4}>4 - Higher education</option>
              </select>
            </div>

            {/* Mother Job */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Mother Occupation</label>
              <select
                value={formData.Mjob}
                onChange={(e) => handleChange('Mjob', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              >
                <option value="teacher">Teacher</option>
                <option value="health">Health Care</option>
                <option value="services">Civil Services</option>
                <option value="at_home">At Home</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Father Job */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Father Occupation</label>
              <select
                value={formData.Fjob}
                onChange={(e) => handleChange('Fjob', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              >
                <option value="teacher">Teacher</option>
                <option value="health">Health Care</option>
                <option value="services">Civil Services</option>
                <option value="at_home">At Home</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Reason */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Reason for School Choice</label>
              <select
                value={formData.reason}
                onChange={(e) => handleChange('reason', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              >
                <option value="home">Close to Home</option>
                <option value="reputation">School Reputation</option>
                <option value="course">Course Preference</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Guardian */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Legal Guardian</label>
              <select
                value={formData.guardian}
                onChange={(e) => handleChange('guardian', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              >
                <option value="mother">Mother</option>
                <option value="father">Father</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Travel Time */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Travel Time</label>
              <select
                value={formData.traveltime}
                onChange={(e) => handleChange('traveltime', parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              >
                <option value={1}>1 - &lt; 15 min</option>
                <option value={2}>2 - 15 to 30 min</option>
                <option value={3}>3 - 30 min to 1 hr</option>
                <option value={4}>4 - &gt; 1 hr</option>
              </select>
            </div>

            {/* Study Time Category */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Weekly Study Bracket</label>
              <select
                value={formData.studytime}
                onChange={(e) => handleChange('studytime', parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              >
                <option value={1}>1 - &lt; 2 hours</option>
                <option value={2}>2 - 2 to 5 hours</option>
                <option value={3}>3 - 5 to 10 hours</option>
                <option value={4}>4 - &gt; 10 hours</option>
              </select>
            </div>

            {/* Failures */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Past Class Failures (0–4)</label>
              <input
                type="number"
                min={0}
                max={4}
                value={formData.failures}
                onChange={(e) => handleChange('failures', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              />
            </div>
          </div>
        )}

        {/* Section 2: Study Habits & Social Support */}
        {activeSection === 'habits' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            {/* School Support */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Extra Educational Support</label>
              <select
                value={formData.schoolsup}
                onChange={(e) => handleChange('schoolsup', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>

            {/* Family Support */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Family Educational Support</label>
              <select
                value={formData.famsup}
                onChange={(e) => handleChange('famsup', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>

            {/* Paid Tutoring */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Extra Paid Classes</label>
              <select
                value={formData.paid}
                onChange={(e) => handleChange('paid', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>

            {/* Extracurricular Activities */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Extracurricular Activities</label>
              <select
                value={formData.activities}
                onChange={(e) => handleChange('activities', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>

            {/* Nursery School */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Attended Nursery School</label>
              <select
                value={formData.nursery}
                onChange={(e) => handleChange('nursery', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>

            {/* Higher Education Aim */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Wants Higher Education</label>
              <select
                value={formData.higher}
                onChange={(e) => handleChange('higher', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>

            {/* Internet Access */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Home Internet Access</label>
              <select
                value={formData.internet}
                onChange={(e) => handleChange('internet', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>

            {/* Romantic Relationship */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Romantic Relationship</label>
              <select
                value={formData.romantic}
                onChange={(e) => handleChange('romantic', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>

            {/* Family Relationship */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Family Relations (1–5)</label>
              <select
                value={formData.famrel}
                onChange={(e) => handleChange('famrel', parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              >
                <option value={1}>1 - Very Bad</option>
                <option value={2}>2 - Bad</option>
                <option value={3}>3 - Neutral</option>
                <option value={4}>4 - Good</option>
                <option value={5}>5 - Excellent</option>
              </select>
            </div>

            {/* Free Time */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Free Time After School (1–5)</label>
              <select
                value={formData.freetime}
                onChange={(e) => handleChange('freetime', parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              >
                <option value={1}>1 - Very Low</option>
                <option value={2}>2 - Low</option>
                <option value={3}>3 - Moderate</option>
                <option value={4}>4 - High</option>
                <option value={5}>5 - Very High</option>
              </select>
            </div>

            {/* Going Out */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Going Out with Friends (1–5)</label>
              <select
                value={formData.goout}
                onChange={(e) => handleChange('goout', parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              >
                <option value={1}>1 - Very Low</option>
                <option value={2}>2 - Low</option>
                <option value={3}>3 - Moderate</option>
                <option value={4}>4 - High</option>
                <option value={5}>5 - Very High</option>
              </select>
            </div>

            {/* Workday Alcohol */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Workday Alcohol (1–5)</label>
              <input
                type="number"
                min={1}
                max={5}
                value={formData.Dalc}
                onChange={(e) => handleChange('Dalc', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              />
            </div>

            {/* Weekend Alcohol */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Weekend Alcohol (1–5)</label>
              <input
                type="number"
                min={1}
                max={5}
                value={formData.Walc}
                onChange={(e) => handleChange('Walc', parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              />
            </div>

            {/* Current Health */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Current Health Status (1–5)</label>
              <select
                value={formData.health}
                onChange={(e) => handleChange('health', parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              >
                <option value={1}>1 - Very Bad</option>
                <option value={2}>2 - Bad</option>
                <option value={3}>3 - Normal</option>
                <option value={4}>4 - Good</option>
                <option value={5}>5 - Very Good</option>
              </select>
            </div>

            {/* School Absences */}
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Recorded Absences (0–93)</label>
              <input
                type="number"
                min={0}
                max={93}
                value={formData.absences}
                onChange={(e) => handleChange('absences', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white"
              />
            </div>
          </div>
        )}

        {/* Section 3: Estimated Proxy Indicators */}
        {activeSection === 'proxies' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-purple-50/70 border border-purple-200 text-xs text-purple-900 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">
                  Academic Proxy Indicators Transparency Notice
                </span>
                <p className="text-[11px] text-purple-800 leading-relaxed">
                  These 3 features are derived synthetic approximations engineered during Phase 4 data preparation. They are labeled clearly to preserve rigorous data provenance and must never be treated as verified hardware-logged student activity.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Estimated Study Discipline Index */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="badge bg-purple-100 text-purple-800 text-[10px] font-bold">
                    Derived Heuristic
                  </span>
                  <span className="font-mono text-slate-400">0.0 – 100.0</span>
                </div>
                <label className="font-bold text-slate-800 block">
                  Estimated Study Discipline Index
                </label>
                <p className="text-[11px] text-slate-500">
                  Feature: <code className="font-mono">assignment_completion_rate</code>
                </p>
                <input
                  type="number"
                  step="0.1"
                  min={0.0}
                  max={100.0}
                  value={formData.assignment_completion_rate}
                  onChange={(e) =>
                    handleChange('assignment_completion_rate', parseFloat(e.target.value) || 0.0)
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white text-sm font-semibold"
                />
              </div>

              {/* Estimated Attendance Proxy */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="badge bg-purple-100 text-purple-800 text-[10px] font-bold">
                    60-Session Baseline
                  </span>
                  <span className="font-mono text-slate-400">0.0 – 100.0%</span>
                </div>
                <label className="font-bold text-slate-800 block">
                  Estimated Attendance Proxy
                </label>
                <p className="text-[11px] text-slate-500">
                  Feature: <code className="font-mono">attendance_percentage</code>
                </p>
                <input
                  type="number"
                  step="0.1"
                  min={0.0}
                  max={100.0}
                  value={formData.attendance_percentage}
                  onChange={(e) =>
                    handleChange('attendance_percentage', parseFloat(e.target.value) || 0.0)
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white text-sm font-semibold"
                />
              </div>

              {/* Estimated Weekly Study Hours */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="badge bg-purple-100 text-purple-800 text-[10px] font-bold">
                    Midpoint Approx.
                  </span>
                  <span className="font-mono text-slate-400">0.0 – 60.0 hrs</span>
                </div>
                <label className="font-bold text-slate-800 block">
                  Estimated Weekly Study Hours
                </label>
                <p className="text-[11px] text-slate-500">
                  Feature: <code className="font-mono">study_hours_per_week</code>
                </p>
                <input
                  type="number"
                  step="0.1"
                  min={0.0}
                  max={60.0}
                  value={formData.study_hours_per_week}
                  onChange={(e) =>
                    handleChange('study_hours_per_week', parseFloat(e.target.value) || 0.0)
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white text-sm font-semibold"
                />
              </div>
            </div>
          </div>
        )}

        {/* Section 4: Exam Marks (Milestone 1 & 2) */}
        {milestone >= 1 && activeSection === 'exams' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200 text-xs text-sky-950 flex items-start gap-2.5">
              <Award className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5">
                  Standardized Assessment Marks Input
                </span>
                <p className="text-[11px] text-sky-800 leading-relaxed">
                  Scaled from 0.0 to 100.0. In Milestone 1, Period 1 Exam marks (<code className="font-mono">previous_exam_marks</code>) are integrated. In Milestone 2, Period 2 Quiz scores (<code className="font-mono">quiz_scores</code>) are also incorporated.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Period 1 Exam Marks */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="badge bg-sky-100 text-sky-800 text-[10px] font-bold">
                    Period 1 Assessment
                  </span>
                  <span className="font-mono text-slate-400">0.0 – 100.0</span>
                </div>
                <label className="font-bold text-slate-800 block">
                  Mid-Term Exam Mark (<code className="font-mono">previous_exam_marks</code>)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={0.0}
                  max={100.0}
                  value={formData.previous_exam_marks}
                  onChange={(e) =>
                    handleChange('previous_exam_marks', parseFloat(e.target.value) || 0.0)
                  }
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white text-base font-bold font-mono"
                />
              </div>

              {/* Period 2 Quiz Scores (Milestone 2 only) */}
              {milestone === 2 && (
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="badge bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      Period 2 Assessment
                    </span>
                    <span className="font-mono text-slate-400">0.0 – 100.0</span>
                  </div>
                  <label className="font-bold text-slate-800 block">
                    Pre-Final Quiz Average (<code className="font-mono">quiz_scores</code>)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min={0.0}
                    max={100.0}
                    value={formData.quiz_scores}
                    onChange={(e) =>
                      handleChange('quiz_scores', parseFloat(e.target.value) || 0.0)
                    }
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 bg-white text-base font-bold font-mono"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Form Submission Footer */}
        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Evaluating with <strong className="text-slate-800">{subject}</strong> models for{' '}
            <strong className="text-slate-800">Milestone {milestone}</strong>.
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="submit"
              variant="primary"
              isLoading={loading}
              className="w-full sm:w-auto shadow-glow px-6"
              leftIcon={<Sparkles size={16} />}
            >
              Generate AI Prediction
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
};
