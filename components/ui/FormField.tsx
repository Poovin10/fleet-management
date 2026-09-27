import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormFieldProps = {
  id: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
};

export function FormField({
  id,
  label,
  description,
  error,
  required,
  children,
  className,
}: FormFieldProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ");
  const control = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id,
        "aria-describedby": [
          (children.props as { "aria-describedby"?: string })["aria-describedby"],
          describedBy,
        ].filter(Boolean).join(" ") || undefined,
        "aria-invalid": error ? true : (children.props as { "aria-invalid"?: boolean })["aria-invalid"],
      })
    : children;

  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id} className="text-xs font-medium text-fg-secondary">
        {label}
        {required ? <span className="ml-1 text-danger" aria-hidden="true">*</span> : null}
      </Label>
      {control}
      {description ? <p id={descriptionId} className="text-xs leading-5 text-fg-muted">{description}</p> : null}
      {error ? <p id={errorId} role="alert" className="text-xs leading-5 text-danger">{error}</p> : null}
    </div>
  );
}
