import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AnomalyReviewModal } from '../components/anomalies/AnomalyReviewModal';
import { AnomalyRecord } from '../types';

const mockAnomaly: AnomalyRecord = {
  id: 'anom-123',
  source_record_id: 'src-rec-456',
  student_id_ref: null,
  subject: 'Mathematics',
  model_version: '1.0.0-m0',
  milestone: 'Milestone 0 (Baseline)',
  anomaly_score: -0.1425,
  cohort_percentile: 98.4,
  is_anomaly: true,
  anomaly_severity: 'High Anomaly',
  supporting_deviations: [
    {
      feature: 'absences',
      observed_value: 38,
      cohort_mean_or_mode: 5.7,
      z_score: 3.82,
      rarity_percentage: null,
      deviation_type: 'z_score',
      description: 'Feature value significantly exceeds cohort empirical mean.',
    },
  ],
  review_status: 'Pending Review',
  reviewed_by: null,
  reviewed_by_name: null,
  reviewed_at: null,
  review_notes: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe('AnomalyReviewModal Component', () => {
  it('renders uncalibrated score, cohort rank, and supporting deviations', () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(
      <AnomalyReviewModal
        isOpen={true}
        onClose={vi.fn()}
        record={mockAnomaly}
        onSave={handleSave}
      />
    );

    expect(screen.getByText('Academic Anomaly Human Triage Review')).toBeDefined();
    expect(screen.getByText('-0.1425')).toBeDefined();
    expect(screen.getByText('98.4%')).toBeDefined();
    expect(screen.getByText('absences')).toBeDefined();
    expect(screen.getByText('|Z| = 3.82')).toBeDefined();
    expect(screen.getByText(/Pedagogical Safeguard Notice:/i)).toBeDefined();
  });

  it('allows changing review status and submitting notes', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    const handleClose = vi.fn();
    render(
      <AnomalyReviewModal
        isOpen={true}
        onClose={handleClose}
        record={mockAnomaly}
        onSave={handleSave}
      />
    );

    await act(async () => {
      const confirmedButton = screen.getByRole('button', { name: /Confirmed Anomaly/i });
      fireEvent.click(confirmedButton);

      const textarea = screen.getByPlaceholderText(/Document contextual observations/i);
      fireEvent.change(textarea, { target: { value: 'Confirmed high absenteeism due to family illness.' } });

      const submitBtn = screen.getByRole('button', { name: /Save Review Decision/i });
      fireEvent.click(submitBtn);
    });

    expect(handleSave).toHaveBeenCalledWith(
      'anom-123',
      'Confirmed Anomaly',
      'Confirmed high absenteeism due to family illness.'
    );
  });
});
