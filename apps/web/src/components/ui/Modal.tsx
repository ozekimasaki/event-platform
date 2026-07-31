import { type ReactNode, useEffect, useRef } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="
        fixed inset-0 z-50
        m-0 p-0
        w-full h-full
        max-w-none max-h-none
        bg-transparent
        backdrop:bg-black/50
        backdrop:backdrop-blur-sm
        open:animate-in
      "
    >
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div
          className="
            relative
            bg-surface-elevated
            border border-border-default
            rounded-md
            shadow-lg
            w-full max-w-lg
            max-h-[85vh]
            overflow-y-auto
            p-6
          "
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          {title && (
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">
                {title}
              </h2>
              <button
                onClick={onClose}
                aria-label="閉じる"
                className="
                  inline-flex items-center justify-center
                  w-10 h-10 min-w-[44px] min-h-[44px]
                  rounded-sm
                  text-text-secondary
                  hover:text-text-primary hover:bg-surface-soft
                  transition-colors duration-200
                "
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}

          {/* Close button when no title */}
          {!title && (
            <button
              onClick={onClose}
              aria-label="閉じる"
              className="
                absolute top-3 right-3
                inline-flex items-center justify-center
                w-8 h-8 min-w-[44px] min-h-[44px]
                rounded-sm
                text-text-secondary
                hover:text-text-primary hover:bg-surface-soft
                transition-colors duration-200
              "
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}

          {/* Content */}
          {children}
        </div>
      </div>
    </dialog>
  );
}
