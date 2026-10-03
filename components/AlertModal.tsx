"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AlertModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: "success" | "error" | "info";
  onClose: () => void;
}

export function AlertModal({
  isOpen,
  title,
  message,
  type = "info",
  onClose,
}: AlertModalProps) {
  const styles = {
    success: {
      icon: "border-success/20 bg-success-soft text-success",
      button: "default",
    },
    error: {
      icon: "border-danger/20 bg-danger-soft text-danger",
      button: "destructive",
    },
    info: {
      icon: "border-info/20 bg-info-soft text-info",
      button: "default",
    },
  }[type];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        layout="modal"
        size="sm"
        showClose={false}
        className="overflow-hidden p-0"
      >
        <DialogHeader className="text-center">
          <div
            className={`mx-auto mb-2 flex size-16 items-center justify-center rounded-2xl border ${styles.icon}`}
          >
            {type === "success" && (
              <svg
                className="size-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}

            {type === "error" && (
              <svg
                className="size-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            )}

            {type === "info" && (
              <svg
                className="size-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            )}
          </div>

          <DialogTitle className="text-xl font-semibold tracking-tight">
            {title}
          </DialogTitle>

          <DialogDescription className="text-sm leading-relaxed">
            {message}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="hidden" />

        <DialogFooter className="border-t border-border bg-surface/60">
          <Button
            type="button"
            variant={styles.button as "default" | "destructive"}
            onClick={onClose}
            className="h-11 w-full rounded-xl"
          >
            {type === "success" ? "Awesome, thanks!" : "OK, Got it"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
