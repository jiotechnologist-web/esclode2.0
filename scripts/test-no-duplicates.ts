// Test the no-duplicates upload pipeline
import fs from "fs";

const BASE = "http://localhost:3000";

async function main() {
  // 1. Login as admin to get session cookie
  const loginResp = await fetch(`${BASE}/api/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "jiotechnologist@gmail.com", password: "741504" }),
  });
  const setCookie = loginResp.headers.get("set-cookie") ?? "";
  const sessionCookie = setCookie.split(";")[0];
  console.log("Admin session:", sessionCookie.slice(0, 30) + "...");

  // Fetch demo + viewer user IDs
  const usersResp = await fetch(`${BASE}/api/admin/users`, {
    headers: { Cookie: sessionCookie },
  });
  const usersData = await usersResp.json();
  const demo = usersData.users.find((u: any) => u.email === "demo@escloud.local");
  const viewer = usersData.users.find((u: any) => u.email === "viewer@escloud.local");
  console.log(`Demo: ${demo.id}, Viewer: ${viewer.id}`);

  // 2. Upload ONE image as PRIVATE assigned to BOTH demo and viewer
  const filePath = "/tmp/test-photo.jpg";
  const file = fs.readFileSync(filePath);
  const fileStat = fs.statSync(filePath);
  const filename = "private-test-photo.jpg";
  const size = fileStat.size;

  const initResp = await fetch(`${BASE}/api/upload/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({
      filename, size, mimeType: "image/jpeg",
      visibility: "private",
      assignUserIds: [demo.id, viewer.id],
    }),
  });
  const initData = await initResp.json();
  console.log("Init:", initData);
  if (!initResp.ok) process.exit(1);

  // 3. Upload chunk(s)
  const CHUNK_SIZE = 5 * 1024 * 1024;
  const totalChunks = initData.totalChunks;
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, size);
    const chunk = file.subarray(start, end);
    const fd = new FormData();
    fd.append("uploadId", initData.uploadId);
    fd.append("index", String(i));
    fd.append("chunk", new Blob([chunk]));
    const r = await fetch(`${BASE}/api/upload/chunk`, {
      method: "POST",
      headers: { Cookie: sessionCookie },
      body: fd,
    });
    if (!r.ok) {
      console.error(`Chunk ${i} failed:`, await r.text());
      process.exit(1);
    }
  }

  // 4. Complete — should create ONE media + 2 PrivateAccess records
  const compResp = await fetch(`${BASE}/api/upload/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({
      uploadId: initData.uploadId,
      visibility: "private",
      assignUserIds: [demo.id, viewer.id],
    }),
  });
  const compData = await compResp.json();
  console.log("Complete: mediaId=", compData.mediaId);

  // 5. Verify: count Media records + PrivateAccess records
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  const mediaCount = await db.media.count({ where: { id: compData.mediaId } });
  const accessCount = await db.privateAccess.count({ where: { mediaId: compData.mediaId } });
  const accesses = await db.privateAccess.findMany({
    where: { mediaId: compData.mediaId },
    include: { user: { select: { username: true, email: true } } },
  });
  console.log(`Media records: ${mediaCount} (should be 1)`);
  console.log(`PrivateAccess records: ${accessCount} (should be 2)`);
  console.log("Access list:");
  for (const a of accesses) {
    console.log(`  - ${a.user.username} (${a.user.email})`);
  }
  await db.$disconnect();

  // 6. Verify: admin media list shows the media only ONCE
  const mediaListResp = await fetch(`${BASE}/api/media?visibility=private&pageSize=100`, {
    headers: { Cookie: sessionCookie },
  });
  const list = await mediaListResp.json();
  const matchingMedia = list.items.filter((m: any) => m.id === compData.mediaId);
  console.log(`Admin media list shows this media: ${matchingMedia.length} time(s) (should be 1)`);

  if (mediaCount === 1 && accessCount === 2 && matchingMedia.length === 1) {
    console.log("✓ NO DUPLICATES — test passed!");
  } else {
    console.log("✗ TEST FAILED — duplicates detected!");
    process.exit(1);
  }
}

main().catch(console.error);
