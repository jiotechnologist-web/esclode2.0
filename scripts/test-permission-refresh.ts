// Test that admin permission changes are picked up by an existing user session WITHOUT logout/login
const BASE = "http://localhost:3000";

async function login(identifier: string, password: string, admin = false): Promise<string> {
  const url = admin ? `${BASE}/api/auth/admin/login` : `${BASE}/api/auth/login`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  const setCookie = r.headers.get("set-cookie") ?? "";
  return setCookie.split(";")[0];
}

async function getSessionPerms(cookie: string): Promise<string[]> {
  const r = await fetch(`${BASE}/api/auth/login`, { headers: { Cookie: cookie } });
  const d = await r.json();
  return d?.user?.permissions ?? [];
}

async function main() {
  console.log("=== Test: Session refresh after admin permission change ===\n");

  // Step 1: Login as demo first (before any permission changes)
  console.log("Step 1: Login as demo (BEFORE admin grants permissions)");
  const demoCookie = await login("demo@escloud.local", "demo123");
  const initialPerms = await getSessionPerms(demoCookie);
  console.log(`  Initial permissions count: ${initialPerms.length}`);
  console.log(`  Has upload_videos: ${initialPerms.includes("upload_videos")}`);
  console.log(`  Has private_access: ${initialPerms.includes("private_access")}`);
  console.log(`  Has qr_scan: ${initialPerms.includes("qr_scan")}`);

  // Step 2: Admin logs in and revokes all permissions from demo
  console.log("\nStep 2: Admin revokes all permissions from demo");
  const adminCookie = await login("jiotechnologist@gmail.com", "741504", true);
  const usersResp = await fetch(`${BASE}/api/admin/users`, { headers: { Cookie: adminCookie } });
  const usersData = await usersResp.json();
  const demo = usersData.users.find((u: any) => u.email === "demo@escloud.local");

  await fetch(`${BASE}/api/admin/users`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ userIds: [demo.id], action: "revoke_all" }),
  });
  console.log("  Admin revoked all toggleable permissions");

  // Step 3: Demo's NEXT API call will use the latest DB permissions (not stale)
  // Simulate the user trying to upload
  console.log("\nStep 3: Demo tries to upload (should fail - permissions revoked)");
  const uploadResp = await fetch(`${BASE}/api/upload/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: demoCookie },
    body: JSON.stringify({ filename: "test.jpg", size: 100, mimeType: "image/jpeg", visibility: "public" }),
  });
  const uploadData = await uploadResp.json();
  console.log(`  Upload status: ${uploadResp.status}`);
  console.log(`  Response: ${uploadData.error ?? "OK"}`);
  if (uploadResp.status === 403) {
    console.log("  ✅ Backend correctly rejected (using latest DB permissions, not stale session)");
  } else {
    console.log("  ❌ Backend accepted — this is wrong!");
  }

  // Step 4: Demo's session GET refresh shows updated permissions
  console.log("\nStep 4: Demo's session GET (auto-refresh) shows updated permissions");
  const refreshedPerms = await getSessionPerms(demoCookie);
  console.log(`  Refreshed permissions count: ${refreshedPerms.length}`);
  console.log(`  Has upload_videos: ${refreshedPerms.includes("upload_videos")}`);
  console.log(`  Has private_access: ${refreshedPerms.includes("private_access")}`);
  console.log(`  Has qr_scan: ${refreshedPerms.includes("qr_scan")}`);

  // Step 5: Admin re-grants all permissions
  console.log("\nStep 5: Admin re-grants all permissions to demo");
  await fetch(`${BASE}/api/admin/users`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ userIds: [demo.id], action: "grant_all" }),
  });

  // Step 6: Demo's NEXT API call should succeed
  console.log("\nStep 6: Demo tries to upload again (should succeed now)");
  const uploadResp2 = await fetch(`${BASE}/api/upload/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: demoCookie },
    body: JSON.stringify({ filename: "test.jpg", size: 100, mimeType: "image/jpeg", visibility: "public" }),
  });
  const uploadData2 = await uploadResp2.json();
  console.log(`  Upload status: ${uploadResp2.status}`);
  if (uploadResp2.ok) {
    console.log("  ✅ Backend correctly accepted (permissions just granted took effect immediately)");
    // Cleanup
    await fetch(`${BASE}/api/upload/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: demoCookie },
      body: JSON.stringify({ uploadId: uploadData2.uploadId }),
    });
  } else {
    console.log(`  ❌ Backend rejected: ${uploadData2.error}`);
  }

  console.log("\n=== Test complete ===");
}

main().catch((e) => {
  console.error("Test failed:", e);
  process.exit(1);
});
