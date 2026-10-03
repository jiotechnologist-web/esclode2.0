import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getRequestContext, jsonError, jsonOk } from "@/lib/api";

// GET /api/notes — list user's notes
export async function GET(req: NextRequest) {
  const ctx = await getRequestContext(req);
  if (!ctx.user) return jsonError("Not authenticated", 401);
  const notes = await db.note.findMany({
    where: { userId: ctx.user.id },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });
  return jsonOk({
    notes: notes.map((n) => ({
      id: n.id,
      title: n.title,
      content: n.content,
      color: n.color,
      pinned: n.pinned,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    })),
  });
}

// POST /api/notes — create note
export async function POST(req: NextRequest) {
  const ctx = await getRequestContext(req);
  if (!ctx.user) return jsonError("Not authenticated", 401);
  try {
    const body = await req.json();
    const title = String(body.title ?? "").slice(0, 200);
    const content = String(body.content ?? "").slice(0, 10000);
    const color = String(body.color ?? "default");
    const pinned = !!body.pinned;

    const note = await db.note.create({
      data: { userId: ctx.user.id, title, content, color, pinned },
    });
    return jsonOk({
      note: {
        id: note.id,
        title: note.title,
        content: note.content,
        color: note.color,
        pinned: note.pinned,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      },
    });
  } catch (e: any) {
    return jsonError(e?.message ?? "Failed to create note", 500);
  }
}

// PATCH /api/notes — update note
export async function PATCH(req: NextRequest) {
  const ctx = await getRequestContext(req);
  if (!ctx.user) return jsonError("Not authenticated", 401);
  try {
    const body = await req.json();
    const id = String(body.id ?? "");
    if (!id) return jsonError("Missing note id", 400);
    const note = await db.note.findUnique({ where: { id } });
    if (!note || note.userId !== ctx.user.id) return jsonError("Note not found", 404);

    const data: any = {};
    if (body.title !== undefined) data.title = String(body.title).slice(0, 200);
    if (body.content !== undefined) data.content = String(body.content).slice(0, 10000);
    if (body.color !== undefined) data.color = String(body.color);
    if (body.pinned !== undefined) data.pinned = !!body.pinned;

    const updated = await db.note.update({ where: { id }, data });
    return jsonOk({
      note: {
        id: updated.id,
        title: updated.title,
        content: updated.content,
        color: updated.color,
        pinned: updated.pinned,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (e: any) {
    return jsonError(e?.message ?? "Failed to update note", 500);
  }
}

// DELETE /api/notes — delete note
export async function DELETE(req: NextRequest) {
  const ctx = await getRequestContext(req);
  if (!ctx.user) return jsonError("Not authenticated", 401);
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return jsonError("Missing note id", 400);
    const note = await db.note.findUnique({ where: { id } });
    if (!note || note.userId !== ctx.user.id) return jsonError("Note not found", 404);
    await db.note.delete({ where: { id } });
    return jsonOk({ ok: true });
  } catch (e: any) {
    return jsonError(e?.message ?? "Failed to delete note", 500);
  }
}
