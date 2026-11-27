import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminNotifications } from '../pages/admin/AdminNotifications';
import { TeacherNotifications } from '../pages/teacher/TeacherNotifications';
import { StudentNotifications } from '../pages/student/StudentNotifications';
import { AdminFeedback } from '../pages/admin/AdminFeedback';
import { TeacherFeedback } from '../pages/teacher/TeacherFeedback';
import { StudentFeedback } from '../pages/student/StudentFeedback';
import { api, notificationsApi, feedbackApi } from '../services/api';

vi.mock('../context/TeacherSubjectContext', () => ({
  useTeacherSubject: () => ({
    subjects: [{ id: 'subj-1', name: 'Mathematics', code: 'MATH-101' }],
    selectedSubject: { id: 'subj-1', name: 'Mathematics', code: 'MATH-101' },
    selectedSubjectId: 'subj-1',
    hasNoAssignments: false,
    loading: false,
  }),
}));

vi.mock('../services/api', () => ({
  api: {
    getStudentSubjects: vi.fn(),
  },
  notificationsApi: {
    list: vi.fn(),
    getUnreadCount: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    broadcast: vi.fn(),
  },
  feedbackApi: {
    submit: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(),
    updateTicket: vi.fn(),
  },
}));

describe('Phase 12 Notifications & Feedback UI Workspaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.getStudentSubjects as any).mockResolvedValue({
      subjects: [{ id: 'subj-1', name: 'Mathematics', code: 'MATH-101' }],
    });
  });

  it('AdminNotifications renders persisted feed, marks read, and submits real broadcast', async () => {
    (notificationsApi.list as any).mockResolvedValue({
      status_code: 200,
      notifications: [
        {
          id: 'n1',
          recipient_id: 'u1',
          recipient_role: 'admin',
          category: 'early_warning',
          severity: 'critical',
          title: 'High-Risk Milestone Alert',
          message: 'Student flagged High Risk in Mathematics M1.',
          is_read: false,
          created_at: '2026-11-27T10:00:00Z',
        },
      ],
      total: 1,
      unread_count: 1,
      page: 1,
      limit: 10,
      total_pages: 1,
    });
    (notificationsApi.markAsRead as any).mockResolvedValue({ status_code: 200 });
    (notificationsApi.broadcast as any).mockResolvedValue({
      status_code: 201,
      broadcast_id: 'b1',
      recipient_count: 4,
      target_roles: ['student', 'teacher'],
      severity: 'info',
      title: 'Exam Notice',
      message: 'Milestone 1 opens Monday.',
    });

    render(
      <MemoryRouter>
        <AdminNotifications />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('High-Risk Milestone Alert')).toBeTruthy();
      expect(screen.getByText('Unread')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Mark Read'));
    await waitFor(() => {
      expect(notificationsApi.markAsRead).toHaveBeenCalledWith('n1');
    });

    fireEvent.change(screen.getByPlaceholderText(/Milestone 1 Evaluation Window/i), {
      target: { value: 'Exam Notice' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Mid-term Milestone 1 evaluations/i), {
      target: { value: 'Milestone 1 opens Monday.' },
    });
    fireEvent.click(screen.getByText('Send Broadcast'));

    await waitFor(() => {
      expect(notificationsApi.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Exam Notice',
          message: 'Milestone 1 opens Monday.',
        })
      );
      expect(screen.getByText(/Broadcast delivered to 4 active user/i)).toBeTruthy();
    });
  });

  it('TeacherNotifications & StudentNotifications render persisted empty states cleanly', async () => {
    (notificationsApi.list as any).mockResolvedValue({
      status_code: 200,
      notifications: [],
      total: 0,
      unread_count: 0,
      page: 1,
      limit: 10,
      total_pages: 1,
    });

    render(
      <MemoryRouter>
        <TeacherNotifications />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Classroom Notifications & Early-Warning Alerts')).toBeTruthy();
      expect(screen.getByText('No notifications found')).toBeTruthy();
    });

    render(
      <MemoryRouter>
        <StudentNotifications />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Student Notifications & Announcements')).toBeTruthy();
    });
  });

  it('AdminFeedback reviews and updates ticket status through Open -> Reviewed transition', async () => {
    (feedbackApi.list as any).mockResolvedValue({
      status_code: 200,
      tickets: [
        {
          id: 't1',
          sender_id: 's1',
          sender_role: 'student',
          sender_name: 'Alice Student',
          subject_id: 'subj-1',
          subject: 'Mathematics',
          category: 'Academic Counseling',
          title: 'Need Algebra Help',
          message: 'Looking for practice sheets.',
          share_with_instructor: true,
          status: 'Open',
          created_at: '2026-11-27T11:00:00Z',
        },
      ],
      summary: { total: 1, open: 1, reviewed: 0, resolved: 0 },
      total: 1,
      page: 1,
      limit: 12,
      total_pages: 1,
    });
    (feedbackApi.updateTicket as any).mockResolvedValue({ status_code: 200 });

    render(
      <MemoryRouter>
        <AdminFeedback />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Need Algebra Help')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Review & Respond'));
    fireEvent.change(screen.getByPlaceholderText(/Provide clear guidance/i), {
      target: { value: 'Enrolled in Wednesday math tutoring.' },
    });
    fireEvent.click(screen.getByText('Save Review Update'));

    await waitFor(() => {
      expect(feedbackApi.updateTicket).toHaveBeenCalledWith('t1', {
        status: 'Reviewed',
        admin_response: 'Enrolled in Wednesday math tutoring.',
        intervention_notes: '',
      });
    });
  });

  it('StudentFeedback & TeacherFeedback submit real tickets and display persisted history', async () => {
    (feedbackApi.list as any).mockResolvedValue({
      status_code: 200,
      tickets: [],
      summary: { total: 0, open: 0, reviewed: 0, resolved: 0 },
      total: 0,
      page: 1,
      limit: 10,
      total_pages: 1,
    });
    (feedbackApi.submit as any).mockResolvedValue({
      status_code: 201,
      ticket: { id: 't2', title: 'Support Question', status: 'Open' },
    });

    render(
      <MemoryRouter>
        <StudentFeedback />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No feedback inquiries yet')).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText(/Summarize your inquiry/i), {
      target: { value: 'Tutoring Slot Request' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describe your inquiry/i), {
      target: { value: 'Requesting extra practice sessions for Milestone 1.' },
    });
    fireEvent.click(screen.getByText('Submit Inquiry'));

    await waitFor(() => {
      expect(feedbackApi.submit).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'Academic Counseling',
          title: 'Tutoring Slot Request',
        })
      );
    });

    render(
      <MemoryRouter>
        <TeacherFeedback />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Teacher Feedback & Academic Support')).toBeTruthy();
    });
  });
});
