import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, checkRateLimit, recordFailedLogin, clearRateLimit } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api";
import { DEFAULT_USER_PERMISSIONS, serializePermissions } from "@/lib/permissions";

// POST /api/auth/register — public user registration (controlled by system setting)
export async function POST(req: NextRequest) {
  try {
    // Check if registration is enabled
    const setting = await db.systemSetting.findUnique({ where: { key: "registration.enabled" } });
    if (!setting || setting.value !== "on") {
      return jsonError("User registration is currently disabled. Please contact the administrator.", 403);
    }

    // Check maintenance mode
    const maintSetting = await db.systemSetting.findUnique({ where: { key: "maintenance.mode" } });
    if (maintSetting && maintSetting.value === "on") {
      return jsonError("The system is currently under maintenance. Please try again later.", 503);
    }

    const body = await req.json();
    const username = String(body.username ?? "").trim();
    const email = String(body.email ?? "").trim();
    const password = String(body.password ?? "");
    const displayName = body.displayName ? String(body.displayName) : null;

    // Validate
    if (!username || !email || !password) {
      return jsonError("Username, email, and password are required", 400);
    }
    if (username.length < 3) return jsonError("Username must be at least 3 characters", 400);
    if (username.length > 50) return jsonError("Username too long (max 50)", 400);
    if (password.length < 6) return jsonError("Password must be at least 6 characters", 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError("Invalid email format", 400);

    // Rate limit
    const rlKey = `register:${email.toLowerCase()}`;
    const rl = checkRateLimit(rlKey);
    if (!rl.allowed) {
      return jsonError(`Too many attempts. Try again in ${Math.ceil(rl.retryAfterMs / 1000)}s.`, 429);
    }

    // Check for duplicate email/username
    const existing = await db.user.findFirst({
      where: { OR: [{ email: email }, { username: username }] },
    });
    if (existing) {
      if (existing.email === email) return jsonError("An account with this email already exists", 409);
      return jsonError("This username is already taken", 409);
    }

    // Create user with default permissions
    const user = await db.user.create({
      data: {
        username,
        email,
        passwordHash: await hashPassword(password),
        displayName,
        role: "user",
        status: "active",
        permissions: serializePermissions(DEFAULT_USER_PERMISSIONS),
        storageQuota: BigInt(10 * 1024 * 1024 * 1024), // 10 GB default
        uploadMaxBytes: BigInt(2 * 1024 * 1024 * 1024), // 2 GB per file
      },
    });

    clearRateLimit(rlKey);
    return jsonOk({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    });
  } catch (e: any) {
    return jsonError(e?.message ?? "Registration failed", 500);
  }
}

// GET /api/auth/register — check if registration is enabled
export async function GET() {
  try {
    const setting = await db.systemSetting.findUnique({ where: { key: "registration.enabled" } });
    const enabled = setting?.value === "on";
    return jsonOk({ enabled });
  } catch {
    return jsonOk({ enabled: false });
  }
}
