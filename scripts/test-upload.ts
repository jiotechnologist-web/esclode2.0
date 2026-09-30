// Test the chunked upload pipeline end-to-end
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
  console.log("Session cookie:", sessionCookie);

  // 2. Init an upload (use the test photo)
  const filePath = "/tmp/test-photo.jpg";
  const file = fs.readFileSync(filePath);
  const fileStat = fs.statSync(filePath);
  const filename = "test-photo.jpg";
  const size = fileStat.size;
  const mimeType = "image/jpeg";

  const initResp = await fetch(`${BASE}/api/upload/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({ filename, size, mimeType, visibility: "public" }),
  });
  const initData = await initResp.json();
  if (!initResp.ok) {
    console.error("Init failed:", initData);
    process.exit(1);
  }
  console.log("Init:", initData);

  // 3. Upload chunks
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
    const d = await r.json();
    console.log(`Chunk ${i}:`, d);
  }

  // 4. Complete
  const compResp = await fetch(`${BASE}/api/upload/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: sessionCookie },
    body: JSON.stringify({ uploadId: initData.uploadId, visibility: "public" }),
  });
  const compData = await compResp.json();
  console.log("Complete:", compData);

  // 5. Verify media is listed
  const listResp = await fetch(`${BASE}/api/media?type=photo&pageSize=10`, {
    headers: { Cookie: sessionCookie },
  });
  const list = await listResp.json();
  console.log("List count:", list.items?.length);
  console.log("First item:", list.items?.[0]);
}

main().catch(console.error);
