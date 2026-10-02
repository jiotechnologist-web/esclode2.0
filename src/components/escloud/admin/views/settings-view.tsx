"use client";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Loader2, Settings as SettingsIcon, AlertTriangle, UserPlus, Video, Shield, Clock, HardDrive } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function AdminSettingsView() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/settings");
      const d = await r.json();
      setSettings(d.settings ?? {});
      setDirty(false);
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      if (!r.ok) throw new Error("Failed to save");
      toast.success("Settings saved successfully");
      setDirty(false);
      // Reload to confirm persistence
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const update = (key: string, value: string) => {
    setSettings((s) => ({ ...s, [key]: value }));
    setDirty(true);
  };

  const updateBool = (key: string, value: boolean) => {
    update(key, value ? "on" : "off");
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="h-32 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  return (
    <div className="px-3 md:px-6 py-4 md:py-6 max-w-4xl mx-auto space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center shadow-brand">
            <SettingsIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Admin Settings</h1>
            <p className="text-sm text-muted-foreground">Platform-wide configuration</p>
          </div>
        </div>
        {dirty && (
          <Button onClick={save} disabled={saving} className="bg-brand-gradient text-white btn-press">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        )}
      </motion.div>

      {/* Maintenance Mode */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className={cn("shadow-premium", settings["maintenance.mode"] === "on" && "border-amber-500/40 bg-amber-500/5")}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Maintenance Mode
            </CardTitle>
            <CardDescription className="text-xs">
              When enabled, normal users cannot log in. Admins retain full access.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-2 p-3 rounded-lg border">
              <div>
                <div className="text-sm font-medium">Enable Maintenance Mode</div>
                <div className="text-[11px] text-muted-foreground">Blocks non-admin user login and API access</div>
              </div>
              <Switch
                checked={settings["maintenance.mode"] === "on"}
                onCheckedChange={(v) => updateBool("maintenance.mode", v)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Maintenance Message</Label>
              <Input
                value={settings["maintenance.message"] ?? "Escloud is currently under maintenance. Please check back soon."}
                onChange={(e) => update("maintenance.message", e.target.value)}
                placeholder="Message shown to users during maintenance"
              />
            </div>
            {settings["maintenance.mode"] === "on" && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm text-amber-700 dark:text-amber-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Maintenance mode is currently ACTIVE. Non-admin users cannot log in.
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* User Registration */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="shadow-premium">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-500" />
              User Registration
            </CardTitle>
            <CardDescription className="text-xs">
              Allow new users to self-register accounts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-2 p-3 rounded-lg border">
              <div>
                <div className="text-sm font-medium">Enable Public Registration</div>
                <div className="text-[11px] text-muted-foreground">When enabled, anyone can create an account. When disabled, only admin can create users.</div>
              </div>
              <Switch
                checked={settings["registration.enabled"] === "on"}
                onCheckedChange={(v) => updateBool("registration.enabled", v)}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Application */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="shadow-premium">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <SettingsIcon className="w-4 h-4" />
              Application
            </CardTitle>
            <CardDescription className="text-xs">Branding and general configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Application Name</Label>
              <Input value={settings["app.name"] ?? "Escloud"} onChange={(e) => update("app.name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Default Theme</Label>
              <Select value={settings["app.theme"] ?? "system"} onValueChange={(v) => update("app.theme", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Video Streaming */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Card className="shadow-premium">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Video className="w-4 h-4 text-violet-500" />
              Video Streaming
            </CardTitle>
            <CardDescription className="text-xs">Advanced Video Play defaults</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ToggleRow label="Advanced Video Play (default)" desc="Smart adaptive buffering and quality" value={settings["video.advanced_default"] === "on"} onChange={(v) => updateBool("video.advanced_default", v)} />
            <ToggleRow label="Data Saver (default)" desc="Reduce bandwidth usage on mobile networks" value={settings["video.data_saver_default"] === "on"} onChange={(v) => updateBool("video.data_saver_default", v)} />
            <div className="space-y-1.5">
              <Label>Default Preferred Quality</Label>
              <Select value={settings["video.default_quality"] ?? "auto"} onValueChange={(v) => update("video.default_quality", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="1080p">1080p</SelectItem>
                  <SelectItem value="720p">720p</SelectItem>
                  <SelectItem value="480p">480p</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Default Pre-buffer Level</Label>
              <Select value={settings["video.pre_buffer_level"] ?? "adaptive"} onValueChange={(v) => update("video.pre_buffer_level", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="adaptive">Adaptive</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Security & Sessions */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Card className="shadow-premium">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-rose-500" />
              Security & Sessions
            </CardTitle>
            <CardDescription className="text-xs">Authentication and access control</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Session Timeout (minutes)</Label>
              <Input type="number" value={settings["session.timeout_minutes"] ?? "43200"} onChange={(e) => update("session.timeout_minutes", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>QR Login Expiry (seconds)</Label>
              <Input type="number" value={settings["qr.ttl_seconds"] ?? "180"} onChange={(e) => update("qr.ttl_seconds", e.target.value)} />
            </div>
            <ToggleRow label="Upload Approval Required (global)" desc="User uploads require admin approval before being visible" value={settings["upload.approval_required"] === "on"} onChange={(v) => updateBool("upload.approval_required", v)} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Save button at bottom too */}
      {dirty && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="sticky bottom-4 z-10">
          <div className="flex items-center justify-center gap-3 p-3 rounded-xl glass-strong border shadow-premium-lg">
            <Badge variant="outline" className="text-amber-600 border-amber-500/30">
              Unsaved changes
            </Badge>
            <Button onClick={save} disabled={saving} className="bg-brand-gradient text-white btn-press">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
              {saving ? "Saving…" : "Save All Changes"}
            </Button>
            <Button variant="ghost" onClick={() => load()} size="sm">Discard</Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function ToggleRow({ label, desc, value, onChange }: { label: string; desc?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg border">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {desc && <div className="text-[11px] text-muted-foreground">{desc}</div>}
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}
