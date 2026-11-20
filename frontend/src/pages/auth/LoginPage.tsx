import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { InputField } from '../../components/forms/InputField';
import { Button } from '../../components/forms/Button';
import { ErrorAlert } from '../../components/common/ErrorAlert';
import { LogIn, ArrowRight } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Please provide both your registered email and password.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await login(email, password, remember);
      const from = (location.state as any)?.from?.pathname;

      if (from) {
        navigate(from, { replace: true });
      } else {
        // Role-based landing redirect
        if (user.role === 'admin') navigate('/admin', { replace: true });
        else if (user.role === 'teacher') navigate('/teacher', { replace: true });
        else if (user.role === 'analyst') navigate('/analyst', { replace: true });
        else navigate('/student', { replace: true });
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  return (
    <div>
      <div className="mb-8">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-brand-50 text-brand-600 text-[11px] font-bold uppercase tracking-wider mb-3">
          <span>Portal Access</span>
        </div>
        <h2 className="text-2xl font-extrabold text-navy-900 tracking-tight">
          Welcome back
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Sign in to your EduPredict account to continue
        </p>
      </div>

      <ErrorAlert message={error || ''} onDismiss={() => setError(null)} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <InputField
          label="Institutional Email"
          type="email"
          placeholder="user@edupredict.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        <InputField
          label="Password"
          isPassword
          placeholder="••••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />

        <div className="flex items-center justify-between text-xs sm:text-sm pt-1">
          <label className="flex items-center gap-2 cursor-pointer text-slate-600 select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
            />
            <span>Remember me</span>
          </label>

          <Link
            to="/forgot-password"
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          isLoading={isLoading}
          leftIcon={<LogIn size={18} />}
          rightIcon={<ArrowRight size={16} className="opacity-70" />}
          className="w-full mt-4 shadow-sm hover:shadow-soft"
        >
          Sign In to Dashboard
        </Button>

        {/* Demo Credentials Quick-Fill Helper */}
        <div className="pt-4 border-t border-slate-100">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center mb-2">
            Demo Portal Credentials
          </p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => fillDemo('admin@edupredict.com', 'Admin123!')}
              className="px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-brand-50 hover:border-brand-300 transition-all text-center text-left"
            >
              <div className="text-[11px] font-bold text-navy-800">Admin</div>
              <div className="text-[10px] text-slate-500 truncate">admin@edupredict.com</div>
            </button>
            <button
              type="button"
              onClick={() => fillDemo('dr.foster@edupredict.com', 'Teacher123!')}
              className="px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-brand-50 hover:border-brand-300 transition-all text-center text-left"
            >
              <div className="text-[11px] font-bold text-navy-800">Teacher</div>
              <div className="text-[10px] text-slate-500 truncate">dr.foster@edupredict.com</div>
            </button>
            <button
              type="button"
              onClick={() => fillDemo('john.doe@gmail.com', 'Student123!')}
              className="px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-brand-50 hover:border-brand-300 transition-all text-center text-left"
            >
              <div className="text-[11px] font-bold text-navy-800">Student</div>
              <div className="text-[10px] text-slate-500 truncate">john.doe@gmail.com</div>
            </button>
            <button
              type="button"
              onClick={() => fillDemo('analyst@edupredict.com', 'Analyst123!')}
              className="px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-brand-50 hover:border-brand-300 transition-all text-center text-left"
            >
              <div className="text-[11px] font-bold text-navy-800">Analyst</div>
              <div className="text-[10px] text-slate-500 truncate">analyst@edupredict.com</div>
            </button>
          </div>
        </div>

        <div className="pt-2 text-center">
          <p className="text-xs text-slate-500">
            Enrolling for the first time?{' '}
            <Link
              to="/register"
              className="font-bold text-brand-600 hover:text-brand-700 transition-colors"
            >
              Register as Student
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
};
