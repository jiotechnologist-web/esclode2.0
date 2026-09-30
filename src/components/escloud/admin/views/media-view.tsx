"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Loader2, Trash2, Download, Lock, Globe, Filter, Eye, Users, ChevronRight,
} from "lucide-react";
import { useMediaList, formatBytes, formatRelative, deleteMedia } from "../../shared/use-media-list";
import { MediaSkeleton, EmptyState } from "../../shared/media-card";
import { useUIStore } from "@/stores/ui";
import { toast } from "sonner";
import type { ApiMediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AdminMediaView() {
  const [type, setType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState<string>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const setOverlay = useUIStore((s) => s.setOverlay);

  const { items, loading, refresh, hasMore, loadMore } = useMediaList({
    type: type && type !== "all" ? type : undefined,
    visibility: visibility && visibility !== "all" ? visibility : undefined,
    search: search || undefined,
    pageSize: 50,
  });

  const toggleSelect = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const bulkDelete = async () => {
    if (selected.length === 0) return;
    if (!confirm(`Delete ${selected.length} media file(s)? This is irreversible.`)) return;
    let ok = 0, fail = 0;
    for (const id of selected) {
      try {
        await deleteMedia(id);
        ok++;
      } catch {
        fail++;
      }
    }
    toast.success(`Deleted ${ok}${fail ? `, ${fail} failed` : ""}`);
    setSelected([]);
    refresh();
  };

  const openMedia = (m: ApiMediaItem) => {
    if (m.type === "video") setOverlay("video-player", { mediaId: m.id });
    else if (m.type === "photo") setOverlay("photo-viewer", { mediaId: m.id });
    else if (m.type === "document") {
      // Open documents in new tab (PDF viewer) if possible
      window.open(`/api/media/${m.id}/download`, "_blank");
    } else {
      toast.info("Use the download button to save this file");
    }
  };

  return (
    <div className="px-3 md:px-6 py-4 md:py-6 max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Media Management</h1>
        <p className="text-sm text-muted-foreground">All media across all users · click any row to preview</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search media…" className="pl-9" />
        </div>
        <Select value={type} onValueChange={(v) => setType(v)}>
          <SelectTrigger className="sm:w-36">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
            <SelectItem value="photo">Photos</SelectItem>
            <SelectItem value="document">Documents</SelectItem>
            <SelectItem value="contact">Contacts</SelectItem>
          </SelectContent>
        </Select>
        <Select value={visibility} onValueChange={(v) => setVisibility(v)}>
          <SelectTrigger className="sm:w-36">
            <SelectValue placeholder="Visibility" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All visibility</SelectItem>
            <SelectItem value="public">Public</SelectItem>
            <SelectItem value="private">Private</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk actions */}
      {selected.length > 0 && (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <span className="text-sm font-medium">{selected.length} selected</span>
          <div className="flex-1" />
          <Button size="sm" variant="destructive" onClick={bulkDelete}>
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete selected
          </Button>
        </div>
      )}

      {loading ? (
        <MediaSkeleton />
      ) : items.length === 0 ? (
        <EmptyState icon={Filter} title="No media found" description="Try adjusting filters or upload new content." />
      ) : (
        <>
          {/* Grid view (cards) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {items.map((m) => (
              <Card
                key={m.id}
                className="group relative overflow-hidden hover:shadow-lg transition-shadow cursor-pointer p-0"
                onClick={() => openMedia(m)}
              >
                <div className="relative aspect-video bg-muted overflow-hidden">
                  {m.thumbnailUrl ? (
                    <img
                      src={m.thumbnailUrl}
                      alt={m.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-2xl uppercase text-muted-foreground font-bold">
                        {m.docType ?? m.type.slice(0, 4)}
                      </span>
                    </div>
                  )}
                  {/* Status badges */}
                  <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
                    {m.visibility === "private" ? (
                      <Badge className="text-[10px] bg-black/70 hover:bg-black/70 text-white">
                        <Lock className="w-2.5 h-2.5 mr-0.5" /> PRIVATE
                      </Badge>
                    ) : (
                      <Badge className="text-[10px] bg-black/70 hover:bg-black/70 text-white">
                        <Globe className="w-2.5 h-2.5 mr-0.5" /> PUBLIC
                      </Badge>
                    )}
                  </div>
                  {m.type === "video" && m.duration && (
                    <div className="absolute bottom-1.5 right-1.5 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded">
                      {Math.floor(m.duration / 60)}:{String(Math.floor(m.duration % 60)).padStart(2, "0")}
                    </div>
                  )}
                  {/* Quick action buttons */}
                  <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7 bg-black/70 hover:bg-black/90 text-white border-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`/api/media/${m.id}/download`, "_blank");
                      }}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {/* Click-to-preview overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
                      <Eye className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>
                <div className="p-3">
                  <div className="font-medium text-sm truncate">{m.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-1 truncate flex items-center gap-1">
                    <Users className="w-2.5 h-2.5" />
                    {m.ownerName ?? "—"}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {formatBytes(m.size)} · {formatRelative(m.createdAt)}
                  </div>
                </div>
                {/* Select checkbox */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(m.id);
                  }}
                  className={cn(
                    "absolute top-1.5 left-1.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                    selected.includes(m.id)
                      ? "bg-emerald-500 border-emerald-500 text-white opacity-100"
                      : "border-white/70 bg-black/40 opacity-0 group-hover:opacity-100"
                  )}
                  style={{ left: m.visibility === "private" ? "70px" : "8px" }}
                >
                  {selected.includes(m.id) && (
                    <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                  )}
                </button>
              </Card>
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={loadMore}><Loader2 className="w-4 h-4 mr-2" /> Load more</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
