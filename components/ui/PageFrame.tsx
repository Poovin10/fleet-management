import * as React from "react";
import { cn } from "@/lib/utils";

export function PageFrame({
  children,
  className,
  as: Element = "main",
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: "main" | "div" }) {
  return (
    <Element className={cn("kss-page", className)} {...props}>
      {children}
    </Element>
  );
}
