import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[14px] text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
  {
    variants: {
      variant: {
        default:
          "bg-[linear-gradient(135deg,_#2563EB,_#1D4ED8)] text-white shadow-[0_14px_30px_rgba(37,99,235,0.22)] hover:translate-y-[-1px] hover:shadow-[0_18px_38px_rgba(37,99,235,0.24)]",
        secondary:
          "border border-slate-200 bg-slate-100 text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.05)] hover:border-slate-300 hover:bg-slate-200/80",
        outline:
          "border border-slate-200 bg-white text-slate-700 shadow-[0_10px_22px_rgba(15,23,42,0.05)] hover:border-blue-200 hover:bg-blue-50/60 hover:text-blue-800",
        ghost:
          "bg-transparent text-slate-600 hover:bg-blue-50 hover:text-blue-800",
      },
      size: {
        default: "h-11 px-5",
        lg: "h-12 px-6 text-sm",
        sm: "h-9 px-4 text-xs",
        icon: "h-10 w-10 shrink-0 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
