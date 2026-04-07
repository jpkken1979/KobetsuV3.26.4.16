import { Dialog, DialogHeader, DialogTitle, DialogClose } from "./dialog";
import { Button } from "./button";
import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
  isPending?: boolean;
  confirmDisabled?: boolean;
  extraContent?: ReactNode;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "確認",
  cancelLabel = "キャンセル",
  variant = "default",
  isPending = false,
  confirmDisabled = false,
  extraContent,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} className="max-w-md">
      <DialogHeader>
        {variant === "destructive" && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/50">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" aria-hidden="true" />
          </div>
        )}
        <div className="flex-1">
          <DialogTitle>{title}</DialogTitle>
        </div>
        <DialogClose onClose={onClose} />
      </DialogHeader>

      <p className="mb-6 text-sm text-muted-foreground">{description}</p>
  {extraContent ? <div className="mb-6">{extraContent}</div> : null}

      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={isPending}
        >
          {cancelLabel}
        </Button>
        <Button
          variant={variant === "destructive" ? "destructive" : "default"}
          onClick={() => {
            onConfirm();
            // Do NOT call onClose() here — let the parent close it via onSuccess/onError
          }}
          disabled={isPending || confirmDisabled}
        >
          {isPending ? "処理中..." : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
