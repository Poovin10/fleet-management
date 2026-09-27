import * as React from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  status?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  status,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("kss-page-header", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="kss-eyebrow mb-2">{eyebrow}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="kss-page-title">{title}</h1>
          {status}
        </div>
        {subtitle ? <p className="kss-page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2 max-sm:w-full max-sm:[&>*]:flex-1">{actions}</div> : null}
    </header>
  );
}
