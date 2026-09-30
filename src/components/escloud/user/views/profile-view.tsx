"use client";
import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserCircle, Mail, Phone, Lock, LogOut, Save, Camera, Shield, HardDrive, Calendar } from "lucide-react";
import { toast } from "sonner";
import { formatBytes, formatDate } from "../../shared/use-media-list";
import { PERMISSIONS, hasPermission } from "@/lib/permissions";

export function ProfileView() {
  const user = useAuthStore((s) => s.user)!;
  const logout = useAuthStore((s) => s.logout);
  const fetchSession = useAuthStore((s) => s.fetchSession);

  const [profile, setProfile] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);

  const load = async () => {
    try {
      const r = await fetch("/api/profile");
      const d = await r.json();
      setProfile(d);
      setDisplayName(d.profile.displayName ?? "");
      setPhone(d.profile.phone ?? "");
      setEmail(d.profile.email ?? "");
      setUsername(d.profile.username ?? "");
      setAvatar(d.profile.avatarUrl ?? null);
    } catch {}
  };

  useEffect(() => {
    load();
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    try {
      const r = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, phone, email, username }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success("Profile updated");
      setEditing(false);
      fetchSession();
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const changePwd = async () => {
    if (!currentPwd || !newPwd) return;
    if (newPwd.length < 6) {
      toast.error("New password too short");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current: currentPwd, next: newPwd }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success("Password changed");
      setCurrentPwd("");
      setNewPwd("");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch("/api/profile/avatar", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success("Avatar updated");
      load();
      fetchSession();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update avatar");
    }
  };

  const storagePct = profile ? Math.min(100, (profile.storage.used / profile.storage.quota) * 100) : 0;

  const permLabels: Record<string, string> = {
    view_videos: "View Videos",
    view_photos: "View Photos",
    view_private: "View Private",
    view_documents: "View Documents",
    view_contacts: "View Contacts",
    view_favorites: "View Favorites",
    view_recent: "View Recent",
    view_uploads: "View Uploads",
    upload_videos: "Upload Videos",
    upload_photos: "Upload Photos",
    upload_documents: "Upload Documents",
    upload_contacts: "Upload Contacts",
    download_videos: "Download Videos",
    download_photos: "Download Photos",
    download_documents: "Download Documents",
    download_contacts: "Download Contacts",
    delete_own: "Delete Own",
    edit_own: "Edit Own",
    create_albums: "Create Albums",
    create_folders: "Create Folders",
    use_favorites: "Use Favorites",
    qr_login: "QR Login",
    advanced_video_play: "Advanced Video Play",
  };

  return (
    <div className="px-3 md:px-6 py-4 md:py-6 max-w-5xl mx-auto space-y-4">
      {/* Profile header card */}
      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-4">
            <div className="relative">
              <Avatar className="w-24 h-24">
                <AvatarFallback className="bg-brand-gradient text-white text-3xl">
                  {user.displayName?.[0]?.toUpperCase() ?? user.username[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <label className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow-md">
                <Camera className="w-3.5 h-3.5" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadAvatar(f);
                  }}
                />
              </label>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-2xl font-bold">{user.displayName ?? user.username}</h1>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1 justify-center md:justify-start">
                <Badge variant="secondary" className="capitalize">{user.role}</Badge>
                <Badge variant="outline">Status: {user.status}</Badge>
                {user.approvalRequired && <Badge variant="outline">Upload approval required</Badge>}
              </div>
            </div>
            <Button
              variant="outline"
              onClick={async () => {
                await logout();
                toast.success("Signed out");
              }}
            >
              <LogOut className="w-4 h-4 mr-1.5" /> Logout
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="account">
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account Information</CardTitle>
              <CardDescription className="text-xs">Update your profile details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Username</Label>
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} disabled={!editing} />
                </div>
                <div className="space-y-1.5">
                  <Label>Display name</Label>
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={!editing} />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} disabled={!editing} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!editing} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!editing ? (
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                ) : (
                  <>
                    <Button onClick={saveProfile} disabled={saving}>
                      <Save className="w-4 h-4 mr-1.5" /> {saving ? "Saving…" : "Save"}
                    </Button>
                    <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Lock className="w-4 h-4" /> Change Password</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-w-md">
              <div className="space-y-1.5">
                <Label>Current password</Label>
                <Input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>New password</Label>
                <Input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} />
              </div>
              <Button onClick={changePwd} disabled={saving || !currentPwd || !newPwd}>
                {saving ? "Updating…" : "Update Password"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><HardDrive className="w-4 h-4" /> Storage Usage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress value={storagePct} className="h-2 brand-progress" />
              <div className="flex justify-between text-xs">
                <span>{formatBytes(profile?.storage.used ?? 0)} used</span>
                <span className="text-muted-foreground">{formatBytes(profile?.storage.quota ?? 0)} quota</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                {(profile?.storage.byType ?? []).map((b: any) => (
                  <div key={b.type} className="text-center p-3 rounded-lg bg-muted">
                    <div className="text-2xl font-bold">{b.count}</div>
                    <div className="text-xs text-muted-foreground capitalize">{b.type}s</div>
                    <div className="text-[10px] text-muted-foreground mt-1">{formatBytes(b.size)}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4" /> Your Permissions</CardTitle>
              <CardDescription className="text-xs">Permissions are set by your administrator</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {user.permissions.map((p) => (
                  <div key={p} className="flex items-center gap-2 text-xs p-2 rounded-md bg-muted/50 border">
                    <Shield className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>{permLabels[p] ?? p}</span>
                  </div>
                ))}
                {user.permissions.length === 0 && (
                  <div className="text-sm text-muted-foreground col-span-full text-center py-4">No specific permissions</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
