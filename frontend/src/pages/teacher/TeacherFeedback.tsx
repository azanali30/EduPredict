import React from 'react';
import { SectionCard } from '../../components/common/SectionCard';
import { FeedbackInquiryWorkspace } from '../../components/common/FeedbackInquiryWorkspace';
import { useTeacherSubject } from '../../context/TeacherSubjectContext';

export const TeacherFeedback: React.FC = () => {
  const { subjects, selectedSubject, selectedSubjectId } = useTeacherSubject();

  return (
    <FeedbackInquiryWorkspace
      role="teacher"
      pageTitle="Teacher Feedback & Academic Support"
      pageSubtitle="Submit curriculum observations, track inquiry responses, and review authorized student counseling requests."
      categories={[
        { value: 'Curriculum & Grading', label: 'Curriculum & Grading Calibration' },
        { value: 'At-Risk Triage', label: 'At-Risk Student Intervention Support' },
        { value: 'Platform Usability', label: 'Platform Usability & Feature Request' },
        { value: 'IT Support', label: 'Technical / System Issue' },
      ]}
      subjects={subjects}
      defaultSubjectId={selectedSubjectId || ''}
      statLabel="Active Discipline"
      statValue={selectedSubject?.name || 'All Courses'}
      statSubtitle={selectedSubject ? `Subject code: ${selectedSubject.code}` : 'General & course inquiries'}
      guidelinesCard={
        <SectionCard
          title="Faculty Assistance Guidelines"
          subtitle="Guidelines for requesting academic interventions."
        >
          <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="font-bold text-navy-900 mb-1">Early-Warning Triage Protocol</div>
              <p>
                If a student receives a High Risk prediction (predicted mark &lt; 50.0% / &lt; 10.0/20.0), review authorized counseling requests below or coordinate with departmental advising.
              </p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="font-bold text-navy-900 mb-1">Authorization Boundaries</div>
              <p>
                Only Academic Counseling requests shared by students actively enrolled in your assigned courses and terms appear in your queue.
              </p>
            </div>
          </div>
        </SectionCard>
      }
    />
  );
};
