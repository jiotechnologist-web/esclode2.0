import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getRequestContext, jsonError, jsonOk } from "@/lib/api";
import { resolveStoragePath } from "@/lib/storage";
import { generateVideoThumbnail } from "@/lib/video-thumb";

// POST /api/media/regenerate-thumbnails
// Regenerates thumbnails + metadata for videos that are missing them.
// Admin can regenerate for any video; regular users can only regenerate
// for their own videos. Body: { mediaId?: string } — if mediaId is provided,
// only that video is regenerated; otherwise all videos with null/empty
// thumbnailPath or null duration are processed (admin only for bulk).
export async function POST(req: NextRequest) {
  const ctx = await getRequestContext(req);
  if (!ctx.user) return jsonError("Not authenticated", 401);

  try {
    const body = await req.json().catch(() => ({}));
    const specificId = body.mediaId ? String(body.mediaId) : null;

    // Regular users can only regenerate a specific video they own
    if (ctx.user.role !== "admin" && !specificId) {
      return jsonError("Admin only for bulk regeneration; pass mediaId for your own video", 403);
    }

    const where: any = { type: "video" };
    if (specificId) {
      where.id = specificId;
      // Non-admin: restrict to own videos
      if (ctx.user.role !== "admin") where.ownerId = ctx.user.id;
    } else {
      // Admin bulk: only videos missing a thumbnail OR missing duration
      where.OR = [
        { thumbnailPath: null },
        { thumbnailPath: "" },
        { duration: null },
      ];
    }

    const videos = await db.media.findMany({ where, take: 100 });
    let processed = 0;
    let success = 0;
    let failed = 0;
    const errors: { id: string; name: string; error: string }[] = [];

    for (const v of videos) {
      processed++;
      try {
        const videoAbs = resolveStoragePath(v.storagePath);
        const result = await generateVideoThumbnail(videoAbs, v.id);
        await db.media.update({
          where: { id: v.id },
          data: {
            thumbnailPath: result.thumbnailRel || null,
            duration: result.duration,
            width: result.width,
            height: result.height,
          },
        });
        if (result.thumbnailRel) success++;
        else {
          failed++;
          errors.push({ id: v.id, name: v.name, error: "Thumbnail generation returned empty" });
        }
      } catch (e: any) {
        failed++;
        errors.push({ id: v.id, name: v.name, error: e?.message ?? "Unknown error" });
      }
    }

    return jsonOk({
      processed,
      success,
      failed,
      errors: errors.slice(0, 10),
    });
  } catch (e: any) {
    return jsonError(e?.message ?? "Failed to regenerate thumbnails", 500);
  }
}
