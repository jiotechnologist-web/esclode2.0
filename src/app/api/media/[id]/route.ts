import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getRequestContext, jsonError, jsonOk, canAccessMedia } from "@/lib/api";
import { safeDeleteStoragePath } from "@/lib/storage";
import { promises as fs } from "fs";
import { logAdminActivity, getClientIp } from "@/lib/auth";

// DELETE /api/media/[id] - delete media (owner or admin)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getRequestContext(req);
  if (!ctx.user) return jsonError("Not authenticated", 401);
  const { id } = await params;
  const media = await db.media.findUnique({ where: { id } });
  if (!media) return jsonError("Not found", 404);

  const isOwner = media.ownerId === ctx.user.id;
  const isAdmin = ctx.user.role === "admin";

  if (!isOwner && !isAdmin) return jsonError("Not allowed", 403);
  if (isOwner && !isAdmin && !ctx.user.permissions.includes("delete_own")) {
    return jsonError("No delete permission", 403);
  }

  // Delete file(s)
  await safeDeleteStoragePath(media.storagePath);
  if (media.thumbnailPath) await safeDeleteStoragePath(media.thumbnailPath);
  if (media.hlsPath) await safeDeleteStoragePath(media.hlsPath);

  await db.media.delete({ where: { id } });

  if (isAdmin && !isOwner) {
    await logAdminActivity({
      adminId: ctx.user.id,
      action: "media.delete",
      targetUserId: media.ownerId,
      targetContent: media.name,
      ip: getClientIp(req),
    });
  }

  return jsonOk({ ok: true });
}

// PATCH /api/media/[id] - rename, move folder, change visibility
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getRequestContext(req);
  if (!ctx.user) return jsonError("Not authenticated", 401);
  const { id } = await params;
  const media = await db.media.findUnique({ where: { id } });
  if (!media) return jsonError("Not found", 404);

  const isOwner = media.ownerId === ctx.user.id;
  const isAdmin = ctx.user.role === "admin";

  if (!isOwner && !isAdmin) return jsonError("Not allowed", 403);

  const body = await req.json();
  const data: any = {};
  if (body.name !== undefined) data.name = String(body.name).slice(0, 200);
  if (body.folderId !== undefined) data.folderId = body.folderId;
  if (body.visibility !== undefined && isAdmin) {
    data.visibility = body.visibility === "private" ? "private" : "public";
  }

  await db.media.update({ where: { id }, data });
  return jsonOk({ ok: true });
}
