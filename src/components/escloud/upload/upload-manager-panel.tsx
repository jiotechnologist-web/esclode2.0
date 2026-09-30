"use client";
import { useUploadStore } from "@/stores/upload";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Upload, X, Loader2, CheckCircle2, AlertCircle, RefreshCw, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { formatBytes } from "../shared/use-media-list";
import { cn } from "@/lib/utils";

export function UploadManagerPanel() {
  const { jobs, showPanel, setShowPanel, cancelJob, retryJob, clearCompleted } = useUploadStore();
  const active = jobs.filter((j) => j.status === "uploading" || j.status === "queued").length;
  const totalBytes = jobs.reduce((acc, j) => acc + (j.size || 0), 0);
  const overallProgress = jobs.length > 0 ? jobs.reduce((a, j) => a + j.progress, 0) / jobs.length : 0;

  return (
    <>
      {/* Floating trigger (bottom-right on desktop) */}
      {jobs.length > 0 && !showPanel && (
        <button
          onClick={() => setShowPanel(true)}
          className="hidden md:flex fixed bottom-4 right-4 z-40 items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-95"
        >
          <Upload className="w-4 h-4" />
          <span className="text-sm font-medium">{active} active</span>
          <span className="text-xs opacity-80">{(overallProgress * 100).toFixed(0)}%</span>
        </button>
      )}

      {/* Mobile: bottom sheet */}
      <Sheet open={showPanel} onOpenChange={setShowPanel}>
        <SheetContent side="bottom" className="h-[80vh] max-h-[80vh] p-0">
          <SheetHeader className="px-4 py-3 border-b">
            <SheetTitle className="flex items-center gap-2 text-base">
              <Upload className="w-4 h-4 text-primary" /> Upload Manager
              <Badge variant="secondary" className="text-[10px]">{jobs.length}</Badge>
            </SheetTitle>
            <div className="text-xs text-muted-foreground mt-1">
              {active} active · {formatBytes(totalBytes)} total
            </div>
            <Progress value={overallProgress * 100} className="h-1 mt-2 brand-progress" />
          </SheetHeader>
          <div className="p-3 space-y-2 overflow-y-auto scroll-thin h-[calc(80vh-160px)]">
            {jobs.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-12">No active uploads</div>
            )}
            {jobs.map((j) => (
              <Card key={j.id} className="p-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    {j.status === "completed" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : j.status === "failed" ? (
                      <AlertCircle className="w-4 h-4 text-rose-500" />
                    ) : j.status === "cancelled" ? (
                      <X className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{j.filename}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <span>{formatBytes(j.size)}</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0">{j.mediaType}</Badge>
                      {j.status === "uploading" && <span>· {j.receivedChunks}/{j.totalChunks}</span>}
                    </div>
                    {j.error && <div className="text-[11px] text-rose-500 truncate mt-0.5">{j.error}</div>}
                  </div>
                  <div className="flex items-center gap-1">
                    {j.status === "failed" && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => retryJob(j.id)}>
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                    )}
                    {(j.status === "uploading" || j.status === "queued") && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => cancelJob(j.id)}>
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
                {(j.status === "uploading" || j.status === "completed") && (
                  <Progress value={j.progress * 100} className="h-1 mt-2 brand-progress" />
                )}
              </Card>
            ))}
          </div>
          <SheetFooter className="px-4 py-3 border-t">
            <Button variant="outline" onClick={clearCompleted} size="sm">
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Clear finished
            </Button>
            <Button variant="outline" onClick={() => setShowPanel(false)} size="sm">Hide</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
