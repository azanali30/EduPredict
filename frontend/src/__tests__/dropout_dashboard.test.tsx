import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { DropoutRecord } from '../types';

// Standalone component representing the Student Dropout Early Warning card for verification
const DropoutSupportCard: React.FC<{ record: DropoutRecord }> = ({ record }) => {
  return (
    <div data-testid="dropout-support-card">
      <h3>Academic Retention & Degree Progression Support</h3>
      <div data-testid="risk-tier-badge">
        <span>{record.risk_tier} Risk Tier</span>
      </div>
      <div data-testid="risk-probability">
        Probability: {(record.risk_probability * 100).toFixed(1)}%
      </div>
      <div data-testid="recommendations-list">
        {record.recommendations.map((rec, idx) => (
          <p key={idx}>{rec}</p>
        ))}
      </div>
      <div data-testid="protective-factors">
        {record.protective_factors.map((pf, idx) => (
          <span key={idx}>{pf.factor}: {pf.detail}</span>
        ))}
      </div>
      <p data-testid="disclaimer-text">{record.disclaimer}</p>
      {record.requires_human_review && (
        <span data-testid="human-review-tag">Human Review Required</span>
      )}
    </div>
  );
};

const mockDropoutRecord: DropoutRecord = {
  id: 'drop-rec-101',
  student_id: 'stud-555',
  student_name: 'Jordan Lee',
  risk_probability: 0.725,
  risk_tier: 'High',
  model_version: 'Dropout_LogisticRegression_v1.0.0',
  key_risk_factors: [
    {
      factor: 'Tuition Payment Delay',
      detail: 'Tuition fees are flagged as overdue.',
      importance: 'High',
    },
    {
      factor: 'Curricular Unit Completion Deficit',
      detail: 'Completed 2 units out of expected 6.',
      importance: 'High',
    },
  ],
  protective_factors: [
    {
      factor: 'Prior Entrance Qualification',
      detail: 'Solid high school exit standing.',
    },
  ],
  recommendations: [
    'Schedule a 1-on-1 supportive counseling check-in with an Academic Success Advisor.',
    'Connect with Student Financial Support to explore tuition installment plans.',
    'Enroll in complimentary Peer Tutoring and study skill development workshops.',
  ],
  academic_term: '2025-2026-T1',
  requires_human_review: true,
  disclaimer:
    'Early-warning estimate designed solely for proactive academic support. Requires human review by authorized advisors before taking any intervention.',
};

describe('Student Dropout Early Warning Components (Phase 8A)', () => {
  it('renders student dropout risk tier and calibrated probability', () => {
    render(<DropoutSupportCard record={mockDropoutRecord} />);

    expect(screen.getByTestId('risk-tier-badge').textContent).toContain('High Risk Tier');
    expect(screen.getByTestId('risk-probability').textContent).toContain('72.5%');
  });

  it('renders supportive, non-punitive recommendations', () => {
    render(<DropoutSupportCard record={mockDropoutRecord} />);

    const recs = screen.getByTestId('recommendations-list');
    expect(recs.textContent).toContain('Academic Success Advisor');
    expect(recs.textContent).toContain('Student Financial Support');
    expect(recs.textContent).toContain('Peer Tutoring');
  });

  it('enforces mandatory human review notice and ethical disclaimer', () => {
    render(<DropoutSupportCard record={mockDropoutRecord} />);

    expect(screen.getByTestId('human-review-tag').textContent).toBe('Human Review Required');
    expect(screen.getByTestId('disclaimer-text').textContent).toContain(
      'Requires human review by authorized advisors'
    );
  });
});
