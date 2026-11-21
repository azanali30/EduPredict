import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { SectionCard } from '../../components/common/SectionCard';
import { StatCard } from '../../components/common/StatCard';
import { Button } from '../../components/forms/Button';
import { InputField } from '../../components/forms/InputField';
import { useTeacherSubject } from '../../context/TeacherSubjectContext';
import {
  MessageSquare,
  Send,
  CheckCircle2,
  Clock,
  BookOpen,
} from 'lucide-react';

export const TeacherFeedback: React.FC = () => {
  const { selectedSubject } = useTeacherSubject();
  const [category, setCategory] = useState('Curriculum & Grading');
  const [subjectTitle, setSubjectTitle] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !subjectTitle.trim()) return;
    setSubmitted(true);
    setSubjectTitle('');
    setMessage('');
    setTimeout(() => setSubmitted(false), 4000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teacher Feedback & Academic Support"
        subtitle="Submit curriculum observations, request model calibration reviews, or contact administrative support."
        icon={<MessageSquare size={24} className="text-brand-royal" />}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Active Discipline"
          value={selectedSubject?.name || 'Classroom'}
          subtitle={`Subject code: ${selectedSubject?.code || 'N/A'}`}
          icon={<BookOpen size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Support Status"
          value="Online"
          subtitle="Administrative desk active"
          icon={<CheckCircle2 size={20} className="text-emerald-500" />}
        />
        <StatCard
          title="Average Response"
          value="< 24 Hours"
          subtitle="Academic counseling SLA"
          icon={<Clock size={20} className="text-brand-ocean" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Support Ticket Submission Form */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Submit Feedback or Inquiries"
            subtitle="Send your feedback directly to the academic administrator."
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              {submitted && (
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center gap-2 border border-emerald-200">
                  <CheckCircle2 size={16} />
                  <span>Feedback inquiry logged successfully. Administrator will review shortly.</span>
                </div>
              )}

              <div>
                <label className="label">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input text-xs sm:text-sm"
                >
                  <option value="Curriculum & Grading">Curriculum & Grading Calibration</option>
                  <option value="At-Risk Triage">At-Risk Student Intervention Support</option>
                  <option value="Platform Usability">Platform Usability & Feature Request</option>
                  <option value="IT Support">Technical / System Issue</option>
                </select>
              </div>

              <InputField
                label="Inquiry Subject"
                value={subjectTitle}
                onChange={(e) => setSubjectTitle(e.target.value)}
                placeholder="e.g. Question regarding G1 weighting in Milestone 1"
                required
              />

              <div>
                <label className="label">Message / Description</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Detail your observation or support request..."
                  className="input h-32 text-xs sm:text-sm resize-none"
                  required
                />
              </div>

              <Button type="submit" variant="primary" leftIcon={<Send size={14} />} className="shadow-glow">
                Submit Inquiry
              </Button>
            </form>
          </SectionCard>
        </div>

        {/* Support Information */}
        <div>
          <SectionCard
            title="Faculty Assistance Guidelines"
            subtitle="Guidelines for requesting academic interventions."
          >
            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="font-bold text-navy-900 mb-1">Early-Warning Triage Protocol</div>
                <p>
                  If a student receives a High Risk prediction (predicted mark &lt; 50.0% / &lt; 10.0/20.0), log an intervention note and notify departmental academic counseling.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="font-bold text-navy-900 mb-1">Subject Allocation Adjustments</div>
                <p>
                  To request additions or changes to your assigned subjects or terms, select "Curriculum & Grading" above or contact your administrator.
                </p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
};
