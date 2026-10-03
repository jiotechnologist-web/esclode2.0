"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Upload, Video, Image as ImageIcon, FileText, Users, Lock,
  Settings as SettingsIcon, ChevronRight, HardDrive, StickyNote, Heart,
  Clock, Shield, Sparkles,
} from "lucide-react";
import type { ApiMediaItem } from "@/lib/types";
import { MediaGrid } from "../../shared/media-card";
import { formatBytes } from "../../shared/use-media-list";
import { useUploadStore } from "@/stores/upload";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { UploadButton } from "../../shared/upload-button";

export function HomeView() {
  const user = useAuthStore((s) => s.user)!;
  const refreshSession = useAuthStore((s) => s.refreshSession);
  const setView = useUIStore((s) => s.setView);
  const setOverlay = useUIStore((s) => s.setOverlay);
  const addFiles = useUploadStore((s) => s.addFiles);
  const [profile, setProfile] = useState<any>(null);
  const [recentVideos, setRecentVideos] = useState<ApiMediaItem[]>([]);
  const [recentPhotos, setRecentPhotos] = useState<ApiMediaItem[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    refreshSession();
    (async () => {
      try {
        const [p, v, ph] = await Promise.all([
          fetch("/api/profile").then((r) => r.json()),
          fetch("/api/media?type=video&pageSize=6").then((r) => r.json()),
          fetch("/api/media?type=photo&pageSize=6").then((r) => r.json()),
        ]);
        setProfile(p);
        setRecentVideos(v.items ?? []);
        setRecentPhotos(ph.items ?? []);
        if (p?.profile?.avatarUrl) setAvatarUrl(p.profile.avatarUrl + "&t=" + Date.now());
      } catch {}
    })();
  }, []);

  const storagePct = profile ? Math.min(100, (profile.storage.used / profile.storage.quota) * 100) : 0;
  const hasPrivateAccess = hasPermission(user.permissions, PERMISSIONS.PRIVATE_ACCESS);
  const canUploadAny = user.uploadEnabled && (
    hasPermission(user.permissions, PERMISSIONS.UPLOAD_VIDEOS) ||
    hasPermission(user.permissions, PERMISSIONS.UPLOAD_PHOTOS) ||
    hasPermission(user.permissions, PERMISSIONS.UPLOAD_DOCUMENTS) ||
    hasPermission(user.permissions, PERMISSIONS.UPLOAD_CONTACTS)
  );

  const stats = [
    { label: "Videos", value: profile?.storage.byType.find((b: any) => b.type === "video")?.count ?? 0, icon: Video, color: "from-violet-500 to-purple-600", view: "videos" as const },
    { label: "Photos", value: profile?.storage.byType.find((b: any) => b.type === "photo")?.count ?? 0, icon: ImageIcon, color: "from-amber-500 to-orange-500", view: "photos" as const },
    { label: "Docs", value: profile?.storage.byType.find((b: any) => b.type === "document")?.count ?? 0, icon: FileText, color: "from-sky-500 to-blue-600", view: "documents" as const },
    { label: "Contacts", value: profile?.storage.byType.find((b: any) => b.type === "contact")?.count ?? 0, icon: Users, color: "from-emerald-500 to-teal-600", view: "contacts" as const },
  ];

  const quickActions = [
    { label: "Notes", icon: StickyNote, color: "from-amber-500 to-yellow-500", view: "notes" as const, show: true },
    { label: "Favorites", icon: Heart, color: "from-rose-500 to-pink-600", view: "favorites" as const, show: true },
    { label: "Recent", icon: Clock, color: "from-cyan-500 to-teal-500", view: "recent" as const, show: true },
    { label: "Private", icon: Lock, color: "from-violet-500 to-purple-600", view: "private" as const, show: hasPrivateAccess },
    { label: "Settings", icon: SettingsIcon, color: "from-sky-500 to-blue-600", view: "settings" as const, show: true },
  ].filter(a => a.show);

  const openMedia = (m: ApiMediaItem) => {
    // Pass `visibility` so the viewer overlay fetches the correct list (private vs public).
    if (m.type === "video") setOverlay("video-player", { mediaId: m.id, visibility: m.visibility });
    else if (m.type === "photo") setOverlay("photo-viewer", { mediaId: m.id, visibility: m.visibility });
  };

  return (
    <div className="pb-6">
      {/* Profile Header — gradient banner */}
      <div className="relative bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 dark:from-emerald-900 dark:via-teal-900 dark:to-cyan-900 px-4 pt-5 pb-6 mt-3 rounded-2xl mx-3">
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-cyan-400/20 blur-xl pointer-events-none" />
        <div className="relative flex items-center gap-4">
          <Avatar className="w-16 h-16 border-4 border-white/30 shadow-lg shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={user.displayName ?? user.username} className="w-full h-full object-cover rounded-full" />
            ) : (
              <AvatarFallback className="bg-white/20 text-white text-2xl font-bold">
                {user.displayName?.[0]?.toUpperCase() ?? user.username[0]?.toUpperCase()}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white truncate">{user.displayName ?? user.username}</h1>
            <p className="text-sm text-white/70 truncate">{user.email}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant="secondary" className="text-[10px] capitalize bg-white/20 text-white border-0">{user.role}</Badge>
              {hasPrivateAccess && (
                <Badge variant="secondary" className="text-[10px] bg-amber-500/30 text-amber-100 border-0">
                  <Lock className="w-2.5 h-2.5 mr-0.5" />Private
                </Badge>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setView("settings")} className="text-white hover:bg-white/10 shrink-0">
            <SettingsIcon className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Content — proper spacing, no negative margins, no overlap */}
      <div className="px-3 pt-4 space-y-4">
        {/* Storage + Upload row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card className="shadow-md border-border/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0">
                  <HardDrive className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">Storage</div>
                  <div className="text-xs text-muted-foreground">{profile?.storage?.mediaCount ?? 0} items</div>
                </div>
              </div>
              <div className="relative h-2.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${storagePct}%` }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                />
              </div>
              <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                <span>{formatBytes(profile?.storage?.used ?? 0)} / {formatBytes(profile?.storage?.quota ?? 0)}</span>
                <span>{storagePct.toFixed(1)}% used</span>
              </div>
            </CardContent>
          </Card>

          {canUploadAny ? (
            <Card className="shadow-md border-border/50">
              <CardContent className="pt-4 pb-4 flex flex-col items-center justify-center">
                <UploadButton
                  label="Upload Files"
                  className="w-full h-11 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white border-0"
                  onFiles={async (files) => {
                    await addFiles(files, { visibility: "public" });
                    toast.success(`Uploading ${files.length} file(s)`);
                  }}
                />
                <p className="text-[10px] text-muted-foreground mt-2 text-center">Videos, photos, docs & contacts</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-md border-border/50">
              <CardContent className="pt-4 pb-4 flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center mb-2">
                  <Sparkles className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground text-center">Ask admin to enable uploads</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex sm:grid sm:grid-cols-5 gap-2 overflow-x-auto no-scrollbar pb-1">
          {quickActions.map((a, i) => (
            <motion.button
              key={a.label}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 * i, type: "spring", stiffness: 300, damping: 20 }}
              onClick={() => setView(a.view)}
              className="flex flex-col items-center gap-1.5 p-2 shrink-0 sm:w-auto"
            >
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${a.color} flex items-center justify-center shadow-md`}>
                <a.icon className="w-5 h-5 text-white" />
              </div>
              <span className="text-[11px] font-medium">{a.label}</span>
            </motion.button>
          ))}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              whileHover={{ y: -3 }}
              onClick={() => setView(s.view)}
              className="cursor-pointer"
            >
              <Card className="overflow-hidden shadow-md border-border/50">
                <div className={`h-1 bg-gradient-to-r ${s.color}`} />
                <CardContent className="flex items-center gap-3 pt-3 pb-3">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center shrink-0`}>
                    <s.icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xl font-bold leading-tight">{s.value}</div>
                    <div className="text-[11px] text-muted-foreground">{s.label}</div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Private Access Banner */}
        {hasPrivateAccess && (
          <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30 shadow-md">
            <CardContent className="py-3 flex items-center gap-3">
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0"
              >
                <Shield className="w-4 h-4 text-amber-500" />
              </motion.div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">Private Access</div>
                <div className="text-[11px] text-muted-foreground">Password-protected private content</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setView("private")} className="shrink-0">
                Open
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Recent Videos */}
        {recentVideos.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-violet-500" />
                <h2 className="font-semibold text-sm">Recent Videos</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setView("videos")} className="text-xs h-7">
                View all <ChevronRight className="w-3 h-3 ml-0.5" />
              </Button>
            </div>
            <MediaGrid items={recentVideos.slice(0, 5)} onChange={() => setView("home")} />
          </section>
        )}

        {/* Recent Photos */}
        {recentPhotos.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-500" />
                <h2 className="font-semibold text-sm">Recent Photos</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setView("photos")} className="text-xs h-7">
                View all <ChevronRight className="w-3 h-3 ml-0.5" />
              </Button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {recentPhotos.slice(0, 6).map((p, i) => (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  whileHover={{ scale: 1.04 }}
                  className="aspect-square rounded-xl overflow-hidden bg-muted cursor-pointer shadow-md relative"
                  onClick={() => openMedia(p)}
                >
                  {p.thumbnailUrl && <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" loading="lazy" />}
                  {p.visibility === "private" && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 backdrop-blur flex items-center justify-center">
                      <Lock className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {!profile?.storage?.mediaCount && (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center mx-auto mb-3 shadow-md">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <p className="text-sm font-medium">Welcome to Escloud!</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                Upload your first file to get started.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
