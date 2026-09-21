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
    "transition-all duration-normal ease-spring",
    "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30",
    "disabled:pointer-events-none disabled:opacity-50",
    "active:scale-[0.97]",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
    "[&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border-accent/40 shadow-orange hover:bg-accent-hover hover:shadow-orange-hover hover:-translate-y-px",

        outline:
          "border-border-strong bg-transparent text-fg hover:bg-surface-raised hover:border-border-strong",

        secondary:
          "bg-surface-raised text-fg border-border hover:bg-surface-elevated",

        ghost:
          "bg-transparent text-fg-secondary hover:bg-surface-raised hover:text-fg",

        destructive:
          "bg-danger/10 text-danger border-danger/20 hover:bg-danger/20",

        link:
          "text-accent underline-offset-4 hover:underline",

        glass:
          "bg-surface-raised/70 text-fg border-border-strong backdrop-blur-xl hover:bg-surface-elevated hover:border-border-strong",
      },

      size: {
        default:
          "h-9 gap-1.5 rounded-md px-3 text-sm",

        xs:
          "h-7 gap-1 rounded-sm px-2 text-xs",

        sm:
          "h-8 gap-1 rounded-md px-2.5 text-xs",

        lg:
          "h-11 gap-2 rounded-lg px-4 text-sm",

        icon:
          "size-9 rounded-md",

        "icon-xs":
          "size-7 rounded-sm",

        "icon-sm":
          "size-8 rounded-md",

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
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
