import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/forms/Button';

export const NotFoundPage: React.FC = () => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '70vh',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--bg-subtle)',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <FileQuestion size={36} />
      </div>

      <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>
        404 – Page Not Found
      </h1>
      <p style={{ color: 'var(--text-muted)', maxWidth: '440px', marginBottom: '2rem' }}>
        The requested page or resource could not be found. Please check the URL or return to the application dashboard.
      </p>

      <Link to="/">
        <Button variant="primary" leftIcon={<ArrowLeft size={16} />}>
          Go to Home
        </Button>
      </Link>
    </div>
  );
};
