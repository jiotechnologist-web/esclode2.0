"use client";
import { useState } from "react";
import { useMediaList } from "../../shared/use-media-list";
import { MediaSkeleton, EmptyState, ViewToggle } from "../../shared/media-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Upload, Image as ImageIcon, Loader2 } from "lucide-react";
import { useUploadStore } from "@/stores/upload";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { toast } from "sonner";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export function PhotosView() {
  const user = useAuthStore((s) => s.user)!;
  const addFiles = useUploadStore((s) => s.addFiles);
  const setView = useUIStore((s) => s.setView);
  const setOverlay = useUIStore((s) => s.setOverlay);
  const canUpload = user.uploadEnabled && hasPermission(user.permissions, PERMISSIONS.UPLOAD_PHOTOS);

  const [view, setViewMode] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("createdAt:desc");

  const { items, loading, hasMore, loadMore, refresh } = useMediaList({
    type: "photo",
    search: search || undefined,
    sort,
    pageSize: 36,
  });

  return (
    <div className="px-3 md:px-6 py-4 md:py-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><ImageIcon className="w-5 h-5 text-primary" /> Photos</h1>
          <p className="text-xs text-muted-foreground">{items.length} photos</p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle view={view} onChange={setViewMode} />
          {canUpload && (
            <label className="cursor-pointer">
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length > 0) {
                    await addFiles(files, { visibility: "public" });
                    toast.success(`Uploading ${files.length} file(s)`);
                  }
                }}
              />
              <Button size="sm" className="bg-brand-gradient text-white hover:opacity-95">
                <Upload className="w-4 h-4 mr-1.5" /> Upload
              </Button>
            </label>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search photos…"
            className="pl-9"
          />
        </div>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt:desc">Newest first</SelectItem>
            <SelectItem value="createdAt:asc">Oldest first</SelectItem>
            <SelectItem value="name:asc">Name A-Z</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {Array.from({ length: 18 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={ImageIcon} title="No photos yet" description="Upload photos to build your gallery." />
      ) : view === "grid" ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {items.map((p) => (
            <div
              key={p.id}
              className={cn("aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer hover:opacity-90 transition-opacity group relative")}
              onClick={() => setOverlay("photo-viewer", { mediaId: p.id })}
            >
              {p.thumbnailUrl && (
                <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors opacity-0 group-hover:opacity-100 flex items-end p-2">
                <div className="text-white text-[10px] truncate">{p.name}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <MediaSkeleton view="list" />
      )}

      {hasMore && (
        <div className="flex justify-center mt-4">
          <Button onClick={loadMore} variant="outline">
            <Loader2 className="w-4 h-4 mr-2" /> Load more
          </Button>
        </div>
      )}
    </div>
  );
}
