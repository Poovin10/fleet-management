import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  [
    "inline-flex items-center rounded-md border",
    "px-2.5 py-1 text-xs font-semibold",
    "transition-colors",
    "focus:outline-none focus:ring-2 focus:ring-ring/30",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "border-accent/20 bg-accent-soft text-accent",

        secondary:
          "border-border bg-surface-raised text-fg-secondary",

        destructive:
          "border-danger/20 bg-danger-soft text-danger",

        outline:
          "border-border-strong bg-transparent text-fg",

        success:
          "border-success/20 bg-success-soft text-success",

        warning:
          "border-warning/20 bg-warning-soft text-warning",

        info:
          "border-info/20 bg-info-soft text-info",

        glass:
          "border-border bg-white/[0.035] text-fg-secondary backdrop-blur-xl",
      },
    },

    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
