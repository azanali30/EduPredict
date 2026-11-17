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
      <div className="text-center py-4">
        <CheckCircle2 size={48} className="mx-auto text-emerald-500 mb-4" />
        <h2 className="text-xl font-bold text-navy-900 mb-2">
          Registration Successful!
        </h2>
        <p className="text-sm text-slate-500 mb-6">
          Your student account has been created. Redirecting you to login...
        </p>
        <Link to="/login">
          <Button variant="primary" className="w-full">
            Proceed to Login
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="inline-block mb-1">
          <span className="badge badge-student">Student Access</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-navy-900">Create Account</h2>
        <p className="text-sm text-slate-500 mt-1">
          Register as a student to access AI academic analytics
        </p>
      </div>

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      <form onSubmit={handleSubmit} className="space-y-4">
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
        <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 flex flex-col gap-1 border border-slate-200">
          <div className="font-semibold text-navy-900 mb-0.5">
            Password Requirements:
          </div>
          <div className={hasLength ? 'text-emerald-600 font-medium' : 'text-slate-400'}>
            {hasLength ? '✓' : '•'} At least 8 characters
          </div>
          <div className={hasLetter ? 'text-emerald-600 font-medium' : 'text-slate-400'}>
            {hasLetter ? '✓' : '•'} At least one letter
          </div>
          <div className={hasDigit ? 'text-emerald-600 font-medium' : 'text-slate-400'}>
            {hasDigit ? '✓' : '•'} At least one digit
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          isLoading={isLoading}
          leftIcon={<UserPlus size={18} />}
          className="w-full mt-2"
        >
          Create Student Account
        </Button>

        <div className="text-center text-xs sm:text-sm text-slate-500 pt-2">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">
            Sign In
          </Link>
        </div>
      </form>
    </div>
  );
};
