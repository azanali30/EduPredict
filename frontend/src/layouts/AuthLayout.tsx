import React from 'react';
import { Outlet } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';

export const AuthLayout: React.FC = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1rem',
        backgroundColor: 'var(--bg-page)',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--primary-navy)',
            color: 'var(--accent-cyan)',
            marginBottom: '0.75rem',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <GraduationCap size={28} />
        </div>
        <h1 style={{ fontSize: '1.75rem', color: 'var(--primary-navy)', letterSpacing: '-0.02em' }}>
          EduPredict
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          AI-Powered Academic Performance Intelligence
        </p>
      </div>

      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '440px',
          boxShadow: 'var(--shadow-lg)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <Outlet />
      </div>

      <footer style={{ marginTop: '2.5rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
        EduPredict &copy; {new Date().getFullYear()} – Standalone Educational Intelligence Platform
      </footer>
    </div>
  );
};
