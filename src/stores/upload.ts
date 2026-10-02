"use client";
import { create } from "zustand";

export interface UploadJob {
  id: string;
  uploadId?: string;
  file: File;
  mediaType: "video" | "photo" | "document" | "contact";
  filename: string;
  size: number;
  mimeType: string;
  status: "queued" | "preparing" | "uploading" | "processing" | "completed" | "failed" | "cancelled";
  progress: number; // 0..1
  receivedChunks: number;
  totalChunks: number;
  uploadedBytes: number;
  speed: number; // bytes per second
  eta: number | null; // seconds remaining
  error: string | null;
  startedAt: number;
  finishedAt: number | null;
  visibility: "public" | "private";
  targetUserId?: string;
  assignUserIds?: string[];
  mediaId?: string;
  thumbnailUrl?: string | null;
  _lastSpeedUpdate: number;
  _lastUploadedBytes: number;
}

interface UploadState {
  jobs: UploadJob[];
  maxConcurrent: number;
  showPanel: boolean;
  setShowPanel: (v: boolean) => void;
  addFiles: (
    files: File[],
    opts: { visibility?: "public" | "private"; targetUserId?: string; assignUserIds?: string[] }
  ) => Promise<void>;
  cancelJob: (id: string) => Promise<void>;
  cancelAll: () => Promise<void>;
  retryJob: (id: string) => Promise<void>;
  clearCompleted: () => void;
}

// Use larger chunks for faster uploads — 10MB is a good balance
const CHUNK_SIZE = 10 * 1024 * 1024;

function detectMediaType(file: File): "video" | "photo" | "document" | "contact" {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = file.type;
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("image/")) return "photo";
  if (mime === "text/vcard" || mime === "text/x-vcard" || ext === "vcf") return "contact";
  return "document";
}

const activeUploads = new Set<string>();

async function startJob(job: UploadJob): Promise<void> {
  if (activeUploads.has(job.id)) return;
  activeUploads.add(job.id);

  // Use a local state updater that batches to avoid excessive re-renders
  let pendingUpdate: Partial<UploadJob> = {};
  let updateTimer: any = null;

  const flushUpdate = () => {
    if (Object.keys(pendingUpdate).length > 0) {
      const patch = pendingUpdate;
      pendingUpdate = {};
      useUploadStore.setState((s) => ({
        jobs: s.jobs.map((j) => (j.id === job.id ? { ...j, ...patch } : j)),
      }));
    }
  };

  const setJob = (patch: Partial<UploadJob>) => {
    pendingUpdate = { ...pendingUpdate, ...patch };
    if (!updateTimer) {
      updateTimer = setTimeout(() => {
        updateTimer = null;
        flushUpdate();
      }, 100); // Batch updates every 100ms — smooth but not excessive
    }
  };

  const setJobImmediate = (patch: Partial<UploadJob>) => {
    // For status changes, flush immediately
    if (updateTimer) {
      clearTimeout(updateTimer);
      updateTimer = null;
    }
    pendingUpdate = { ...pendingUpdate, ...patch };
    flushUpdate();
  };

  try {
    setJobImmediate({ status: "preparing", startedAt: Date.now(), progress: 0, uploadedBytes: 0, speed: 0, eta: null, _lastSpeedUpdate: Date.now(), _lastUploadedBytes: 0 });

    // Step 1: Init upload
    const initResp = await fetch("/api/upload/init", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: job.file.name,
        size: job.file.size,
        mimeType: job.file.type || "application/octet-stream",
        visibility: job.visibility,
        targetUserId: job.targetUserId,
        assignUserIds: job.assignUserIds,
      }),
    });
    if (!initResp.ok) {
      const err = await initResp.json().catch(() => ({}));
      throw new Error(err.error ?? "Failed to initialize upload. Please check your connection and try again.");
    }
    const initData = await initResp.json();
    const uploadId = initData.uploadId as string;
    const chunkSize = initData.chunkSize ?? CHUNK_SIZE;
    const totalChunks = initData.totalChunks;
    setJobImmediate({ uploadId, totalChunks, status: "uploading", progress: 0 });

    // Step 2: Upload chunks with higher concurrency for speed
    const concurrency = Math.min(4, totalChunks);
    let chunkIdx = 0;
    let totalUploaded = 0;
    let lastSpeedCheck = Date.now();
    let lastSpeedBytes = 0;

    const uploadChunk = async (): Promise<void> => {
      while (chunkIdx < totalChunks) {
        const myIdx = chunkIdx++;
        if (myIdx >= totalChunks) return;

        const start = myIdx * chunkSize;
        const end = Math.min(start + chunkSize, job.file.size);
        const blob = job.file.slice(start, end);
        const formData = new FormData();
        formData.append("uploadId", uploadId);
        formData.append("index", String(myIdx));
        formData.append("chunk", blob);

        let attempt = 0;
        let success = false;
        while (attempt < 3 && !success) {
          try {
            const r = await fetch("/api/upload/chunk", { method: "POST", body: formData });
            if (!r.ok) {
              const err = await r.json().catch(() => ({}));
              throw new Error(err.error ?? `Upload failed for chunk ${myIdx + 1}`);
            }
            success = true;
            const data = await r.json();
            totalUploaded = Math.min(data.receivedChunks * chunkSize, job.size);

            // Calculate speed every 300ms for smoother updates
            const now = Date.now();
            const elapsed = (now - lastSpeedCheck) / 1000;
            if (elapsed >= 0.3) {
              const bytesInPeriod = totalUploaded - lastSpeedBytes;
              const speed = elapsed > 0 ? bytesInPeriod / elapsed : 0;
              const remaining = job.size - totalUploaded;
              const eta = speed > 0 ? remaining / speed : null;
              setJob({
                receivedChunks: data.receivedChunks,
                progress: data.receivedChunks / totalChunks,
                uploadedBytes: totalUploaded,
                speed,
                eta,
              });
              lastSpeedCheck = now;
              lastSpeedBytes = totalUploaded;
            } else {
              setJob({
                receivedChunks: data.receivedChunks,
                progress: data.receivedChunks / totalChunks,
                uploadedBytes: totalUploaded,
              });
            }
          } catch (e: any) {
            attempt++;
            if (attempt >= 3) {
              throw new Error(`Failed to upload chunk ${myIdx + 1} after 3 attempts. ${e?.message ?? "Network error."}`);
            }
            await new Promise((r) => setTimeout(r, 500 * attempt));
          }
        }
      }
    };

    const workers = Array.from({ length: concurrency }, () => uploadChunk());
    await Promise.all(workers);

    // Flush any pending updates before status change
    setJobImmediate({ progress: 1, uploadedBytes: job.size, speed: 0, eta: 0 });

    // Step 3: Complete upload — show "processing" status
    setJobImmediate({ status: "processing" });
    const compResp = await fetch("/api/upload/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadId,
        visibility: job.visibility,
        assignUserIds: job.assignUserIds,
      }),
    });
    if (!compResp.ok) {
      const err = await compResp.json().catch(() => ({}));
      throw new Error(err.error ?? "Upload completed but server processing failed. The file may need to be re-uploaded.");
    }
    const compData = await compResp.json();
    setJobImmediate({
      status: "completed",
      progress: 1,
      uploadedBytes: job.size,
      finishedAt: Date.now(),
      mediaId: compData.mediaId,
      thumbnailUrl: compData.media?.thumbnailUrl ?? null,
      speed: 0,
      eta: 0,
    });

    // Broadcast for real-time UI sync
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("escloud-data-changed", { detail: { type: "upload", mediaId: compData.mediaId } }));
    }
  } catch (e: any) {
    setJobImmediate({ status: "failed", error: e?.message ?? "Upload failed. Please try again.", finishedAt: Date.now(), speed: 0, eta: null });
  } finally {
    // Flush any remaining pending updates
    if (updateTimer) {
      clearTimeout(updateTimer);
      updateTimer = null;
    }
    flushUpdate();
    activeUploads.delete(job.id);
  }
}

export const useUploadStore = create<UploadState>((set, get) => ({
  jobs: [],
  maxConcurrent: 3,
  showPanel: false,
  setShowPanel: (v) => set({ showPanel: v }),
  addFiles: async (files, opts) => {
    const visibility = opts.visibility ?? "public";
    const seen = new Set<string>();
    const uniqueFiles = files.filter((f) => {
      const key = `${f.name}-${f.size}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const newJobs: UploadJob[] = uniqueFiles.map((f) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file: f,
      mediaType: detectMediaType(f),
      filename: f.name,
      size: f.size,
      mimeType: f.type || "application/octet-stream",
      status: "queued",
      progress: 0,
      receivedChunks: 0,
      totalChunks: 0,
      uploadedBytes: 0,
      speed: 0,
      eta: null,
      error: null,
      startedAt: 0,
      finishedAt: null,
      visibility,
      targetUserId: opts.targetUserId,
      assignUserIds: opts.assignUserIds,
      _lastSpeedUpdate: 0,
      _lastUploadedBytes: 0,
    }));

    set((s) => ({ jobs: [...s.jobs, ...newJobs], showPanel: true }));

    const queue = [...newJobs];
    const max = get().maxConcurrent;
    const workers = Array.from({ length: Math.min(max, queue.length) }, async () => {
      while (queue.length > 0) {
        const job = queue.shift();
        if (!job) break;
        await startJob(job);
      }
    });
    await Promise.all(workers);
  },
  cancelJob: async (id) => {
    const job = get().jobs.find((j) => j.id === id);
    if (job?.uploadId) {
      try {
        await fetch("/api/upload/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId: job.uploadId }),
        });
      } catch {}
    }
    activeUploads.delete(id);
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? { ...j, status: "cancelled", finishedAt: Date.now() } : j)),
    }));
  },
  cancelAll: async () => {
    const jobs = get().jobs;
    for (const j of jobs) {
      if (j.status === "uploading" || j.status === "queued") {
        await get().cancelJob(j.id);
      }
    }
  },
  retryJob: async (id) => {
    const job = get().jobs.find((j) => j.id === id);
    if (!job) return;
    set((s) => ({
      jobs: s.jobs.map((j) => (j.id === id ? {
        ...j,
        status: "queued",
        progress: 0,
        receivedChunks: 0,
        uploadedBytes: 0,
        speed: 0,
        eta: null,
        error: null,
        startedAt: 0,
        finishedAt: null,
        uploadId: undefined,
      } : j)),
    }));
    await startJob({
      ...job,
      status: "queued",
      progress: 0,
      receivedChunks: 0,
      uploadedBytes: 0,
      speed: 0,
      eta: null,
      error: null,
      startedAt: 0,
      finishedAt: null,
      uploadId: undefined,
    });
  },
  clearCompleted: () => {
    set((s) => ({ jobs: s.jobs.filter((j) => j.status !== "completed" && j.status !== "cancelled") }));
  },
}));
