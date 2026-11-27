import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { SubjectItem } from '../../types';
import { SectionCard } from '../../components/common/SectionCard';
import { FeedbackInquiryWorkspace } from '../../components/common/FeedbackInquiryWorkspace';

export const StudentFeedback: React.FC = () => {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);

  useEffect(() => {
    api
      .getStudentSubjects()
      .then((res) => setSubjects(res?.subjects || []))
      .catch(() => setSubjects([]));
  }, []);

  return (
    <FeedbackInquiryWorkspace
      role="student"
      pageTitle="Student Feedback & Academic Support"
      pageSubtitle="Submit course feedback, request academic counseling, and view responses to your inquiries."
      categories={[
        { value: 'Academic Counseling', label: 'Academic Counseling & Tutoring Request' },
        { value: 'Course Feedback', label: 'Course Feedback & Experience' },
        { value: 'AI Predictions Help', label: 'Understanding My AI Predictions' },
        { value: 'Technical Issue', label: 'Technical Platform Support' },
      ]}
      subjects={subjects}
      statLabel="Support Desk"
      statValue="Active"
      statSubtitle="Persisted inquiry tracking"
      guidelinesCard={
        <SectionCard
          title="Student Counseling Resources"
          subtitle="Access academic support services."
        >
          <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="font-bold text-navy-900 mb-1">Private vs Shared Requests</div>
              <p>
                General feedback and technical inquiries remain private between you and administrators. Course-linked Academic Counseling requests may be shared with your assigned course instructor.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="font-bold text-navy-900 mb-1">Study Skills Workshops</div>
              <p>
                Weekly tutoring sessions are held on Wednesdays at 15:00 for Mathematics and Thursdays at 14:00 for Portuguese Language.
              </p>
            </div>
          </div>
        </SectionCard>
      }
    />
  );
};
