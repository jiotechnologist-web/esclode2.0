"use client";
import { useState } from "react";
import { useMediaList } from "../../shared/use-media-list";
import { MediaGrid, MediaSkeleton, EmptyState } from "../../shared/media-card";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Lock, Search, Shield } from "lucide-react";

export function PrivateView() {
  const [search, setSearch] = useState("");
  const { items, loading, hasMore, loadMore, refresh } = useMediaList({
    visibility: "private",
    search: search || undefined,
    pageSize: 24,
  });

  return (
    <div className="px-3 md:px-6 py-4 md:py-6 max-w-7xl mx-auto space-y-4">
      <Card className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border-emerald-500/30">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Lock className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <CardTitle className="text-base">Private Mode</CardTitle>
              <CardDescription className="text-xs">Files assigned to you by administrator only</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          These files are only visible to you and the administrator. Other users will not see them.
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search private files…"
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <MediaSkeleton />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No private content"
          description="When your administrator assigns private content to you, it will appear here."
        />
      ) : (
        <>
          <MediaGrid items={items} onChange={refresh} />
        </>
      )}
    </div>
  );
}
