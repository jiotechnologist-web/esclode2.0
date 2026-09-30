import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getRequestContext, jsonError, jsonOk } from "@/lib/api";
import { DEFAULT_USER_PERMISSIONS, serializePermissions } from "@/lib/permissions";
import { hashPassword, logAdminActivity, getClientIp } from "@/lib/auth";

// GET /api/admin/users — list all users
export async function GET(req: NextRequest) {
  const ctx = await getRequestContext(req);
  if (!ctx.user || ctx.user.role !== "admin") return jsonError("Forbidden", 403);

  const url = new URL(req.url);
  const search = url.searchParams.get("search") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const role = url.searchParams.get("role") ?? "";

  const where: any = {};
  if (search) {
    where.OR = [
      { username: { contains: search } },
      { email: { contains: search } },
      { displayName: { contains: search } },
    ];
  }
  if (status && status !== "all") where.status = status;
  if (role) where.role = role;

  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Compute used storage + media count + last active session
  const userIds = users.map((u) => u.id);
  const storageAggs = await db.media.groupBy({
    by: ["ownerId"],
    where: { ownerId: { in: userIds } },
    _sum: { size: true },
    _count: { _all: true },
  });
  const sessions = await db.session.findMany({
    where: { userId: { in: userIds } },
    orderBy: { lastActive: "desc" },
    select: { userId: true, lastActive: true },
  });
  const lastActiveMap = new Map<string, Date>();
  for (const s of sessions) {
    if (!lastActiveMap.has(s.userId)) lastActiveMap.set(s.userId, s.lastActive);
    else {
      const cur = lastActiveMap.get(s.userId)!;
      if (s.lastActive > cur) lastActiveMap.set(s.userId, s.lastActive);
    }
  }

  return jsonOk({
    users: users.map((u) => {
      const agg = storageAggs.find((a) => a.ownerId === u.id);
      return {
        id: u.id,
        username: u.username,
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        status: u.status,
        phone: u.phone,
        avatarPath: u.avatarPath,
        avatarUrl: u.avatarPath ? `/api/profile/avatar?path=${encodeURIComponent(u.avatarPath)}` : null,
        permissions: u.permissions ? JSON.parse(u.permissions || "[]") : [],
        storageQuota: Number(u.storageQuota),
        usedStorage: Number(agg?._sum.size ?? 0),
        uploadMaxBytes: Number(u.uploadMaxBytes),
        uploadEnabled: u.uploadEnabled,
        downloadEnabled: u.downloadEnabled,
        approvalRequired: u.approvalRequired,
        expiresAt: u.expiresAt?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
        lastActiveAt: lastActiveMap.get(u.id)?.toISOString() ?? null,
        mediaCount: agg?._count._all ?? 0,
        mustChangePwd: u.mustChangePwd,
      };
    }),
  });
}

// POST /api/admin/users — create a new user
export async function POST(req: NextRequest) {
  const ctx = await getRequestContext(req);
  if (!ctx.user || ctx.user.role !== "admin") return jsonError("Forbidden", 403);

  try {
    const body = await req.json();
    const username = String(body.username ?? "").trim();
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");
    const displayName = body.displayName ? String(body.displayName) : null;
    const role = body.role === "admin" ? "admin" : "user";
    const permissions = Array.isArray(body.permissions) ? body.permissions : DEFAULT_USER_PERMISSIONS;
    const storageQuota = Number(body.storageQuota ?? 10 * 1024 * 1024 * 1024);
    const uploadMaxBytes = Number(body.uploadMaxBytes ?? 2 * 1024 * 1024 * 1024);

    if (!username || !email || !password) return jsonError("Missing fields", 400);
    if (password.length < 6) return jsonError("Password too short (min 6)", 400);

    const existing = await db.user.findFirst({
      where: { OR: [{ email: { equals: email } }, { username: { equals: username } }] },
    });
    if (existing) return jsonError("User with same email/username exists", 409);

    const user = await db.user.create({
      data: {
        username,
        email,
        passwordHash: await hashPassword(password),
        displayName,
        role,
        status: "active",
        permissions: serializePermissions(permissions),
        storageQuota: BigInt(storageQuota),
        uploadMaxBytes: BigInt(uploadMaxBytes),
      },
    });

    await logAdminActivity({
      adminId: ctx.user.id,
      action: "user.create",
      targetUserId: user.id,
      ip: getClientIp(req),
      metadata: { username, email, role },
    });

    return jsonOk({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (e: any) {
    return jsonError(e?.message ?? "Failed to create user", 500);
  }
}
