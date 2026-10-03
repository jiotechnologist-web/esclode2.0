import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getRequestContext, jsonError, jsonOk } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";

// GET /api/media?type=video|photo|document|contact&docType=pdf&search=&visibility=&sort=createdAt:desc&page=1&pageSize=24&folderId=&favorites=true&recent=true
export async function GET(req: NextRequest) {
  const ctx = await getRequestContext(req);
  if (!ctx.user) return jsonError("Not authenticated", 401);

  try {
    const url = new URL(req.url);
    const type = url.searchParams.get("type") ?? undefined;
    const docType = url.searchParams.get("docType") ?? undefined;
    const search = url.searchParams.get("search") ?? undefined;
    const visibility = url.searchParams.get("visibility") ?? undefined;
    const sort = url.searchParams.get("sort") ?? "createdAt:desc";
    const folderId = url.searchParams.get("folderId") ?? undefined;
    const favorites = url.searchParams.get("favorites") === "true";
    const recent = url.searchParams.get("recent") === "true";
    const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "24", 10)));

    const where: any = {};
    if (type) where.type = type;
    if (docType) where.docType = docType;
    if (folderId) where.folderId = folderId;
    if (search) where.name = { contains: search };

    if (ctx.user.role === "admin") {
      // Admin sees everything (optionally filtered by user)
      const ownerId = url.searchParams.get("ownerId");
      if (ownerId) where.ownerId = ownerId;
      if (visibility) where.visibility = visibility;
    } else {
      // NON-ADMIN USER ACCESS RULES:
      // 1. Own content (regardless of public/private)
      // 2. Admin's PUBLIC content (with appropriate view permission)
      // 3. Private content explicitly shared with this user via PrivateAccess
      // 4. NOT other users' content (even if marked "public" by another user)

      const allowedTypes: string[] = [];
      if (hasPermission(ctx.user.permissions, "view_videos")) allowedTypes.push("video");
      if (hasPermission(ctx.user.permissions, "view_photos")) allowedTypes.push("photo");
      if (hasPermission(ctx.user.permissions, "view_documents")) allowedTypes.push("document");
      if (hasPermission(ctx.user.permissions, "view_contacts")) allowedTypes.push("contact");

      const canSeePrivate = hasPermission(ctx.user.permissions, "view_private");

      // Get all admin user IDs (admins' public content is visible to all)
      const adminUsers = await db.user.findMany({ where: { role: "admin" }, select: { id: true } });
      const adminIds = adminUsers.map((u) => u.id);

      const orClauses: any[] = [
        // 1. User's own PUBLIC content only (private content lives in the Private view)
        { ownerId: ctx.user.id, visibility: "public" },
      ];

      // 2. Admin's public content (with type permission filter)
      if (allowedTypes.length > 0) {
        orClauses.push({
          visibility: "public",
          ownerId: { in: adminIds },
          type: type ? type : { in: allowedTypes },
        });
      }

      // 3. Private content shared with this user (only shown via visibility=private filter,
      //    NOT in the default public listing — this is what makes "Move to Private" a real MOVE)
      // -> excluded here on purpose.

      where.AND = [{ OR: orClauses }];

      // Handle visibility filter
      if (visibility === "private") {
        if (!canSeePrivate) return jsonOk({ items: [], page, pageSize, total: 0 });
        where.AND = [{
          OR: [
            { ownerId: ctx.user.id, visibility: "private" },
            { visibility: "private", privateAccess: { some: { userId: ctx.user.id } } },
          ]
        }];
      } else if (visibility === "public") {
        where.AND = [{
          OR: [
            { ownerId: ctx.user.id, visibility: "public" },
            { visibility: "public", ownerId: { in: adminIds }, type: type ? type : { in: allowedTypes } },
          ]
        }];
      }
      // else (no visibility specified): only user's own PUBLIC + admin's PUBLIC content.
      // User's own PRIVATE content is hidden from the default listing — that's the MOVE behavior.
    }

    if (favorites) {
      where.favorites = { some: { userId: ctx.user.id } };
    }

    let orderBy: any = { createdAt: "desc" };
    const [sortField, sortDir] = sort.split(":");
    if (sortField) {
      if (["createdAt", "name", "size", "duration"].includes(sortField)) {
        orderBy = { [sortField]: sortDir === "asc" ? "asc" : "desc" };
      }
    }

    let items: any[];
    let total: number;

    if (recent) {
      const hist = await db.watchHistory.findMany({
        where: { userId: ctx.user.id, media: { type: type ?? "video" } },
        orderBy: { updatedAt: "desc" },
        take: pageSize,
        skip: (page - 1) * pageSize,
        include: { media: { include: { tags: { include: { tag: true } } } } },
      });
      total = await db.watchHistory.count({ where: { userId: ctx.user.id } });
      items = hist.map((h) => mapMediaWithUser(h.media, ctx.user!.id, h.position));
    } else {
      const [rows, count] = await Promise.all([
        db.media.findMany({
          where,
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            tags: { include: { tag: true } },
            owner: { select: { username: true, displayName: true } },
          },
        }),
        db.media.count({ where }),
      ]);
      total = count;
      const favIds = favorites
        ? new Set(rows.map((r) => r.id))
        : new Set(
            (
              await db.favorite.findMany({
                where: { userId: ctx.user.id, mediaId: { in: rows.map((r) => r.id) } },
                select: { mediaId: true },
              })
            ).map((f) => f.mediaId)
          );
      const watchMap = new Map<string, number>();
      if (rows.some((r) => r.type === "video")) {
        const wh = await db.watchHistory.findMany({
          where: { userId: ctx.user.id, mediaId: { in: rows.map((r) => r.id) } },
          select: { mediaId: true, position: true },
        });
        for (const w of wh) watchMap.set(w.mediaId, w.position);
      }
      items = rows.map((r) => mapMediaWithUser(r, ctx.user!.id, favIds.has(r.id), watchMap.get(r.id) ?? null));
    }

    return jsonOk({ items, page, pageSize, total });
  } catch (e: any) {
    console.error("Failed to fetch media:", e);
    return jsonError("Something went wrong. Please try again.", 500);
  }
}

function mapMediaWithUser(
  m: any,
  userId: string,
  isFavoriteOrPosition: boolean | number,
  watchPos?: number | null
) {
  const isFav = typeof isFavoriteOrPosition === "boolean" ? isFavoriteOrPosition : false;
  const wPos = typeof isFavoriteOrPosition === "number" ? isFavoriteOrPosition : (watchPos ?? null);
  return {
    id: m.id,
    type: m.type,
    name: m.name,
    originalName: m.originalName,
    mimeType: m.mimeType,
    size: Number(m.size),
    visibility: m.visibility,
    status: m.status,
    approvalStatus: m.approvalStatus,
    ownerId: m.ownerId,
    ownerName: m.owner?.displayName ?? m.owner?.username ?? null,
    thumbnailUrl: m.thumbnailPath ? `/api/media/${m.id}/thumbnail` : null,
    streamUrl: m.type === "video" || m.type === "photo" ? `/api/media/${m.id}/stream` : null,
    downloadUrl: `/api/media/${m.id}/download`,
    duration: m.duration,
    width: m.width,
    height: m.height,
    resolution: m.resolution,
    hlsPath: m.hlsPath ? `/api/media/${m.id}/stream?hls=1` : null,
    docType: m.docType,
    contactName: m.contactName,
    contactCount: m.contactCount,
    folderId: m.folderId,
    tags: m.tags?.map((t: any) => t.tag.name) ?? [],
    createdAt: m.createdAt.toISOString ? m.createdAt.toISOString() : m.createdAt,
    isFavorite: isFav,
    watchProgress: wPos,
  };
}
