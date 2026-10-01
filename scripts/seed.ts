// Seed script: creates only the default admin account + system settings.
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
        storageQuota: BigInt(1024 * 1024 * 1024 * 1024),
        uploadMaxBytes: BigInt(100 * 1024 * 1024 * 1024),
      },
    });
    console.log(`Created default admin: ${adminEmail}`);
  } else {
    console.log(`Admin already exists: ${adminEmail}`);
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
