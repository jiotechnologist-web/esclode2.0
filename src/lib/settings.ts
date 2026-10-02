import { db } from "./db";

// In-memory cache for settings (TTL: 30 seconds)
let settingsCache: Record<string, string> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30_000; // 30 seconds

/**
 * Get all system settings as a key-value map.
 * Uses a 30-second in-memory cache to avoid repeated DB queries.
 */
export async function getSystemSettings(): Promise<Record<string, string>> {
  const now = Date.now();
  if (settingsCache && (now - cacheTimestamp) < CACHE_TTL) {
    return settingsCache;
  }
  const settings = await db.systemSetting.findMany();
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;
  settingsCache = map;
  cacheTimestamp = now;
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
  const val = await getSetting("maintenance.mode", "off");
  return val === "on";
}

/**
 * Check if user registration is enabled.
 */
export async function isRegistrationEnabled(): Promise<boolean> {
  const val = await getSetting("registration.enabled", "off");
  return val === "on";
}

/**
 * Invalidate the settings cache (call after admin updates settings).
 */
export function invalidateSettingsCache() {
  settingsCache = null;
  cacheTimestamp = 0;
}
