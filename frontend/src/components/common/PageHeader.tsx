import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Optional eyebrow label rendered above the title (eyebrow small · uppercase). */
  eyebrow?: string;
  /** Optional icon shown next to the title. */
  icon?: LucideIcon;
  /** Optional right-aligned actions (buttons, filters, etc.). */
  actions?: React.ReactNode;
  /** Optional small breadcrumb-style chips above the title. */
  meta?: React.ReactNode;
  className?: string;
}

/**
 * Standard page heading with optional eyebrow, icon, and accent rail.
 * Title + optional description on the left, action slot on the right.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  icon: Icon,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-end sm:justify-between",
        className
      )}
    >
      {/* Accent gradient rail — a thin brand-colored stripe on the left edge */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-0.5 rounded-full bg-gradient-primary"
      />

      <div className="min-w-0 flex-1 pl-2">
        {eyebrow ? (
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
            {eyebrow}
          </div>
        ) : null}
        {meta ? <div className="mb-1.5 flex items-center gap-2">{meta}</div> : null}
        <div className="flex items-center gap-3">
          {Icon ? (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary shadow-sm">
              <Icon className="h-4.5 w-4.5" strokeWidth={2.2} />
            </div>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
        </div>
        {description ? (
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
