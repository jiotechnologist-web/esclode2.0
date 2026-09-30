"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { useUIStore, type UserView } from "@/stores/ui";
import { useUploadStore } from "@/stores/upload";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Sun, Moon, Monitor, LogOut, Cloud, Menu, X, MoreHorizontal, Home, Video, Image as ImageIcon,
  Lock, FileText, Users, Upload, Heart, History, UserCircle, Settings as SettingsIcon,
} from "lucide-react";
import { GlobalSearch } from "../shared/global-search";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

interface NavItem {
  key: UserView;
  label: string;
  icon: any;
  enabled: boolean;
  isPrivate?: boolean;
  isSystem?: boolean; // Cannot be hidden
}

interface Props {
  navItems: NavItem[];
  children: React.ReactNode;
}

const ICONS_MAP: Record<string, any> = {
  home: Home,
  videos: Video,
  photos: ImageIcon,
  private: Lock,
  documents: FileText,
  contacts: Users,
  uploads: Upload,
  favorites: Heart,
  recent: History,
  profile: UserCircle,
  settings: SettingsIcon,
};

const LABELS_MAP: Record<string, string> = {
  home: "Home",
  videos: "Videos",
  photos: "Photos",
  private: "Private",
  documents: "Documents",
  contacts: "Contacts",
  uploads: "Uploads",
  favorites: "Favorites",
  recent: "Recent",
  profile: "Profile",
  settings: "Settings",
};

// System items that cannot be hidden by the user
const SYSTEM_ITEMS = ["home", "profile"];

export function UserShell({ navItems, children }: Props) {
  const user = useAuthStore((s) => s.user);
  const view = useUIStore((s) => s.view) as UserView;
  const setView = useUIStore((s) => s.setView);
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const mobileOpen = useUIStore((s) => s.mobileOpen);
  const setMobileOpen = useUIStore((s) => s.setMobileOpen);
  const logout = useAuthStore((s) => s.logout);
  const navPrefs = useUIStore((s) => s.navPrefs);
  const setNavPrefs = useUIStore((s) => s.setNavPrefs);
  const [moreOpen, setMoreOpen] = useState(false);

  // Load nav prefs on mount
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const r = await fetch("/api/user/nav-prefs");
        if (r.ok) {
          const d = await r.json();
          setNavPrefs({ primaryItems: d.primaryItems ?? [], hiddenItems: d.hiddenItems ?? [] });
          useUIStore.getState().setVideoPrefs({
            preloadVideos: d.preloadVideos,
            advancedVideoPlay: d.advancedVideoPlay,
            preferredQuality: d.preferredQuality,
            autoQuality: d.autoQuality,
            preBufferLevel: d.preBufferLevel,
            dataSaver: d.dataSaver,
          });
        }
      } catch {}
    })();
  }, [user, setNavPrefs]);

  if (!user) return null;

  // All enabled nav items (always visible ones like home and profile stay)
  const enabledItems = navItems.filter((i) => i.enabled);

  // Build primary nav (max 5) + More menu
  let primaryNav: NavItem[] = [];
  let moreNav: NavItem[] = [];

  if (navPrefs && navPrefs.primaryItems.length > 0) {
    // Use user-defined primary items (filtered by enabled)
    const prefKeys = navPrefs.primaryItems.filter((k) => enabledItems.some((i) => i.key === k));
    primaryNav = prefKeys.map((k) => enabledItems.find((i) => i.key === k)!).filter(Boolean).slice(0, 5);
    // Hidden items removed from both primary and more
    const hidden = new Set(navPrefs.hiddenItems);
    moreNav = enabledItems.filter((i) => !primaryNav.includes(i) && !hidden.has(i.key));
  } else {
    // Default: take first 5 enabled items for primary, rest for More
    primaryNav = enabledItems.slice(0, 5);
    moreNav = enabledItems.slice(5);
  }

  // Always ensure Home and Profile are in primary (they're required system items)
  for (const sysKey of SYSTEM_ITEMS) {
    const sysItem = enabledItems.find((i) => i.key === sysKey);
    if (sysItem && !primaryNav.includes(sysItem)) {
      // If primary is already at 5, swap out the last one to More
      if (primaryNav.length >= 5) {
        const last = primaryNav.pop();
        if (last) moreNav.unshift(last);
      }
      primaryNav.push(sysItem);
    }
  }

  const active = enabledItems.find((i) => i.key === view) ?? enabledItems.find((i) => i.key === "home");

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="px-4 py-4 flex items-center gap-3 border-b">
          <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center shrink-0">
            <Cloud className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold leading-tight text-brand-gradient">Escloud</div>
            <div className="text-[11px] text-muted-foreground">Private Cloud</div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5 scroll-thin">
          {enabledItems.map((item) => {
            const isHidden = navPrefs?.hiddenItems.includes(item.key);
            if (isHidden && !SYSTEM_ITEMS.includes(item.key)) return null;
            return (
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
                {item.isPrivate && (
                  <Badge variant="secondary" className="ml-auto text-[9px] px-1.5 py-0">PRIV</Badge>
                )}
              </button>
            );
          })}
        </nav>
        <div className="p-2 border-t space-y-1">
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

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border">
          <div className="flex items-center gap-2 px-3 md:px-6 py-3 pt-safe">
            <Button variant="ghost" size="sm" className="md:hidden h-9 w-9 p-0" onClick={() => setMobileOpen(!mobileOpen)}>
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
          {mobileOpen && (
            <div className="md:hidden border-t">
              <nav className="p-2 grid grid-cols-2 gap-1 max-h-[60vh] overflow-y-auto scroll-thin">
                {enabledItems.map((item) => {
                  const isHidden = navPrefs?.hiddenItems.includes(item.key);
                  if (isHidden && !SYSTEM_ITEMS.includes(item.key)) return null;
                  return (
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
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
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

        {/* Mobile bottom navigation — max 5 primary + More button */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 glass border-t border-border pb-safe">
          <div className="grid max-w-md mx-auto" style={{ gridTemplateColumns: `repeat(${Math.min(6, primaryNav.length + 1)}, minmax(0, 1fr))` }}>
            {primaryNav.map((item) => {
              const isActive = view === item.key;
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2 px-1 text-[10px] transition-colors min-w-0",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <div className="relative">
                    <Icon className={cn("w-5 h-5", isActive && "scale-110 transition-transform")} />
                    {item.isPrivate && (
                      <span className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-amber-500" />
                    )}
                  </div>
                  <span className="truncate max-w-full">{item.label}</span>
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

      {/* Mobile More sheet */}
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
