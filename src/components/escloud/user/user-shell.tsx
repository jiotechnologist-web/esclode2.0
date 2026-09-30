"use client";
import { useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { useUIStore, type UserView } from "@/stores/ui";
import { useUploadStore } from "@/stores/upload";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sun, Moon, Monitor, LogOut, Cloud, Menu, X, Search } from "lucide-react";
import { GlobalSearch } from "../shared/global-search";
import { toast } from "sonner";

interface NavItem {
  key: UserView;
  label: string;
  icon: any;
  enabled: boolean;
  mobile?: boolean;
}

interface Props {
  navItems: NavItem[];
  children: React.ReactNode;
}

export function UserShell({ navItems, children }: Props) {
  const user = useAuthStore((s) => s.user);
  const view = useUIStore((s) => s.view) as UserView;
  const setView = useUIStore((s) => s.setView);
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const mobileOpen = useUIStore((s) => s.mobileOpen);
  const setMobileOpen = useUIStore((s) => s.setMobileOpen);
  const logout = useAuthStore((s) => s.logout);
  const setShowUploadPanel = useUploadStore((s) => s.setShowPanel);

  if (!user) return null;

  const visibleItems = navItems.filter((i) => i.enabled);
  const mobileItems = visibleItems.filter((i) => i.mobile);
  // If user's primary mobile items are too few, fall back to first 5 visible
  const bottomNavItems = mobileItems.length >= 4 ? mobileItems : visibleItems.slice(0, 5);

  const active = visibleItems.find((i) => i.key === view);

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 lg:w-72 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="px-4 py-4 flex items-center gap-3 border-b">
          <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center">
            <Cloud className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-semibold leading-tight text-brand-gradient">Escloud</div>
            <div className="text-[11px] text-muted-foreground">Private Cloud</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1 scroll-thin">
          {visibleItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-left",
                view === item.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "hover:bg-sidebar-accent text-sidebar-foreground"
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.label}</span>
              {item.key === "private" && (
                <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">PRIV</Badge>
              )}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t space-y-2">
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-sidebar-accent/40">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-brand-gradient text-white text-xs">
                {user.displayName?.[0]?.toUpperCase() ?? user.username[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user.displayName ?? user.username}</div>
              <div className="text-[10px] text-muted-foreground truncate">{user.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={() => setTheme("light")}
              title="Light"
            >
              <Sun className={cn("w-3.5 h-3.5", theme === "light" && "text-primary")} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={() => setTheme("dark")}
              title="Dark"
            >
              <Moon className={cn("w-3.5 h-3.5", theme === "dark" && "text-primary")} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={() => setTheme("system")}
              title="System"
            >
              <Monitor className={cn("w-3.5 h-3.5", theme === "system" && "text-primary")} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await logout();
                toast.success("Signed out");
              }}
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (sticky) */}
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="flex items-center gap-2 px-3 md:px-6 py-3 pt-safe">
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
            <div className="flex items-center gap-2 md:hidden">
              <div className="w-7 h-7 rounded-lg bg-brand-gradient flex items-center justify-center">
                <Cloud className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-semibold text-brand-gradient">Escloud</span>
            </div>
            <div className="hidden md:flex items-center gap-2">
              {active && (
                <>
                  <active.icon className="w-4 h-4 text-muted-foreground" />
                  <h1 className="text-base font-semibold">{active.label}</h1>
                </>
              )}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <GlobalSearch />
            </div>
          </div>
          {/* Mobile menu drawer (when open) */}
          {mobileOpen && (
            <div className="md:hidden border-t">
              <nav className="p-2 grid grid-cols-2 gap-1 max-h-[60vh] overflow-y-auto scroll-thin">
                {visibleItems.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => {
                      setView(item.key);
                      setMobileOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
                      view === item.key
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="truncate">{item.label}</span>
                  </button>
                ))}
                <button
                  onClick={async () => {
                    await logout();
                    setMobileOpen(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-rose-500 hover:bg-rose-500/10"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </nav>
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 pb-20 md:pb-0">{children}</main>

        {/* Mobile bottom navigation */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 glass border-t border-border pb-safe">
          <div className="grid grid-cols-5 max-w-md mx-auto">
            {bottomNavItems.map((item) => {
              const isActive = view === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2.5 px-1 text-[10px] transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", isActive && "scale-110 transition-transform")} />
                  <span className="truncate max-w-full">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
