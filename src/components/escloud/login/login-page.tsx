"use client";
import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "@/stores/auth";
import { useUIStore, type LoginView } from "@/stores/ui";
import { QRLoginPanel } from "@/components/escloud/qr/qr-login-panel";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Eye, EyeOff, Lock, User as UserIcon, Shield, Loader2, ArrowLeft, QrCode, Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoginPage() {
  const view = useUIStore((s) => s.view) as LoginView;
  const setView = useUIStore((s) => s.setView);
  const theme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const fetchSession = useAuthStore((s) => s.fetchSession);

  // 10-tap shortcut to reveal admin login
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<any>(null);
  const [tapProgress, setTapProgress] = useState(0);

  const handleLoginAreaTap = () => {
    tapCountRef.current += 1;
    setTapProgress(tapCountRef.current);
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => {
      tapCountRef.current = 0;
      setTapProgress(0);
    }, 1200);
    if (tapCountRef.current >= 10) {
      tapCountRef.current = 0;
      setTapProgress(0);
      setView("admin-login");
      toast.success("Admin entry revealed", { description: "Please authenticate with administrator credentials." });
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-50 via-background to-cyan-50 dark:from-emerald-950/30 dark:via-background dark:to-cyan-950/30">
      {/* Decorative background blobs */}
      <div className="absolute -top-20 -left-20 w-96 h-96 rounded-full bg-emerald-500/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-20 w-[28rem] h-[28rem] rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 w-72 h-72 rounded-full bg-teal-400/10 blur-3xl pointer-events-none" />

      {/* Theme switcher */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-1 rounded-full bg-card/80 backdrop-blur border p-1 shadow-sm">
        <button
          onClick={() => setTheme("light")}
          className={cn("p-2 rounded-full transition-colors", theme === "light" ? "bg-primary/15 text-primary" : "text-muted-foreground")}
          aria-label="Light theme"
        >
          <Sun className="w-4 h-4" />
        </button>
        <button
          onClick={() => setTheme("dark")}
          className={cn("p-2 rounded-full transition-colors", theme === "dark" ? "bg-primary/15 text-primary" : "text-muted-foreground")}
          aria-label="Dark theme"
        >
          <Moon className="w-4 h-4" />
        </button>
        <button
          onClick={() => setTheme("system")}
          className={cn("p-2 rounded-full transition-colors", theme === "system" ? "bg-primary/15 text-primary" : "text-muted-foreground")}
          aria-label="System theme"
        >
          <Monitor className="w-4 h-4" />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {view === "admin-login" ? (
          <motion.div
            key="admin"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="relative z-10 w-full max-w-md px-4"
          >
            <AdminLoginCard onBack={() => setView("user-login")} />
          </motion.div>
        ) : view === "qr-login" ? (
          <motion.div
            key="qr"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="relative z-10 w-full max-w-md px-4"
          >
            <QRLoginPanel onBack={() => setView("user-login")} onSuccess={fetchSession} />
          </motion.div>
        ) : (
          <motion.div
            key="user"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="relative z-10 w-full max-w-md px-4"
          >
            <UserLoginCard
              onTap={handleLoginAreaTap}
              tapProgress={tapProgress}
              onShowQR={() => setView("qr-login")}
              onSuccess={fetchSession}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UserLoginCard({
  onTap,
  tapProgress,
  onShowQR,
  onSuccess,
}: {
  onTap: () => void;
  tapProgress: number;
  onShowQR: () => void;
  onSuccess: () => void;
}) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const setView = useUIStore((s) => s.setView);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) return;
    setLoading(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast.error(data.error ?? "Login failed");
        return;
      }
      toast.success("Welcome back!");
      onSuccess();
    } catch (e: any) {
      toast.error(e?.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-xl border-border/60 backdrop-blur-md bg-card/95">
      {/* The brand header is the tappable area for admin reveal */}
      <div
        onClick={onTap}
        onTouchStart={onTap}
        className="pt-8 pb-4 cursor-pointer select-none flex flex-col items-center gap-3 relative"
        role="button"
        aria-label="Login User"
      >
        <div className="w-16 h-16 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <img src="/escloud-logo.svg" alt="Escloud" className="w-10 h-10" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-brand-gradient">Escloud</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Private Cloud · Media · Documents · Contacts</p>
        </div>
        {/* Tiny progress hint, only visible during tapping */}
        {tapProgress > 0 && tapProgress < 10 && (
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-0.5 bg-muted overflow-hidden rounded-full">
            <div
              className="h-full brand-progress transition-all"
              style={{ width: `${(tapProgress / 10) * 100}%` }}
            />
          </div>
        )}
      </div>

      <CardContent className="pt-2 pb-6">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="identifier">Username or Email</Label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                placeholder="you@example.com"
                className="pl-9"
                disabled={loading}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                className="pl-9 pr-10"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-brand-gradient text-white hover:opacity-95">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
          </Button>
        </form>

        <div className="mt-6 grid grid-cols-1 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onShowQR}
            className="w-full"
          >
            <QrCode className="w-4 h-4 mr-2" />
            Scan QR to Login (PC)
          </Button>
        </div>

        <div className="mt-4 text-xs text-center text-muted-foreground">
          Demo users: <code className="px-1.5 py-0.5 rounded bg-muted">demo@escloud.local</code> /{" "}
          <code className="px-1.5 py-0.5 rounded bg-muted">demo123</code>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminLoginCard({ onBack }: { onBack: () => void }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const fetchSession = useAuthStore((s) => s.fetchSession);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) return;
    setLoading(true);
    try {
      const r = await fetch("/api/auth/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast.error(data.error ?? "Admin login failed");
        return;
      }
      toast.success("Administrator authenticated");
      fetchSession();
    } catch (e: any) {
      toast.error(e?.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-2xl border-emerald-500/30 bg-card/95 backdrop-blur-md">
      <CardHeader className="text-center pt-8">
        <div className="mx-auto w-14 h-14 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
          <Shield className="w-7 h-7 text-emerald-500" />
        </div>
        <CardTitle className="mt-3">Administrator Access</CardTitle>
        <CardDescription>Restricted area · All actions are logged</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="admin-id">Admin Email or Username</Label>
            <Input
              id="admin-id"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="admin@example.com"
              autoComplete="username"
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-pwd">Password</Label>
            <div className="relative">
              <Input
                id="admin-pwd"
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
            Authenticate Administrator
          </Button>
        </form>
      </CardContent>
      <CardFooter className="pb-6 flex flex-col gap-3">
        <Button variant="ghost" onClick={onBack} className="w-full">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to user login
        </Button>
        <div className="text-[11px] text-muted-foreground text-center">
          Default admin: <code className="px-1.5 py-0.5 rounded bg-muted">jiotechnologist@gmail.com</code> /{" "}
          <code className="px-1.5 py-0.5 rounded bg-muted">741504</code>
        </div>
      </CardFooter>
    </Card>
  );
}
