import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-accent hover:bg-accent-hover text-white',
  secondary: 'bg-elevated hover:bg-elevated/80 text-text-primary border border-border',
  ghost: 'bg-transparent hover:bg-elevated text-muted hover:text-text-primary',
  danger: 'bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-900/50',
};

export const Button = ({ variant = 'primary', loading, children, className = '', disabled, ...props }: ButtonProps) => (
  <button
    {...props}
    disabled={disabled || loading}
    className={`
      inline-flex items-center gap-2 px-5 py-2.5
      text-xs font-semibold tracking-widest uppercase
      transition-colors duration-150 cursor-pointer
      disabled:opacity-50 disabled:cursor-not-allowed
      ${variantClasses[variant]} ${className}
    `}
  >
    {loading && (
      <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />
    )}
    {children}
  </button>
);
