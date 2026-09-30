// Seed script: creates the default admin and demo users, plus default system settings.
import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import { DEFAULT_USER_PERMISSIONS, serializePermissions } from "../src/lib/permissions";

async function main() {
  console.log("Seeding Escloud database...");

  // Default admin
  const adminEmail = "jiotechnologist@gmail.com";
  const adminPwd = "741504";
  const existingAdmin = await db.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    await db.user.create({
      data: {
        username: "admin",
        email: adminEmail,
        passwordHash: await hashPassword(adminPwd),
        displayName: "Escloud Administrator",
        role: "admin",
        status: "active",
        mustChangePwd: true,
        permissions: serializePermissions([...DEFAULT_USER_PERMISSIONS, "admin"]),
        storageQuota: 1024 * 1024 * 1024 * 1024,
        uploadMaxBytes: 100 * 1024 * 1024 * 1024,
      },
    });
    console.log(`Created default admin: ${adminEmail} / ${adminPwd}`);
  } else {
    console.log(`Admin already exists: ${adminEmail}`);
  }

  // Demo user "demo"
  const demoEmail = "demo@escloud.local";
  const existingDemo = await db.user.findUnique({ where: { email: demoEmail } });
  if (!existingDemo) {
    await db.user.create({
      data: {
        username: "demo",
        email: demoEmail,
        passwordHash: await hashPassword("demo123"),
        displayName: "Demo User",
        role: "user",
        status: "active",
        mustChangePwd: false,
        permissions: serializePermissions(DEFAULT_USER_PERMISSIONS),
        storageQuota: 20 * 1024 * 1024 * 1024,
        uploadMaxBytes: 5 * 1024 * 1024 * 1024,
      },
    });
    console.log(`Created demo user: demo@escloud.local / demo123`);
  }

  // Demo user WITHOUT private access
  const user2Email = "viewer@escloud.local";
  const existing2 = await db.user.findUnique({ where: { email: user2Email } });
  if (!existing2) {
    const restrictedPerms = DEFAULT_USER_PERMISSIONS.filter((p) => p !== "view_private");
    await db.user.create({
      data: {
        username: "viewer",
        email: user2Email,
        passwordHash: await hashPassword("viewer123"),
        displayName: "Viewer (No Private)",
        role: "user",
        status: "active",
        permissions: serializePermissions(restrictedPerms),
        storageQuota: 5 * 1024 * 1024 * 1024,
        uploadMaxBytes: 1 * 1024 * 1024 * 1024,
      },
    });
    console.log(`Created viewer user: viewer@escloud.local / viewer123 (no private access)`);
  }

  // Default system settings
  const defaults: Record<string, string> = {
    "app.name": "Escloud",
    "app.theme": "system",
    "video.advanced_default": "on",
    "video.default_quality": "auto",
    "video.pre_buffer_level": "adaptive",
    "video.data_saver_default": "off",
    "upload.approval_required": "off",
    "session.timeout_minutes": "43200",
    "qr.ttl_seconds": "180",
    "registration.enabled": "off",
    "maintenance.mode": "off",
  };
  for (const [key, value] of Object.entries(defaults)) {
    const existing = await db.systemSetting.findUnique({ where: { key } });
    if (!existing) {
      await db.systemSetting.create({ data: { key, value } });
    }
  }
  console.log("System settings seeded.");

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
