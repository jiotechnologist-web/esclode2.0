"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, Loader2, Trash2, Download, Lock, Globe, Filter } from "lucide-react";
import { useMediaList, formatBytes, formatRelative, deleteMedia } from "../../shared/use-media-list";
import { MediaSkeleton, EmptyState } from "../../shared/media-card";
import { toast } from "sonner";
import type { ApiMediaItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AdminMediaView() {
  const [type, setType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [visibility, setVisibility] = useState<string>("all");
  const [selected, setSelected] = useState<string[]>([]);

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
    if (!confirm(`Delete ${selected.length} media files? This is irreversible.`)) return;
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

  return (
    <div className="px-3 md:px-6 py-4 md:py-6 max-w-7xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Media Management</h1>
        <p className="text-sm text-muted-foreground">All media across all users</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search media…" className="pl-9" />
        </div>
        <Select value={type} onValueChange={(v) => setType(v === "all" ? "" : v)}>
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
        <Select value={visibility} onValueChange={(v) => setVisibility(v === "all" ? "" : v)}>
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
          <Card className="overflow-hidden">
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="p-2 text-left w-10">
                      <input
                        type="checkbox"
                        checked={selected.length === items.length && items.length > 0}
                        onChange={(e) => setSelected(e.target.checked ? items.map((i) => i.id) : [])}
                      />
                    </th>
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-left">Type</th>
                    <th className="p-2 text-left">Visibility</th>
                    <th className="p-2 text-left">Size</th>
                    <th className="p-2 text-left">Created</th>
                    <th className="p-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((m) => (
                    <tr key={m.id} className="border-b hover:bg-accent/40">
                      <td className="p-2" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggleSelect(m.id)} />
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          {m.thumbnailUrl ? (
                            <img src={m.thumbnailUrl} alt="" className="w-10 h-10 rounded object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded bg-muted" />
                          )}
                          <div className="min-w-0">
                            <div className="font-medium truncate">{m.name}</div>
                            <div className="text-[11px] text-muted-foreground">{m.ownerName ?? "—"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-2"><Badge variant="outline" className="text-[10px]">{m.type}</Badge></td>
                      <td className="p-2">
                        {m.visibility === "private" ? (
                          <Badge variant="secondary" className="text-[10px]"><Lock className="w-2.5 h-2.5 mr-0.5" />Private</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]"><Globe className="w-2.5 h-2.5 mr-0.5" />Public</Badge>
                        )}
                      </td>
                      <td className="p-2 text-xs">{formatBytes(m.size)}</td>
                      <td className="p-2 text-xs text-muted-foreground">{formatRelative(m.createdAt)}</td>
                      <td className="p-2 text-right">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => window.open(`/api/media/${m.id}/download`, "_blank")}>
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-500" onClick={async () => { await deleteMedia(m.id); toast.success("Deleted"); refresh(); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="md:hidden divide-y">
              {items.map((m) => (
                <div key={m.id} className="p-3 flex items-center gap-2">
                  <input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggleSelect(m.id)} />
                  {m.thumbnailUrl && <img src={m.thumbnailUrl} alt="" className="w-12 h-12 rounded object-cover" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{m.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {m.type} · {formatBytes(m.size)} · {formatRelative(m.createdAt)}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => window.open(`/api/media/${m.id}/download`, "_blank")}>
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
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
