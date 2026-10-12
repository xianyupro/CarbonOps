"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { routeMap } from "@/lib/nav";
import { cn } from "@/lib/utils";

/**
 * Simple breadcrumb derived from the current pathname.
 * Maps each segment to its human label via `routeMap`; falls back to the raw
 * segment title-cased when no match exists.
 */
export function Breadcrumb() {
  const pathname = usePathname() || "/";
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((seg, idx) => {
    const href = "/" + segments.slice(0, idx + 1).join("/");
    const matched = routeMap[href];
    const label =
      matched?.label ?? seg.charAt(0).toUpperCase() + seg.slice(1);
    return { href, label };
  });

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center text-sm text-muted-foreground"
    >
      <ol className="flex items-center gap-1.5">
        <li>
          <Link
            href="/dashboard"
            className={cn(
              "transition-colors hover:text-foreground",
              pathname === "/dashboard" && "text-foreground"
            )}
          >
            首页
          </Link>
        </li>
        {crumbs.map((c, idx) => {
          const isLast = idx === crumbs.length - 1;
          return (
            <li key={c.href} className="flex items-center gap-1.5">
              <ChevronRight className="h-3.5 w-3.5 opacity-50" />
              {isLast ? (
                <span className="font-medium text-foreground">{c.label}</span>
              ) : (
                <Link
                  href={c.href}
                  className="transition-colors hover:text-foreground"
                >
                  {c.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
