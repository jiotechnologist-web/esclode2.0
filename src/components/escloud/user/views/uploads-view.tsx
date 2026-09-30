"use client";
import { useUploadStore } from "@/stores/upload";
import { EmptyState } from "../../shared/media-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, X, Loader2, CheckCircle2, AlertCircle, RefreshCw, Pause, Trash2 } from "lucide-react";
import { formatBytes } from "../../shared/use-media-list";
import { cn } from "@/lib/utils";

export function UploadsView() {
  const { jobs, cancelAll, retryJob, clearCompleted } = useUploadStore();
  const active = jobs.filter((j) => j.status === "uploading" || j.status === "queued");
  const completed = jobs.filter((j) => j.status === "completed");
  const failed = jobs.filter((j) => j.status === "failed");
  const cancelled = jobs.filter((j) => j.status === "cancelled");

  return (
    <div className="px-3 md:px-6 py-4 md:py-6 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Upload className="w-5 h-5 text-primary" /> Upload Manager</h1>
          <p className="text-xs text-muted-foreground">
            {active.length} active · {completed.length} done · {failed.length} failed · {cancelled.length} cancelled
          </p>
        </div>
        {active.length > 0 && (
          <Button variant="outline" size="sm" onClick={cancelAll}>
            <X className="w-3.5 h-3.5 mr-1.5" /> Cancel all
          </Button>
        )}
      </div>

      {jobs.length === 0 ? (
        <EmptyState
          icon={Upload}
          title="No uploads yet"
          description="Files you upload will appear here with real-time progress."
        />
      ) : (
        <div className="space-y-2">
          {jobs.map((j) => (
            <Card key={j.id} className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Upload className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium truncate flex-1">{j.filename}</div>
                    <StatusBadge status={j.status} />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                    <span>{formatBytes(j.size)}</span>
                    <span>·</span>
                    <span>{j.mimeType || j.mediaType}</span>
                    {j.status === "uploading" && (
                      <>
                        <span>·</span>
                        <span>{j.receivedChunks}/{j.totalChunks} chunks</span>
                      </>
                    )}
                    {j.error && (
                      <>
                        <span>·</span>
                        <span className="text-rose-500 truncate">{j.error}</span>
                      </>
                    )}
                  </div>
                  {(j.status === "uploading" || j.status === "completed") && (
                    <Progress value={j.progress * 100} className="h-1.5 mt-2 brand-progress" />
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {(j.status === "failed") && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => retryJob(j.id)} title="Retry">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {(j.status === "uploading" || j.status === "queued") && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => useUploadStore.getState().cancelJob(j.id)} title="Cancel">
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {(completed.length > 0 || failed.length > 0) && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={clearCompleted}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Clear completed
          </Button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: any; icon?: any }> = {
    queued: { label: "Queued", variant: "secondary", icon: Pause },
    uploading: { label: "Uploading", variant: "default", icon: Loader2 },
    completed: { label: "Done", variant: "secondary", icon: CheckCircle2 },
    failed: { label: "Failed", variant: "destructive", icon: AlertCircle },
    cancelled: { label: "Cancelled", variant: "outline", icon: X },
  };
  const m = map[status] ?? map.queued;
  return (
    <Badge variant={m.variant} className="text-[10px]">
      <m.icon className={cn("w-2.5 h-2.5 mr-0.5", status === "uploading" && "animate-spin")} />
      {m.label}
    </Badge>
  );
}
