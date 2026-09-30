// End-to-end test for the full system audit
// 1. Login as admin
// 2. Grant ALL permissions to demo user (bulk action)
// 3. Login as demo (without logout/login cycle - simulate fresh session)
// 4. Verify demo's session shows the new permissions immediately
// 5. Verify demo can hit the upload endpoint successfully (init returns 200, not 403)
// 6. Verify QR scan endpoint accepts demo's request
// 7. Verify media viewer endpoint returns the media item

import fs from "fs";

const BASE = "http://localhost:3000";

function log(emoji: string, msg: string) {
  console.log(`${emoji}  ${msg}`);
}

async function login(identifier: string, password: string, admin = false): Promise<string> {
  const url = admin ? `${BASE}/api/auth/admin/login` : `${BASE}/api/auth/login`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    throw new Error(`Login failed for ${identifier}: ${d.error ?? r.status}`);
  }
  const setCookie = r.headers.get("set-cookie") ?? "";
  return setCookie.split(";")[0];
}

async function getJSON(cookie: string, url: string) {
  const r = await fetch(`${BASE}${url}`, { headers: { Cookie: cookie } });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => null) };
}

async function main() {
  // Step 1: Admin login
  log("🔐", "Step 1: Admin login");
  const adminCookie = await login("jiotechnologist@gmail.com", "741504", true);
  log("✅", "Admin logged in");

  // Step 2: Find demo user
  const usersResp = await getJSON(adminCookie, "/api/admin/users");
  const demo = usersResp.data?.users?.find((u: any) => u.email === "demo@escloud.local");
  if (!demo) throw new Error("Demo user not found");
  log("👤", `Demo user ID: ${demo.id}`);

  // Step 3: Grant ALL permissions to demo (bulk action)
  log("🔑", "Step 3: Granting ALL permissions to demo via bulk action");
  const grantResp = await fetch(`${BASE}/api/admin/users`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ userIds: [demo.id], action: "grant_all" }),
  });
  const grantData = await grantResp.json();
  if (!grantResp.ok) throw new Error(`Bulk grant failed: ${grantData.error}`);
  log("✅", `Bulk grant succeeded. Updated: ${grantData.updated}`);

  // Step 4: Verify demo's DB permissions
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  const demoUser = await db.user.findUnique({ where: { id: demo.id } });
  const demoPerms = JSON.parse(demoUser!.permissions);
  log("📋", `Demo permissions in DB: ${demoPerms.length} keys`);
  log("📋", `Includes private_access: ${demoPerms.includes("private_access")}`);
  log("📋", `Includes qr_scan: ${demoPerms.includes("qr_scan")}`);
  log("📋", `Includes upload_videos: ${demoPerms.includes("upload_videos")}`);
  log("📋", `Includes upload_photos: ${demoPerms.includes("upload_photos")}`);
  log("📋", `uploadEnabled flag: ${demoUser!.uploadEnabled}`);
  await db.$disconnect();

  // Step 5: Login as demo with FRESH session
  log("👤", "Step 5: Login demo with fresh session");
  const demoCookie = await login("demo@escloud.local", "demo123");

  // Step 6: Verify demo's session shows updated permissions
  log("📋", "Step 6: Verify demo's session reflects updated permissions");
  const sessResp = await getJSON(demoCookie, "/api/auth/login");
  const sessPerms = sessResp.data?.user?.permissions ?? [];
  log("📋", `Session permissions: ${sessPerms.length} keys`);
  log("📋", `Session has private_access: ${sessPerms.includes("private_access")}`);
  log("📋", `Session has qr_scan: ${sessPerms.includes("qr_scan")}`);
  log("📋", `Session has upload_videos: ${sessPerms.includes("upload_videos")}`);
  log("📋", `Session has upload_photos: ${sessPerms.includes("upload_photos")}`);

  // Step 7: Verify demo can init an upload (public photo)
  log("📤", "Step 7: Verify demo can init a public photo upload");
  const uploadInitResp = await fetch(`${BASE}/api/upload/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: demoCookie },
    body: JSON.stringify({
      filename: "test-audit.jpg",
      size: 522,
      mimeType: "image/jpeg",
      visibility: "public",
    }),
  });
  const uploadInitData = await uploadInitResp.json();
  if (uploadInitResp.ok) {
    log("✅", `Upload init OK. uploadId: ${uploadInitData.uploadId}`);
    // Cancel the test upload
    await fetch(`${BASE}/api/upload/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: demoCookie },
      body: JSON.stringify({ uploadId: uploadInitData.uploadId }),
    });
    log("🧹", "Test upload cancelled");
  } else {
    log("❌", `Upload init FAILED: ${uploadInitData.error}`);
  }

  // Step 8: Verify demo can init a PRIVATE upload (since they have private_access)
  log("🔒", "Step 8: Verify demo can init a PRIVATE upload");
  const privUploadResp = await fetch(`${BASE}/api/upload/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: demoCookie },
    body: JSON.stringify({
      filename: "test-private.jpg",
      size: 522,
      mimeType: "image/jpeg",
      visibility: "private",
      assignUserIds: [demo.id],
    }),
  });
  const privUploadData = await privUploadResp.json();
  if (privUploadResp.ok) {
    log("✅", `Private upload init OK. uploadId: ${privUploadData.uploadId}`);
    await fetch(`${BASE}/api/upload/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: demoCookie },
      body: JSON.stringify({ uploadId: privUploadData.uploadId }),
    });
    log("🧹", "Test private upload cancelled");
  } else {
    log("❌", `Private upload init FAILED: ${privUploadData.error}`);
  }

  // Step 9: Verify demo can call QR scan endpoint
  log("📷", "Step 9: Verify demo can call QR scan endpoint");
  // Generate a QR token first
  const qrGenResp = await fetch(`${BASE}/api/auth/qr/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const qrGenData = await qrGenResp.json();
  const qrToken = qrGenData.token;

  const qrScanResp = await fetch(`${BASE}/api/auth/qr/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: demoCookie },
    body: JSON.stringify({ token: `escloud-qr:${qrToken}` }),
  });
  const qrScanData = await qrScanResp.json();
  if (qrScanResp.ok) {
    log("✅", `QR scan OK. Message: ${qrScanData.message}`);
  } else {
    log("❌", `QR scan FAILED: ${qrScanData.error}`);
  }

  // Step 10: Verify media viewer endpoint works (admin uploads a photo first, then demo views)
  log("👁️ ", "Step 10: Verify media viewer endpoint works for demo");

  // Admin uploads a public photo
  const filePath = "/tmp/test-photo.jpg";
  if (!fs.existsSync(filePath)) {
    // Create a small test image
    fs.writeFileSync(filePath, Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a4944415408d76360000000000200014e93d3b0000000049454e44ae426082", "hex"));
  }
  const file = fs.readFileSync(filePath);
  const initResp = await fetch(`${BASE}/api/upload/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ filename: "audit-test.png", size: file.length, mimeType: "image/png", visibility: "public" }),
  });
  const initData = await initResp.json();
  if (!initResp.ok) throw new Error(`Admin upload init failed: ${initData.error}`);

  // Upload the chunk
  const fd = new FormData();
  fd.append("uploadId", initData.uploadId);
  fd.append("index", "0");
  fd.append("chunk", new Blob([file]));
  await fetch(`${BASE}/api/upload/chunk`, {
    method: "POST",
    headers: { Cookie: adminCookie },
    body: fd,
  });

  // Complete
  const compResp = await fetch(`${BASE}/api/upload/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ uploadId: initData.uploadId, visibility: "public" }),
  });
  const compData = await compResp.json();
  const mediaId = compData.mediaId;
  log("📤", `Admin uploaded test media: ${mediaId}`);

  // Demo fetches the single media item via /api/media/[id]
  const mediaItemResp = await getJSON(demoCookie, `/api/media/${mediaId}`);
  if (mediaItemResp.ok && mediaItemResp.data?.item) {
    log("✅", `Demo can view media item: ${mediaItemResp.data.item.name}`);
  } else {
    log("❌", `Demo CANNOT view media item: ${mediaItemResp.data?.error ?? "Unknown"}`);
  }

  // Step 11: Verify media stream endpoint works for demo
  log("🌐", "Step 11: Verify media stream endpoint works for demo");
  const streamResp = await fetch(`${BASE}/api/media/${mediaId}/stream`, {
    headers: { Cookie: demoCookie },
  });
  if (streamResp.ok) {
    log("✅", `Demo can stream media (status: ${streamResp.status})`);
  } else {
    log("❌", `Demo CANNOT stream media (status: ${streamResp.status})`);
  }

  log("🎉", "Full audit complete!");
}

main().catch((e) => {
  console.error("AUDIT FAILED:", e);
  process.exit(1);
});
