import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-white hover:bg-primary-strong hover:shadow-[0_0_24px_rgba(var(--brand-primary-glow),0.5)]",
        secondary:
          "bg-surface-2 text-text hover:bg-surface hover:shadow-[0_0_20px_rgba(var(--brand-primary-glow),0.25)]",
        ghost: "text-text hover:bg-surface-2 hover:text-primary",
        outline:
          "border border-surface-2 text-text hover:bg-surface-2 hover:border-primary",
        destructive:
          "bg-down text-white hover:bg-opacity-90 hover:shadow-[0_0_24px_rgba(255,77,109,0.4)]",
      },
      size: {
        default: "h-10 px-4 rounded-full text-sm",
        sm: "h-8 px-3 rounded-lg text-xs",
        lg: "h-12 px-6 rounded-xl text-base",
        icon: "h-10 w-10 rounded-full",
        xl: "h-16 w-16 rounded-full text-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
