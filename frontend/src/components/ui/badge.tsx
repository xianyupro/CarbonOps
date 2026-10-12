import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80 shadow-sm shadow-primary/30",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        success:
          "border-success/25 bg-success/12 text-success",
        warning:
          "border-warning/30 bg-warning/12 text-warning",
        muted:
          "border-transparent bg-muted text-muted-foreground",
        gradient:
          "border-transparent text-white shadow-sm shadow-primary/25 bg-gradient-primary",
        "outline-success":
          "border-success/40 text-success bg-success/5",
        "outline-warning":
          "border-warning/40 text-warning bg-warning/5",
        "outline-destructive":
          "border-destructive/40 text-destructive bg-destructive/5",
        info:
          "border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
