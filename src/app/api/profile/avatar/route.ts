import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getRequestContext, jsonError, jsonOk } from "@/lib/api";
import { PATHS } from "@/lib/storage";
import { promises as fs } from "fs";
import path from "path";
import { randomBytes } from "crypto";
import sharp from "sharp";

// POST /api/profile/avatar — upload profile picture with auto-crop/resize
export async function POST(req: NextRequest) {
  const ctx = await getRequestContext(req);
  if (!ctx.user) return jsonError("Not authenticated", 401);
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return jsonError("Missing file", 400);
  if (!file.type.startsWith("image/")) return jsonError("Not an image. Please select a photo file (JPG, PNG, WEBP).", 400);
  if (file.size > 10 * 1024 * 1024) return jsonError("Image too large (max 10MB). Please choose a smaller image.", 413);

  try {
    await fs.mkdir(PATHS.AVATARS, { recursive: true });
    
    // Read the file buffer
    const buf = Buffer.from(await file.arrayBuffer());
    
    // Use sharp to auto-resize and crop to a square 256x256 avatar
    // This ensures: correct aspect ratio, reasonable file size, proper centering
    const processedBuf = await sharp(buf)
      .resize(256, 256, {
        fit: "cover",
        position: "center",
        withoutEnlargement: true,
      })
      .jpeg({ quality: 85 })
      .toBuffer();
    
    const safe = randomBytes(16).toString("hex") + ".jpg";
    const abs = path.join(PATHS.AVATARS, safe);
    await fs.writeFile(abs, processedBuf);
    const rel = path.relative(PATHS.ROOT, abs);

    // Delete old avatar if exists
    const user = await db.user.findUnique({ where: { id: ctx.user.id } });
    if (user?.avatarPath) {
      try {
        const oldAbs = path.resolve(PATHS.ROOT, user.avatarPath);
        await fs.unlink(oldAbs);
      } catch {}
    }

    await db.user.update({ where: { id: ctx.user.id }, data: { avatarPath: rel } });
    
    // Broadcast for real-time UI sync
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("escloud-data-changed", { detail: { type: "profile" } }));
    }
    
    return jsonOk({ 
      ok: true, 
      avatarUrl: `/api/profile/avatar?path=${encodeURIComponent(rel)}&t=${Date.now()}` 
    });
  } catch (e: any) {
    console.error("Avatar upload failed:", e);
    return jsonError(e?.message ?? "Failed to upload profile photo. Please try again.", 500);
  }
}

// GET /api/profile/avatar?path=...
export async function GET(req: NextRequest) {
  const ctx = await getRequestContext(req);
  if (!ctx.user) return jsonError("Not authenticated", 401);
  const url = new URL(req.url);
  const rel = url.searchParams.get("path") ?? "";
  if (!rel) return jsonError("Missing path", 400);
  try {
    const abs = path.resolve(PATHS.ROOT, rel);
    if (!abs.startsWith(PATHS.ROOT)) return jsonError("Forbidden", 403);
    const buf = await fs.readFile(abs);
    return new Response(buf, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return jsonError("Not found", 404);
  }
}
