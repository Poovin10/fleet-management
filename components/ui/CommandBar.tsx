import * as React from "react";
import { cn } from "@/lib/utils";

export function CommandBar({
  children,
  actions,
  className,
}: {
  children?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("kss-command-bar-surface", className)} aria-label="Page actions and filters">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">{children}</div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </section>
  );
}
