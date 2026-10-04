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
 * IMPORTANT: -update 1 is required by ffmpeg 7.x to write a single frame
 * to a non-sequence filename (without it, ffmpeg treats the output as an
 * image sequence and may fail to write the file).
 */
async function tryGenerateAt(
  videoAbs: string,
  thumbAbs: string,
  seekSeconds: number
): Promise<boolean> {
  const ts = formatTimecode(seekSeconds);
  try {
    // -update 1 = allow writing to a single non-sequence filename
    // -frames:v 1 = extract exactly one frame
    // scale=480:-2 = 480px wide, preserve aspect ratio (must be even)
    // -q:v 4 = high quality JPEG
    await execAsync(
      `ffmpeg -y -ss ${ts} -i "${videoAbs}" -frames:v 1 -vf "scale=480:-2" -q:v 4 -update 1 "${thumbAbs}"`,
      { timeout: 30000 }
    );
    const stat = await fs.stat(thumbAbs).catch(() => null);
    if (stat && stat.size > 0) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Generate a thumbnail from a video.
 * PRIMARY: seek to exactly 2 seconds and capture that frame (user's request).
 * Fallbacks only if 2s fails.
 */
export async function generateVideoThumbnail(
  videoAbs: string,
  mediaId: string
): Promise<{ thumbnailRel: string; duration: number | null; width: number | null; height: number | null }> {
  const thumbName = `${mediaId}.jpg`;
  const thumbAbs = path.join(PATHS.THUMBNAILS, thumbName);
  await fs.mkdir(PATHS.THUMBNAILS, { recursive: true });

  const meta = await probeVideoMetadata(videoAbs);
  const duration = meta.duration;

  // PRIMARY: 2 seconds. Fallbacks: 1s, 0.5s, 0.1s, 0, then no-seek.
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
  for (const seek of uniqueAttempts) {
    try { await fs.unlink(thumbAbs); } catch {}
    if (await tryGenerateAt(videoAbs, thumbAbs, seek)) {
      thumbnailSuccess = true;
      usedSeek = seek;
      break;
    }
  }

  // Last resort: no seek, decode from start
  if (!thumbnailSuccess) {
    try { await fs.unlink(thumbAbs); } catch {}
    try {
      await execAsync(
        `ffmpeg -y -i "${videoAbs}" -frames:v 1 -vf "scale=480:-2" -q:v 4 -update 1 "${thumbAbs}"`,
        { timeout: 30000 }
      );
      const stat = await fs.stat(thumbAbs).catch(() => null);
      if (stat && stat.size > 0) {
        thumbnailSuccess = true;
        usedSeek = 0;
      }
    } catch (e) {
      console.error("Video thumbnail generation failed completely:", e);
    }
  }

  if (thumbnailSuccess) {
    console.log(`[video-thumb] Thumbnail for ${mediaId} generated at ${usedSeek}s`);
  } else {
    console.error(`[video-thumb] FAILED to generate thumbnail for ${mediaId}`);
  }

  const thumbnailRel = thumbnailSuccess ? getStorageRelativePath(thumbAbs) : "";
  return {
    thumbnailRel,
    duration,
    width: meta.width,
    height: meta.height,
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
