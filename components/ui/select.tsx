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
          "flex h-10 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg shadow-sm transition-all duration-base ease-standard",
          "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-surface-raised",
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
