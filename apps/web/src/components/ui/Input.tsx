import { type InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  id?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, className = "", ...props }, ref) => {
    const inputId = id || props.name || "input";

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-text-primary"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-3 py-2.5
            text-base text-text-primary
            bg-surface-base
            border rounded-sm
            placeholder:text-text-secondary
            transition-colors duration-200
            min-h-[44px]
            focus:outline-2 focus:outline-accent-blue focus:outline-offset-0
            focus:border-accent-blue
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-soft
            ${error
              ? "border-danger focus:outline-danger focus:border-danger"
              : "border-border-default"
            }
            ${className}
          `}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
        {error && (
          <p
            id={`${inputId}-error`}
            className="text-sm text-danger"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
