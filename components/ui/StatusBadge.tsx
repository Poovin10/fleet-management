import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva("kss-status", {
  variants: {
    variant: {
      success: "border-success/25 bg-success-soft text-success",
      warning: "border-warning/25 bg-warning-soft text-warning",
      danger: "border-danger/25 bg-danger-soft text-danger",
      info: "border-info/25 bg-info-soft text-info",
      pending: "border-pending/25 bg-pending-soft text-pending",
      active: "border-success/25 bg-success-soft text-success",
      inactive: "border-border bg-surface-raised text-fg-muted",
      maintenance: "border-warning/25 bg-warning-soft text-warning",
      breakdown: "border-danger/25 bg-danger-soft text-danger",
      neutral: "border-border bg-surface-raised text-fg-secondary",
    },
  },
  defaultVariants: { variant: "neutral" },
});

type StatusBadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof statusBadgeVariants>;

export function StatusBadge({ className, variant, ...props }: StatusBadgeProps) {
  return <span className={cn(statusBadgeVariants({ variant }), className)} {...props} />;
}
