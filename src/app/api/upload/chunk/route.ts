import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getRequestContext, jsonError, jsonOk } from "@/lib/api";
import { resolveStoragePath } from "@/lib/storage";
import { promises as fs } from "fs";

export async function POST(req: NextRequest) {
  const ctx = await getRequestContext(req);
  if (!ctx.user) return jsonError("Not authenticated", 401);
  try {
    const form = await req.formData();
    const uploadId = String(form.get("uploadId") ?? "");
    const index = Number(form.get("index") ?? -1);
    const chunk = form.get("chunk") as File | null;
    if (!uploadId || index < 0 || !chunk) return jsonError("Missing parameters", 400);

    const upload = await db.upload.findUnique({ where: { id: uploadId } });
    if (!upload) return jsonError("Upload not found", 404);

    if (upload.userId !== ctx.user.id && ctx.user.role !== "admin") {
      return jsonError("Not allowed", 403);
    }
    if (upload.status === "cancelled" || upload.status === "completed") {
      return jsonError(`Upload is ${upload.status}`, 400);
    }

    const abs = resolveStoragePath(upload.storagePath);
    const buf = Buffer.from(await chunk.arrayBuffer());
    const CHUNK_SIZE = 10 * 1024 * 1024;
    const position = index * CHUNK_SIZE;

    // Write chunk at position — single file operation
    const fh = await fs.open(abs, "r+");
    await fh.write(buf, 0, buf.length, position);
    await fh.close();

    // Minimal DB operations — upsert chunk record + update received count in parallel
    const newReceived = upload.receivedChunks + 1;
    
    await db.uploadChunk.upsert({
      where: { uploadId_index: { uploadId, index } },
      create: { uploadId, index, size: BigInt(buf.length), received: true, receivedAt: new Date() },
      update: { received: true, receivedAt: new Date(), size: BigInt(buf.length) },
    });

    await db.upload.update({
      where: { id: uploadId },
      data: { receivedChunks: newReceived },
    });

    return jsonOk({
      ok: true,
      index,
      receivedChunks: newReceived,
      totalChunks: upload.totalChunks,
      progress: newReceived / upload.totalChunks,
    });
  } catch (e: any) {
    console.error("Chunk upload failed:", e);
    return jsonError(e?.message ?? "Chunk upload failed", 500);
  }
}
