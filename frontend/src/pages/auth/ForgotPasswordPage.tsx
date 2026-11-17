import React from 'react';
import { Link } from 'react-router-dom';
import { Info, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/forms/Button';

export const ForgotPasswordPage: React.FC = () => {
  return (
    <div style={{ textAlign: 'center', padding: '1rem 0' }}>
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--status-info-bg)',
          color: 'var(--status-info)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.25rem',
        }}
      >
        <Info size={28} />
      </div>

      <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: '0.5rem' }}>
        Password Recovery Notice
      </h2>

      <div
        style={{
          backgroundColor: 'var(--bg-subtle)',
          padding: '1rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-light)',
          textAlign: 'left',
          fontSize: '0.875rem',
          color: 'var(--text-muted)',
          lineHeight: 1.6,
          marginBottom: '1.5rem',
        }}
      >
        <p style={{ fontWeight: 600, color: 'var(--primary-navy)', marginBottom: '0.35rem' }}>
          Automated Recovery Unavailable
        </p>
        <p>
          Self-service automated email recovery is not enabled in this deployment phase.
          If you have lost access to your account, please reach out to your institution's System Administrator for an authorized credential reset.
        </p>
      </div>

      <Link to="/login">
        <Button variant="primary" style={{ width: '100%' }} leftIcon={<ArrowLeft size={16} />}>
          Back to Login
        </Button>
      </Link>
    </div>
  );
};
