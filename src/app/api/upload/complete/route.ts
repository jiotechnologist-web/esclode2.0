import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getRequestContext, jsonError, jsonOk, checkPermission } from "@/lib/api";
import { resolveStoragePath, getMediaTypeDir, getStorageRelativePath, PATHS } from "@/lib/storage";
import { promises as fs } from "fs";
import path from "path";
import { ensureThumbnailForImage, generatePhotoMetadata } from "@/lib/media";
import { serializePermissions } from "@/lib/permissions";

const THUMB_SIZE = 480;
import sharp from "sharp";

export async function POST(req: NextRequest) {
  const ctx = await getRequestContext(req);
  if (!ctx.user) return jsonError("Not authenticated", 401);
  try {
    const body = await req.json();
    const uploadId = String(body.uploadId ?? "");
    if (!uploadId) return jsonError("Missing uploadId", 400);

    const upload = await db.upload.findUnique({ where: { id: uploadId } });
    if (!upload) return jsonError("Upload not found", 404);
    if (upload.userId !== ctx.user.id && ctx.user.role !== "admin") {
      return jsonError("Not allowed", 403);
    }

    if (upload.receivedChunks < upload.totalChunks) {
      return jsonError("Not all chunks received", 400);
    }

    // Move the file from temp to permanent location
    const tmpAbs = resolveStoragePath(upload.storagePath);
    const dir = getMediaTypeDir(upload.mediaType as any);
    await fs.mkdir(dir, { recursive: true });
    const ext = upload.filename.includes(".") ? upload.filename.slice(upload.filename.lastIndexOf(".")) : "";
    const finalName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    const finalAbs = path.join(dir, finalName);
    const finalRel = getStorageRelativePath(finalAbs);
    await fs.rename(tmpAbs, finalAbs);

    // Generate thumbnail for images
    let thumbRel: string | null = null;
    let width: number | null = null;
    let height: number | null = null;
    if (upload.mediaType === "photo") {
      try {
        const meta = await generatePhotoMetadata(finalAbs);
        width = meta.width;
        height = meta.height;
        thumbRel = await ensureThumbnailForImage(upload.id, finalAbs, ext);
      } catch (e) {
        console.error("Thumbnail generation failed", e);
      }
    }

    // Determine approval status (default approved unless user requires approval)
    const owner = await db.user.findUnique({ where: { id: upload.userId } });
    const approvalStatus = owner?.approvalRequired ? "pending" : "approved";
    const status = approvalStatus === "pending" ? "pending" : "ready";

    // Create media record
    const media = await db.media.create({
      data: {
        type: upload.mediaType,
        name: upload.filename.replace(/\.[^.]+$/, ""),
        originalName: upload.filename,
        mimeType: upload.mimeType,
        size: upload.fileSize,
        visibility: body.visibility === "private" ? "private" : "public",
        status,
        approvalStatus,
        ownerId: upload.userId,
        storagePath: finalRel,
        thumbnailPath: thumbRel,
        width,
        height,
        docType: upload.mediaType === "document" ? inferDocType(upload.filename) : null,
      },
    });

    // Assign private access if requested
    if (media.visibility === "private" && Array.isArray(body.assignUserIds)) {
      const ids = (body.assignUserIds as string[]).filter(Boolean);
      if (ids.length > 0) {
        await db.privateAccess.createMany({
          data: ids.map((uid) => ({ mediaId: media.id, userId: uid, grantedBy: ctx.user!.id })),
          skipDuplicates: true,
        });
      }
    }

    // Mark upload completed
    await db.upload.update({
      where: { id: upload.id },
      data: { status: "completed", completedAt: new Date(), mediaId: media.id },
    });

    // Record daily usage
    const today = new Date().toISOString().slice(0, 10);
    const existing = await db.dailyUsage.findUnique({
      where: { userId_date: { userId: upload.userId, date: today } },
    });
    if (existing) {
      await db.dailyUsage.update({
        where: { id: existing.id },
        data: { uploadBytes: existing.uploadBytes + upload.fileSize, uploadCount: existing.uploadCount + 1 },
      });
    } else {
      await db.dailyUsage.create({
        data: { userId: upload.userId, date: today, uploadBytes: upload.fileSize, uploadCount: 1 },
      });
    }

    return jsonOk({
      mediaId: media.id,
      media: {
        id: media.id,
        type: media.type,
        name: media.name,
        originalName: media.originalName,
        mimeType: media.mimeType,
        size: Number(media.size),
        visibility: media.visibility,
        status: media.status,
        approvalStatus: media.approvalStatus,
        ownerId: media.ownerId,
        thumbnailUrl: thumbRel ? `/api/media/${media.id}/thumbnail` : null,
        streamUrl: media.type === "video" || media.type === "photo" ? `/api/media/${media.id}/stream` : null,
        downloadUrl: `/api/media/${media.id}/download`,
        duration: media.duration,
        width: media.width,
        height: media.height,
        resolution: media.resolution,
        hlsPath: media.hlsPath,
        docType: media.docType,
        contactName: media.contactName,
        contactCount: media.contactCount,
        folderId: media.folderId,
        tags: [],
        createdAt: media.createdAt.toISOString(),
        isFavorite: false,
      },
    });
  } catch (e: any) {
    return jsonError(e?.message ?? "Upload complete failed", 500);
  }
}

function inferDocType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    pdf: "pdf",
    doc: "doc",
    docx: "docx",
    xls: "xls",
    xlsx: "xlsx",
    ppt: "ppt",
    pptx: "pptx",
    txt: "txt",
    csv: "csv",
    zip: "zip",
    rar: "rar",
    "7z": "7z",
    apk: "apk",
  };
  return map[ext] ?? "other";
}
