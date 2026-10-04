// Video thumbnail + metadata generation using ffmpeg
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { promises as fs } from "fs";
import { PATHS, getStorageRelativePath } from "./storage";

const execAsync = promisify(exec);

export interface VideoMetadata {
  duration: number | null;
  width: number | null;
  height: number | null;
}

/**
 * Probe video metadata (duration, width, height) using ffprobe.
 * Tries multiple approaches to be robust against various video formats.
 */
async function probeVideoMetadata(videoAbs: string): Promise<VideoMetadata> {
  let duration: number | null = null;
  let width: number | null = null;
  let height: number | null = null;

  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration -of csv=p=0 "${videoAbs}"`,
      { timeout: 15000 }
    );
    const parts = stdout.trim().split(",");
    if (parts.length >= 3) {
      width = parseInt(parts[0], 10) || null;
      height = parseInt(parts[1], 10) || null;
      duration = parseFloat(parts[2]) || null;
    }
  } catch {}

  if (duration === null) {
    try {
      const { stdout } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of csv=p=0 "${videoAbs}"`,
        { timeout: 15000 }
      );
      const d = parseFloat(stdout.trim());
      if (!isNaN(d) && d > 0) duration = d;
    } catch {}
  }

  if (width === null || height === null) {
    try {
      const { stdout } = await execAsync(
        `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${videoAbs}"`,
        { timeout: 15000 }
      );
      const parts = stdout.trim().split(",");
      if (parts.length >= 2) {
        if (width === null) width = parseInt(parts[0], 10) || null;
        if (height === null) height = parseInt(parts[1], 10) || null;
      }
    } catch {}
  }

  return { duration, width, height };
}

/**
 * Try to generate a thumbnail at a specific timestamp.
 * Uses fast seek (-ss before -i) for speed + reliability.
 * -update 1 is required by ffmpeg 7.x for single-frame output.
 * Returns { success: boolean, error?: string }.
 */
async function tryGenerateAt(
  videoAbs: string,
  thumbAbs: string,
  seekSeconds: number
): Promise<{ success: boolean; error?: string }> {
  const ts = formatTimecode(seekSeconds);
  try {
    await execAsync(
      `ffmpeg -y -ss ${ts} -i "${videoAbs}" -frames:v 1 -vf "scale=480:-2" -q:v 4 -update 1 "${thumbAbs}" 2>&1`,
      { timeout: 30000 }
    );
    const stat = await fs.stat(thumbAbs).catch(() => null);
    if (stat && stat.size > 0) return { success: true };
    return { success: false, error: "Output file empty" };
  } catch (e: any) {
    return { success: false, error: e?.message ?? "ffmpeg failed" };
  }
}

/**
 * Generate a thumbnail from a video.
 * PRIMARY: seek to exactly 2 seconds and capture that frame (user's request).
 * Fallbacks only if 2s fails.
 * Returns the relative storage path + metadata + any error details.
 */
export async function generateVideoThumbnail(
  videoAbs: string,
  mediaId: string
): Promise<{
  thumbnailRel: string;
  duration: number | null;
  width: number | null;
  height: number | null;
  error?: string;
}> {
  const thumbName = `${mediaId}.jpg`;
  const thumbAbs = path.join(PATHS.THUMBNAILS, thumbName);
  await fs.mkdir(PATHS.THUMBNAILS, { recursive: true });

  // First check if the file exists and is non-empty
  try {
    const stat = await fs.stat(videoAbs);
    if (stat.size === 0) {
      return {
        thumbnailRel: "",
        duration: null,
        width: null,
        height: null,
        error: "Video file is empty (0 bytes) — upload may have failed",
      };
    }
  } catch {
    return {
      thumbnailRel: "",
      duration: null,
      width: null,
      height: null,
      error: "Video file not found on disk",
    };
  }

  // Check if ffprobe can read the file at all
  let ffprobeWorks = false;
  try {
    await execAsync(`ffprobe -v error -show_entries format=duration "${videoAbs}"`, { timeout: 10000 });
    ffprobeWorks = true;
  } catch (e: any) {
    console.error("[video-thumb] ffprobe cannot read file:", e?.message);
  }

  if (!ffprobeWorks) {
    return {
      thumbnailRel: "",
      duration: null,
      width: null,
      height: null,
      error: "Video file is corrupted or uses an unsupported codec (ffprobe cannot read it)",
    };
  }

  // Probe metadata
  const meta = await probeVideoMetadata(videoAbs);
  const duration = meta.duration;

  // Build the list of timestamps to try — 2s first (user's request)
  const seekAttempts: number[] = [2];
  if (duration && duration > 0) {
    if (duration > 2) {
      seekAttempts.push(1, 0.5, 0.1, 0);
    } else if (duration > 1) {
      seekAttempts.push(1, 0.5, 0.1, 0);
    } else if (duration > 0.5) {
      seekAttempts.push(0.5, 0.1, 0);
    } else {
      seekAttempts.push(0.1, 0);
    }
  } else {
    seekAttempts.push(1, 0.5, 0.1, 0);
  }
  const seen = new Set<number>();
  const uniqueAttempts = seekAttempts.filter((s) => {
    const rounded = Math.round(s * 1000) / 1000;
    if (seen.has(rounded)) return false;
    seen.add(rounded);
    return true;
  });

  let thumbnailSuccess = false;
  let usedSeek = 0;
  let lastError = "";
  for (const seek of uniqueAttempts) {
    try { await fs.unlink(thumbAbs); } catch {}
    const result = await tryGenerateAt(videoAbs, thumbAbs, seek);
    if (result.success) {
      thumbnailSuccess = true;
      usedSeek = seek;
      break;
    }
    lastError = result.error ?? "";
  }

  // Last resort: no seek, decode from start
  if (!thumbnailSuccess) {
    try { await fs.unlink(thumbAbs); } catch {}
    try {
      await execAsync(
        `ffmpeg -y -i "${videoAbs}" -frames:v 1 -vf "scale=480:-2" -q:v 4 -update 1 "${thumbAbs}" 2>&1`,
        { timeout: 30000 }
      );
      const stat = await fs.stat(thumbAbs).catch(() => null);
      if (stat && stat.size > 0) {
        thumbnailSuccess = true;
        usedSeek = 0;
      }
    } catch (e: any) {
      lastError = e?.message ?? "ffmpeg failed completely";
      console.error("[video-thumb] All attempts failed:", lastError);
    }
  }

  if (thumbnailSuccess) {
    console.log(`[video-thumb] Thumbnail for ${mediaId} generated at ${usedSeek}s`);
  } else {
    console.error(`[video-thumb] FAILED to generate thumbnail for ${mediaId}: ${lastError}`);
  }

  const thumbnailRel = thumbnailSuccess ? getStorageRelativePath(thumbAbs) : "";
  return {
    thumbnailRel,
    duration,
    width: meta.width,
    height: meta.height,
    error: thumbnailSuccess ? undefined : lastError,
  };
}

export async function generateVideoThumbnailAtTime(
  videoAbs: string,
  mediaId: string,
  timeSeconds: number
): Promise<string> {
  const thumbName = `${mediaId}.jpg`;
  const thumbAbs = path.join(PATHS.THUMBNAILS, thumbName);
  await fs.mkdir(PATHS.THUMBNAILS, { recursive: true });
  const ts = formatTimecode(timeSeconds);
  await execAsync(
    `ffmpeg -y -ss ${ts} -i "${videoAbs}" -frames:v 1 -vf "scale=480:-2" -q:v 4 -update 1 "${thumbAbs}"`,
    { timeout: 30000 }
  );
  return getStorageRelativePath(thumbAbs);
}

function formatTimecode(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
