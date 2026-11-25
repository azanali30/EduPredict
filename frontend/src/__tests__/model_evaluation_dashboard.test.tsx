import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ModelEvaluationDashboard } from '../pages/shared/ModelEvaluationDashboard';
import { evaluationApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock('../services/api', () => ({
  evaluationApi: {
    getDropoutEvaluation: vi.fn(),
    getDemandEvaluation: vi.fn(),
    listRegistryModels: vi.fn(),
    activateModel: vi.fn(),
    deactivateModel: vi.fn(),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// Exact backend JSON shape from ModelEvaluationService.get_dropout_evaluation_report()
const mockDropoutEvalBackend = {
  status_code: 200,
  domain: 'dropout_classification',
  champion_model: 'Calibrated Logistic Regression',
  champion_model_version: 'Dropout_LogisticRegression_v1.0.0',
  validation_status: 'benchmark_validated',
  local_institutional_validation: false,
  benchmark_disclosure: 'UCI Portuguese higher-education holdout benchmark only.',
  explainability_disclaimer: 'Feature weights represent statistical correlation, not causation.',
  dataset: { name: 'UCI (ID 697)', train_samples: 3539, test_samples: 885, feature_count: 34 },
  calibrated_champion_metrics: {
    accuracy: 0.875,
    precision: 0.895,
    recall: 0.754,
    f1: 0.818,
    roc_auc: 0.9317,
    pr_auc: 0.9024,
    brier_score: 0.0851,
    true_negatives: 570,
    false_positives: 25,
    false_negatives: 85,
    true_positives: 205,
    confusion_matrix: [
      [570, 25],
      [85, 205],
    ],
  },
  candidate_comparison: [
    {
      model_name: 'Calibrated Logistic Regression',
      is_champion: true,
      test_accuracy: 0.875,
      test_precision: 0.895,
      test_recall: 0.754,
      test_f1: 0.818,
      test_roc_auc: 0.9317,
      test_pr_auc: 0.9024,
      test_brier_score: 0.0851,
    },
  ],
  roc_curve: [
    { fpr: 0, tpr: 0 },
    { fpr: 0.1, tpr: 0.8 },
    { fpr: 1, tpr: 1 },
  ],
  pr_curve: [
    { recall: 0, precision: 1 },
    { recall: 0.8, precision: 0.85 },
    { recall: 1, precision: 0.3 },
  ],
  calibration_curve: [{ mean_predicted: 0.2, fraction_positive: 0.18 }],
  expected_calibration_error: 0.024,
  feature_contributions: [
    {
      feature: 'Curricular units 2nd sem (approved)',
      weight: -0.42,
      abs_weight: 0.42,
      direction: 'Decreases Risk Score',
    },
  ],
};

// Exact backend JSON shape from ModelEvaluationService.get_demand_evaluation_report()
const mockDemandEvalBackend = {
  status_code: 200,
  domain: 'course_demand_forecasting',
  organization_id: 'org-test',
  overall_status: 'Insufficient Data',
  validation_methodology: 'Common-origin expanding-window walk-forward validation.',
  model_comparison: [
    {
      model_name: 'RidgeLagForecaster',
      subjects_evaluated: 0,
      total_validation_splits: 0,
      mean_mae: null,
      mean_rmse: null,
      mean_mape: null,
      status: 'Insufficient Data',
    },
  ],
  subject_evaluations: [],
  actual_vs_predicted: [],
  insufficient_data_notice:
    'Insufficient Data: At least 3–4 historical enrollment terms per subject are required.',
};

const mockRegistryBackend = {
  status_code: 200,
  total: 1,
  organization_id: 'org-test',
  models: [
    {
      id: 'reg-1',
      model_type: 'dropout' as const,
      model_name: 'Calibrated Logistic Regression',
      model_version: 'Dropout_LogisticRegression_v1.0.0',
      model_status: 'benchmark_only',
      deployment_status: 'deployed',
      is_active: true,
      evaluation_metrics: { roc_auc: 0.9317 },
      validation_methodology: 'Stratified Holdout Benchmark',
      approval_notes: 'Default champion',
    },
  ],
};

describe('ModelEvaluationDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (evaluationApi.getDropoutEvaluation as any).mockResolvedValue(mockDropoutEvalBackend);
    (evaluationApi.getDemandEvaluation as any).mockResolvedValue(mockDemandEvalBackend);
    (evaluationApi.listRegistryModels as any).mockResolvedValue(mockRegistryBackend);
  });

  it('renders exact backend dropout metrics, 2x2 confusion matrix, and feature weights safely', async () => {
    (useAuth as any).mockReturnValue({ user: { id: '1', role: 'admin' } });
    render(
      <MemoryRouter>
        <ModelEvaluationDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Model Evaluation, Comparison & Registry')).toBeDefined();
    });
    expect(screen.getAllByText('0.932').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0.818').length).toBeGreaterThan(0);
    expect(screen.getByText('570')).toBeDefined();
    expect(screen.getByText('205')).toBeDefined();
    expect(screen.getByText('0.4200')).toBeDefined();
    expect(screen.getByText(/statistical correlation, not causation/i)).toBeDefined();
  });

  it('renders Course Demand Forecasting tab with null metrics and Insufficient Data notice without crashing', async () => {
    (useAuth as any).mockReturnValue({ user: { id: '1', role: 'analyst' } });
    render(
      <MemoryRouter>
        <ModelEvaluationDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Course Demand Forecasting/i })).toBeDefined();
    });
    fireEvent.click(screen.getByRole('button', { name: /Course Demand Forecasting/i }));
    expect(screen.getByText(/Insufficient Data Notice:/i)).toBeDefined();
    expect(screen.getByText('RidgeLagForecaster')).toBeDefined();
    expect(screen.getAllByText('N/A').length).toBeGreaterThanOrEqual(3);
  });

  it('renders Actual vs Predicted chart when evaluated demand data exists', async () => {
    (evaluationApi.getDemandEvaluation as any).mockResolvedValue({
      ...mockDemandEvalBackend,
      overall_status: 'walk_forward_evaluated',
      insufficient_data_notice: null,
      model_comparison: [
        {
          model_name: 'MovingAverage2',
          subjects_evaluated: 1,
          mean_mae: 1.5,
          mean_rmse: 2.0,
          mean_mape: 4.5,
          status: 'evaluated',
        },
      ],
      actual_vs_predicted: [{ subject: 'MAT101', actual: 30, predicted: 32, mae: 1.5 }],
    });
    (useAuth as any).mockReturnValue({ user: { id: '1', role: 'admin' } });
    render(
      <MemoryRouter>
        <ModelEvaluationDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Course Demand Forecasting/i })).toBeDefined();
    });
    fireEvent.click(screen.getByRole('button', { name: /Course Demand Forecasting/i }));
    expect(screen.getByText('4.5%')).toBeDefined();
    expect(screen.getByText('Actual vs Predicted Enrollment by Subject')).toBeDefined();
  });

  it('shows Admin governance controls in Model Registry and hides them for Analyst', async () => {
    (useAuth as any).mockReturnValue({ user: { id: '1', role: 'admin' } });
    const { unmount } = render(
      <MemoryRouter>
        <ModelEvaluationDashboard />
      </MemoryRouter>
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Model Registry/i })).toBeDefined()
    );
    fireEvent.click(screen.getByRole('button', { name: /Model Registry/i }));
    expect(screen.getByText('Deactivate')).toBeDefined();
    unmount();

    (useAuth as any).mockReturnValue({ user: { id: '2', role: 'analyst' } });
    render(
      <MemoryRouter>
        <ModelEvaluationDashboard />
      </MemoryRouter>
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Model Registry/i })).toBeDefined()
    );
    fireEvent.click(screen.getByRole('button', { name: /Model Registry/i }));
    expect(screen.queryByText('Deactivate')).toBeNull();
    expect(screen.getByText(/Read-only registry view for Analysts/i)).toBeDefined();
  });
});
