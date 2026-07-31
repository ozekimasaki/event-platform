import { useState, useEffect, useCallback } from "react";

type ToastVariant = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
  duration: number;
}

interface ToastProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const variantStyles: Record<ToastVariant, { bg: string; icon: string }> = {
  success: { bg: "border-l-4 border-l-success", icon: "✓" },
  error: { bg: "border-l-4 border-l-danger", icon: "✕" },
  warning: { bg: "border-l-4 border-l-warning", icon: "!" },
  info: { bg: "border-l-4 border-l-accent-blue", icon: "i" },
};

function ToastItemComponent({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / toast.duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        onDismiss(toast.id);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [toast, onDismiss]);

  const style = variantStyles[toast.variant];

  return (
    <div
      role="alert"
      className={`
        relative
        bg-surface-elevated
        border border-border-default
        rounded-sm
        shadow-md
        p-4
        min-w-[300px]
        max-w-[400px]
        overflow-hidden
        ${style.bg}
      `}
    >
      <div className="flex items-start gap-3">
        <span
          className={`
            inline-flex items-center justify-center
            w-6 h-6 rounded-full
            text-xs font-bold
            shrink-0
            ${toast.variant === "success" ? "text-success" : ""}
            ${toast.variant === "error" ? "text-danger" : ""}
            ${toast.variant === "warning" ? "text-warning" : ""}
            ${toast.variant === "info" ? "text-accent-blue" : ""}
          `}
        >
          {style.icon}
        </span>
        <p className="text-sm text-text-primary flex-1">{toast.message}</p>
        <button
          onClick={() => onDismiss(toast.id)}
          aria-label="通知を閉じる"
          className="
            text-text-secondary
            hover:text-text-primary
            min-w-[44px] min-h-[44px]
            inline-flex items-center justify-center
            -mr-2 -mt-1
          "
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-surface-medium">
        <div
          className="h-full bg-accent-blue transition-[width] duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function Toast({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2"
    >
      {toasts.map((toast) => (
        <ToastItemComponent
          key={toast.id}
          toast={toast}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}

// Hook for managing toasts
export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback(
    (variant: ToastVariant, message: string, duration = 5000) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, variant, message, duration }]);
    },
    []
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, dismiss };
}
