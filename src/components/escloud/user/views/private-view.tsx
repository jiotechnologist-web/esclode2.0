"use client";
import { useState, useEffect } from "react";
import { useMediaList } from "../../shared/use-media-list";
import { MediaGrid, MediaSkeleton, EmptyState } from "../../shared/media-card";
import { useBulkActions } from "../../shared/use-bulk-actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Lock, Search, Shield, Loader2, Eye, EyeOff, Upload,
  CheckSquare, Square, X, Trash2, Globe, Download, Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth";
import { useUploadStore } from "@/stores/upload";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { UploadButton } from "../../shared/upload-button";
import { cn } from "@/lib/utils";

export function PrivateView() {
  const user = useAuthStore((s) => s.user);
  const addFiles = useUploadStore((s) => s.addFiles);
  const [search, setSearch] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [pwdInput, setPwdInput] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const hasPrivateAccess = user ? hasPermission(user.permissions, PERMISSIONS.PRIVATE_ACCESS) : false;
  const canUpload = user?.uploadEnabled && hasPrivateAccess && (
    hasPermission(user.permissions, PERMISSIONS.UPLOAD_VIDEOS) ||
    hasPermission(user.permissions, PERMISSIONS.UPLOAD_PHOTOS) ||
    hasPermission(user.permissions, PERMISSIONS.UPLOAD_DOCUMENTS) ||
    hasPermission(user.permissions, PERMISSIONS.UPLOAD_CONTACTS)
  );

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/user/private-password");
        const d = await r.json();
        setHasPassword(d.hasPassword);
        if (!d.hasPassword) setUnlocked(true);
      } catch {
        setHasPassword(false);
        setUnlocked(true);
      }
    })();
  }, []);

  const verifyPassword = async () => {
    if (!pwdInput) return;
    setVerifying(true);
    try {
      const r = await fetch("/api/user/private-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", currentPrivatePassword: pwdInput }),
      });
      const d = await r.json();
      if (r.ok && d.verified) {
        setUnlocked(true);
        setPwdInput("");
        toast.success("Private content unlocked");
      } else {
        toast.error(d.error ?? "Incorrect password");
      }
    } catch {
      toast.error("Failed to verify password");
    } finally {
      setVerifying(false);
    }
  };

  const { items, loading, refresh } = useMediaList({
    visibility: "private",
    search: search || undefined,
    pageSize: 24,
  });

  const bulk = useBulkActions(items, refresh);

  // Password gate screen
  if (!unlocked && hasPassword) {
    return (
      <div className="px-3 md:px-6 py-4 md:py-6 max-w-md mx-auto flex flex-col items-center justify-center min-h-[60vh]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full"
        >
          <div className="flex flex-col items-center mb-6">
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg mb-4"
            >
              <Lock className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-xl font-bold">Private Content Locked</h1>
            <p className="text-sm text-muted-foreground mt-1">Enter your private password to access</p>
          </div>

          <Card className="shadow-premium">
            <CardContent className="pt-6 space-y-4">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showPwd ? "text" : "password"}
                  value={pwdInput}
                  onChange={(e) => setPwdInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && verifyPassword()}
                  placeholder="Enter private password"
                  className="pl-9 pr-10 h-12"
                  autoFocus
                />
                <button
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button
                onClick={verifyPassword}
                disabled={!pwdInput || verifying}
                className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-500 text-white"
              >
                {verifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5 mr-2" />}
                Unlock Private Content
              </Button>
              <p className="text-[11px] text-center text-muted-foreground">
                You can set or change your private password in Settings → Privacy
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="px-3 md:px-6 py-4 md:py-6 max-w-7xl mx-auto space-y-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md">
          <Lock className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Private</h1>
          <p className="text-xs text-muted-foreground">
            {bulk.selectMode ? `${bulk.selectedIds.size} of ${items.length} selected` : `${items.length} private files`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {bulk.selectMode ? (
            <>
              <Button size="sm" variant="outline" onClick={bulk.selectAll} disabled={bulk.busy}>
                <CheckSquare className="w-4 h-4 mr-1.5" /> All
              </Button>
              <Button size="sm" variant="outline" onClick={bulk.selectNone} disabled={bulk.busy}>
                <Square className="w-4 h-4 mr-1.5" /> None
              </Button>
              <Button size="sm" variant="outline" onClick={bulk.exitSelectMode} disabled={bulk.busy}>
                <X className="w-4 h-4 mr-1.5" /> Cancel
              </Button>
            </>
          ) : (
            <>
              {items.length > 0 && (
                <Button size="sm" variant="outline" onClick={bulk.enterSelectMode} className="btn-press" title="Select items to delete, move to public, or download">
                  <CheckSquare className="w-4 h-4 mr-1.5" /> Select
                </Button>
              )}
              {hasPrivateAccess && canUpload && (
                <UploadButton
                  label="Upload"
                  size="sm"
                  className="bg-gradient-to-r from-amber-500 to-orange-500 text-white"
                  onFiles={async (files) => {
                    await addFiles(files, { visibility: "private" });
                    toast.success(`Uploading ${files.length} private file(s)`);
                  }}
                />
              )}
              {hasPassword && (
                <Button variant="ghost" size="sm" onClick={() => { setUnlocked(false); setPwdInput(""); }}>
                  <Lock className="w-3.5 h-3.5 mr-1" /> Lock
                </Button>
              )}
            </>
          )}
        </div>
      </motion.div>

      <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30 shadow-premium">
        <CardContent className="py-4 flex items-center gap-3">
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center"
          >
            <Shield className="w-5 h-5 text-amber-500" />
          </motion.div>
          <div className="flex-1">
            <div className="font-medium text-sm">Private Mode</div>
            <div className="text-xs text-muted-foreground">Files assigned to you by administrator</div>
          </div>
          {hasPassword && (
            <Badge variant="secondary" className="text-[10px] bg-amber-500/15 text-amber-600">
              <Lock className="w-2.5 h-2.5 mr-0.5" />Password Protected
            </Badge>
          )}
        </CardContent>
      </Card>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search private files…" className="pl-9 h-10 border-border/60" disabled={bulk.selectMode} />
      </div>

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
            <Button size="sm" onClick={bulk.bulkDownload} disabled={bulk.busy} className="bg-gradient-to-r from-sky-500 to-blue-500 text-white border-0 hover:opacity-95 btn-press">
              <Download className="w-4 h-4 mr-1.5" /> {bulk.busy ? "…" : "Download"}
            </Button>
            {/* In Private view, items are already private — show "Move to Public" if any are private (which they all are) */}
            {bulk.showMoveToPublic && (
              <Button size="sm" onClick={bulk.bulkMoveToPublic} disabled={bulk.busy} className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white border-0 hover:opacity-95 btn-press">
                <Globe className="w-4 h-4 mr-1.5" /> {bulk.busy ? "Moving…" : "Move to Public"}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={bulk.bulkDelete} disabled={bulk.busy} className="text-rose-600 hover:text-rose-700 border-rose-300 hover:border-rose-400 btn-press">
              <Trash2 className="w-4 h-4 mr-1.5" /> {bulk.busy ? "Deleting…" : "Delete"}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <MediaSkeleton />
      ) : items.length === 0 ? (
        <EmptyState icon={Shield} title="No private content" description="When your administrator assigns private content to you, it will appear here." />
      ) : bulk.selectMode ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
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
                  isSelected ? "bg-amber-500 text-white" : "bg-black/50 text-white backdrop-blur scale-90 hover:scale-100"
                )}>
                  {isSelected ? <Check className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                </div>
                {isSelected && <div className="absolute inset-0 bg-amber-500/20 pointer-events-none" />}
              </div>
            );
          })}
        </div>
      ) : (
        <MediaGrid items={items} onChange={refresh} />
      )}
    </div>
  );
}
