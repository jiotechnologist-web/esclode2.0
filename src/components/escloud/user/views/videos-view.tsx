"use client";
import { useEffect, useState } from "react";
import { useMediaList } from "../../shared/use-media-list";
import { MediaGrid, MediaSkeleton, EmptyState, ViewToggle } from "../../shared/media-card";
import { useBulkActions } from "../../shared/use-bulk-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Video as VideoIcon, Loader2, Smartphone, CheckSquare, Square,
  X, Trash2, Lock, Globe, Download,
} from "lucide-react";
import { useUploadStore } from "@/stores/upload";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { toast } from "sonner";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { UploadButton } from "../../shared/upload-button";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function VideosView() {
  const user = useAuthStore((s) => s.user)!;
  const refreshSession = useAuthStore((s) => s.refreshSession);
  const addFiles = useUploadStore((s) => s.addFiles);
  const setOverlay = useUIStore((s) => s.setOverlay);
  const canUpload = user.uploadEnabled && hasPermission(user.permissions, PERMISSIONS.UPLOAD_VIDEOS);

  useEffect(() => { refreshSession(); }, [refreshSession]);

  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("createdAt:desc");

  const { items, loading, hasMore, loadMore, refresh } = useMediaList({
    type: "video",
    search: search || undefined,
    sort,
    pageSize: 24,
  });

  const bulk = useBulkActions(items, refresh);

  const openReelsMode = () => {
    if (items.length === 0) {
      toast.error("No videos to play");
      return;
    }
    setOverlay("video-player", { mediaId: items[0].id, reelsMode: true });
  };

  return (
    <div className="px-3 md:px-6 py-4 md:py-6 max-w-7xl mx-auto space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col md:flex-row md:items-center gap-3 justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-md">
            <VideoIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Videos</h1>
            <p className="text-xs text-muted-foreground">
              {bulk.selectMode
                ? `${bulk.selectedIds.size} of ${items.length} selected`
                : `${items.length} videos in your library`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {bulk.selectMode ? (
            <>
              <Button size="sm" variant="outline" onClick={bulk.selectAll} disabled={bulk.busy} className="btn-press">
                <CheckSquare className="w-4 h-4 mr-1.5" /> All
              </Button>
              <Button size="sm" variant="outline" onClick={bulk.selectNone} disabled={bulk.busy} className="btn-press">
                <Square className="w-4 h-4 mr-1.5" /> None
              </Button>
              <Button size="sm" variant="outline" onClick={bulk.exitSelectMode} disabled={bulk.busy} className="btn-press">
                <X className="w-4 h-4 mr-1.5" /> Cancel
              </Button>
            </>
          ) : (
            <>
              <ViewToggle view={view} onChange={setView} />
              {items.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={bulk.enterSelectMode}
                  className="btn-press"
                  title="Select videos to delete, move, or download"
                >
                  <CheckSquare className="w-4 h-4 mr-1.5" /> Select
                </Button>
              )}
              {items.length > 0 && (
                <Button
                  onClick={openReelsMode}
                  size="sm"
                  variant="outline"
                  className="bg-brand-gradient text-white border-0 hover:opacity-95 shadow-brand btn-press"
                  title="Watch as Reels"
                >
                  <Smartphone className="w-4 h-4 mr-1.5" /> Reels
                </Button>
              )}
              {canUpload && (
                <UploadButton
                  label="Upload"
                  size="sm"
                  accept="video/*"
                  className="bg-brand-gradient text-white hover:opacity-95 shadow-brand btn-press"
                  onFiles={async (files) => {
                    await addFiles(files, { visibility: "public" });
                    toast.success(`Uploading ${files.length} file(s)`);
                  }}
                />
              )}
            </>
          )}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row gap-2"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search videos…"
            className="pl-9 h-10 border-border/60"
            disabled={bulk.selectMode}
          />
        </div>
        {!bulk.selectMode && (
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="sm:w-44 h-10 border-border/60"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt:desc">Newest first</SelectItem>
              <SelectItem value="createdAt:asc">Oldest first</SelectItem>
              <SelectItem value="name:asc">Name A-Z</SelectItem>
              <SelectItem value="name:desc">Name Z-A</SelectItem>
              <SelectItem value="duration:desc">Longest</SelectItem>
            </SelectContent>
          </Select>
        )}
      </motion.div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {bulk.selectMode && bulk.selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="sticky top-16 z-30 flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 shadow-md backdrop-blur flex-wrap"
          >
            <div className="text-sm font-medium text-amber-700 dark:text-amber-300 mr-auto">
              {bulk.selectedIds.size} selected
            </div>
            <Button
              size="sm"
              onClick={bulk.bulkDownload}
              disabled={bulk.busy}
              className="bg-gradient-to-r from-sky-500 to-blue-500 text-white border-0 hover:opacity-95 btn-press"
            >
              <Download className="w-4 h-4 mr-1.5" /> {bulk.busy ? "…" : "Download"}
            </Button>
            {bulk.showMoveToPrivate && (
              <Button
                size="sm"
                onClick={bulk.bulkMoveToPrivate}
                disabled={bulk.busy}
                className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 hover:opacity-95 btn-press"
              >
                <Lock className="w-4 h-4 mr-1.5" /> {bulk.busy ? "Moving…" : "Move to Private"}
              </Button>
            )}
            {bulk.showMoveToPublic && (
              <Button
                size="sm"
                onClick={bulk.bulkMoveToPublic}
                disabled={bulk.busy}
                className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white border-0 hover:opacity-95 btn-press"
              >
                <Globe className="w-4 h-4 mr-1.5" /> {bulk.busy ? "Moving…" : "Move to Public"}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={bulk.bulkDelete}
              disabled={bulk.busy}
              className="text-rose-600 hover:text-rose-700 border-rose-300 hover:border-rose-400 btn-press"
            >
              <Trash2 className="w-4 h-4 mr-1.5" /> {bulk.busy ? "Deleting…" : "Delete"}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <MediaSkeleton view={view} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={VideoIcon}
          title="No videos yet"
          description={search ? "Try different search terms" : "Upload your first video to start building your library."}
        />
      ) : bulk.selectMode ? (
        /* In select mode, render a custom grid with selection checkboxes */
        <div className={cn(
          "grid gap-3",
          view === "list"
            ? "grid-cols-1"
            : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        )}>
          {items.map((m) => {
            const isSelected = bulk.selectedIds.has(m.id);
            return (
              <div
                key={m.id}
                onClick={() => bulk.toggleSelect(m.id)}
                className={cn(
                  "relative rounded-xl overflow-hidden cursor-pointer transition-all",
                  "aspect-video bg-muted",
                  isSelected && "ring-4 ring-amber-500 ring-offset-2 ring-offset-background"
                )}
              >
                {m.thumbnailUrl && (
                  <img src={m.thumbnailUrl} alt={m.name} className="w-full h-full object-cover" loading="lazy" />
                )}
                <div className={cn(
                  "absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center transition-all",
                  isSelected
                    ? "bg-amber-500 text-white"
                    : "bg-black/50 text-white backdrop-blur scale-90 hover:scale-100"
                )}>
                  {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                </div>
                {isSelected && <div className="absolute inset-0 bg-amber-500/20 pointer-events-none" />}
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <MediaGrid items={items} view={view} onChange={refresh} />
          {hasMore && (
            <div className="flex justify-center mt-4">
              <Button onClick={loadMore} variant="outline" className="btn-press">
                <Loader2 className="w-4 h-4 mr-2" /> Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
