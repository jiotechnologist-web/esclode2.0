import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getRequestContext, jsonError, jsonOk, checkPermission } from "@/lib/api";
import { categorizeFile, getAllowedStoragePath, getStorageRelativePath, PATHS } from "@/lib/storage";
import { promises as fs } from "fs";
import path from "path";
import { logAdminActivity, getClientIp } from "@/lib/auth";

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB chunks - good for resume on flaky networks

export async function POST(req: NextRequest) {
  const ctx = await getRequestContext(req);
  if (!ctx.user) return jsonError("Not authenticated", 401);
  try {
    const body = await req.json();
    const filename = String(body.filename ?? "");
    const size = Number(body.size ?? 0);
    const mimeType = String(body.mimeType ?? "application/octet-stream");
    const visibility = String(body.visibility ?? "public"); // "public" | "private"
    const targetUserId = String(body.targetUserId ?? ctx.user.id); // admin can upload to another user
    const assignUserIds: string[] = Array.isArray(body.assignUserIds) ? body.assignUserIds : [];

    if (!filename || !size) return jsonError("Missing filename/size", 400);

    // Permission check
    const { type } = categorizeFile(filename, mimeType);
    const uploadPermMap: Record<string, string> = {
      video: "upload_videos",
      photo: "upload_photos",
      document: "upload_documents",
      contact: "upload_contacts",
    };

    let ownerId = ctx.user.id;
    if (targetUserId !== ctx.user.id) {
      // Only admin may upload to other user
      if (ctx.user.role !== "admin") return jsonError("Not allowed", 403);
      ownerId = targetUserId;
    } else {
      if (!ctx.user.uploadEnabled) return jsonError("Upload disabled for this account", 403);
      if (!checkPermission(ctx.user, uploadPermMap[type])) return jsonError(`No ${type} upload permission`, 403);
    }

    const targetUser = await db.user.findUnique({ where: { id: ownerId } });
    if (!targetUser) return jsonError("Target user not found", 404);
    if (targetUser.status !== "active") return jsonError("Target user not active", 403);

    // Size validation
    if (size > Number(targetUser.uploadMaxBytes)) {
      return jsonError(`File exceeds max upload size (${targetUser.uploadMaxBytes} bytes)`, 413);
    }

    // Storage quota check
    const used = await db.media.aggregate({ where: { ownerId: ownerId }, _sum: { size: true } });
    const usedBytes = Number(used._sum.size ?? 0);
    if (usedBytes + size > Number(targetUser.storageQuota)) {
      return jsonError("Storage quota exceeded", 413);
    }

    // Daily upload limit
    const today = new Date().toISOString().slice(0, 10);
    const usage = await db.dailyUsage.findUnique({ where: { userId_date: { userId: ownerId, date: today } } });
    const usedToday = Number(usage?.uploadBytes ?? 0);
    if (targetUser.dailyUploadLimit > 0 && usedToday + size > Number(targetUser.dailyUploadLimit)) {
      return jsonError("Daily upload limit exceeded", 413);
    }

    // Storage path: temporarily under uploads/, will move on complete
    const tmpDir = path.join(PATHS.UPLOADS, "incoming");
    await fs.mkdir(tmpDir, { recursive: true });
    const tmpName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const tmpPath = path.join(tmpDir, tmpName);
    const relTmp = getStorageRelativePath(tmpPath);

    // Pre-create the file
    await fs.writeFile(tmpPath, Buffer.alloc(0));

    const totalChunks = Math.max(1, Math.ceil(size / CHUNK_SIZE));

    const upload = await db.upload.create({
      data: {
        userId: ownerId,
        filename,
        fileSize: BigInt(size),
        mimeType,
        mediaType: type,
        totalChunks,
        storagePath: relTmp,
        status: "uploading",
      },
    });

    return jsonOk({
      uploadId: upload.id,
      chunkSize: CHUNK_SIZE,
      totalChunks,
      mediaType: type,
    });
  } catch (e: any) {
    return jsonError(e?.message ?? "Upload init failed", 500);
  }
}
