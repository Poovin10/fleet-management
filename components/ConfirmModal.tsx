"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  isDanger = false,
  onConfirm,
  onCancel,
  isProcessing = false,
}: ConfirmModalProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isProcessing) {
          onCancel();
        }
      }}
    >
      <DialogContent
        layout="modal"
        size="sm"
        showClose={false}
        className="overflow-hidden p-0"
      >
        <DialogHeader className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-warning/20 bg-warning-soft text-warning">
            <svg
              className="size-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v4m0 4h.01M10.29 3.86l-8.12 14a2 2 0 001.73 3h16.2a2 2 0 001.73-3l-8.1-14a2 2 0 00-3.44 0z"
              />
            </svg>
          </div>

          <div className="min-w-0 pt-0.5">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              {title}
            </DialogTitle>

            <DialogDescription className="mt-1 text-sm leading-relaxed">
              {message}
            </DialogDescription>
          </div>
        </DialogHeader>

        <DialogFooter className="border-t border-border bg-surface/60">
          <Button
            type="button"
            variant="glass"
            onClick={onCancel}
            disabled={isProcessing}
            className="h-11 rounded-xl"
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant={isDanger ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={isProcessing}
            className="h-11 rounded-xl"
          >
            {isProcessing ? "Processing..." : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
