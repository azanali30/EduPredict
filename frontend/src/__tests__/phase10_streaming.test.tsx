import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminRealTimeStream } from '../pages/admin/AdminRealTimeStream';
import { streamApi } from '../services/api';

vi.mock('../services/api', () => ({
  streamApi: {
    getStatus: vi.fn(),
    listEvents: vi.fn(),
    ingestEvent: vi.fn(),
    retryEvent: vi.fn(),
  },
}));

describe('Phase 10 AdminRealTimeStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders streaming KPIs and empty state cleanly', async () => {
    (streamApi.getStatus as any).mockResolvedValue({
      status_code: 200,
      metrics: {
        events_received: 5,
        events_processed: 4,
        events_failed: 1,
        events_pending: 0,
        out_of_order_events: 0,
        incomplete_data_events: 0,
        backfill_events: 2,
        realtime_events: 3,
        average_latency_ms: 12.5,
        last_event_at: null,
        delivery_guarantee: 'at-least-once (idempotent event_id deduplication)',
      },
      reconciliation: {
        realtime_processed: 2,
        batch_backfill_processed: 2,
        total_unique_processed: 4,
        consistent: true,
      },
    });
    (streamApi.listEvents as any).mockResolvedValue({
      status_code: 200,
      events: [],
      total: 0,
    });

    render(
      <MemoryRouter>
        <AdminRealTimeStream />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Real-Time Data Stream & Monitoring')).toBeTruthy();
      expect(screen.getByText('No stream events recorded yet')).toBeTruthy();
      expect(screen.getByText('12.5 ms')).toBeTruthy();
    });
  });

  it('displays understandable error alert when status fails to load', async () => {
    (streamApi.getStatus as any).mockRejectedValue(new Error('Stream service offline'));
    (streamApi.listEvents as any).mockResolvedValue({ status_code: 200, events: [], total: 0 });

    render(
      <MemoryRouter>
        <AdminRealTimeStream />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Stream service offline')).toBeTruthy();
    });
  });
});
