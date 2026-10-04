import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getRequestContext, jsonError, jsonOk, canAccessMedia } from "@/lib/api";
import { PATHS, getStorageRelativePath } from "@/lib/storage";
import { promises as fs } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

// POST /api/media/[id]/upload-thumbnail
// Body (multipart/form-data): thumbnail (Blob/File — JPEG/PNG/WebP)
// Resizes the uploaded image to 480px wide (matching auto-generated thumbnails)
// and saves it as the thumbnail for the media item.
// Works for any media type (video, photo, document).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getRequestContext(req);
  if (!ctx.user) return jsonError("Not authenticated", 401);
  const { id } = await params;
  const canSee = await canAccessMedia(ctx.user, id);
  if (!canSee) return jsonError("Not authorized", 403);

  const media = await db.media.findUnique({ where: { id } });
  if (!media) return jsonError("Not found", 404);

  // Only the owner or admin can change the thumbnail
  if (media.ownerId !== ctx.user.id && ctx.user.role !== "admin") {
    return jsonError("Not authorized", 403);
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return jsonError("Expected multipart/form-data", 400);
  }

  const thumbnail = formData.get("thumbnail");
  if (!thumbnail || !(thumbnail instanceof Blob)) {
    return jsonError("thumbnail file is required", 400);
  }

  // Validate it's an image
  const mimeType = thumbnail.type;
  if (!mimeType.startsWith("image/")) {
    return jsonError("Thumbnail must be an image file (JPEG, PNG, or WebP)", 400);
  }

  // Limit to 10MB for the uploaded thumbnail
  if (thumbnail.size > 10 * 1024 * 1024) {
    return jsonError("Thumbnail image must be under 10MB", 400);
  }

  try {
    // Save the uploaded image to a temp file
    const tmpDir = path.join(PATHS.TMP);
    await fs.mkdir(tmpDir, { recursive: true });
    const tmpExt = mimeType === "image/png" ? ".png" : mimeType === "image/webp" ? ".webp" : ".jpg";
    const tmpPath = path.join(tmpDir, `thumb-upload-${id}-${Date.now()}${tmpExt}`);
    const buf = Buffer.from(await thumbnail.arrayBuffer());
    await fs.writeFile(tmpPath, buf);

    // The thumbnail file path — use the media ID so it matches the auto-generated naming
    const thumbName = `${id}.jpg`;
    const thumbAbs = path.join(PATHS.THUMBNAILS, thumbName);
    await fs.mkdir(PATHS.THUMBNAILS, { recursive: true });

    // Use ffmpeg to resize the image to 480px wide (preserve aspect ratio) and
    // convert to JPEG. This matches the auto-generated thumbnail format.
    // -vf "scale=480:-2" = 480px wide, height auto (must be even for JPEG)
    // -q:v 4 = high quality JPEG
    // -update 1 = required by ffmpeg 7.x for single image output
    try {
      await execAsync(
        `ffmpeg -y -i "${tmpPath}" -vf "scale=480:-2" -q:v 4 -update 1 "${thumbAbs}"`,
        { timeout: 15000 }
      );
    } catch (e: any) {
      // ffmpeg failed — try just copying the original image as the thumbnail
      // (in case ffmpeg can't handle the format, use sharp as a fallback)
      try {
        const sharp = (await import("sharp")).default;
        await sharp(buf)
          .resize(480, null, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toFile(thumbAbs);
      } catch {
        // Last resort: save the original image as-is (no resize)
        await fs.copyFile(tmpPath, thumbAbs);
      }
    }

    // Verify the thumbnail was created
    const stat = await fs.stat(thumbAbs).catch(() => null);
    if (!stat || stat.size === 0) {
      return jsonError("Failed to process the uploaded thumbnail", 500);
    }

    // Clean up the temp file
    try { await fs.unlink(tmpPath); } catch {}

    // Update the media record with the new thumbnail path
    const thumbnailRel = getStorageRelativePath(thumbAbs);
    await db.media.update({
      where: { id },
      data: { thumbnailPath: thumbnailRel },
    });

    // Broadcast for real-time UI sync
    return jsonOk({
      ok: true,
      thumbnailUrl: `/api/media/${id}/thumbnail?t=${Date.now()}`,
    });
  } catch (e: any) {
    console.error("Thumbnail upload failed:", e);
    return jsonError(e?.message ?? "Failed to upload thumbnail", 500);
  }
}
