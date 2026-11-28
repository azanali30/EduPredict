import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { apiRequest, feedbackApi } from '../services/api';
import { Navbar } from '../components/common/Navbar';
import { NotificationCenterPanel } from '../components/common/NotificationCenterPanel';
import { AdminFeedback } from '../pages/admin/AdminFeedback';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-1',
      email: 'admin@edupredict.com',
      full_name: 'Admin Reviewer',
      role: 'admin',
      is_active: true,
    },
    logout: vi.fn(),
  }),
}));

vi.mock('../context/TeacherSubjectContext', () => ({
  TeacherSubjectSelector: () => null,
}));

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Phase 12 Minor Findings Remediation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retries PATCH once after expired CSRF 400 preserving payload and headers, and stops after 1 retry', async () => {
    const capturedPatchAttempts: Array<{
      csrf: string | null;
      contentType: string | null;
      accept: string | null;
      body: any;
      credentials: RequestCredentials | undefined;
    }> = [];

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === '/api/csrf-token') {
        const callNum = fetchSpy.mock.calls.filter(([u]) => String(u) === '/api/csrf-token').length;
        return jsonResponse({ csrf_token: callNum === 1 ? 'stale-csrf' : 'fresh-csrf' }, 200);
      }
      if (url === '/api/feedback/t-patch') {
        const hdrs = new Headers(init?.headers);
        capturedPatchAttempts.push({
          csrf: hdrs.get('X-CSRFToken'),
          contentType: hdrs.get('Content-Type'),
          accept: hdrs.get('Accept'),
          body: init?.body,
          credentials: init?.credentials,
        });
        if (capturedPatchAttempts.length === 1) {
          return jsonResponse({ message: 'CSRF validation failed: The CSRF token has expired.' }, 400);
        }
        return jsonResponse({ status_code: 200, ticket: { id: 't-patch', status: 'Reviewed' } }, 200);
      }
      return jsonResponse({ message: 'Unexpected URL' }, 500);
    });

    const res = await feedbackApi.updateTicket('t-patch', {
      status: 'Reviewed',
      admin_response: 'Preserved payload text',
    });
    expect(res.status_code).toBe(200);

    expect(capturedPatchAttempts).toHaveLength(2);
    expect(capturedPatchAttempts[0].csrf).toBe('stale-csrf');
    expect(capturedPatchAttempts[1].csrf).toBe('fresh-csrf');
    expect(capturedPatchAttempts[1].contentType).toBe('application/json');
    expect(capturedPatchAttempts[1].accept).toBe('application/json');
    expect(capturedPatchAttempts[1].body).toBe(
      JSON.stringify({ status: 'Reviewed', admin_response: 'Preserved payload text' })
    );
    expect(capturedPatchAttempts[1].credentials).toBe('include');

    // Persistent CSRF 400 must retry at most once (no infinite loop)
    let persistentPatchCount = 0;
    fetchSpy.mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/csrf-token') {
        return jsonResponse({ csrf_token: 'rotated-token' }, 200);
      }
      persistentPatchCount += 1;
      return jsonResponse({ message: 'CSRF validation failed: Invalid token.' }, 400);
    });

    await expect(
      apiRequest('/api/feedback/t-fail', { method: 'PATCH', body: JSON.stringify({ status: 'Resolved' }) })
    ).rejects.toThrow(/CSRF validation failed/i);
    expect(persistentPatchCount).toBe(2);

    // Existing POST retry behavior remains intact
    let postAttempt = 0;
    fetchSpy.mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/csrf-token') {
        return jsonResponse({ csrf_token: 'post-fresh-token' }, 200);
      }
      postAttempt += 1;
      if (postAttempt === 1) {
        return jsonResponse({ message: 'CSRF validation failed: expired.' }, 400);
      }
      return jsonResponse({ status_code: 201 }, 201);
    });
    const postRes = await apiRequest('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test', message: 'Valid body' }),
    });
    expect(postRes.status_code).toBe(201);
    expect(postAttempt).toBe(2);
  });

  it('AdminFeedback labels intervention_notes accurately without internal/confidential wording', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith('/api/feedback')) {
        return jsonResponse({
          status_code: 200,
          tickets: [
            {
              id: 't-wording',
              sender_id: 's-1',
              sender_role: 'student',
              sender_name: 'Student One',
              category: 'Academic Counseling',
              title: 'Support Inquiry',
              message: 'Need tutoring information.',
              share_with_instructor: true,
              status: 'Open',
              created_at: '2026-11-27T12:00:00Z',
            },
          ],
          summary: { total: 1, open: 1, reviewed: 0, resolved: 0 },
          total: 1,
          page: 1,
          limit: 12,
          total_pages: 1,
        });
      }
      return jsonResponse({ message: 'Unexpected URL' }, 404);
    });

    render(
      <MemoryRouter>
        <AdminFeedback />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Support Inquiry')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Review & Respond'));
    expect(screen.getByText(/Intervention Notes \(Optional — Visible on Ticket\)/i)).toBeTruthy();
    const notesTextarea = screen.getByPlaceholderText(
      /Record academic follow-up or intervention steps visible to the ticket owner/i
    );
    expect(notesTextarea).toBeTruthy();
    expect(document.body.textContent?.toLowerCase()).not.toContain('internal academic follow-up');
  });

  it('Navbar refreshes unread count immediately after Mark Read and Mark All Read in NotificationCenterPanel', async () => {
    let unread = 2;
    let items = [
      {
        id: 'n1',
        recipient_id: 'admin-1',
        recipient_role: 'admin',
        category: 'early_warning',
        severity: 'critical',
        title: 'Alert One',
        message: 'First persisted alert.',
        is_read: false,
        created_at: '2026-11-27T12:00:00Z',
      },
      {
        id: 'n2',
        recipient_id: 'admin-1',
        recipient_role: 'admin',
        category: 'broadcast',
        severity: 'info',
        title: 'Alert Two',
        message: 'Second persisted alert.',
        is_read: false,
        created_at: '2026-11-27T11:00:00Z',
      },
    ];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/csrf-token') {
        return jsonResponse({ csrf_token: 'csrf-ok' });
      }
      if (url === '/api/health') {
        return jsonResponse({ status: 'healthy', database: { connected: true } });
      }
      if (url === '/api/notifications/n1/read') {
        items = items.map((i) => (i.id === 'n1' ? { ...i, is_read: true } : i));
        unread = items.filter((i) => !i.is_read).length;
        return jsonResponse({ status_code: 200, notification: items[0] });
      }
      if (url === '/api/notifications/read-all') {
        items = items.map((i) => ({ ...i, is_read: true }));
        unread = 0;
        return jsonResponse({ status_code: 200, modified_count: 1 });
      }
      if (url.startsWith('/api/notifications')) {
        return jsonResponse({
          status_code: 200,
          notifications: items,
          total: items.length,
          unread_count: unread,
          page: 1,
          limit: 10,
          total_pages: 1,
        });
      }
      return jsonResponse({ message: 'Not found' }, 404);
    });

    render(
      <MemoryRouter initialEntries={['/admin/notifications']}>
        <Navbar title="Notifications" />
        <NotificationCenterPanel
          title="Notifications Inbox"
          subtitle="Inbox subtitle"
          feedTitle="Alert Feed"
          feedSubtitle="Feed subtitle"
        />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Alert One')).toBeTruthy();
    });

    // Open Navbar notification dropdown and verify initial "2 unread"
    fireEvent.click(screen.getByLabelText('Notifications'));
    await waitFor(() => {
      expect(screen.getByText('2 unread')).toBeTruthy();
    });

    // Click Mark Read inside NotificationCenterPanel -> Navbar count updates immediately to "1 unread"
    const markReadBtns = screen.getAllByText('Mark Read');
    fireEvent.click(markReadBtns[0]);
    await waitFor(() => {
      expect(screen.getByText('1 unread')).toBeTruthy();
    });

    // Click Mark All Read -> Navbar count updates immediately to "0 unread"
    fireEvent.click(screen.getByText('Mark All Read'));
    await waitFor(() => {
      expect(screen.getByText('0 unread')).toBeTruthy();
    });
  });
});
