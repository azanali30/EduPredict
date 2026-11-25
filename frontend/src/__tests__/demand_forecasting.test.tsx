import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CourseDemandForecasting } from '../pages/shared/CourseDemandForecasting';
import { demandApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

// Polyfill ResizeObserver for Recharts ResponsiveContainer in jsdom
globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock('../services/api', () => ({
  demandApi: {
    getOverview: vi.fn(),
    generateForecast: vi.fn(),
    getHistory: vi.fn(),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const mockOverviewResponse = {
  status_code: 200,
  summary: {
    total_subjects_analyzed: 2,
    total_latest_actual_enrollment: 45,
    total_predicted_enrollment: 52,
    high_demand_count: 1,
    low_demand_count: 1,
    periods_ahead: 1,
    overall_data_sufficiency: 'sufficient' as const,
    sufficiency_breakdown: { sufficient: 2, baseline_only: 0, insufficient: 0 },
    average_walk_forward_mae: 2.1,
    models_used: { RidgeLagForecaster: 1, MovingAverage2: 1 },
  },
  forecasts: [
    {
      subject_id: 'subj-1',
      subject_code: 'MAT101',
      subject_name: 'Mathematics',
      department: 'STEM',
      capacity: 40,
      historical_series: [],
      terms_observed: 5,
      forecast_period: '2026-2027-T1',
      periods_ahead: 1,
      latest_actual_enrollment: 35,
      predicted_enrollment: 38.5,
      confidence_lower: 34,
      confidence_upper: 43,
      confidence_level: 'Moderate (Heuristic)',
      interval_type: 'heuristic_residual_band',
      is_calibrated_confidence_interval: false,
      growth_rate_pct: 10.0,
      trend_direction: 'Growth',
      demand_tier: 'High Demand',
      utilization_pct: 96.25,
      model_used: 'RidgeLagForecaster',
      validation_status: 'walk_forward_evaluated' as const,
      data_sufficiency: 'sufficient' as const,
      evaluation_metrics: { mae: 2.1, rmse: 2.5, mape: 6.2, validation_splits: 3 },
      disclaimer: 'Estimated enrollment demand for academic planning only — not confirmed registration.',
    },
    {
      subject_id: 'subj-2',
      subject_code: 'POR101',
      subject_name: 'Portuguese Language',
      department: 'Humanities',
      capacity: null,
      historical_series: [],
      terms_observed: 5,
      forecast_period: '2026-2027-T1',
      periods_ahead: 1,
      latest_actual_enrollment: 10,
      predicted_enrollment: 13.5,
      confidence_lower: 10,
      confidence_upper: 17,
      confidence_level: 'Low (Heuristic)',
      growth_rate_pct: 35.0,
      trend_direction: 'Growth',
      demand_tier: 'Unclassified',
      utilization_pct: null,
      model_used: 'MovingAverage2',
      validation_status: 'experimental' as const,
      data_sufficiency: 'sufficient' as const,
      evaluation_metrics: { mae: 1.8, rmse: 2.0, mape: 12.0, validation_splits: 3 },
      disclaimer: 'Estimated enrollment demand for academic planning only — not confirmed registration.',
    },
  ],
  high_demand_courses: [],
  low_demand_courses: [],
  department_summary: [{ department: 'STEM', subject_count: 1, latest_actual: 35, predicted_enrollment: 38.5, growth_rate_pct: 10.0 }],
  historical_timeline: [{ academic_term: '2025-2026-T1', total_enrollment: 45 }],
  disclaimer: 'Estimated enrollment demand for academic planning only — not confirmed registration.',
  generated_at: new Date().toISOString(),
};

describe('CourseDemandForecasting Page (Phase 8B)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders KPIs, forecasts, and Admin snapshot button for admin role', async () => {
    (useAuth as any).mockReturnValue({ user: { id: 'admin-1', role: 'admin', full_name: 'Admin' } });
    (demandApi.getOverview as any).mockResolvedValue(mockOverviewResponse);

    render(
      <MemoryRouter>
        <CourseDemandForecasting />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Course & Subject Demand Forecasting')).toBeDefined();
    });

    expect(screen.getByText('Save Forecast Snapshot')).toBeDefined();
    expect(screen.getByText('Mathematics')).toBeDefined();
    expect(screen.getByText('Portuguese Language')).toBeDefined();
    expect(screen.getByText('Unclassified (No Capacity)')).toBeDefined();
    expect(screen.getByText(/Heuristic Range \(Not Calibrated CI\)/i)).toBeDefined();
    expect(screen.getByText(/walk_forward_evaluated/i)).toBeDefined();
    expect(screen.getByText(/not confirmed registration/i)).toBeDefined();
  });

  it('hides Admin snapshot generation button for Analyst role', async () => {
    (useAuth as any).mockReturnValue({ user: { id: 'analyst-1', role: 'analyst', full_name: 'Analyst' } });
    (demandApi.getOverview as any).mockResolvedValue(mockOverviewResponse);

    render(
      <MemoryRouter>
        <CourseDemandForecasting />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Course & Subject Demand Forecasting')).toBeDefined();
    });

    expect(screen.queryByText('Save Forecast Snapshot')).toBeNull();
  });

  it('displays insufficient-data banner honestly when history is insufficient', async () => {
    (useAuth as any).mockReturnValue({ user: { id: 'teacher-1', role: 'teacher', full_name: 'Teacher' } });
    (demandApi.getOverview as any).mockResolvedValue({
      ...mockOverviewResponse,
      summary: {
        ...mockOverviewResponse.summary,
        overall_data_sufficiency: 'insufficient',
      },
    });

    render(
      <MemoryRouter>
        <CourseDemandForecasting />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Insufficient Historical Enrollment Data/i)).toBeDefined();
    });
  });

  it('renders error alert gracefully when API call fails', async () => {
    (useAuth as any).mockReturnValue({ user: { id: 'admin-1', role: 'admin', full_name: 'Admin' } });
    (demandApi.getOverview as any).mockRejectedValue(new Error('Network error loading forecasts'));

    render(
      <MemoryRouter>
        <CourseDemandForecasting />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Network error loading forecasts')).toBeDefined();
    });
  });
});
