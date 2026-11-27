import React from 'react';
import { NotificationCenterPanel } from '../../components/common/NotificationCenterPanel';

export const TeacherNotifications: React.FC = () => {
  return (
    <NotificationCenterPanel
      title="Classroom Notifications & Early-Warning Alerts"
      subtitle="Persisted early-warning alerts for your authorized subjects and institutional notices."
      feedTitle="Classroom Alert Feed"
      feedSubtitle="Automated High-Risk warnings, confirmed anomalies, and institutional broadcasts."
    />
  );
};
