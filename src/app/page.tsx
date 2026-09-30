"use client";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { LoginPage } from "@/components/escloud/login/login-page";
import { UserApp } from "@/components/escloud/user/user-app";
import { AdminApp } from "@/components/escloud/admin/admin-app";
import { LoadingSplash } from "@/components/escloud/loading-splash";

export default function Home() {
  const user = useAuthStore((s) => s.user);
  const isImpersonating = useAuthStore((s) => s.isImpersonating);
  const loading = useAuthStore((s) => s.loading);
  const fetchSession = useAuthStore((s) => s.fetchSession);
  const view = useUIStore((s) => s.view);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  // Initialize default view based on auth state
  useEffect(() => {
    if (loading) return;
    if (user) {
      if (user.role === "admin" && !isImpersonating) {
        // Default admin view
        useUIStore.getState().setView("dashboard", {});
      } else {
        // Default user view
        useUIStore.getState().setView("home", {});
      }
    } else {
      useUIStore.getState().setView("user-login", {});
    }
  }, [user, isImpersonating, loading]);

  if (loading) return <LoadingSplash />;

  if (!user) return <LoginPage />;

  if (user.role === "admin" && !isImpersonating) return <AdminApp />;

  return <UserApp />;
}
