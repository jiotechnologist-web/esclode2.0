import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getRequestContext, jsonError, jsonOk } from "@/lib/api";
import { PATHS } from "@/lib/storage";
import { promises as fs } from "fs";
import path from "path";

// POST /api/upload/cancel — cancel an in-progress upload
// Body: { uploadId }
export async function POST(req: NextRequest) {
  const ctx = await getRequestContext(req);
  if (!ctx.user) return jsonError("Not authenticated", 401);

  try {
    const body = await req.json();
    const uploadId = String(body.uploadId ?? "");
    if (!uploadId) return jsonError("uploadId is required", 400);

    const upload = await db.upload.findUnique({ where: { id: uploadId } });
    if (!upload) return jsonError("Upload not found", 404);
    if (upload.userId !== ctx.user.id && ctx.user.role !== "admin") {
      return jsonError("Not authorized", 403);
    }

    // Mark as cancelled
    await db.upload.update({
      where: { id: uploadId },
      data: { status: "cancelled", errorMessage: "Cancelled by user" },
    });

    // Clean up any received chunk files
    const incomingDir = path.join(PATHS.UPLOADS, "incoming");
    for (let i = 0; i < upload.totalChunks; i++) {
      const chunkPath = path.join(incomingDir, `${uploadId}-${i}`);
      try { await fs.unlink(chunkPath); } catch {}
    }

    return jsonOk({ ok: true });
  } catch (e: any) {
    return jsonError(e?.message ?? "Failed to cancel upload", 500);
  }
}
