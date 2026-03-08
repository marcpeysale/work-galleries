import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input = ({ label, error, id, className = '', ...props }: InputProps) => {
  const inputId = id ?? label.toLowerCase().replace(/\s/g, '-');
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-xs font-semibold tracking-widest uppercase text-muted">
        {label}
      </label>
      <input
        id={inputId}
        {...props}
        className={`
          w-full bg-elevated border px-4 py-2.5 text-sm text-text-primary
          placeholder:text-faint outline-none transition-colors duration-150
          ${error ? 'border-red-500 focus:border-red-400' : 'border-border focus:border-accent'}
          ${className}
        `}
      />
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
};
