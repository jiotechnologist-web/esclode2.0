import { db } from "./db";

/**
 * Get all system settings as a key-value map.
 * No caching — always reads from DB to ensure consistency across API routes.
 * The settings table is tiny (~12 rows) so this is fast.
 */
export async function getSystemSettings(): Promise<Record<string, string>> {
  const settings = await db.systemSetting.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;
  return map;
}

/**
 * Get a single setting value by key.
 * Returns the provided default if not found.
 */
export async function getSetting(key: string, defaultValue: string = ""): Promise<string> {
  const settings = await getSystemSettings();
  return settings[key] ?? defaultValue;
}

/**
 * Check if maintenance mode is enabled.
 */
export async function isMaintenanceMode(): Promise<boolean> {
  const setting = await db.systemSetting.findUnique({ where: { key: "maintenance.mode" } });
  return setting?.value === "on";
}

/**
 * Check if user registration is enabled.
 */
export async function isRegistrationEnabled(): Promise<boolean> {
  const setting = await db.systemSetting.findUnique({ where: { key: "registration.enabled" } });
  return setting?.value === "on";
}

/**
 * No-op — kept for backward compatibility. Settings are always read from DB.
 */
export function invalidateSettingsCache() {
  // No cache to invalidate — settings are always read from DB
}
