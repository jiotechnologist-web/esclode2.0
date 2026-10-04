import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getRequestContext, jsonError, jsonOk } from "@/lib/api";

// GET /api/upload/status?uploadId=xxx
// Returns the list of chunk indices that have been received so far.
// Used for resumable uploads — the client checks which chunks are already
// on the server and only uploads the missing ones.
export async function GET(req: NextRequest) {
  const ctx = await getRequestContext(req);
  if (!ctx.user) return jsonError("Not authenticated", 401);

  const url = new URL(req.url);
  const uploadId = url.searchParams.get("uploadId");
  if (!uploadId) return jsonError("uploadId is required", 400);

  const upload = await db.upload.findUnique({ where: { id: uploadId } });
  if (!upload) return jsonError("Upload not found", 404);
  if (upload.userId !== ctx.user.id && ctx.user.role !== "admin") {
    return jsonError("Not authorized", 403);
  }

  const chunks = await db.uploadChunk.findMany({
    where: { uploadId, received: true },
    select: { index: true },
    orderBy: { index: "asc" },
  });

  return jsonOk({
    uploadId,
    status: upload.status,
    totalChunks: upload.totalChunks,
    receivedChunks: chunks.map((c) => c.index),
  });
}
