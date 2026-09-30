"use client";
import { useEffect, useState } from "react";
import { useMediaList, formatBytes, formatRelative } from "../../shared/use-media-list";
import { MediaSkeleton, EmptyState } from "../../shared/media-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Search,
  Upload,
  FileText,
  FileArchive,
  FileSpreadsheet,
  File as FileIcon,
  Download,
  Loader2,
  Smartphone,
  Presentation,
} from "lucide-react";
import { useUploadStore } from "@/stores/upload";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { ApiMediaItem } from "@/lib/types";

const DOC_FILTERS: { key: string; label: string; icon: any }[] = [
  { key: "all", label: "All", icon: FileText },
  { key: "pdf", label: "PDF", icon: FileText },
  { key: "doc", label: "DOC", icon: FileText },
  { key: "docx", label: "DOCX", icon: FileText },
  { key: "xls", label: "XLS", icon: FileSpreadsheet },
  { key: "xlsx", label: "XLSX", icon: FileSpreadsheet },
  { key: "ppt", label: "PPT", icon: Presentation },
  { key: "pptx", label: "PPTX", icon: Presentation },
  { key: "txt", label: "TXT", icon: FileText },
  { key: "csv", label: "CSV", icon: FileSpreadsheet },
  { key: "zip", label: "ZIP", icon: FileArchive },
  { key: "rar", label: "RAR", icon: FileArchive },
  { key: "7z", label: "7Z", icon: FileArchive },
  { key: "apk", label: "APK", icon: Smartphone },
  { key: "other", label: "Other", icon: FileIcon },
];

function iconFor(docType: string | null): any {
  if (!docType) return FileIcon;
  if (docType === "pdf") return FileText;
  if (docType === "doc" || docType === "docx") return FileText;
  if (docType === "xls" || docType === "xlsx" || docType === "csv") return FileSpreadsheet;
  if (docType === "ppt" || docType === "pptx") return Presentation;
  if (docType === "zip" || docType === "rar" || docType === "7z") return FileArchive;
  if (docType === "apk") return Smartphone;
  return FileIcon;
}

function colorFor(docType: string | null): string {
  if (!docType) return "from-slate-500 to-slate-600";
  if (docType === "pdf") return "from-rose-500 to-rose-600";
  if (docType === "doc" || docType === "docx") return "from-blue-500 to-blue-600";
  if (docType === "xls" || docType === "xlsx") return "from-emerald-500 to-emerald-600";
  if (docType === "ppt" || docType === "pptx") return "from-orange-500 to-orange-600";
  if (docType === "zip" || docType === "rar" || docType === "7z") return "from-amber-500 to-amber-600";
  if (docType === "apk") return "from-fuchsia-500 to-fuchsia-600";
  return "from-slate-500 to-slate-600";
}

export function DocumentsView() {
  const user = useAuthStore((s) => s.user)!;
  const refreshSession = useAuthStore((s) => s.refreshSession);
  const addFiles = useUploadStore((s) => s.addFiles);
  const canUpload = user.uploadEnabled && hasPermission(user.permissions, PERMISSIONS.UPLOAD_DOCUMENTS);

  // Refresh session on mount so upload permission is current
  useEffect(() => { refreshSession(); }, [refreshSession]);

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("createdAt:desc");

  const { items, loading, hasMore, loadMore, refresh } = useMediaList({
    type: "document",
    docType: filter !== "all" ? filter : undefined,
    search: search || undefined,
    sort,
    pageSize: 24,
  });

  return (
    <div className="px-3 md:px-6 py-4 md:py-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> Documents</h1>
          <p className="text-xs text-muted-foreground">{items.length} documents</p>
        </div>
        {canUpload && (
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
            <Button size="sm" className="bg-brand-gradient text-white hover:opacity-95">
              <Upload className="w-4 h-4 mr-1.5" /> Upload
            </Button>
          </label>
        )}
      </div>

      {/* Top-level document filters */}
      <div className="flex flex-wrap gap-1.5">
        {DOC_FILTERS.map((f) => {
          const isActive = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:bg-accent"
              )}
            >
              <f.icon className="w-3.5 h-3.5" />
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="pl-9"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm w-full sm:w-44"
        >
          <option value="createdAt:desc">Newest first</option>
          <option value="createdAt:asc">Oldest first</option>
          <option value="name:asc">Name A-Z</option>
          <option value="size:desc">Largest first</option>
        </select>
      </div>

      {loading ? (
        <MediaSkeleton count={8} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents"
          description={filter !== "all" ? `No ${filter.toUpperCase()} files found.` : "Upload documents to organize them here."}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} onChange={refresh} />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center mt-4">
              <Button onClick={loadMore} variant="outline">
                <Loader2 className="w-4 h-4 mr-2" /> Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DocumentCard({ doc, onChange }: { doc: ApiMediaItem; onChange?: () => void }) {
  const Icon = iconFor(doc.docType);
  const color = colorFor(doc.docType);
  const handleDownload = () => window.open(`/api/media/${doc.id}/download`, "_blank");

  return (
    <Card className="p-3 flex items-center gap-3 hover:shadow-md transition-shadow group">
      <div className={cn("w-12 h-12 rounded-lg bg-gradient-to-br flex items-center justify-center shrink-0", color)}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{doc.name}</div>
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <Badge variant="outline" className="text-[9px] px-1 py-0 uppercase">{doc.docType ?? "FILE"}</Badge>
          <span>·</span>
          <span>{formatBytes(doc.size)}</span>
          <span>·</span>
          <span>{formatRelative(doc.createdAt)}</span>
        </div>
      </div>
      <Button size="icon" variant="ghost" onClick={handleDownload} className="h-8 w-8 shrink-0">
        <Download className="w-4 h-4" />
      </Button>
    </Card>
  );
}
