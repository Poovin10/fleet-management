import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Slot } from "@radix-ui/react-slot"

const buttonVariants = cva(
  [
    "group/button inline-flex shrink-0 items-center justify-center",
    "border border-transparent bg-clip-padding",
    "font-medium whitespace-nowrap select-none",
    "outline-none",
    "transition-colors duration-base ease-standard",
    "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2 focus-visible:ring-offset-app",
    "disabled:pointer-events-none disabled:opacity-50 aria-busy:cursor-wait",
    "active:scale-[0.99]",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
    "[&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "h-10 rounded-md bg-primary text-primary-foreground border-accent/30 shadow-orange hover:bg-accent-hover",

        outline:
          "h-10 rounded-md border-border-strong bg-transparent text-fg hover:bg-surface-raised hover:border-border-strong",

        secondary:
          "h-10 rounded-md bg-surface-raised text-fg border-border hover:bg-surface-elevated",

        ghost:
          "h-10 rounded-md bg-transparent text-fg-secondary hover:bg-surface-raised hover:text-fg",

        destructive:
          "h-10 rounded-md bg-danger/10 text-danger border-danger/20 hover:bg-danger/20",

        link:
          "h-auto rounded-sm text-accent underline-offset-4 hover:underline",

        glass:
          "h-10 rounded-md bg-surface-raised text-fg border-border hover:bg-surface-elevated hover:border-border-strong",
      },

      size: {
        default:
          "gap-1.5 px-3 text-sm",

        xs:
          "h-8 gap-1 rounded-sm px-2 text-xs",

        sm:
          "h-9 gap-1 rounded-md px-2.5 text-xs",

        lg:
          "h-11 gap-2 rounded-lg px-4 text-sm",

        icon:
          "size-10 rounded-md",

        "icon-xs":
          "size-8 rounded-sm",

        "icon-sm":
          "size-9 rounded-md",

        "icon-lg":
          "size-11 rounded-lg",
      },
    },

    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  disabled = false,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      aria-disabled={asChild && loading ? true : undefined}
      disabled={asChild ? undefined : disabled || loading}
      className={cn(buttonVariants({ variant, size, className }), loading && asChild && "pointer-events-none")}
      {...props}
    >
      {loading ? <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current motion-reduce:animate-none" /> : null}
      {children}
    </Comp>
  )
}

export { Button, buttonVariants }
