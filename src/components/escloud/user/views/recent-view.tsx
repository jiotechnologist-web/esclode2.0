"use client";
import { useMediaList } from "../../shared/use-media-list";
import { MediaGrid, MediaSkeleton, EmptyState } from "../../shared/media-card";
import { History } from "lucide-react";

export function RecentView() {
  const { items, loading } = useMediaList({ recent: true, pageSize: 24 });
  return (
    <div className="px-3 md:px-6 py-4 md:py-6 max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2"><History className="w-5 h-5 text-primary" /> Recent</h1>
        <p className="text-xs text-muted-foreground">Recently viewed videos</p>
      </div>
      {loading ? (
        <MediaSkeleton />
      ) : items.length === 0 ? (
        <EmptyState icon={History} title="No recent activity" description="Videos you watch will show up here so you can resume from where you left off." />
      ) : (
        <MediaGrid items={items} />
      )}
    </div>
  );
}
