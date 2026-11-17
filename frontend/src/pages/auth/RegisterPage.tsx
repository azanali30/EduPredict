import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { InputField } from '../../components/forms/InputField';
import { Button } from '../../components/forms/Button';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { UserPlus, CheckCircle2 } from 'lucide-react';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const hasLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /\d/.test(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!hasLength || !hasLetter || !hasDigit) {
      setError('Password does not meet the complexity requirements.');
      return;
    }

    setIsLoading(true);
    try {
      await register(email, password, fullName);
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err: any) {
      setError(err?.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: '1rem 0' }}>
        <CheckCircle2 size={48} color="var(--status-success)" style={{ margin: '0 auto 1rem' }} />
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Registration Successful!
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          Your student account has been created. Redirecting you to login...
        </p>
        <Link to="/login">
          <Button variant="primary" style={{ width: '100%' }}>
            Proceed to Login
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'inline-block', marginBottom: '0.25rem' }}>
          <span className="badge badge-student">Student Access</span>
        </div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Create Account</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          Register as a student to access AI academic analytics
        </p>
      </div>

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      <form onSubmit={handleSubmit}>
        <InputField
          label="Full Legal Name"
          type="text"
          placeholder="e.g. John Doe"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />

        <InputField
          label="Email Address"
          type="email"
          placeholder="student@university.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        <InputField
          label="Password"
          isPassword
          placeholder="Create a strong password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
        />

        <InputField
          label="Confirm Password"
          isPassword
          placeholder="Re-enter password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
        />

        {/* Password Strength Checklist */}
        <div
          style={{
            backgroundColor: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem',
            marginBottom: '1.25rem',
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--primary-navy)', marginBottom: '0.15rem' }}>
            Password Requirements:
          </div>
          <div style={{ color: hasLength ? 'var(--status-success)' : 'var(--text-muted)' }}>
            {hasLength ? '✓' : '•'} At least 8 characters
          </div>
          <div style={{ color: hasLetter ? 'var(--status-success)' : 'var(--text-muted)' }}>
            {hasLetter ? '✓' : '•'} At least one letter
          </div>
          <div style={{ color: hasDigit ? 'var(--status-success)' : 'var(--text-muted)' }}>
            {hasDigit ? '✓' : '•'} At least one digit
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          isLoading={isLoading}
          leftIcon={<UserPlus size={18} />}
          style={{ width: '100%', marginBottom: '1.25rem' }}
        >
          Create Student Account
        </Button>

        <div style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ fontWeight: 600, color: 'var(--brand-blue)' }}>
            Sign In
          </Link>
        </div>
      </form>
    </div>
  );
};
