import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getRequestContext, jsonError, jsonOk } from "@/lib/api";

function serializeLabels(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {}
  return [];
}

function deserializeLabels(arr: any): string {
  if (!Array.isArray(arr)) return "[]";
  return JSON.stringify(arr.map(String).filter(Boolean).slice(0, 50));
}

function mapNote(n: any) {
  return {
    id: n.id,
    title: n.title,
    content: n.content,
    color: n.color,
    pinned: n.pinned,
    archive: n.archive,
    trash: n.trash,
    trashAt: n.trashAt ? n.trashAt.toISOString() : null,
    labels: serializeLabels(n.labels),
    reminder: n.reminder ? n.reminder.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
  };
}

// GET /api/notes — list user's notes
export async function GET(req: NextRequest) {
  const ctx = await getRequestContext(req);
  if (!ctx.user) return jsonError("Not authenticated", 401);
  const notes = await db.note.findMany({
    where: { userId: ctx.user.id },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });
  return jsonOk({ notes: notes.map(mapNote) });
}

// POST /api/notes — create note
export async function POST(req: NextRequest) {
  const ctx = await getRequestContext(req);
  if (!ctx.user) return jsonError("Not authenticated", 401);
  try {
    const body = await req.json();
    const title = String(body.title ?? "").slice(0, 200);
    const content = String(body.content ?? "").slice(0, 100000);
    const color = String(body.color ?? "default");
    const pinned = !!body.pinned;
    const archive = !!body.archive;
    const trash = !!body.trash;
    const labels = deserializeLabels(body.labels);
    const reminder = body.reminder ? new Date(String(body.reminder)) : null;
    const trashAt = body.trashAt ? new Date(String(body.trashAt)) : null;

    const note = await db.note.create({
      data: { userId: ctx.user.id, title, content, color, pinned, archive, trash, labels, reminder, trashAt },
    });
    return jsonOk({ note: mapNote(note) });
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
    if (body.content !== undefined) data.content = String(body.content).slice(0, 100000);
    if (body.color !== undefined) data.color = String(body.color);
    if (body.pinned !== undefined) data.pinned = !!body.pinned;
    if (body.archive !== undefined) data.archive = !!body.archive;
    if (body.trash !== undefined) {
      data.trash = !!body.trash;
      if (body.trash && !note.trashAt) data.trashAt = new Date();
      if (!body.trash) data.trashAt = null;
    }
    if (body.labels !== undefined) data.labels = deserializeLabels(body.labels);
    if (body.reminder !== undefined) {
      data.reminder = body.reminder ? new Date(String(body.reminder)) : null;
    }

    const updated = await db.note.update({ where: { id }, data });
    return jsonOk({ note: mapNote(updated) });
  } catch (e: any) {
    return jsonError(e?.message ?? "Failed to update note", 500);
  }
}

// DELETE /api/notes — delete note permanently
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
    return jsonError(e?.message ?? "Failed to delete", 500);
  }
}
