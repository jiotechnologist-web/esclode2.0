"use client";
import { create } from "zustand";
import type { AuthUser } from "@/lib/auth";

interface AuthState {
  user: AuthUser | null;
  isImpersonating: boolean;
  impersonatingAdmin: { id: string; username: string; email: string; displayName: string | null } | null;
  loading: boolean;
  fetchSession: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: AuthUser | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isImpersonating: false,
  impersonatingAdmin: null,
  loading: true,
  fetchSession: async () => {
    set({ loading: true });
    try {
      const r = await fetch("/api/auth/login");
      const data = await r.json();
      if (data && data.user) {
        const u = data.user;
        set({
          user: {
            id: u.id,
            username: u.username,
            email: u.email,
            displayName: u.displayName,
            role: u.role,
            status: u.status,
            avatarPath: u.avatarPath ?? null,
            permissions: u.permissions ?? [],
            storageQuota: u.storageQuota ?? 0,
            uploadMaxBytes: u.uploadMaxBytes ?? 0,
            uploadEnabled: u.uploadEnabled ?? false,
            downloadEnabled: u.downloadEnabled ?? false,
            approvalRequired: u.approvalRequired ?? false,
          },
          isImpersonating: !!data.isImpersonating,
          impersonatingAdmin: data.impersonatingAdmin ?? null,
          loading: false,
        });
      } else {
        set({ user: null, isImpersonating: false, impersonatingAdmin: null, loading: false });
      }
    } catch {
      set({ user: null, loading: false });
    }
  },
  logout: async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
    set({ user: null, isImpersonating: false, impersonatingAdmin: null });
  },
  setUser: (u) => set({ user: u }),
}));
