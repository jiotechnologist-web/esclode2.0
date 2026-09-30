"use client";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Upload, FileText, Users, Lock, Globe, Check } from "lucide-react";
import { useUploadStore } from "@/stores/upload";
import { toast } from "sonner";
import { useEffect, useState as useReactState } from "react";

export function AdminUploadsView() {
  const addFiles = useUploadStore((s) => s.addFiles);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [targetUserId, setTargetUserId] = useState("");
  const [users, setUsers] = useReactState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useReactState<string[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/admin/users");
        const d = await r.json();
        setUsers(d.users ?? []);
      } catch {}
    })();
  }, []);

  const toggleUser = (id: string) => {
    setSelectedUserIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };
  const selectAll = () => setSelectedUserIds(users.map((u) => u.id));
  const clearAll = () => setSelectedUserIds([]);

  const handleUpload = async (files: FileList | null) => {
    if (!files) return;
    if (visibility === "private" && selectedUserIds.length === 0 && !targetUserId) {
      toast.error("Select at least one user to assign private content");
      return;
    }
    const opts: any = { visibility };
    if (targetUserId) opts.targetUserId = targetUserId;
    if (visibility === "private") opts.assignUserIds = selectedUserIds;
    await addFiles(Array.from(files), opts);
    toast.success(`Uploading ${files.length} file(s)`);
  };

  const filteredUsers = users.filter((u: any) =>
    u.role === "user" && (u.username?.toLowerCase().includes(filter.toLowerCase()) || u.email?.toLowerCase().includes(filter.toLowerCase()))
  );

  return (
    <div className="px-3 md:px-6 py-4 md:py-6 max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Upload className="w-5 h-5 text-primary" /> Upload & Assign</h1>
        <p className="text-sm text-muted-foreground">Upload content and control access — bulk assignment supported</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Choose Files</CardTitle>
          <CardDescription className="text-xs">Mixed files (videos, photos, documents, contacts) are auto-categorized</CardDescription>
        </CardHeader>
        <CardContent>
          <label className="block">
            <input type="file" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
            <div className="border-2 border-dashed rounded-xl p-8 text-center hover:bg-accent/40 cursor-pointer transition-colors">
              <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">Drop files here or click to select</p>
              <p className="text-xs text-muted-foreground mt-1">Multiple files supported. Types auto-detected.</p>
            </div>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Access Control</CardTitle>
          <CardDescription className="text-xs">Who can access the uploaded content?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setVisibility("public")}
              className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${visibility === "public" ? "border-primary bg-primary/5" : "hover:bg-accent/40"}`}
            >
              <Globe className="w-4 h-4 text-emerald-500" />
              <div className="text-left">
                <div className="text-sm font-medium">Everyone</div>
                <div className="text-[11px] text-muted-foreground">Visible to all authorized users</div>
              </div>
              {visibility === "public" && <Check className="w-4 h-4 text-primary ml-auto" />}
            </button>
            <button
              onClick={() => setVisibility("private")}
              className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${visibility === "private" ? "border-primary bg-primary/5" : "hover:bg-accent/40"}`}
            >
              <Lock className="w-4 h-4 text-amber-500" />
              <div className="text-left">
                <div className="text-sm font-medium">Private</div>
                <div className="text-[11px] text-muted-foreground">Only selected users</div>
              </div>
              {visibility === "private" && <Check className="w-4 h-4 text-primary ml-auto" />}
            </button>
          </div>

          {visibility === "private" && (
            <>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <div className="text-sm font-medium">Selected users</div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={selectAll}>Select all</Button>
                  <Button size="sm" variant="ghost" onClick={clearAll}>Clear</Button>
                </div>
              </div>
              <input
                type="text"
                placeholder="Filter users by name or email…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <div className="max-h-72 overflow-y-auto border rounded-lg scroll-thin">
                {filteredUsers.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">No users found</div>
                ) : filteredUsers.map((u: any) => (
                  <button
                    key={u.id}
                    onClick={() => toggleUser(u.id)}
                    className={`w-full flex items-center gap-3 p-3 hover:bg-accent/40 border-b last:border-0 text-left ${selectedUserIds.includes(u.id) ? "bg-primary/5" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUserIds.includes(u.id)}
                      onChange={() => toggleUser(u.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{u.displayName ?? u.username}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{u.email}</div>
                    </div>
                    {selectedUserIds.includes(u.id) && <Check className="w-4 h-4 text-primary" />}
                  </button>
                ))}
              </div>
              {selectedUserIds.length > 0 && (
                <Badge variant="secondary" className="text-xs">{selectedUserIds.length} user(s) will get access</Badge>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
