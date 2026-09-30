"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, Video, Image as ImageIcon, FileText, Users, Clock, Heart, ChevronRight, TrendingUp, Cloud, Lock } from "lucide-react";
import type { ApiMediaItem } from "@/lib/types";
import { MediaGrid } from "../../shared/media-card";
import { formatBytes } from "../../shared/use-media-list";
import { useUploadStore } from "@/stores/upload";

export function HomeView() {
  const user = useAuthStore((s) => s.user)!;
  const setView = useUIStore((s) => s.setView);
  const addFiles = useUploadStore((s) => s.addFiles);
  const [profile, setProfile] = useState<any>(null);
  const [recentVideos, setRecentVideos] = useState<ApiMediaItem[]>([]);
  const [recentPhotos, setRecentPhotos] = useState<ApiMediaItem[]>([]);
  const [continueWatching, setContinueWatching] = useState<ApiMediaItem[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [p, v, ph] = await Promise.all([
          fetch("/api/profile").then((r) => r.json()),
          fetch("/api/media?type=video&pageSize=8").then((r) => r.json()),
          fetch("/api/media?type=photo&pageSize=8").then((r) => r.json()),
        ]);
        setProfile(p);
        setRecentVideos(v.items ?? []);
        setRecentPhotos(ph.items ?? []);
      } catch {}
    })();
    // Continue watching
    (async () => {
      try {
        const r = await fetch("/api/media?recent=true&type=video&pageSize=6");
        const d = await r.json();
        setContinueWatching(d.items ?? []);
      } catch {}
    })();
  }, []);

  const storagePct = profile ? Math.min(100, (profile.storage.used / profile.storage.quota) * 100) : 0;

  const stats = [
    { label: "Videos", value: profile?.storage.byType.find((b: any) => b.type === "video")?.count ?? 0, icon: Video, color: "from-violet-500 to-fuchsia-500", view: "videos" as const },
    { label: "Photos", value: profile?.storage.byType.find((b: any) => b.type === "photo")?.count ?? 0, icon: ImageIcon, color: "from-amber-500 to-orange-500", view: "photos" as const },
    { label: "Documents", value: profile?.storage.byType.find((b: any) => b.type === "document")?.count ?? 0, icon: FileText, color: "from-sky-500 to-blue-500", view: "documents" as const },
    { label: "Contacts", value: profile?.storage.byType.find((b: any) => b.type === "contact")?.count ?? 0, icon: Users, color: "from-emerald-500 to-teal-500", view: "contacts" as const },
  ];

  return (
    <div className="px-3 md:px-6 py-4 md:py-6 space-y-6 max-w-7xl mx-auto">
      {/* Welcome header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Welcome, {user.displayName ?? user.username} 👋
          </h1>
          <p className="text-sm text-muted-foreground">Your private cloud at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="cursor-pointer">
            <input
              type="file"
              multiple
              className="hidden"
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length > 0) {
                  await addFiles(files, { visibility: "public" });
                  toast.success(`Uploading ${files.length} file(s)`);
                }
              }}
            />
            <Button className="bg-brand-gradient text-white hover:opacity-95">
              <Upload className="w-4 h-4 mr-2" /> Upload Files
            </Button>
          </label>
        </div>
      </div>

      {/* Storage card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-primary" />
              <CardTitle className="text-base">Storage</CardTitle>
            </div>
            <Badge variant="secondary">{formatBytes(profile?.storage.used ?? 0)} / {formatBytes(profile?.storage.quota ?? 0)}</Badge>
          </div>
          <CardDescription className="text-xs">{profile?.storage.mediaCount ?? 0} items in your cloud</CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={storagePct} className="h-2 brand-progress" />
          <div className="mt-2 text-xs text-muted-foreground flex justify-between">
            <span>{storagePct.toFixed(1)}% used</span>
            <span>{formatBytes(Math.max(0, (profile?.storage.quota ?? 0) - (profile?.storage.used ?? 0)))} remaining</span>
          </div>
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card
            key={s.label}
            className="cursor-pointer hover:shadow-md transition-shadow p-0 overflow-hidden"
            onClick={() => setView(s.view)}
          >
            <div className={`h-1 bg-gradient-to-r ${s.color}`} />
            <CardContent className="flex items-center gap-3 pt-4">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center`}>
                <s.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
              <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Continue Watching */}
      {continueWatching.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <h2 className="font-semibold">Continue Watching</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setView("recent")}>
              View all <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
          <MediaGrid items={continueWatching.slice(0, 5)} onChange={() => setView("home")} />
        </section>
      )}

      {/* Recent Videos */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Recent Videos</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setView("videos")}>
            View all <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
        {recentVideos.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-xl">
            No videos yet. Upload one to get started.
          </div>
        ) : (
          <MediaGrid items={recentVideos.slice(0, 5)} onChange={() => setView("home")} />
        )}
      </section>

      {/* Recent Photos */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Recent Photos</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setView("photos")}>
            View all <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
        {recentPhotos.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-xl">
            No photos yet.
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            {recentPhotos.slice(0, 6).map((p) => (
              <div
                key={p.id}
                className="aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-90"
                onClick={() => setView("photo-viewer", { mediaId: p.id })}
              >
                {p.thumbnailUrl && <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" loading="lazy" />}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

import { toast } from "sonner";
