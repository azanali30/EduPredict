import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PlatformOverview } from '../pages/platform/PlatformOverview';
import { AdminBilling } from '../pages/admin/AdminBilling';
import { platformApi } from '../services/api';

vi.mock('../services/api', () => ({
  platformApi: {
    getOverview: vi.fn(),
    getMySubscription: vi.fn(),
    changeMyPlan: vi.fn(),
    cancelMyPlan: vi.fn(),
  },
}));

describe('Phase 9 Platform & Billing Workspaces', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders PlatformOverview KPIs from backend API', async () => {
    (platformApi.getOverview as any).mockResolvedValue({
      status_code: 200,
      total_institutions: 12,
      active_institutions: 8,
      trial_institutions: 3,
      suspended_institutions: 1,
      active_subscriptions: 8,
      past_due_subscriptions: 0,
      monthly_predictions_used: 1450,
    });

    render(
      <MemoryRouter>
        <PlatformOverview />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Platform Super Admin Overview')).toBeDefined();
    });
    expect(screen.getByText('12')).toBeDefined();
    expect(screen.getByText('1450')).toBeDefined();
  });

  it('renders AdminBilling quota-exceeded & cancelled states cleanly', async () => {
    (platformApi.getMySubscription as any).mockResolvedValue({
      status_code: 200,
      subscription: {
        id: 'sub-1',
        organization_id: 'org-harvard',
        plan_tier: 'starter',
        plan_name: 'Starter',
        price_monthly_usd: 0,
        billing_status: 'cancelled',
        seat_limit: 25,
        seats_used: 10,
        prediction_quota_monthly: 500,
        predictions_used: 500,
        features: ['dropout_analytics'],
      },
      plans: [
        {
          plan_tier: 'starter',
          name: 'Starter',
          price_monthly_usd: 0,
          billing_interval: 'month',
          trial_days: 14,
          seat_limit: 25,
          prediction_quota_monthly: 500,
          features: ['dropout_analytics'],
          is_active: true,
        },
      ],
    });

    render(
      <MemoryRouter>
        <AdminBilling />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Institution Billing & Plan Quotas')).toBeDefined();
    });
    expect(screen.getByText(/Subscription is cancelled/i)).toBeDefined();
    expect(screen.getByText(/Monthly prediction quota reached/i)).toBeDefined();
  });
});
