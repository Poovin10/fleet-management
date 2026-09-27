import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "flex h-[var(--control-height-md)] w-full rounded-md border border-border-strong bg-surface-raised px-3 py-2 text-sm text-fg transition-colors duration-base ease-standard",
          "focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface",
          "aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/30",
          "[&>option]:bg-surface [&>option]:text-fg",
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = "Select";

export { Select };
