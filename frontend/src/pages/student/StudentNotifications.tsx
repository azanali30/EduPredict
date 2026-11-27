import React from 'react';
import { NotificationCenterPanel } from '../../components/common/NotificationCenterPanel';

export const StudentNotifications: React.FC = () => {
  return (
    <NotificationCenterPanel
      title="Student Notifications & Announcements"
      subtitle="Persisted academic reminders, prediction early warnings, support updates, and notices."
      feedTitle="Recent Academic Notices"
      feedSubtitle="Updates from predictive early-warning checks, ticket responses, and announcements."
    />
  );
};
