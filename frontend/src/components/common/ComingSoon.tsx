import * as React from "react";
import { Construction } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComingSoonProps {
  /** Optional feature title shown in the body. */
  title?: string;
  /** Short description of what is coming. */
  description?: string;
  className?: string;
}

/**
 * Friendly "under construction" placeholder for stubbed modules.
 * Used by every not-yet-implemented page so navigation still works.
 */
export function ComingSoon({
  title = "模块建设中",
  description = "该模块将在后续迭代中上线，敬请期待。",
  className,
}: ComingSoonProps) {
  return (
    <div
      className={cn(
        "flex flex-1 items-center justify-center py-16",
        className
      )}
    >
      <div className="flex max-w-md flex-col items-center rounded-xl border border-dashed border-border bg-card/60 px-8 py-12 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Construction className="h-7 w-7" />
        </div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
