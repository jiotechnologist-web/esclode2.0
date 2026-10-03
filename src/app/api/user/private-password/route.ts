import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getRequestContext, jsonError, jsonOk } from "@/lib/api";
import { hashPassword, verifyPassword } from "@/lib/auth";

// POST /api/user/private-password — set or change private content password
export async function POST(req: NextRequest) {
  const ctx = await getRequestContext(req);
  if (!ctx.user) return jsonError("Not authenticated", 401);
  try {
    const body = await req.json();
    const action = String(body.action ?? "set"); // "set" | "change" | "remove" | "verify"
    const newPassword = String(body.newPassword ?? "");
    const currentPrivatePwd = String(body.currentPrivatePassword ?? "");

    if (action === "verify") {
      // Verify the private password (used before accessing private content)
      const user = await db.user.findUnique({ where: { id: ctx.user.id } });
      if (!user || !user.privatePasswordHash) {
        return jsonError("Private password is not set. Set it in Settings first.", 403);
      }
      const ok = await verifyPassword(currentPrivatePwd, user.privatePasswordHash);
      if (!ok) return jsonError("Incorrect private password", 403);
      return jsonOk({ verified: true });
    }

    if (action === "remove") {
      await db.user.update({
        where: { id: ctx.user.id },
        data: { privatePasswordHash: "" },
      });
      return jsonOk({ ok: true, removed: true });
    }

    // set or change
    if (newPassword.length < 4) {
      return jsonError("Private password must be at least 4 characters", 400);
    }
    if (newPassword.length > 100) {
      return jsonError("Private password too long (max 100 characters)", 400);
    }

    // If changing, verify the current private password first
    if (action === "change") {
      const user = await db.user.findUnique({ where: { id: ctx.user.id } });
      if (!user || !user.privatePasswordHash) {
        return jsonError("Private password is not set yet. Use 'Set' instead of 'Change'.", 400);
      }
      const ok = await verifyPassword(currentPrivatePwd, user.privatePasswordHash);
      if (!ok) return jsonError("Current private password is incorrect", 403);
    }

    const hash = await hashPassword(newPassword);
    await db.user.update({
      where: { id: ctx.user.id },
      data: { privatePasswordHash: hash },
    });

    return jsonOk({ ok: true, hasPassword: true });
  } catch (e: any) {
    return jsonError(e?.message ?? "Failed to update private password", 500);
  }
}

// GET /api/user/private-password — check if private password is set (does NOT expose the password)
export async function GET(req: NextRequest) {
  const ctx = await getRequestContext(req);
  if (!ctx.user) return jsonError("Not authenticated", 401);
  const user = await db.user.findUnique({ where: { id: ctx.user.id } });
  if (!user) return jsonError("User not found", 404);
  return jsonOk({ hasPassword: !!(user.privatePasswordHash && user.privatePasswordHash.length > 0) });
}
