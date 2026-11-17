import React, { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  style,
  ...props
}) => {
  const variantClasses = {
    primary: 'bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white shadow-sm',
    secondary: 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800',
    outline: 'border border-slate-200 hover:bg-slate-50 active:bg-slate-100 text-slate-700 bg-transparent',
    danger: 'bg-rose-500 hover:bg-rose-600 active:bg-rose-700 text-white shadow-sm',
    ghost: 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:bg-slate-200 bg-transparent',
  }[variant];

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs font-semibold rounded-md',
    md: 'px-4 py-2 text-sm font-semibold rounded-lg',
    lg: 'px-6 py-3 text-base font-semibold rounded-lg',
  }[size];

  return (
    <button
      disabled={disabled || isLoading}
      style={style}
      className={`inline-flex items-center justify-center gap-2 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500/25 disabled:opacity-60 disabled:cursor-not-allowed select-none cursor-pointer ${variantClasses} ${sizeClasses} ${className}`}
      {...props}
    >
      {isLoading ? <Loader2 size={16} className="animate-spin shrink-0" /> : leftIcon}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
};
