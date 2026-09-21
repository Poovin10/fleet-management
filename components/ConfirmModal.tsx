"use client";

import { Button } from "@/components/ui/button";

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  isDanger = false,
  onConfirm,
  onCancel,
  isProcessing = false,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="liquid-glass w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <div
              className={[
                "flex size-11 shrink-0 items-center justify-center rounded-xl border",
                isDanger
                  ? "border-danger/20 bg-danger-soft text-danger"
                  : "border-accent/20 bg-accent-soft text-accent",
              ].join(" ")}
            >
              {isDanger ? (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              ) : (
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              )}
            </div>

            <h3
              id="confirm-modal-title"
              className="text-lg font-semibold tracking-tight text-fg"
            >
              {title}
            </h3>
          </div>

          <p className="text-sm leading-relaxed text-fg-secondary">
            {message}
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-border bg-surface/60 p-4">
          <Button
            type="button"
            variant="glass"
            onClick={onCancel}
            disabled={isProcessing}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant={isDanger ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={isProcessing}
            className="min-w-[120px]"
          >
            {isProcessing ? (
              <>
                <svg
                  className="size-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z"
                  />
                </svg>
                Processing...
              </>
            ) : (
              confirmText
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
