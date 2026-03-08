import type { SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select = ({ label, error, id, options, className = '', ...props }: SelectProps) => {
  const selectId = id ?? label.toLowerCase().replace(/\s/g, '-');
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-xs font-semibold tracking-widest uppercase text-muted">
        {label}
      </label>
      <select
        id={selectId}
        {...props}
        className={`
          w-full bg-elevated border px-4 py-2.5 text-sm text-text-primary
          outline-none transition-colors duration-150 cursor-pointer
          ${error ? 'border-red-500 focus:border-red-400' : 'border-border focus:border-accent'}
          ${className}
        `}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
};
