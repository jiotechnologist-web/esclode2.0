import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, getImpersonatingAdmin, AuthUser } from "./auth";
import { db } from "./db";
import { hasPermission } from "./permissions";

export interface RequestContext {
  req: NextRequest;
  user: AuthUser | null;
  impersonatingAdmin: AuthUser | null;
  isImpersonating: boolean;
}

export async function getRequestContext(req: NextRequest): Promise<RequestContext> {
  const user = await getCurrentUser();
  const impersonatingAdmin = await getImpersonatingAdmin();
  return {
    req,
    user,
    impersonatingAdmin,
    isImpersonating: !!impersonatingAdmin,
  };
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function jsonOk(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

export function requireAuth(ctx: RequestContext): AuthUser | null {
  return ctx.user;
}

export function requireAdmin(ctx: RequestContext): AuthUser | null {
  if (!ctx.user || ctx.user.role !== "admin") return null;
  return ctx.user;
}

export function checkPermission(user: AuthUser | null, perm: string): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return hasPermission(user.permissions, perm);
}

/**
 * Check if a user can access a specific media item.
 * 
 * Access rules:
 * - Admin: can access everything
 * - Owner: can access their own content (regardless of public/private)
 * - Public content from ADMIN: visible to all users with the appropriate view permission
 * - Public content from another USER: NOT visible to other users (user content is private by default)
 * - Private content: only visible to users with explicit PrivateAccess grant
 */
export async function canAccessMedia(
  user: AuthUser | null,
  mediaId: string
): Promise<boolean> {
  if (!user) return false;
  if (user.role === "admin") return true;
  
  const media = await db.media.findUnique({ where: { id: mediaId } });
  if (!media) return false;
  
  // Owner can always access their own content
  if (media.ownerId === user.id) return true;
  
  // For content NOT owned by this user:
  if (media.visibility === "public") {
    // Only allow access to public content if the OWNER is an admin
    // (Regular users' "public" content is only visible to themselves, not to other users)
    const owner = await db.user.findUnique({ where: { id: media.ownerId }, select: { role: true } });
    if (!owner || owner.role !== "admin") return false;
    
    // Admin's public content: check view permission
    const permMap: Record<string, string> = {
      video: "view_videos",
      photo: "view_photos",
      document: "view_documents",
      contact: "view_contacts",
    };
    return hasPermission(user.permissions, permMap[media.type] ?? "");
  }
  
  if (media.visibility === "private") {
    // Private content: need explicit PrivateAccess grant
    if (!hasPermission(user.permissions, "view_private")) return false;
    const access = await db.privateAccess.findUnique({
      where: { mediaId_userId: { mediaId, userId: user.id } },
    });
    return !!access;
  }
  
  return false;
}

export async function canDownloadMedia(
  user: AuthUser | null,
  mediaId: string
): Promise<boolean> {
  if (!user) return false;
  if (user.role === "admin") return true;
  const canView = await canAccessMedia(user, mediaId);
  if (!canView) return false;
  const media = await db.media.findUnique({ where: { id: mediaId } });
  if (!media) return false;
  if (media.ownerId === user.id) return true;
  if (!user.downloadEnabled) return false;
  const permMap: Record<string, string> = {
    video: "download_videos",
    photo: "download_photos",
    document: "download_documents",
    contact: "download_contacts",
  };
  return hasPermission(user.permissions, permMap[media.type] ?? "");
}
