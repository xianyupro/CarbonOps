"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { clearTokens, setTokens } from "@/lib/auth";
import type { LoginResult, User } from "@/types/api";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresIn: number | null;
  /** Hydration flag — true once persist middleware has rehydrated from storage. */
  hydrated: boolean;
  /** Derived auth state. Recomputed on every mutating action + on rehydrate. */
  isAuthenticated: boolean;
  permissions: string[];

  setHydrated: () => void;
  login: (result: LoginResult) => void;
  logout: () => void;
  setUser: (user: User) => void;
  /** Sync the access token after a silent refresh (no full re-login). */
  setAccessToken: (accessToken: string, expiresIn?: number) => void;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (codes: string[]) => boolean;
}

/** Derive auth flags from the core credentials. Kept pure so it can be reused. */
function derive(user: User | null, accessToken: string | null) {
  return {
    isAuthenticated: !!accessToken && !!user,
    permissions: user?.permissions ?? [],
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      expiresIn: null,
      hydrated: false,
      isAuthenticated: false,
      permissions: [],

      setHydrated: () => {
        // Recompute derived flags from the rehydrated credentials.
        const { user, accessToken } = get();
        set({ hydrated: true, ...derive(user, accessToken) });
      },

      login: (result) => {
        setTokens({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
        });
        set({
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
          ...derive(result.user, result.accessToken),
        });
      },

      logout: () => {
        clearTokens();
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          expiresIn: null,
          isAuthenticated: false,
          permissions: [],
        });
      },

      setUser: (user) => {
        const { accessToken } = get();
        set({ user, ...derive(user, accessToken) });
      },

      setAccessToken: (accessToken, expiresIn) => {
        const { user, refreshToken } = get();
        const next: Partial<AuthState> = {
          accessToken,
          ...derive(user, accessToken),
        };
        if (typeof expiresIn === "number") next.expiresIn = expiresIn;
        if (refreshToken === undefined) next.refreshToken = null;
        set(next);
      },

      hasPermission: (code) => {
        const perms = get().user?.permissions;
        if (!perms || perms.length === 0) return false;
        if (perms.includes("*")) return true;
        return perms.includes(code);
      },

      hasAnyPermission: (codes) => {
        if (!codes || codes.length === 0) return true;
        const perms = get().user?.permissions;
        if (!perms || perms.length === 0) return false;
        if (perms.includes("*")) return true;
        return codes.some((c) => perms.includes(c));
      },
    }),
    {
      name: "carbonops-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        expiresIn: state.expiresIn,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);

/**
 * Permission helper usable outside React components (e.g. nav config).
 * Reads from the current zustand snapshot.
 */
export function can(permissionCode: string): boolean {
  return useAuthStore.getState().hasPermission(permissionCode);
}
