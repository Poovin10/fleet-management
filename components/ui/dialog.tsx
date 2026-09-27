"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const overlayVariants = cva(
  "fixed inset-0 z-[100] bg-[var(--glass-overlay)] backdrop-blur-[12px] backdrop-saturate-[115%] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:animate-none",
);

const contentVariants = cva(
  "kss-dialog-surface left-1/2 top-1/2 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 motion-reduce:animate-none",
  {
    variants: {
      layout: {
        modal: "",
        sheet: "data-[layout=sheet]:left-auto data-[layout=sheet]:right-0 data-[layout=sheet]:top-0 data-[layout=sheet]:h-dvh data-[layout=sheet]:max-h-dvh data-[layout=sheet]:w-full data-[layout=sheet]:translate-x-0 data-[layout=sheet]:translate-y-0 data-[layout=sheet]:rounded-none sm:data-[layout=sheet]:h-[min(96dvh,900px)] sm:data-[layout=sheet]:max-h-[min(96dvh,900px)] sm:data-[layout=sheet]:top-1/2 sm:data-[layout=sheet]:-translate-y-1/2 sm:data-[layout=sheet]:w-[min(38rem,calc(100vw-2rem))] sm:data-[layout=sheet]:rounded-l-xl sm:data-[layout=sheet]:rounded-r-none",
        inspector: "data-[layout=inspector]:left-auto data-[layout=inspector]:right-0 data-[layout=inspector]:top-0 data-[layout=inspector]:h-dvh data-[layout=inspector]:max-h-dvh data-[layout=inspector]:w-full data-[layout=inspector]:translate-x-0 data-[layout=inspector]:translate-y-0 data-[layout=inspector]:rounded-none sm:data-[layout=inspector]:w-[min(32rem,calc(100vw-2rem))] sm:data-[layout=inspector]:rounded-l-xl sm:data-[layout=inspector]:rounded-r-none",
      },
      size: {
        sm: "max-w-sm",
        md: "max-w-md",
        lg: "max-w-2xl",
        xl: "max-w-4xl",
        full: "w-[calc(98vw-0px)] max-w-[min(1600px,calc(98vw-0px))]",
      },
    },
    defaultVariants: { layout: "modal", size: "lg" },
  },
);

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> &
  VariantProps<typeof contentVariants> & { showClose?: boolean };

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, layout, size, showClose = true, ...props }, ref) => (
  <DialogPortal>
    <DialogPrimitive.Overlay className={overlayVariants()} />
    <DialogPrimitive.Content
      ref={ref}
      data-layout={layout ?? "modal"}
      data-size={size ?? "lg"}
      className={cn(contentVariants({ layout, size }), className)}
      {...props}
    >
      {children}
      {showClose ? (
        <DialogPrimitive.Close
          className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-white/[0.06] hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Close dialog"
        >
          <X className="size-4" aria-hidden="true" />
        </DialogPrimitive.Close>
      ) : null}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("border-b border-border px-5 py-4 pr-14 sm:px-6", className)} {...props} />
);

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-base font-semibold tracking-tight text-fg", className)} {...props} />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("mt-1 text-sm leading-5 text-fg-secondary", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("kss-dialog-body px-5 py-4 sm:px-6", className)} {...props} />
);

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-4 sm:px-6", className)} {...props} />
);

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
};
