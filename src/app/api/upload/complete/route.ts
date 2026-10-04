import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getRequestContext, jsonError, jsonOk } from "@/lib/api";
import { PATHS, getStorageRelativePath, resolveStoragePath, categorizeFile } from "@/lib/storage";
import { generateVideoThumbnail } from "@/lib/video-thumb";
import { promises as fs } from "fs";
import path from "path";

// POST /api/upload/complete — finalize an upload, concatenate chunks, create Media record
// Body: { uploadId, visibility, assignUserIds? }
// Returns: { mediaId, media: {...} }
export async function POST(req: NextRequest) {
  const ctx = await getRequestContext(req);
  if (!ctx.user) return jsonError("Not authenticated", 401);

  try {
    const body = await req.json();
    const uploadId = String(body.uploadId ?? "");
    const visibility = body.visibility === "private" ? "private" : "public";
    const assignUserIds: string[] = Array.isArray(body.assignUserIds) ? body.assignUserIds.map(String) : [];

    if (!uploadId) return jsonError("uploadId is required", 400);

    const upload = await db.upload.findUnique({ where: { id: uploadId } });
    if (!upload) return jsonError("Upload not found", 404);
    if (upload.userId !== ctx.user.id && ctx.user.role !== "admin") {
      return jsonError("Not authorized", 403);
    }
    if (upload.status !== "completed" && upload.receivedChunks < upload.totalChunks) {
      return jsonError(`Not all chunks received (${upload.receivedChunks}/${upload.totalChunks})`, 400);
    }

    // Concatenate all chunks into the final storage path
    const incomingDir = path.join(PATHS.UPLOADS, "incoming");
    const finalAbs = resolveStoragePath(upload.storagePath);
    await fs.mkdir(path.dirname(finalAbs), { recursive: true });

    // Stream chunks in order into the final file
    const writeStream = (await import("fs")).createWriteStream(finalAbs);
    for (let i = 0; i < upload.totalChunks; i++) {
      const chunkPath = path.join(incomingDir, `${uploadId}-${i}`);
      try {
        const data = await fs.readFile(chunkPath);
        await new Promise<void>((resolve, reject) => {
          writeStream.write(data, (err) => err ? reject(err) : resolve());
        });
      } catch (e) {
        // Chunk missing — abort
        writeStream.close();
        await db.upload.update({
          where: { id: uploadId },
          data: { status: "failed", errorMessage: `Missing chunk ${i}` },
        });
        return jsonError(`Missing chunk ${i}`, 500);
      }
    }
    await new Promise<void>((resolve) => writeStream.end(() => resolve()));

    // Verify the final file size matches
    const finalStat = await fs.stat(finalAbs);
    if (Number(finalStat.size) !== Number(upload.fileSize)) {
      // Size mismatch — non-fatal, but log it
      console.warn(`Upload ${uploadId}: final size ${finalStat.size} != declared ${upload.fileSize}`);
    }

    // Clean up the chunk files
    for (let i = 0; i < upload.totalChunks; i++) {
      const chunkPath = path.join(incomingDir, `${uploadId}-${i}`);
      try { await fs.unlink(chunkPath); } catch {}
    }

    // Categorize the file
    const { type: mediaType, docType } = categorizeFile(upload.filename, upload.mimeType);

    // Create the Media record
    const media = await db.media.create({
      data: {
        type: mediaType,
        name: upload.filename,
        originalName: upload.filename,
        mimeType: upload.mimeType,
        size: BigInt(finalStat.size),
        visibility,
        status: "ready",
        approvalStatus: "approved",
        ownerId: upload.userId,
        storagePath: upload.storagePath,
        docType: mediaType === "document" ? docType : null,
      },
    });

    // If private + assignUserIds provided, create PrivateAccess rows
    if (visibility === "private" && assignUserIds.length > 0) {
      for (const uid of assignUserIds) {
        try {
          await db.privateAccess.create({
            data: { mediaId: media.id, userId: uid, grantedBy: ctx.user.id },
          });
        } catch {}
      }
      // Also grant the owner access so they can see it in the Private section
      try {
        await db.privateAccess.create({
          data: { mediaId: media.id, userId: upload.userId, grantedBy: ctx.user.id },
        });
      } catch {}
    } else if (visibility === "private") {
      // Owner gets access to their own private content
      try {
        await db.privateAccess.create({
          data: { mediaId: media.id, userId: upload.userId, grantedBy: ctx.user.id },
        });
      } catch {}
    }

    // Generate thumbnail for videos / photos
    let thumbnailRel: string | null = null;
    let duration: number | null = null;
    let width: number | null = null;
    let height: number | null = null;
    if (mediaType === "video") {
      try {
        const thumbResult = await generateVideoThumbnail(finalAbs, media.id);
        thumbnailRel = thumbResult.thumbnailRel || null;
        duration = thumbResult.duration;
        width = thumbResult.width;
        height = thumbResult.height;
      } catch (e) {
        console.error("Video thumbnail generation failed:", e);
      }
      await db.media.update({
        where: { id: media.id },
        data: {
          thumbnailPath: thumbnailRel,
          duration,
          width,
          height,
        },
      });
    } else if (mediaType === "photo") {
      // Use the photo itself as its thumbnail (just reference the storage path)
      thumbnailRel = upload.storagePath;
      await db.media.update({
        where: { id: media.id },
        data: { thumbnailPath: thumbnailRel },
      });
    }

    // Mark the upload as completed
    await db.upload.update({
      where: { id: uploadId },
      data: {
        status: "completed",
        mediaId: media.id,
        completedAt: new Date(),
      },
    });

    return jsonOk({
      mediaId: media.id,
      media: {
        id: media.id,
        type: media.type,
        name: media.name,
        thumbnailUrl: thumbnailRel ? `/api/media/${media.id}/thumbnail` : null,
      },
    });
  } catch (e: any) {
    console.error("Upload complete failed:", e);
    return jsonError(e?.message ?? "Failed to complete upload", 500);
  }
}
