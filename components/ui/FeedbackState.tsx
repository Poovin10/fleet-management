import * as React from "react";
import { cn } from "@/lib/utils";

type FeedbackKind = "loading" | "empty" | "error" | "no-results" | "no-permission";

const defaults: Record<FeedbackKind, { title: string; role: "status" | "alert" }> = {
  loading: { title: "Loading", role: "status" },
  empty: { title: "Nothing here yet", role: "status" },
  error: { title: "Something went wrong", role: "alert" },
  "no-results": { title: "No matching results", role: "status" },
  "no-permission": { title: "Access unavailable", role: "status" },
};

export function FeedbackState({
  kind,
  title,
  description,
  action,
  className,
}: {
  kind: FeedbackKind;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const isLoading = kind === "loading";
  return (
    <div
      className={cn("kss-feedback", className)}
      role={defaults[kind].role}
      aria-live={isLoading ? "polite" : undefined}
      aria-busy={isLoading || undefined}
    >
      {isLoading ? (
        <span aria-hidden="true" className="size-5 animate-spin rounded-full border-2 border-border-strong border-t-accent motion-reduce:animate-none" />
      ) : null}
      <h2 className="text-sm font-semibold text-fg">{title ?? defaults[kind].title}</h2>
      {description ? <p className="max-w-xl text-sm leading-5 text-fg-secondary">{description}</p> : null}
      {action}
    </div>
  );
}
