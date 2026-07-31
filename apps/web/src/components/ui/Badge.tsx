import { type HTMLAttributes, type ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-surface-medium text-text-primary",
  success: "bg-[color-mix(in_srgb,var(--color-success)_15%,transparent)] text-success",
  warning: "bg-[color-mix(in_srgb,var(--color-warning)_15%,transparent)] text-warning",
  danger: "bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] text-danger",
  info: "bg-[color-mix(in_srgb,var(--accent-blue)_15%,transparent)] text-accent-blue",
};

export function Badge({
  variant = "default",
  children,
  className = "",
  ...props
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center
        px-2.5 py-0.5
        text-xs font-medium
        rounded-sm
        ${variantClasses[variant]}
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  );
}
