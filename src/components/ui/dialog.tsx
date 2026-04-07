import { useCallback, useEffect, useId, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, children, className }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const shouldReduceMotion = useReducedMotion();

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  // Focus trap: cycle Tab within the dialog
  const handleFocusTrap = useCallback((e: KeyboardEvent) => {
    if (e.key !== "Tab" || !dialogRef.current) return;

    const focusableSelectors =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusableElements = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(focusableSelectors),
    );
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }, []);

  // Store previous focus on open, restore on close
  useEffect(() => {
    if (open) {
      previousActiveElementRef.current = document.activeElement as HTMLElement | null;
    } else if (previousActiveElementRef.current) {
      previousActiveElementRef.current.focus();
      previousActiveElementRef.current = null;
    }
  }, [open]);

  // Auto-focus first focusable element inside dialog
  useEffect(() => {
    if (open && dialogRef.current) {
      const timer = requestAnimationFrame(() => {
        if (!dialogRef.current) return;
        const focusableSelectors =
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
        const first = dialogRef.current.querySelector<HTMLElement>(focusableSelectors);
        if (first) {
          first.focus();
        } else {
          dialogRef.current.focus();
        }
      });
      return () => cancelAnimationFrame(timer);
    }
  }, [open]);

  // Scroll lock via CSS class (not body.style.overflow manipulation)
  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.addEventListener("keydown", handleFocusTrap);
      document.documentElement.classList.add("dialog-open");
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("keydown", handleFocusTrap);
      document.documentElement.classList.remove("dialog-open");
    };
  }, [open, handleEscape, handleFocusTrap]);

  const motionProps = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0, scale: 0.96, y: -8 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.96, y: -8 },
        transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
      };

  const overlayMotion = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.15 },
      };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            ref={overlayRef}
            {...overlayMotion}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            {...motionProps}
            className={cn(
              "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
              "mx-4 max-h-[85vh] w-full max-w-lg overflow-y-auto",
              "rounded-2xl border border-border/60 bg-card p-6 shadow-2xl",
              className,
            )}
          >
            <DialogContext.Provider value={{ titleId }}>
              {children}
            </DialogContext.Provider>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Context to pass titleId from Dialog to DialogTitle
import { createContext, useContext } from "react";
const DialogContext = createContext<{ titleId: string }>({ titleId: "" });

export function DialogHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex items-center gap-3", className)}>
      {children}
    </div>
  );
}

export function DialogTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { titleId } = useContext(DialogContext);
  return <h2 id={titleId} className={cn("text-lg font-bold", className)}>{children}</h2>;
}

export function DialogClose({ onClose }: { onClose: () => void }) {
  return (
    <button
      onClick={onClose}
      aria-label="閉じる"
      className="ml-auto rounded-lg p-1.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
    >
      <X className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
