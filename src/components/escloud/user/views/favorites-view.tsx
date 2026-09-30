"use client";
import { useMediaList } from "../../shared/use-media-list";
import { MediaGrid, MediaSkeleton, EmptyState, ViewToggle } from "../../shared/media-card";
import { Heart } from "lucide-react";
import { useState } from "react";

export function FavoritesView() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const { items, loading, refresh } = useMediaList({ favorites: true, pageSize: 36 });
  return (
    <div className="px-3 md:px-6 py-4 md:py-6 max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Heart className="w-5 h-5 text-rose-500 fill-rose-500" /> Favorites</h1>
          <p className="text-xs text-muted-foreground">{items.length} favorites</p>
        </div>
        <ViewToggle view={view} onChange={setView} />
      </div>
      {loading ? (
        <MediaSkeleton view={view} />
      ) : items.length === 0 ? (
        <EmptyState icon={Heart} title="No favorites yet" description="Tap the heart on any media to add it to favorites." />
      ) : (
        <MediaGrid items={items} view={view} onChange={refresh} />
      )}
    </div>
  );
}
