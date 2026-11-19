import React, { useState } from 'react';
import { PageHeader } from '../../components/common/PageHeader';
import { SectionCard } from '../../components/common/SectionCard';
import { StatCard } from '../../components/common/StatCard';
import { Button } from '../../components/forms/Button';
import { InputField } from '../../components/forms/InputField';
import {
  MessageSquare,
  Send,
  CheckCircle2,
  HelpCircle,
  Clock,
} from 'lucide-react';

export const StudentFeedback: React.FC = () => {
  const [category, setCategory] = useState('Course Feedback');
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
        title="Student Feedback & Academic Support"
        subtitle="Submit feedback on your learning experience, request academic counseling, or ask platform support."
        icon={<MessageSquare size={24} className="text-brand-royal" />}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Academic Support"
          value="Available"
          subtitle="Mentorship desk online"
          icon={<HelpCircle size={20} className="text-brand-royal" />}
        />
        <StatCard
          title="Confidentiality"
          value="Protected"
          subtitle="Direct advisor communication"
          icon={<CheckCircle2 size={20} className="text-emerald-500" />}
        />
        <StatCard
          title="Response Time"
          value="< 24 Hours"
          subtitle="Student counseling SLA"
          icon={<Clock size={20} className="text-brand-ocean" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SectionCard
            title="Submit Feedback or Inquiries"
            subtitle="Send your message to the educational support and counseling team."
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              {submitted && (
                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center gap-2 border border-emerald-200">
                  <CheckCircle2 size={16} />
                  <span>Your feedback has been submitted successfully. An advisor will respond shortly.</span>
                </div>
              )}

              <div>
                <label className="label">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input text-xs sm:text-sm"
                >
                  <option value="Course Feedback">Course Feedback & Experience</option>
                  <option value="Academic Counseling">Academic Counseling & Tutoring Request</option>
                  <option value="AI Predictions Help">Understanding My AI Predictions</option>
                  <option value="Technical Issue">Technical Platform Support</option>
                </select>
              </div>

              <InputField
                label="Topic / Subject"
                value={subjectTitle}
                onChange={(e) => setSubjectTitle(e.target.value)}
                placeholder="e.g. Request for additional Mathematics tutoring"
                required
              />

              <div>
                <label className="label">Message / Details</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your inquiry or question in detail..."
                  className="input h-32 text-xs sm:text-sm resize-none"
                  required
                />
              </div>

              <Button type="submit" variant="primary" leftIcon={<Send size={14} />} className="shadow-glow">
                Submit Message
              </Button>
            </form>
          </SectionCard>
        </div>

        <div>
          <SectionCard
            title="Student Counseling Resources"
            subtitle="Access academic support services."
          >
            <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="font-bold text-navy-900 mb-1">Study Skills Workshops</div>
                <p>
                  Weekly tutoring sessions are held on Wednesdays at 15:00 for Mathematics and Thursdays at 14:00 for Portuguese.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="font-bold text-navy-900 mb-1">Peer Mentorship Program</div>
                <p>
                  Connect with senior students who have mastered your enrolled subjects for 1-on-1 guidance.
                </p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
};
