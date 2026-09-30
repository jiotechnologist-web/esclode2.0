"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  QrCode, Navigation, Video as VideoIcon, Shield, Save, Loader2, Check, GripVertical, Eye, EyeOff, Camera,
} from "lucide-react";
import { toast } from "sonner";
import { QRScanner } from "../../qr/qr-scanner";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

interface NavPref {
  primaryItems: string[];
  hiddenItems: string[];
  preloadVideos: boolean;
  advancedVideoPlay: boolean;
  preferredQuality: string;
  autoQuality: boolean;
  preBufferLevel: string;
  dataSaver: boolean;
}

const ALL_NAV_ITEMS = [
  { key: "home", label: "Home", system: true },
  { key: "videos", label: "Videos", system: false },
  { key: "photos", label: "Photos", system: false },
  { key: "private", label: "Private", system: false },
  { key: "documents", label: "Documents", system: false },
  { key: "contacts", label: "Contacts", system: false },
  { key: "uploads", label: "Uploads", system: false },
  { key: "favorites", label: "Favorites", system: false },
  { key: "recent", label: "Recent", system: false },
  { key: "profile", label: "Profile", system: true },
];

export function SettingsView() {
  const user = useAuthStore((s) => s.user)!;
  const refreshSession = useAuthStore((s) => s.refreshSession);
  const setNavPrefs = useUIStore((s) => s.setNavPrefs);
  const setVideoPrefs = useUIStore((s) => s.setVideoPrefs);
  const [pref, setPref] = useState<NavPref | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      // Refresh session first so permissions are up-to-date
      await refreshSession();
      const r = await fetch("/api/user/nav-prefs");
      const d = await r.json();
      setPref({
        primaryItems: d.primaryItems ?? [],
        hiddenItems: d.hiddenItems ?? [],
        preloadVideos: !!d.preloadVideos,
        advancedVideoPlay: d.advancedVideoPlay ?? true,
        preferredQuality: d.preferredQuality ?? "auto",
        autoQuality: d.autoQuality ?? true,
        preBufferLevel: d.preBufferLevel ?? "adaptive",
        dataSaver: d.dataSaver ?? false,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (updates: Partial<NavPref>) => {
    setSaving(true);
    try {
      const body = { ...pref, ...updates };
      const r = await fetch("/api/user/nav-prefs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      // Update store
      setNavPrefs({ primaryItems: d.primaryItems ?? [], hiddenItems: d.hiddenItems ?? [] });
      setVideoPrefs({
        preloadVideos: d.preloadVideos,
        advancedVideoPlay: d.advancedVideoPlay,
        preferredQuality: d.preferredQuality,
        autoQuality: d.autoQuality,
        preBufferLevel: d.preBufferLevel,
        dataSaver: d.dataSaver,
      });
      toast.success("Settings saved");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !pref) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="h-32 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  const canScanQR = hasPermission(user.permissions, PERMISSIONS.QR_SCAN);

  const togglePrimary = (key: string) => {
    const item = ALL_NAV_ITEMS.find((i) => i.key === key);
    if (item?.system) {
      toast.error("System items (Home, Profile) are always shown");
      return;
    }
    const current = [...pref.primaryItems];
    const idx = current.indexOf(key);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      if (current.length >= 5) {
        toast.error("You can have at most 5 primary navigation items. Remove one first.");
        return;
      }
      current.push(key);
    }
    const newPref = { ...pref, primaryItems: current };
    setPref(newPref);
  };

  const toggleHidden = (key: string) => {
    const item = ALL_NAV_ITEMS.find((i) => i.key === key);
    if (item?.system) {
      toast.error("System items cannot be hidden");
      return;
    }
    const current = [...pref.hiddenItems];
    const idx = current.indexOf(key);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      // If hiding, also remove from primary
      const newPrimary = pref.primaryItems.filter((k) => k !== key);
      setPref({ ...pref, hiddenItems: current, primaryItems: newPrimary });
      return;
    }
    setPref({ ...pref, hiddenItems: current });
  };

  const moveItem = (key: string, dir: -1 | 1) => {
    const arr = [...pref.primaryItems];
    const i = arr.indexOf(key);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setPref({ ...pref, primaryItems: arr });
  };

  return (
    <div className="px-3 md:px-6 py-4 md:py-6 max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Personalize your Escloud experience</p>
      </div>

      <Tabs defaultValue="navigation">
        <TabsList className="grid grid-cols-3 w-full sm:w-auto">
          <TabsTrigger value="navigation" className="text-xs sm:text-sm"><Navigation className="w-3.5 h-3.5 mr-1.5" />Navigation</TabsTrigger>
          <TabsTrigger value="video" className="text-xs sm:text-sm"><VideoIcon className="w-3.5 h-3.5 mr-1.5" />Video</TabsTrigger>
          <TabsTrigger value="security" className="text-xs sm:text-sm"><Shield className="w-3.5 h-3.5 mr-1.5" />Security</TabsTrigger>
        </TabsList>

        {/* Navigation tab */}
        <TabsContent value="navigation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Navigation className="w-4 h-4" />Mobile Navigation</CardTitle>
              <CardDescription className="text-xs">Choose up to 5 items for the primary bottom bar. Others go to "More" menu.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-2">Primary Items ({pref.primaryItems.length}/5)</div>
                {pref.primaryItems.length === 0 ? (
                  <div className="text-xs text-muted-foreground p-3 border border-dashed rounded-lg">
                    No primary items selected. Default order will be used.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {pref.primaryItems.map((key, i) => {
                      const item = ALL_NAV_ITEMS.find((x) => x.key === key);
                      if (!item) return null;
                      return (
                        <div key={key} className="flex items-center gap-2 p-2 rounded-lg border bg-card">
                          <GripVertical className="w-4 h-4 text-muted-foreground" />
                          <span className="flex-1 text-sm">{item.label}{item.system && <Badge variant="secondary" className="ml-2 text-[9px]">System</Badge>}</span>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveItem(key, -1)} disabled={i === 0}>
                            ↑
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveItem(key, 1)} disabled={i === pref.primaryItems.length - 1}>
                            ↓
                          </Button>
                          {!item.system && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-500" onClick={() => togglePrimary(key)}>
                              <EyeOff className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <div className="text-sm font-medium mb-2">Available Items</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ALL_NAV_ITEMS.map((item) => {
                    const isPrimary = pref.primaryItems.includes(item.key);
                    const isHidden = pref.hiddenItems.includes(item.key);
                    return (
                      <button
                        key={item.key}
                        onClick={() => (isHidden ? toggleHidden(item.key) : togglePrimary(item.key))}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm transition-colors ${
                          isPrimary ? "border-primary bg-primary/5 text-primary" : isHidden ? "border-muted opacity-50" : "hover:bg-accent"
                        }`}
                      >
                        {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span className="truncate">{item.label}</span>
                        {item.system && <Badge variant="secondary" className="text-[9px] ml-auto">Sys</Badge>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button onClick={() => save(pref)} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
                Save Navigation
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Video tab */}
        <TabsContent value="video" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><VideoIcon className="w-4 h-4" />Video Playback</CardTitle>
              <CardDescription className="text-xs">Control how videos load and play</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ToggleRow
                label="Preload Videos"
                desc="Pre-buffer video content for smoother playback"
                value={pref.preloadVideos}
                onChange={(v) => { const np = { ...pref, preloadVideos: v }; setPref(np); save({ preloadVideos: v }); }}
              />
              <ToggleRow
                label="Advanced Video Play"
                desc="Smart adaptive buffering and quality"
                value={pref.advancedVideoPlay}
                onChange={(v) => { setPref({ ...pref, advancedVideoPlay: v }); save({ advancedVideoPlay: v }); }}
              />
              <ToggleRow
                label="Auto Quality"
                desc="Automatically adjust quality based on network"
                value={pref.autoQuality}
                onChange={(v) => { setPref({ ...pref, autoQuality: v }); save({ autoQuality: v }); }}
              />
              <ToggleRow
                label="Data Saver"
                desc="Reduce bandwidth usage on mobile networks"
                value={pref.dataSaver}
                onChange={(v) => { setPref({ ...pref, dataSaver: v }); save({ dataSaver: v }); }}
              />
              <div className="space-y-1.5">
                <Label>Preferred quality</Label>
                <Select
                  value={pref.preferredQuality}
                  onValueChange={(v) => { setPref({ ...pref, preferredQuality: v }); save({ preferredQuality: v }); }}
                >
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
                <Label>Pre-buffer level</Label>
                <Select
                  value={pref.preBufferLevel}
                  onValueChange={(v) => { setPref({ ...pref, preBufferLevel: v }); save({ preBufferLevel: v }); }}
                >
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
        </TabsContent>

        {/* Security / QR tab */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><QrCode className="w-4 h-4" />QR Code Scanner</CardTitle>
              <CardDescription className="text-xs">Scan a PC login QR code from your mobile device</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!canScanQR ? (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm text-amber-700 dark:text-amber-400">
                  You don't have permission to scan QR codes. Ask your administrator to grant the "Scan QR Codes" permission.
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Open the Escloud login page on your PC, click "Scan QR to Login", then point your camera at the QR code shown there.
                  </p>
                  <Button onClick={() => setShowScanner(true)} className="bg-brand-gradient text-white">
                    <Camera className="w-4 h-4 mr-2" /> Open Scanner
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {showScanner && (
        <QRScanner
          onClose={() => setShowScanner(false)}
          onScanned={(token) => {
            setShowScanner(false);
            toast.success("QR scanned — authorizing PC login…");
          }}
        />
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
