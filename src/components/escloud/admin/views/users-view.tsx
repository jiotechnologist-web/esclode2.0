"use client";
import { useEffect, useState } from "react";
import { useUIStore } from "@/stores/ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  UserPlus,
  Loader2,
  CheckCircle2,
  PauseCircle,
  Trash2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import type { ApiUserListItem } from "@/lib/types";
import { formatBytes, formatDate, formatRelative } from "../../shared/use-media-list";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DEFAULT_USER_PERMISSIONS, PERMISSIONS, serializePermissions } from "@/lib/permissions";

export function AdminUsersView() {
  const setView = useUIStore((s) => s.setView);
  const [users, setUsers] = useState<ApiUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/users?search=${encodeURIComponent(search)}&status=${statusFilter}`);
      const d = await r.json();
      setUsers(d.users ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [search, statusFilter]);

  const toggleSelect = (id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const bulkAction = async (action: string) => {
    if (selected.length === 0) return;
    if (!confirm(`Apply "${action}" to ${selected.length} user(s)?`)) return;
    for (const id of selected) {
      try {
        const u = users.find((x) => x.id === id);
        if (!u) continue;
        if (action === "suspend") {
          await fetch(`/api/admin/users/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "suspended" }),
          });
        } else if (action === "activate") {
          await fetch(`/api/admin/users/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "active" }),
          });
        } else if (action === "delete") {
          await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
        } else if (action === "force-logout") {
          await fetch(`/api/admin/users/${id}/force-logout`, { method: "POST" });
        }
      } catch {}
    }
    toast.success(`Bulk action done`);
    setSelected([]);
    refresh();
  };

  return (
    <div className="px-3 md:px-6 py-4 md:py-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-muted-foreground">{users.length} users · {selected.length} selected</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-brand-gradient text-white">
          <UserPlus className="w-4 h-4 mr-1.5" /> Create User
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username, email, name…"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="deleted">Deleted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk actions */}
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <span className="text-sm font-medium">{selected.length} selected</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => bulkAction("activate")}><CheckCircle2 className="w-3.5 h-3.5 mr-1" />Activate</Button>
          <Button size="sm" variant="outline" onClick={() => bulkAction("suspend")}><PauseCircle className="w-3.5 h-3.5 mr-1" />Suspend</Button>
          <Button size="sm" variant="outline" onClick={() => bulkAction("force-logout")}><Lock className="w-3.5 h-3.5 mr-1" />Force logout</Button>
          <Button size="sm" variant="destructive" onClick={() => bulkAction("delete")}><Trash2 className="w-3.5 h-3.5 mr-1" />Delete</Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No users found</div>
      ) : (
        <Card className="overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="p-2 text-left w-10">
                    <input
                      type="checkbox"
                      checked={selected.length === users.length && users.length > 0}
                      onChange={(e) => setSelected(e.target.checked ? users.map((u) => u.id) : [])}
                    />
                  </th>
                  <th className="p-2 text-left">User</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Storage</th>
                  <th className="p-2 text-left">Media</th>
                  <th className="p-2 text-left">Last active</th>
                  <th className="p-2 text-left">Created</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b hover:bg-accent/40 cursor-pointer"
                    onClick={() => setView("user-detail", { userId: u.id })}
                  >
                    <td className="p-2" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggleSelect(u.id)} />
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-brand-gradient text-white text-xs">
                            {u.displayName?.[0]?.toUpperCase() ?? u.username[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-medium truncate flex items-center gap-1">
                            {u.displayName ?? u.username}
                            {u.role === "admin" && <ShieldCheck className="w-3 h-3 text-emerald-500" />}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-2">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="p-2">
                      <div className="text-xs">{formatBytes(u.usedStorage)} / {formatBytes(u.storageQuota)}</div>
                      <div className="w-24 h-1 bg-muted rounded overflow-hidden mt-1">
                        <div className="h-full brand-progress" style={{ width: `${Math.min(100, (u.usedStorage / u.storageQuota) * 100)}%` }} />
                      </div>
                    </td>
                    <td className="p-2 text-xs">{u.mediaCount}</td>
                    <td className="p-2 text-xs text-muted-foreground">{u.lastActiveAt ? formatRelative(u.lastActiveAt) : "—"}</td>
                    <td className="p-2 text-xs text-muted-foreground">{formatDate(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y">
            {users.map((u) => (
              <div
                key={u.id}
                className="p-3 flex items-center gap-3 active:bg-accent/40 cursor-pointer"
                onClick={() => setView("user-detail", { userId: u.id })}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(u.id)}
                  onChange={() => toggleSelect(u.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-brand-gradient text-white text-xs">
                    {u.displayName?.[0]?.toUpperCase() ?? u.username[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate flex items-center gap-1">
                    {u.displayName ?? u.username}
                    {u.role === "admin" && <ShieldCheck className="w-3 h-3 text-emerald-500" />}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <StatusBadge status={u.status} />
                    <Badge variant="outline" className="text-[10px]">{formatBytes(u.usedStorage)}</Badge>
                    <Badge variant="outline" className="text-[10px]">{u.mediaCount} files</Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <CreateUserDialog open={showCreate} onOpenChange={setShowCreate} onCreated={refresh} />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: any; label: string }> = {
    active: { variant: "default", label: "Active" },
    suspended: { variant: "secondary", label: "Suspended" },
    deleted: { variant: "destructive", label: "Deleted" },
  };
  const m = map[status] ?? map.active;
  return <Badge variant={m.variant} className="text-[10px]">{m.label}</Badge>;
}

function CreateUserDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [storageQuota, setStorageQuota] = useState(20 * 1024 * 1024 * 1024);
  const [uploadMaxBytes, setUploadMaxBytes] = useState(5 * 1024 * 1024 * 1024);
  const [perms, setPerms] = useState<string[]>(DEFAULT_USER_PERMISSIONS);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email,
          password,
          displayName,
          role,
          storageQuota,
          uploadMaxBytes,
          permissions: role === "admin" ? [...DEFAULT_USER_PERMISSIONS, "admin"] : perms,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(`Created ${username}`);
      onOpenChange(false);
      setUsername(""); setEmail(""); setPassword(""); setDisplayName("");
      onCreated();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create User</DialogTitle>
          <DialogDescription>Provision a new user account</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Username *</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Display name</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Email *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Password *</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Storage quota (bytes)</Label>
              <Input type="number" value={storageQuota} onChange={(e) => setStorageQuota(Number(e.target.value))} />
            </div>
          </div>
          {role === "user" && (
            <div className="space-y-1">
              <Label>Permissions</Label>
              <div className="grid grid-cols-2 gap-1 max-h-44 overflow-y-auto p-2 rounded-lg border">
                {DEFAULT_USER_PERMISSIONS.map((p) => (
                  <label key={p} className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={perms.includes(p)}
                      onChange={(e) => setPerms((s) => e.target.checked ? [...s, p] : s.filter((x) => x !== p))}
                    />
                    {p.replace(/_/g, " ")}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || !username || !email || !password}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <UserPlus className="w-4 h-4 mr-1" />}
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
