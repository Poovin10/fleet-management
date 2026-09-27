import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          "input-glass h-[var(--control-height-md)] text-sm",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/30",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";

export { Input };
