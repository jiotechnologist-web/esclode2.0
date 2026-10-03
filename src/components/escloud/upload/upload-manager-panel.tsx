"use client";
import { useUploadStore } from "@/stores/upload";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  Upload, X, Loader2, CheckCircle2, AlertCircle, RefreshCw, Trash2,
  FileText, Image as ImageIcon, Video as VideoIcon, Users as UsersIcon, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

function formatBytes(n: number): string {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0; let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatSpeed(bytesPerSec: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return "—";
  return `${formatBytes(bytesPerSec)}/s`;
}

function formatEta(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return "—";
  if (seconds < 60) return `~${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return `~${m}m ${s}s`;
}

// Progress bar component with smooth animation and state-based colors
function ProgressBar({ progress, status }: { progress: number; status: string }) {
  const pct = Math.min(100, Math.max(0, progress * 100));

  // Color based on status
  const barColor =
    status === "completed" ? "from-emerald-500 to-teal-500" :
    status === "failed" ? "from-rose-500 to-red-500" :
    status === "processing" ? "from-blue-500 to-cyan-500" :
    status === "preparing" ? "from-amber-500 to-orange-500" :
    "from-emerald-500 to-cyan-500"; // uploading

  return (
    <div className="relative h-2.5 bg-muted rounded-full overflow-hidden">
      {/* Background shimmer for active states */}
      {(status === "uploading" || status === "preparing" || status === "processing") && (
        <div className="absolute inset-0 shimmer opacity-30" />
      )}
      {/* Progress fill */}
      <motion.div
        className={cn("h-full rounded-full bg-gradient-to-r transition-colors", barColor)}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{ width: `${pct}%` }}
      >
        {/* Animated shimmer overlay for uploading */}
        {(status === "uploading" || status === "preparing" || status === "processing") && (
          <div className="absolute inset-0 bg-white/20 animate-pulse" style={{ borderRadius: "inherit" }} />
        )}
      </motion.div>
      {/* Percentage text overlay for active uploads */}
      {(status === "uploading" || status === "preparing" || status === "processing") && (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white mix-blend-difference">
          {pct.toFixed(0)}%
        </div>
      )}
    </div>
  );
}

export function UploadManagerPanel() {
  const { jobs, showPanel, setShowPanel, cancelJob, retryJob, clearCompleted } = useUploadStore();
  const active = jobs.filter((j) => j.status === "uploading" || j.status === "queued" || j.status === "preparing" || j.status === "processing").length;
  const totalBytes = jobs.reduce((acc, j) => acc + (j.size || 0), 0);
  const uploadedBytes = jobs.reduce((acc, j) => acc + (j.uploadedBytes || 0), 0);
  const completedCount = jobs.filter((j) => j.status === "completed").length;
  const failedCount = jobs.filter((j) => j.status === "failed").length;
  const overallProgress = jobs.length > 0 ? jobs.reduce((a, j) => a + (j.progress || 0), 0) / jobs.length : 0;
  const totalSpeed = jobs.filter((j) => j.status === "uploading").reduce((acc, j) => acc + (j.speed || 0), 0);

  return (
    <>
      {/* Floating trigger button */}
      <AnimatePresence>
        {jobs.length > 0 && !showPanel && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onClick={() => setShowPanel(true)}
            className="flex fixed bottom-20 md:bottom-6 right-4 z-40 items-center gap-2 pl-3 pr-4 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-xl shadow-emerald-500/30 hover:scale-105 transition-all"
          >
            <div className="relative">
              {active > 0 ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {active > 0 && (
                <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {active}
                </span>
              )}
            </div>
            <span className="text-sm font-medium">{active > 0 ? `${active} active` : "Uploads"}</span>
            {active > 0 && (
              <>
                <span className="text-xs opacity-90">{(overallProgress * 100).toFixed(0)}%</span>
                <div className="w-1 h-6 bg-white/30 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-white"
                    initial={{ height: 0 }}
                    animate={{ height: `${overallProgress * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      <Sheet open={showPanel} onOpenChange={setShowPanel}>
        <SheetContent side="bottom" className="h-[85vh] max-h-[85vh] p-0 rounded-t-3xl border-t-2 border-emerald-500/20">
          <SheetHeader className="px-5 py-4 border-b bg-gradient-to-r from-emerald-500/5 to-cyan-500/5">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2.5 text-lg">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-md">
                  <Upload className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-bold">Upload Manager</div>
                  <div className="text-xs font-normal text-muted-foreground">
                    {active} active · {completedCount} done{failedCount > 0 && ` · ${failedCount} failed`}
                    {totalBytes > 0 && ` · ${formatBytes(uploadedBytes)} / ${formatBytes(totalBytes)}`}
                    {totalSpeed > 0 && ` · ${formatSpeed(totalSpeed)}`}
                  </div>
                </div>
              </SheetTitle>
            </div>
            {jobs.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                  <span>Overall progress</span>
                  <span className="font-medium">{(overallProgress * 100).toFixed(0)}%</span>
                </div>
                <ProgressBar progress={overallProgress} status={active > 0 ? "uploading" : "completed"} />
              </div>
            )}
          </SheetHeader>

          <div className="p-4 space-y-2.5 overflow-y-auto scroll-thin h-[calc(85vh-180px)]">
            <AnimatePresence mode="popLayout">
              {jobs.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Upload className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">No active uploads</p>
                  <p className="text-xs text-muted-foreground mt-1">Files you upload will appear here with real-time progress.</p>
                </motion.div>
              )}
              {jobs.map((j) => (
                <motion.div
                  key={j.id}
                  layout
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95, height: 0 }}
                  transition={{ type: "spring", stiffness: 280, damping: 25 }}
                >
                  <Card className="p-3.5 border-border/60 hover:shadow-md transition-shadow overflow-hidden">
                    <div className="flex items-start gap-3">
                      {/* Status icon */}
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                        j.status === "completed" ? "bg-emerald-500/15" :
                        j.status === "failed" ? "bg-rose-500/15" :
                        j.status === "cancelled" ? "bg-muted" :
                        j.status === "processing" ? "bg-blue-500/15" :
                        j.status === "preparing" ? "bg-amber-500/15" :
                        "bg-primary/10"
                      )}>
                        {j.status === "completed" ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        ) : j.status === "failed" ? (
                          <AlertCircle className="w-5 h-5 text-rose-500" />
                        ) : j.status === "cancelled" ? (
                          <X className="w-5 h-5 text-muted-foreground" />
                        ) : j.status === "processing" ? (
                          <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                        ) : j.status === "preparing" ? (
                          <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                        ) : j.status === "uploading" ? (
                          <Loader2 className="w-5 h-5 text-primary animate-spin" />
                        ) : (
                          <MediaTypeIcon type={j.mediaType} className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>

                      {/* File info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium truncate flex-1">{j.filename}</div>
                          <StatusBadge status={j.status} />
                        </div>

                        {/* Size + type info */}
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-1">
                          <span>{formatBytes(j.uploadedBytes)} / {formatBytes(j.size)}</span>
                          <Badge variant="outline" className="text-[9px] px-1 py-0 capitalize">{j.mediaType}</Badge>
                          {j.visibility === "private" && <span className="text-amber-600">· Private</span>}
                        </div>

                        {/* Speed + ETA — show during uploading */}
                        {j.status === "uploading" && (
                          <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-2">
                            <span className="flex items-center gap-0.5">
                              <span className="text-emerald-500 font-medium">{formatSpeed(j.speed)}</span>
                            </span>
                            {j.eta !== null && j.eta > 0 && (
                              <>
                                <span>·</span>
                                <span className="flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5" />
                                  {formatEta(j.eta)}
                                </span>
                              </>
                            )}
                          </div>
                        )}

                        {/* Processing message */}
                        {j.status === "processing" && (
                          <div className="text-[10px] text-blue-500 mt-1 flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Processing on server...
                          </div>
                        )}

                        {/* Preparing message */}
                        {j.status === "preparing" && (
                          <div className="text-[10px] text-amber-500 mt-1 flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Preparing upload...
                          </div>
                        )}

                        {/* Error message */}
                        {j.error && (
                          <div className="text-[11px] text-rose-500 truncate mt-1 font-medium">{j.error}</div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        {j.status === "failed" && (
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => retryJob(j.id)} title="Retry upload">
                            <RefreshCw className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {(j.status === "uploading" || j.status === "queued" || j.status === "preparing") && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-500 hover:text-rose-600" onClick={() => cancelJob(j.id)} title="Cancel upload">
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Progress bar — show for ALL active states + completed */}
                    {j.status !== "cancelled" && j.status !== "failed" && j.status !== "queued" && (
                      <div className="mt-3">
                        <ProgressBar progress={j.progress} status={j.status} />
                      </div>
                    )}
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <SheetFooter className="px-5 py-3 border-t flex items-center justify-between gap-2 bg-background/95 backdrop-blur">
            {(completedCount > 0 || failedCount > 0) && (
              <Button variant="outline" onClick={clearCompleted} size="sm">
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Clear finished
              </Button>
            )}
            <div className="flex-1" />
            <Button variant="ghost" onClick={() => setShowPanel(false)} size="sm">Hide</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    queued: { label: "Queued", className: "bg-muted text-muted-foreground" },
    preparing: { label: "Preparing", className: "bg-amber-500/15 text-amber-600" },
    uploading: { label: "Uploading", className: "bg-emerald-500/15 text-emerald-600" },
    processing: { label: "Processing", className: "bg-blue-500/15 text-blue-600" },
    completed: { label: "Completed", className: "bg-emerald-500/15 text-emerald-600" },
    failed: { label: "Failed", className: "bg-rose-500/15 text-rose-600" },
    cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
  };
  const m = map[status] ?? map.queued;
  return (
    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0", m.className)}>
      {m.label}
    </span>
  );
}

function MediaTypeIcon({ type, className }: { type: string; className?: string }) {
  if (type === "video") return <VideoIcon className={className} />;
  if (type === "photo") return <ImageIcon className={className} />;
  if (type === "contact") return <UsersIcon className={className} />;
  return <FileText className={className} />;
}
