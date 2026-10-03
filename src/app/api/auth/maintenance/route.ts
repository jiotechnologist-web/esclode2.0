import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getRequestContext, jsonOk, jsonError } from "@/lib/api";

// GET /api/auth/maintenance — check if maintenance mode is active
export async function GET(req: NextRequest) {
  try {
    const setting = await db.systemSetting.findUnique({ where: { key: "maintenance.mode" } });
    const maintenanceMode = setting?.value === "on";

    // Get maintenance message if set
    const msgSetting = await db.systemSetting.findUnique({ where: { key: "maintenance.message" } });
    const message = msgSetting?.value ?? "Escloud is currently under maintenance. Please check back soon.";

    const ctx = await getRequestContext(req);
    const isAdmin = ctx.user?.role === "admin";

    return jsonOk({
      maintenanceMode,
      message,
      isAdmin,
    });
  } catch {
    return jsonOk({ maintenanceMode: false, message: "", isAdmin: false });
  }
}
