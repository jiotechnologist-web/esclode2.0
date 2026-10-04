import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getRequestContext, jsonError, canDownloadMedia } from "@/lib/api";
import { resolveStoragePath, safeFilename } from "@/lib/storage";
import { getClientIp } from "@/lib/auth";
import { createReadStream } from "fs";
import { stat } from "fs/promises";

// GET /api/media/[id]/download
// OPTIMIZED: streams the file directly from disk using createReadStream.
// Does NOT load the entire file into memory (the old version used fs.readFile
// which buffered the whole file in RAM — a major bottleneck for large videos).
// Supports HTTP Range requests for resumable downloads.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getRequestContext(req);
  if (!ctx.user) return jsonError("Not authenticated", 401);
  const { id } = await params;
  const canDl = await canDownloadMedia(ctx.user, id);
  if (!canDl) return jsonError("Not authorized to download", 403);

  const media = await db.media.findUnique({ where: { id } });
  if (!media) return jsonError("Not found", 404);
  if (media.status !== "ready" && ctx.user.role !== "admin") {
    return jsonError("Media not ready", 409);
  }

  try {
    const abs = resolveStoragePath(media.storagePath);
    const fileStat = await stat(abs);
    const total = fileStat.size;
    const filename = safeFilename(media.originalName);

    // Parse Range header for resumable downloads
    const range = req.headers.get("range");
    let start = 0;
    let end = total - 1;
    let isRange = false;
    if (range && range.startsWith("bytes=")) {
      const [s, e] = range.replace("bytes=", "").split("-");
      const parsedStart = s ? parseInt(s, 10) : 0;
      const parsedEnd = e ? parseInt(e, 10) : total - 1;
      if (!isNaN(parsedStart) && parsedStart >= 0 && parsedStart < total) {
        start = parsedStart;
        end = Math.min(parsedEnd, total - 1);
        isRange = true;
      }
    }

    const length = end - start + 1;
    // Stream the file directly — never loads into memory
    const stream = createReadStream(abs, { start, end });

    const headers = new Headers();
    headers.set("Content-Type", media.mimeType || "application/octet-stream");
    headers.set("Content-Length", String(length));
    headers.set("Accept-Ranges", "bytes");
    headers.set(
      "Content-Disposition",
      `attachment; filename="${filename}"`
    );
    // Downloads are private — never cache
    headers.set("Cache-Control", "private, no-store");

    if (isRange) {
      headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
    }

    // Record download asynchronously — don't block the response
    // (fire-and-forget so the user gets the file immediately)
    (async () => {
      try {
        await db.downloadRecord.create({
          data: {
            userId: ctx.user!.id,
            mediaId: media.id,
            bytes: BigInt(total),
            ip: getClientIp(req),
            userAgent: req.headers.get("user-agent")?.slice(0, 200) ?? null,
          },
        });
        const today = new Date().toISOString().slice(0, 10);
        const existing = await db.dailyUsage.findUnique({
          where: { userId_date: { userId: ctx.user!.id, date: today } },
        });
        if (existing) {
          await db.dailyUsage.update({
            where: { id: existing.id },
            data: {
              downloadBytes: existing.downloadBytes + BigInt(total),
              downloadCount: existing.downloadCount + 1,
            },
          });
        } else {
          await db.dailyUsage.create({
            data: {
              userId: ctx.user!.id,
              date: today,
              downloadBytes: BigInt(total),
              downloadCount: 1,
            },
          });
        }
      } catch {}
    })();

    return new Response(stream as any, {
      status: isRange ? 206 : 200,
      headers,
    });
  } catch (e: any) {
    return jsonError(e?.message ?? "Download failed", 500);
  }
}
