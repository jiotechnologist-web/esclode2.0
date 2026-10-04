import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getRequestContext, jsonError, jsonOk } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { PATHS, getAllowedStoragePath, categorizeFile } from "@/lib/storage";

// POST /api/upload/init — initialize a chunked upload
// Body: { filename, size, mimeType, visibility, targetUserId?, assignUserIds? }
// Returns: { uploadId, chunkSize, totalChunks }
export async function POST(req: NextRequest) {
  const ctx = await getRequestContext(req);
  if (!ctx.user) return jsonError("Not authenticated", 401);

  try {
    const body = await req.json();
    const filename = String(body.filename ?? "").slice(0, 255);
    const size = Number(body.size ?? 0);
    const mimeType = String(body.mimeType ?? "application/octet-stream");
    const visibility = body.visibility === "private" ? "private" : "public";
    const targetUserId = body.targetUserId ? String(body.targetUserId) : undefined;
    const assignUserIds: string[] = Array.isArray(body.assignUserIds) ? body.assignUserIds.map(String) : [];

    if (!filename || !size || size <= 0) {
      return jsonError("filename and size are required", 400);
    }

    // Permission checks — user must have upload permission for this media type
    const { type: mediaType } = categorizeFile(filename, mimeType);
    const permMap: Record<string, string> = {
      video: PERMISSIONS.UPLOAD_VIDEOS,
      photo: PERMISSIONS.UPLOAD_PHOTOS,
      document: PERMISSIONS.UPLOAD_DOCUMENTS,
      contact: PERMISSIONS.UPLOAD_CONTACTS,
    };
    const requiredPerm = permMap[mediaType] ?? "";
    if (!ctx.user.uploadEnabled) {
      return jsonError("Uploads are disabled for your account", 403);
    }
    if (!hasPermission(ctx.user.permissions, requiredPerm)) {
      return jsonError(`You don't have permission to upload ${mediaType}s`, 403);
    }

    // Private upload requires private_access permission
    if (visibility === "private") {
      if (!hasPermission(ctx.user.permissions, PERMISSIONS.PRIVATE_ACCESS)) {
        return jsonError("You need Private Access permission to upload private content", 403);
      }
    }

    // Quota check
    if (ctx.user.storageQuota && size > Number(ctx.user.storageQuota)) {
      return jsonError("File exceeds your storage quota", 413);
    }
    if (ctx.user.uploadMaxBytes && size > Number(ctx.user.uploadMaxBytes)) {
      return jsonError(`File exceeds the maximum upload size (${Number(ctx.user.uploadMaxBytes)} bytes)`, 413);
    }

    // Pre-allocate the final storage path so the chunk route can write to a known location
    const { abs: storageAbs, rel: storageRel } = await getAllowedStoragePath(mediaType, filename);

    // Use 10MB chunks
    const chunkSize = 10 * 1024 * 1024;
    const totalChunks = Math.max(1, Math.ceil(size / chunkSize));

    const upload = await db.upload.create({
      data: {
        userId: ctx.user.id,
        filename,
        fileSize: BigInt(size),
        mimeType,
        mediaType,
        totalChunks,
        storagePath: storageRel,
        status: "waiting",
      },
    });

    // Ensure the target file's directory exists
    const { promises: fs } = await import("fs");
    await fs.mkdir(PATHS.UPLOADS, { recursive: true });

    // We'll write chunks into a temp file under PATHS.UPLOADS/incoming/<uploadId>-<index>
    // and concatenate them at completion time.
    return jsonOk({
      uploadId: upload.id,
      chunkSize,
      totalChunks,
    });
  } catch (e: any) {
    console.error("Upload init failed:", e);
    return jsonError(e?.message ?? "Failed to initialize upload", 500);
  }
}
