import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldX, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/forms/Button';
import { useAuth } from '../../context/AuthContext';

export const UnauthorizedPage: React.FC = () => {
  const { user } = useAuth();

  const getHomePath = () => {
    if (!user) return '/login';
    if (user.role === 'admin') return '/admin';
    if (user.role === 'teacher') return '/teacher';
    return '/student';
  };

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
          backgroundColor: 'var(--status-danger-bg)',
          color: 'var(--status-danger)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <ShieldX size={36} />
      </div>

      <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.5rem' }}>
        403 – Access Denied
      </h1>
      <p style={{ color: 'var(--text-muted)', maxWidth: '440px', marginBottom: '2rem' }}>
        You do not possess the required role permissions to access this protected area.
        Role boundaries are strictly enforced by the EduPredict security subsystem.
      </p>

      <Link to={getHomePath()}>
        <Button variant="primary" leftIcon={<ArrowLeft size={16} />}>
          Return to Dashboard
        </Button>
      </Link>
    </div>
  );
};
