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

const mockDropoutEval = {
  status_code: 200,
  domain: 'dropout_classification',
  champion_model: 'Calibrated Logistic Regression',
  champion_model_version: 'Dropout_LogisticRegression_v1.0.0',
  validation_status: 'benchmark_only',
  local_institutional_validation: false,
  benchmark_disclosure: 'UCI Portuguese higher-education holdout benchmark only.',
  explainability_disclaimer: 'Feature contributions reflect statistical correlations, not causation.',
  dataset: { name: 'UCI (ID 697)', train_samples: 3539, test_samples: 885, feature_count: 34 },
  calibrated_champion_metrics: {
    accuracy: 0.875,
    precision: 0.895,
    recall: 0.754,
    f1_score: 0.818,
    roc_auc: 0.9317,
    pr_auc: 0.9024,
    brier_score: 0.0851,
    confusion_matrix: { tn: 570, fp: 25, fn: 85, tp: 205 },
  },
  candidate_comparison: [
    {
      model_name: 'Calibrated Logistic Regression',
      accuracy: 0.875,
      precision: 0.895,
      recall: 0.754,
      f1_score: 0.818,
      roc_auc: 0.9317,
      pr_auc: 0.9024,
      brier_score: 0.0851,
      is_champion: true,
    },
  ],
  roc_curve: [{ fpr: 0, tpr: 0 }, { fpr: 0.1, tpr: 0.8 }, { fpr: 1, tpr: 1 }],
  pr_curve: [{ recall: 0, precision: 1 }, { recall: 0.8, precision: 0.85 }, { recall: 1, precision: 0.3 }],
  calibration_curve: [{ mean_predicted_probability: 0.2, fraction_of_positives: 0.18 }],
  expected_calibration_error: 0.024,
  feature_contributions: [
    { feature: 'Curricular units 2nd sem (approved)', importance: 0.42, direction: 'protective' },
  ],
};

const mockDemandEval = {
  status_code: 200,
  domain: 'course_demand_forecasting',
  organization_id: 'org-test',
  overall_status: 'insufficient_data',
  validation_methodology: 'Walk-Forward Time-Series Cross-Validation',
  model_comparison: [
    {
      model_name: 'RidgeLagForecaster',
      evaluated_subjects: 0,
      mae: null,
      rmse: null,
      mape: null,
      smape: null,
      forecast_bias: null,
      directional_accuracy: null,
      status: 'Insufficient Data',
    },
  ],
  subject_evaluations: [],
  actual_vs_predicted: [],
  insufficient_data_notice: 'At least 4 observed terms per subject are required for walk-forward evaluation.',
};

const mockRegistry = {
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
    (evaluationApi.getDropoutEvaluation as any).mockResolvedValue(mockDropoutEval);
    (evaluationApi.getDemandEvaluation as any).mockResolvedValue(mockDemandEval);
    (evaluationApi.listRegistryModels as any).mockResolvedValue(mockRegistry);
  });

  it('renders dropout evaluation metrics, confusion matrix, and disclosures', async () => {
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
    expect(screen.getByText('570')).toBeDefined();
    expect(screen.getByText(/Statistical correlations, not causation/i)).toBeDefined();
  });

  it('displays Insufficient Data notice on Course Demand Forecasting tab', async () => {
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
