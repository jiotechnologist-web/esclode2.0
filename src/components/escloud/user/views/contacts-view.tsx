"use client";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Upload,
  Users as UsersIcon,
  Download,
  Trash2,
  Mail,
  Phone as PhoneIcon,
  User as UserIcon,
  Loader2,
  FileText,
} from "lucide-react";
import { useUploadStore } from "@/stores/upload";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { formatBytes, formatRelative, deleteMedia } from "../../shared/use-media-list";
import type { ApiMediaItem } from "@/lib/types";

export function ContactsView() {
  const user = useAuthStore((s) => s.user)!;
  const addFiles = useUploadStore((s) => s.addFiles);
  const canUpload = user.uploadEnabled && hasPermission(user.permissions, PERMISSIONS.UPLOAD_CONTACTS);

  const [items, setItems] = useState<ApiMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ApiMediaItem | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/media?type=contact&search=${encodeURIComponent(search)}`);
      const d = await r.json();
      setItems(d.items ?? []);
    } catch {
      toast.error("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [search]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this contact file?")) return;
    try {
      await deleteMedia(id);
      toast.success("Deleted");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    }
  };

  return (
    <div className="px-3 md:px-6 py-4 md:py-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><UsersIcon className="w-5 h-5 text-primary" /> Contacts</h1>
          <p className="text-xs text-muted-foreground">{items.length} contact files</p>
        </div>
        {canUpload && (
          <label className="cursor-pointer">
            <input
              type="file"
              multiple
              accept=".vcf,.vcard,text/vcard"
              className="hidden"
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length > 0) {
                  await addFiles(files, { visibility: "public" });
                  toast.success(`Uploading ${files.length} contact file(s)`);
                }
              }}
            />
            <Button size="sm" className="bg-brand-gradient text-white hover:opacity-95">
              <Upload className="w-4 h-4 mr-1.5" /> Upload VCF
            </Button>
          </label>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contacts…"
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <UsersIcon className="w-12 h-12 text-muted-foreground mb-3" />
          <h3 className="font-semibold">No contacts yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Upload .vcf files to manage contacts.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((c) => (
            <Card key={c.id} className="p-3 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white font-semibold text-sm">
                  {(c.contactName ?? c.name)[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{c.contactName ?? c.name}</div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    {c.contactCount && <Badge variant="outline" className="text-[9px] px-1 py-0">{c.contactCount} cards</Badge>}
                    <span>{formatBytes(c.size)}</span>
                    <span>·</span>
                    <span>{formatRelative(c.createdAt)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1 justify-end">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => window.open(`/api/media/${c.id}/download`, "_blank")}>
                  <Download className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-500 hover:text-rose-600" onClick={() => handleDelete(c.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
