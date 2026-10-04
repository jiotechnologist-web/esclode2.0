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
 * Tries multiple approaches to be robust against various video formats
 * (phone-recorded HEVC, fragmented MP4, streams without explicit duration, etc.).
 */
async function probeVideoMetadata(videoAbs: string): Promise<VideoMetadata> {
  let duration: number | null = null;
  let width: number | null = null;
  let height: number | null = null;

  // Approach 1: stream-level metadata (most accurate for standard MP4/MOV)
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
  } catch {
    // fall through to next approach
  }

  // Approach 2: format-level duration (works for fragmented MP4 / streams without stream duration)
  if (duration === null) {
    try {
      const { stdout } = await execAsync(
        `ffprobe -v error -show_entries format=duration -of csv=p=0 "${videoAbs}"`,
        { timeout: 15000 }
      );
      const d = parseFloat(stdout.trim());
      if (!isNaN(d) && d > 0) duration = d;
    } catch {
      // fall through
    }
  }

  // Approach 3: get width/height from format if stream probe failed
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
    } catch {
      // give up
    }
  }

  return { duration, width, height };
}

/**
 * Try to generate a thumbnail at a specific timestamp using fast seek
 * (`-ss` BEFORE `-i` for fast seek to nearest keyframe).
 * Returns true on success, false on failure.
 */
async function tryGenerateAt(
  videoAbs: string,
  thumbAbs: string,
  seekSeconds: number
): Promise<boolean> {
  const ts = formatTimecode(seekSeconds);
  try {
    // Fast seek: -ss before -i jumps to nearest keyframe (fast, works for most formats).
    // -frames:v 1 = extract exactly one frame.
    // -vf scale=480:-2 = scale to 480px wide, preserve aspect ratio (must be even).
    // -q:v 4 = high quality JPEG (2-31, lower is better).
    await execAsync(
      `ffmpeg -y -ss ${ts} -i "${videoAbs}" -frames:v 1 -vf "scale=480:-2" -q:v 4 "${thumbAbs}"`,
      { timeout: 30000 }
    );
    // Verify the file was created and is non-empty
    const stat = await fs.stat(thumbAbs).catch(() => null);
    if (stat && stat.size > 0) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Generate a thumbnail from a video.
 *
 * PRIMARY: seek to exactly 2 seconds and capture that frame as the thumbnail.
 * This is what the user explicitly requested — "video start 2s & capture this".
 *
 * FALLBACKS (only if 2s fails — e.g. video shorter than 2s, or no keyframe near 2s):
 *   - 1s
 *   - 0.5s
 *   - 0.1s
 *   - 0 (first frame)
 *   - decode from start without seeking
 *
 * Returns the relative storage path of the thumbnail (empty string on total failure).
 */
export async function generateVideoThumbnail(
  videoAbs: string,
  mediaId: string
): Promise<{ thumbnailRel: string; duration: number | null; width: number | null; height: number | null }> {
  const thumbName = `${mediaId}.jpg`;
  const thumbAbs = path.join(PATHS.THUMBNAILS, thumbName);
  await fs.mkdir(PATHS.THUMBNAILS, { recursive: true });

  // Probe metadata first so we know the duration (for fallback timestamp selection)
  const meta = await probeVideoMetadata(videoAbs);
  const duration = meta.duration;

  // Build the list of timestamps to try.
  // PRIMARY: 2 seconds (user's explicit request).
  // If the video is shorter than 2s, we still try 2s first (ffmpeg will clamp or
  // return the last frame), but the fallbacks ensure we get something.
  const seekAttempts: number[] = [2];
  if (duration && duration > 0) {
    // Add smart fallbacks based on actual duration
    if (duration > 2) {
      // Video is longer than 2s — 2s should work. Fallbacks: 1s, 0.5s, 0.1s, 0
      seekAttempts.push(1, 0.5, 0.1, 0);
    } else if (duration > 1) {
      // Video is 1-2s — 2s might overshoot. Fallbacks: 1s, 0.5s, 0.1s, 0
      seekAttempts.push(1, 0.5, 0.1, 0);
    } else if (duration > 0.5) {
      // Very short video. Fallbacks: 0.5s, 0.1s, 0
      seekAttempts.push(0.5, 0.1, 0);
    } else {
      // Tiny video. Fallbacks: 0.1s, 0
      seekAttempts.push(0.1, 0);
    }
  } else {
    // Unknown duration — try 2s first (per user request), then smaller values
    seekAttempts.push(1, 0.5, 0.1, 0);
  }
  // De-duplicate while preserving order
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
    // Clear any previous attempt's file
    try { await fs.unlink(thumbAbs); } catch {}
    if (await tryGenerateAt(videoAbs, thumbAbs, seek)) {
      thumbnailSuccess = true;
      usedSeek = seek;
      break;
    }
  }

  // Last-resort: try without seeking at all (decode from start)
  if (!thumbnailSuccess) {
    try { await fs.unlink(thumbAbs); } catch {}
    try {
      await execAsync(
        `ffmpeg -y -i "${videoAbs}" -frames:v 1 -vf "scale=480:-2" -q:v 4 "${thumbAbs}"`,
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

  if (thumbnailSuccess && usedSeek !== 2) {
    console.log(`[video-thumb] Thumbnail for ${mediaId} generated at ${usedSeek}s (2s fallback)`);
  } else if (thumbnailSuccess) {
    console.log(`[video-thumb] Thumbnail for ${mediaId} generated at 2s`);
  }

  const thumbnailRel = thumbnailSuccess ? getStorageRelativePath(thumbAbs) : "";
  return {
    thumbnailRel,
    duration,
    width: meta.width,
    height: meta.height,
  };
}

/**
 * Generate a specific thumbnail at a custom timestamp (for admin manual selection).
 */
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
    `ffmpeg -y -ss ${ts} -i "${videoAbs}" -frames:v 1 -vf "scale=480:-2" -q:v 4 "${thumbAbs}"`,
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
