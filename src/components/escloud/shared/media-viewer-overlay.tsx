"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useUIStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RotateCcw,
  Maximize,
  Download,
  Heart,
  Play,
  Pause,
  Volume2,
  VolumeX,
  PictureInPicture2,
  Settings,
  Info,
  Lock,
  Users,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatBytes, formatDate, formatRelative, saveWatchProgress } from "./use-media-list";
import type { ApiMediaItem } from "@/lib/types";

interface Props {}

export function MediaViewerOverlay({}: Props) {
  const overlay = useUIStore((s) => s.overlay);
  const params = useUIStore((s) => s.params);
  const closeOverlay = useUIStore((s) => s.closeOverlay);
  const goBack = useUIStore((s) => s.goBack);
  const user = useAuthStore((s) => s.user);

  const [items, setItems] = useState<ApiMediaItem[]>([]);
  const [index, setIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAccessPanel, setShowAccessPanel] = useState(false);
  const [accessUsers, setAccessUsers] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  // Load media siblings + access info when overlay opens
  useEffect(() => {
    if (!overlay) return;
    const mediaId = params.mediaId as string;
    if (!mediaId) {
      closeOverlay();
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // Determine which type filter to use
        const typeFilter = overlay === "video-player" ? "video" : overlay === "photo-viewer" ? "photo" : undefined;
        // If user is admin, we use admin/users/[id]/content if ownerId is provided, else /api/media
        const url = typeFilter
          ? `/api/media?type=${typeFilter}&pageSize=200`
          : `/api/media?pageSize=200`;
        const r = await fetch(url);
        const d = await r.json();
        if (cancelled) return;
        const list: ApiMediaItem[] = d.items ?? [];
        setItems(list);
        const i = list.findIndex((m) => m.id === mediaId);
        if (i >= 0) {
          setIndex(i);
        } else {
          // Try to fetch just this one media
          // For admin: if media not in user's view, fetch from admin stats or skip
          setItems([]);
          setIndex(-1);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [overlay, params.mediaId]);

  // Close on Escape (also handled by goBack)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        goBack();
      } else if (e.key === "ArrowRight") {
        next();
      } else if (e.key === "ArrowLeft") {
        prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, index, goBack]);

  const next = useCallback(() => {
    if (items.length === 0) return;
    setIndex((i) => (i + 1) % items.length);
  }, [items]);

  const prev = useCallback(() => {
    if (items.length === 0) return;
    setIndex((i) => (i - 1 + items.length) % items.length);
  }, [items]);

  if (!overlay || loading) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-white" />
      </div>
    );
  }

  if (index < 0 || items.length === 0) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center text-white p-6">
        <p className="text-sm">Media not found or you don't have access.</p>
        <Button variant="outline" className="mt-4 text-white border-white/30" onClick={goBack}>
          Close
        </Button>
      </div>
    );
  }

  const media = items[index];
  const isVideo = media.type === "video";
  const isAdmin = user?.role === "admin";

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col select-none">
      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 z-20 px-3 py-3 pt-safe bg-gradient-to-b from-black/70 to-transparent flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 shrink-0" onClick={goBack}>
          <X className="w-5 h-5" />
        </Button>
        <div className="text-white text-sm font-medium truncate flex-1 text-center">{media.name}</div>
        <div className="flex items-center gap-1 shrink-0">
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              onClick={() => {
                setShowAccessPanel((v) => !v);
                if (!showAccessPanel) loadAccessInfo(media.id);
              }}
              title="Manage Private Access"
            >
              <Users className="w-5 h-5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setShowInfo((v) => !v)} title="Info">
            <Info className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10"
            onClick={() => window.open(`/api/media/${media.id}/download`, "_blank")}
            title="Download"
          >
            <Download className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Left/right arrows */}
      {items.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 h-12 w-12 z-20"
            onClick={prev}
          >
            <ChevronLeft className="w-8 h-8" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-white hover:bg-white/10 h-12 w-12 z-20"
            onClick={next}
          >
            <ChevronRight className="w-8 h-8" />
          </Button>
        </>
      )}

      {/* Main media display */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        {isVideo ? (
          <VideoView media={media} onClose={goBack} />
        ) : (
          <PhotoView media={media} />
        )}
      </div>

      {/* Info panel */}
      {showInfo && (
        <div className="absolute top-16 right-3 z-30 bg-black/90 backdrop-blur-md text-white p-4 rounded-xl border border-white/10 w-72 max-w-[90vw] space-y-2 text-xs max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">{media.name}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-white" onClick={() => setShowInfo(false)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <InfoRow label="Type" value={media.type} />
          <InfoRow label="Size" value={formatBytes(media.size)} />
          <InfoRow label="MIME" value={media.mimeType} />
          {media.width && media.height && <InfoRow label="Dimensions" value={`${media.width}×${media.height}`} />}
          {media.duration && <InfoRow label="Duration" value={`${Math.floor(media.duration / 60)}:${String(Math.floor(media.duration % 60)).padStart(2, "0")}`} />}
          <InfoRow label="Visibility" value={media.visibility} />
          <InfoRow label="Owner" value={media.ownerName ?? "—"} />
          <InfoRow label="Uploaded" value={`${formatDate(media.createdAt)} (${formatRelative(media.createdAt)})`} />
          {media.docType && <InfoRow label="Document type" value={media.docType.toUpperCase()} />}
        </div>
      )}

      {/* Admin: Manage Private Access panel */}
      {showAccessPanel && isAdmin && (
        <PrivateAccessPanel
          media={media}
          accessUsers={accessUsers}
          allUsers={allUsers}
          onAllUsers={setAllUsers}
          onAccessUsers={setAccessUsers}
          onClose={() => setShowAccessPanel(false)}
        />
      )}

      {/* Counter */}
      {items.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full">
          {index + 1} / {items.length}
        </div>
      )}
    </div>
  );

  async function loadAccessInfo(mediaId: string) {
    try {
      const [accR, usersR] = await Promise.all([
        fetch(`/api/media/${mediaId}/access`).then((r) => r.json()),
        fetch("/api/admin/users").then((r) => r.json()),
      ]);
      setAccessUsers(accR.users ?? []);
      setAllUsers((usersR.users ?? []).filter((u: any) => u.role !== "admin"));
    } catch (e) {
      toast.error("Failed to load access info");
    }
  }
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-white/50">{label}</span>
      <span className="text-white/90 text-right break-words">{value}</span>
    </div>
  );
}

function VideoView({ media, onClose }: { media: ApiMediaItem; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(media.duration ?? 0);
  const [fullscreen, setFullscreen] = useState(false);
  const [rate, setRate] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoPrefs = useUIStore((s) => s.videoPrefs);

  // Set preload attribute based on user setting
  const preloadAttr = videoPrefs?.preloadVideos ? "auto" : "metadata";

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = rate;
    v.volume = volume;
    v.muted = muted;
  }, [rate, volume, muted]);

  // Save watch progress periodically
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const id = setInterval(() => {
      if (!v.paused) saveWatchProgress(media.id, v.currentTime, v.duration);
    }, 5000);
    return () => clearInterval(id);
  }, [media.id]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().then(() => setFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.();
      setFullscreen(false);
    }
  };

  const seek = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, t));
  };

  const skip = (delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
  };

  return (
    <div ref={containerRef} className="relative w-full h-full flex items-center justify-center">
      <video
        ref={videoRef}
        src={`/api/media/${media.id}/stream`}
        className="w-full h-full object-contain"
        playsInline
        preload={preloadAttr as any}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onEnded={() => saveWatchProgress(media.id, videoRef.current?.duration ?? 0, videoRef.current?.duration)}
        crossOrigin="anonymous"
      />
      {/* Center play button when paused */}
      {!playing && (
        <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center z-10">
          <div className="w-20 h-20 rounded-full bg-white/15 backdrop-blur-md flex items-center justify-center">
            <Play className="w-10 h-10 text-white fill-white" />
          </div>
        </button>
      )}
      {/* Bottom controls */}
      <div className="absolute bottom-0 inset-x-0 z-20 px-3 pb-3 pb-safe bg-gradient-to-t from-black/80 to-transparent">
        {/* Progress */}
        <div className="mb-2">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={time}
            onChange={(e) => seek(Number(e.target.value))}
            className="w-full h-1 accent-white cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-white/60 mt-1">
            <span>{Math.floor(time / 60)}:{String(Math.floor(time % 60)).padStart(2, "0")}</span>
            <span>{Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, "0")}</span>
          </div>
        </div>
        {/* Buttons */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => skip(-10)}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={togglePlay}>
            {playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
          </Button>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => skip(10)}>
            <ChevronRight className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-1 ml-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              onClick={() => {
                setMuted((m) => !m);
                setVolume((v) => (v === 0 ? 1 : v));
              }}
            >
              {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </Button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                setMuted(v === 0);
              }}
              className="w-16 h-1 accent-white"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <select
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="bg-white/10 text-white text-xs rounded px-2 py-1 border-0"
            >
              <option value="0.5">0.5×</option>
              <option value="0.75">0.75×</option>
              <option value="1">1×</option>
              <option value="1.25">1.25×</option>
              <option value="1.5">1.5×</option>
              <option value="2">2×</option>
            </select>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              onClick={async () => {
                try {
                  if (videoRef.current && (videoRef.current as any).requestPictureInPicture) {
                    await (videoRef.current as any).requestPictureInPicture();
                  }
                } catch {
                  toast.error("PiP not supported");
                }
              }}
            >
              <PictureInPicture2 className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={toggleFullscreen}>
              <Maximize className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhotoView({ media }: { media: ApiMediaItem }) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const startPanRef = useRef({ x: 0, y: 0 });

  const onMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      dragRef.current = { x: e.clientX, y: e.clientY };
      startPanRef.current = { x: pan.x, y: pan.y };
    }
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (dragRef.current && zoom > 1) {
      setPan({
        x: startPanRef.current.x + (e.clientX - dragRef.current.x),
        y: startPanRef.current.y + (e.clientY - dragRef.current.y),
      });
    }
  };
  const onMouseUp = () => {
    dragRef.current = null;
  };

  const onDoubleClick = () => {
    setZoom((z) => (z > 1 ? 1 : 2.5));
    setPan({ x: 0, y: 0 });
  };

  return (
    <div
      className="relative w-full h-full flex items-center justify-center overflow-hidden"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onDoubleClick={onDoubleClick}
    >
      <img
        src={`/api/media/${media.id}/stream`}
        alt={media.name}
        className="max-w-full max-h-full object-contain transition-transform duration-150"
        style={{
          transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg)`,
          transformOrigin: "center",
          willChange: "transform",
          cursor: zoom > 1 ? "grab" : "default",
        }}
        draggable={false}
      />
      {/* Bottom controls */}
      <div className="absolute bottom-0 inset-x-0 z-20 px-3 py-3 pb-safe bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center gap-2">
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setZoom((z) => Math.max(1, z - 0.5))}>
          <ZoomOut className="w-5 h-5" />
        </Button>
        <div className="text-white text-xs w-16 text-center">{Math.round(zoom * 100)}%</div>
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setZoom((z) => Math.min(5, z + 0.5))}>
          <ZoomIn className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setRotation((r) => r - 90)}>
          <RotateCcw className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setRotation((r) => r + 90)}>
          <RotateCw className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}

function PrivateAccessPanel({
  media,
  accessUsers,
  allUsers,
  onAllUsers,
  onAccessUsers,
  onClose,
}: {
  media: ApiMediaItem;
  accessUsers: any[];
  allUsers: any[];
  onAllUsers: (u: any[]) => void;
  onAccessUsers: (u: any[]) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const accessIds = new Set(accessUsers.map((u) => u.id));

  const filtered = allUsers.filter((u) =>
    u.username?.toLowerCase().includes(filter.toLowerCase()) ||
    u.email?.toLowerCase().includes(filter.toLowerCase()) ||
    u.displayName?.toLowerCase().includes(filter.toLowerCase())
  );

  const grant = async (uid: string) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/media/${media.id}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: [uid], action: "add", makePrivate: media.visibility !== "private" ? true : false }),
      });
      if (!r.ok) throw new Error("Failed");
      toast.success("Access granted");
      // Refresh
      const acc = await fetch(`/api/media/${media.id}/access`).then((r) => r.json());
      onAccessUsers(acc.users ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (uid: string) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/media/${media.id}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: [uid], action: "remove" }),
      });
      if (!r.ok) throw new Error("Failed");
      toast.success("Access revoked");
      const acc = await fetch(`/api/media/${media.id}/access`).then((r) => r.json());
      onAccessUsers(acc.users ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute top-16 right-3 z-30 bg-black/95 backdrop-blur-md text-white p-4 rounded-xl border border-white/10 w-80 max-w-[90vw] max-h-[70vh] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="font-medium text-sm flex items-center gap-1.5">
          <Lock className="w-4 h-4" />
          Private Access
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-white" onClick={onClose}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
      <div className="text-xs text-white/50 mb-3">
        {media.visibility === "private" ? "Private content" : "Public content"} — granted to {accessUsers.length} user(s)
      </div>
      <Input
        placeholder="Filter users…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="bg-white/5 border-white/10 text-white text-xs mb-2 h-8"
      />
      <div className="flex-1 overflow-y-auto space-y-1 scroll-thin">
        {filtered.length === 0 && <div className="text-xs text-white/50 text-center py-4">No users found</div>}
        {filtered.map((u) => {
          const has = accessIds.has(u.id);
          return (
            <div key={u.id} className="flex items-center gap-2 p-2 rounded hover:bg-white/5">
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{u.displayName ?? u.username}</div>
                <div className="text-[10px] text-white/50 truncate">{u.email}</div>
              </div>
              <Button
                size="sm"
                variant={has ? "outline" : "default"}
                className={`h-7 text-xs ${has ? "border-white/30 text-white" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}
                disabled={busy}
                onClick={() => (has ? revoke(u.id) : grant(u.id))}
              >
                {has ? "Revoke" : "Grant"}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
