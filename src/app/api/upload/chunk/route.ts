import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getRequestContext, jsonError, jsonOk } from "@/lib/api";
import { PATHS } from "@/lib/storage";
import { promises as fs, createWriteStream } from "fs";
import path from "path";
import { pipeline } from "stream/promises";

// POST /api/upload/chunk — receive one chunk
// Body (multipart/form-data): uploadId, index, chunk (Blob)
// Returns: { receivedChunks, ok: true }
//
// OPTIMIZED: streams the chunk directly to disk via pipeline(), avoiding
// loading the entire chunk into a Buffer in memory. The old version used
// Buffer.from(await chunk.arrayBuffer()) which allocated a 10MB buffer per
// chunk — for 6 concurrent chunks that's 60MB of RAM just for uploads.
export async function POST(req: NextRequest) {
  const ctx = await getRequestContext(req);
  if (!ctx.user) return jsonError("Not authenticated", 401);

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return jsonError("Expected multipart/form-data", 400);
  }

  const uploadId = String(formData.get("uploadId") ?? "");
  const indexStr = String(formData.get("index") ?? "");
  const index = parseInt(indexStr, 10);
  const chunk = formData.get("chunk");

  if (!uploadId || isNaN(index) || !chunk || !(chunk instanceof Blob)) {
    return jsonError("uploadId, index, and chunk are required", 400);
  }

  const upload = await db.upload.findUnique({ where: { id: uploadId } });
  if (!upload) return jsonError("Upload not found", 404);
  if (upload.userId !== ctx.user.id && ctx.user.role !== "admin") {
    return jsonError("Not authorized", 403);
  }
  if (upload.status === "cancelled") {
    return jsonError("Upload was cancelled", 400);
  }
  if (index < 0 || index >= upload.totalChunks) {
    return jsonError("Invalid chunk index", 400);
  }

  // Write the chunk to a temp file under UPLOADS/incoming/<uploadId>-<index>
  const incomingDir = path.join(PATHS.UPLOADS, "incoming");
  await fs.mkdir(incomingDir, { recursive: true });
  const chunkPath = path.join(incomingDir, `${uploadId}-${index}`);

  let chunkSize = 0;
  try {
    // Stream the chunk Blob to disk via pipeline — avoids loading the whole
    // chunk into a Buffer. The Blob's stream() method gives us a ReadableStream
    // that we pipe directly to the file write stream.
    const reader = (chunk as Blob).stream().getReader();
    const writeStream = createWriteStream(chunkPath);
    const writer = writeStream as any;

    // Convert Web ReadableStream to Node Readable via async iteration
    const { Readable } = await import("stream");
    const nodeStream = Readable.fromWeb(chunk.stream() as any);
    await pipeline(nodeStream, writeStream);

    const stat = await fs.stat(chunkPath);
    chunkSize = stat.size;
  } catch (e: any) {
    console.error("Chunk write failed:", e);
    return jsonError("Failed to write chunk", 500);
  }

  // Upsert the UploadChunk row. Use upsert to handle race conditions cleanly.
  try {
    await db.uploadChunk.upsert({
      where: { uploadId_index: { uploadId, index } },
      update: {
        received: true,
        size: BigInt(chunkSize),
        receivedAt: new Date(),
      },
      create: {
        uploadId,
        index,
        size: BigInt(chunkSize),
        received: true,
        receivedAt: new Date(),
      },
    });
  } catch (e: any) {
    console.error("Upsert chunk failed:", e);
    try {
      const existing = await db.uploadChunk.findUnique({
        where: { uploadId_index: { uploadId, index } },
      });
      if (existing && !existing.received) {
        await db.uploadChunk.update({
          where: { id: existing.id },
          data: { received: true, size: BigInt(chunkSize), receivedAt: new Date() },
        });
      }
    } catch {}
  }

  // Count all received chunks for this upload
  const receivedCount = await db.uploadChunk.count({
    where: { uploadId, received: true },
  });

  await db.upload.update({
    where: { id: uploadId },
    data: {
      receivedChunks: receivedCount,
      status: receivedCount >= upload.totalChunks ? "completed" : "uploading",
    },
  });

  return jsonOk({ receivedChunks: receivedCount, ok: true });
}
