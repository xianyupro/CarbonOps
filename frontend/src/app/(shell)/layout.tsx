"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Authenticated shell layout. Guards the entire `(shell)` route group: while
 * the middleware checks the cookie mirror at the edge, this client component
 * re-checks the real auth state from the persisted store and redirects to
 * /login if unauthenticated. Also waits for the persisted store to rehydrate.
 */
export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const hydrated = useAuthStore((s) => s.hydrated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);

  React.useEffect(() => {
    if (!hydrated) return;
    if (!accessToken || !user) {
      router.replace("/login");
    }
  }, [hydrated, accessToken, user, router]);

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          正在加载…
        </div>
      </div>
    );
  }

  if (!accessToken || !user) {
    // Effect above will redirect; render null to avoid flashing protected UI.
    return null;
  }

  return <AppShell>{children}</AppShell>;
}
