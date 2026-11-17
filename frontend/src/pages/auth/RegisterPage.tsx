import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { InputField } from '../../components/forms/InputField';
import { Button } from '../../components/forms/Button';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { UserPlus, CheckCircle2, ArrowRight } from 'lucide-react';

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
  const passwordsMatch = password && confirmPassword && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setError('All registration fields are required.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Password confirmation does not match.');
      return;
    }

    if (!hasLength || !hasLetter || !hasDigit) {
      setError('Please fulfill all password security requirements.');
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
      setError(err?.message || 'Registration failed. Please try a different email or try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-6">
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-200 shadow-sm animate-bounce">
          <CheckCircle2 size={36} />
        </div>
        <h2 className="text-2xl font-extrabold text-navy-900 mb-2">
          Registration Complete!
        </h2>
        <p className="text-sm text-slate-500 mb-6 max-w-xs mx-auto">
          Your student profile has been created in the EduPredict directory. Redirecting you to login...
        </p>
        <Link to="/login">
          <Button variant="primary" size="lg" className="w-full">
            Proceed to Sign In
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-sky-50 text-sky-700 text-[11px] font-bold uppercase tracking-wider mb-2 border border-sky-200">
          <span>Student Registration</span>
        </div>
        <h2 className="text-2xl font-extrabold text-navy-900 tracking-tight">
          Create Student Account
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Join EduPredict to track performance indicators & predicted marks
        </p>
      </div>

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <InputField
          label="Full Legal Name"
          type="text"
          placeholder="e.g. Alex Morgan"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />

        <InputField
          label="Institutional Email"
          type="email"
          placeholder="alex.morgan@university.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        <InputField
          label="Password"
          isPassword
          placeholder="Create a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
        />

        <InputField
          label="Confirm Password"
          isPassword
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
        />

        {/* Live Password Requirements Checklist */}
        <div className="bg-slate-50 rounded-xl p-3.5 text-xs text-slate-600 border border-slate-200/80 space-y-1.5">
          <div className="font-bold text-navy-900 text-[11px] uppercase tracking-wider mb-1">
            Security Checklist
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className={`flex items-center gap-1.5 ${hasLength ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
              <span>{hasLength ? '✓' : '•'}</span> 8+ characters
            </div>
            <div className={`flex items-center gap-1.5 ${hasLetter ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
              <span>{hasLetter ? '✓' : '•'}</span> At least 1 letter
            </div>
            <div className={`flex items-center gap-1.5 ${hasDigit ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
              <span>{hasDigit ? '✓' : '•'}</span> At least 1 number
            </div>
            <div className={`flex items-center gap-1.5 ${passwordsMatch ? 'text-emerald-600 font-semibold' : 'text-slate-400'}`}>
              <span>{passwordsMatch ? '✓' : '•'}</span> Passwords match
            </div>
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isLoading}
          leftIcon={<UserPlus size={18} />}
          rightIcon={<ArrowRight size={16} className="opacity-70" />}
          className="w-full mt-3 shadow-sm hover:shadow-soft"
        >
          Complete Registration
        </Button>

        <div className="pt-3 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500">
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-bold text-brand-600 hover:text-brand-700 transition-colors"
            >
              Sign In Instead
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
};
