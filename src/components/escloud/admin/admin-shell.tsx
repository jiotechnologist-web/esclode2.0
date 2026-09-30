"use client";
import { useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { useUIStore, type AdminView } from "@/stores/ui";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { GlobalSearch } from "../shared/global-search";
import {
  Sun, Moon, Monitor, LogOut, Shield, Cloud, Menu, X, MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";

interface NavItem {
  key: AdminView;
  label: string;
  icon: any;
}

interface Props {
  navItems: NavItem[];
  children: React.ReactNode;
}

// Admin system nav — always visible
const ADMIN_SYSTEM_ITEMS: AdminView[] = ["dashboard", "admin-profile"];

export function AdminShell({ navItems, children }: Props) {
  const user = useAuthStore((s) => s.user);
  const view = useUIStore((s) => s.view) as AdminView;
  const setView = useUIStore((s) => s.setView);
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const mobileOpen = useUIStore((s) => s.mobileOpen);
  const setMobileOpen = useUIStore((s) => s.setMobileOpen);
  const logout = useAuthStore((s) => s.logout);
  const [moreOpen, setMoreOpen] = useState(false);

  if (!user) return null;

  // Bottom nav: 4 primary + More (so max 5 per row)
  const primaryNav = navItems.slice(0, 4);
  const moreNav = navItems.slice(4);
  // Always ensure dashboard is in primary
  if (!primaryNav.some((i) => i.key === "dashboard")) {
    primaryNav.unshift(navItems.find((i) => i.key === "dashboard")!);
  }

  const active = navItems.find((i) => i.key === view) ?? navItems[0];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="px-4 py-4 flex items-center gap-3 border-b">
          <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold leading-tight text-brand-gradient">Escloud Admin</div>
            <div className="text-[11px] text-muted-foreground">Control Center</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5 scroll-thin">
          {navItems.map((item) => (
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
            </button>
          ))}
        </nav>
        <div className="p-2 border-t space-y-1">
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-emerald-600 text-white text-xs">
                {user.displayName?.[0]?.toUpperCase() ?? "A"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate flex items-center gap-1">
                <Shield className="w-3 h-3 text-emerald-500" />
                {user.displayName ?? user.username}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">{user.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="flex-1 h-8" onClick={() => setTheme("light")} title="Light">
              <Sun className={cn("w-3.5 h-3.5", theme === "light" && "text-primary")} />
            </Button>
            <Button variant="ghost" size="sm" className="flex-1 h-8" onClick={() => setTheme("dark")} title="Dark">
              <Moon className={cn("w-3.5 h-3.5", theme === "dark" && "text-primary")} />
            </Button>
            <Button variant="ghost" size="sm" className="flex-1 h-8" onClick={() => setTheme("system")} title="System">
              <Monitor className={cn("w-3.5 h-3.5", theme === "system" && "text-primary")} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 h-8"
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

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="flex items-center gap-2 px-3 md:px-6 py-3 pt-safe">
            <Button variant="ghost" size="sm" className="md:hidden h-9 w-9 p-0" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
            <div className="flex items-center gap-2 md:hidden">
              <div className="w-7 h-7 rounded-lg bg-brand-gradient flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-semibold text-brand-gradient">Admin</span>
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
              <Badge variant="outline" className="hidden md:flex text-[11px]">
                <Shield className="w-3 h-3 mr-1 text-emerald-500" /> Admin
              </Badge>
              <GlobalSearch />
            </div>
          </div>
          {mobileOpen && (
            <div className="md:hidden border-t">
              <nav className="p-2 grid grid-cols-2 gap-1">
                {navItems.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => {
                      setView(item.key);
                      setMobileOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm",
                      view === item.key ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                ))}
                <button
                  onClick={async () => {
                    await logout();
                    setMobileOpen(false);
                  }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-rose-500 hover:bg-rose-500/10"
                >
                  <LogOut className="w-4 h-4" /> Logout
                </button>
              </nav>
            </div>
          )}
        </header>

        <main className="flex-1 pb-20 md:pb-0">{children}</main>

        {/* Mobile bottom nav — max 5 per row, More button for the rest */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 glass border-t border-border pb-safe">
          <div className="grid max-w-md mx-auto" style={{ gridTemplateColumns: `repeat(${Math.min(5, primaryNav.length + (moreNav.length > 0 ? 1 : 0))}, minmax(0, 1fr))` }}>
            {primaryNav.map((item) => {
              const isActive = view === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
                  className={cn("flex flex-col items-center gap-0.5 py-2 px-1 text-[10px] min-w-0", isActive ? "text-primary" : "text-muted-foreground")}
                >
                  <item.icon className={cn("w-5 h-5", isActive && "scale-110 transition-transform")} />
                  <span className="truncate max-w-full">{item.label.split(" ")[0]}</span>
                </button>
              );
            })}
            {moreNav.length > 0 && (
              <button
                onClick={() => setMoreOpen(true)}
                className="flex flex-col items-center gap-0.5 py-2 px-1 text-[10px] text-muted-foreground"
              >
                <MoreHorizontal className="w-5 h-5" />
                <span>More</span>
              </button>
            )}
          </div>
        </nav>
      </div>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="text-base">More</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-4 gap-2 px-2 pb-6">
            {moreNav.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setView(item.key);
                  setMoreOpen(false);
                }}
                className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-accent transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                  <item.icon className="w-5 h-5" />
                </div>
                <span className="text-xs">{item.label}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
