"use client";

import React from "react";
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
  if (!isOpen) return null;

  const styles = {
    success: {
      icon: "border-success/20 bg-success-soft text-success",
      button: "success",
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
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-modal-title"
    >
      <div className="liquid-glass w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 text-center sm:p-8">
          <div
            className={`mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl border ${styles.icon}`}
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

          <h3
            id="alert-modal-title"
            className="mb-2 text-xl font-semibold tracking-tight text-fg"
          >
            {title}
          </h3>

          <p className="text-sm leading-relaxed text-fg-secondary">
            {message}
          </p>
        </div>

        <div className="border-t border-border bg-surface/60 p-4">
          <Button
            type="button"
            variant={styles.button as "default" | "destructive"}
            onClick={onClose}
            className="h-11 w-full rounded-xl"
          >
            {type === "success" ? "Awesome, thanks!" : "OK, Got it"}
          </Button>
        </div>
      </div>
    </div>
  );
}
