import React from 'react';
import { EmptyState } from '../../components/common/EmptyState';
import { Sparkles, BrainCircuit, AlertTriangle } from 'lucide-react';

export const StudentPredictions: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>AI Performance Predictions & Risk Model</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          Expected grade estimation, academic risk classification, and personalized guidance
        </p>
      </div>

      <div className="card">
        <EmptyState
          icon={<BrainCircuit size={36} color="var(--brand-blue)" />}
          title="Predictive Models Inactive (Phase 4 Scheduled)"
          description="The predictive engine requires trained Scikit-learn regressors and risk classifiers. Actual predictions will become available once the benchmark datasets are trained and validated."
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.25rem',
        }}
      >
        <div className="card" style={{ opacity: 0.75 }}>
          <h4 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Sparkles size={18} color="var(--brand-blue)" />
            Expected Marks Estimator
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Linear Regression & Random Forest Regressors will estimate your projected final exam percentage based on attendance, study hours, and quiz averages.
          </p>
        </div>

        <div className="card" style={{ opacity: 0.75 }}>
          <h4 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <AlertTriangle size={18} color="var(--status-warning)" />
            Risk Classification Tier
          </h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Categorizes risk levels into Low, Moderate, or High Risk with associated probabilities and individual feature sensitivity analysis.
          </p>
        </div>
      </div>
    </div>
  );
};
