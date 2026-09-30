"use client";
import { create } from "zustand";

export type UserView =
  | "home"
  | "videos"
  | "video-player"
  | "photos"
  | "photo-viewer"
  | "private"
  | "documents"
  | "contacts"
  | "uploads"
  | "favorites"
  | "recent"
  | "profile"
  | "settings";

export type AdminView =
  | "dashboard"
  | "users"
  | "user-detail"
  | "media"
  | "uploads"
  | "logs"
  | "settings"
  | "admin-profile";

export type LoginView = "user-login" | "admin-login" | "qr-login";

interface UIState {
  view: UserView | AdminView | LoginView | "loading";
  params: Record<string, any>;
  setView: (v: UIState["view"], params?: Record<string, any>) => void;
  theme: "light" | "dark" | "system";
  setTheme: (t: "light" | "dark" | "system") => void;
  applyTheme: () => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

const THEME_KEY = "escloud-theme";

export const useUIStore = create<UIState>((set, get) => ({
  view: "loading",
  params: {},
  setView: (v, params = {}) => {
    set({ view: v, params });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "auto" });
  },
  theme: "system",
  setTheme: (t) => {
    set({ theme: t });
    if (typeof window !== "undefined") {
      localStorage.setItem(THEME_KEY, t);
      get().applyTheme();
    }
  },
  applyTheme: () => {
    if (typeof window === "undefined") return;
    const t = get().theme;
    const root = document.documentElement;
    const isDark =
      t === "dark" ||
      (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.classList.toggle("dark", isDark);
  },
  mobileOpen: false,
  setMobileOpen: (v) => set({ mobileOpen: v }),
}));

export function initTheme() {
  if (typeof window === "undefined") return;
  const stored = localStorage.getItem(THEME_KEY) as any;
  useUIStore.getState().setTheme(stored ?? "system");
}
