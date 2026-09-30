// Escloud - Granular permissions
export const PERMISSIONS = {
  // View
  VIEW_VIDEOS: "view_videos",
  VIEW_PHOTOS: "view_photos",
  VIEW_PRIVATE: "view_private",
  VIEW_DOCUMENTS: "view_documents",
  VIEW_CONTACTS: "view_contacts",
  VIEW_FAVORITES: "view_favorites",
  VIEW_RECENT: "view_recent",
  VIEW_UPLOADS: "view_uploads",
  // Upload
  UPLOAD_VIDEOS: "upload_videos",
  UPLOAD_PHOTOS: "upload_photos",
  UPLOAD_DOCUMENTS: "upload_documents",
  UPLOAD_CONTACTS: "upload_contacts",
  // Download
  DOWNLOAD_VIDEOS: "download_videos",
  DOWNLOAD_PHOTOS: "download_photos",
  DOWNLOAD_DOCUMENTS: "download_documents",
  DOWNLOAD_CONTACTS: "download_contacts",
  // Manage own
  DELETE_OWN: "delete_own",
  EDIT_OWN: "edit_own",
  // Organize
  CREATE_ALBUMS: "create_albums",
  CREATE_FOLDERS: "create_folders",
  USE_FAVORITES: "use_favorites",
  // Sharing
  SHARE: "share",
  // QR login
  QR_LOGIN: "qr_login",
  // Advanced video
  ADVANCED_VIDEO_PLAY: "advanced_video_play",
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;
export type PermissionValue = (typeof PERMISSIONS)[PermissionKey];

// Default permission set for a regular user
export const DEFAULT_USER_PERMISSIONS: string[] = [
  PERMISSIONS.VIEW_VIDEOS,
  PERMISSIONS.VIEW_PHOTOS,
  PERMISSIONS.VIEW_DOCUMENTS,
  PERMISSIONS.VIEW_CONTACTS,
  PERMISSIONS.VIEW_FAVORITES,
  PERMISSIONS.VIEW_RECENT,
  PERMISSIONS.VIEW_UPLOADS,
  PERMISSIONS.UPLOAD_VIDEOS,
  PERMISSIONS.UPLOAD_PHOTOS,
  PERMISSIONS.UPLOAD_DOCUMENTS,
  PERMISSIONS.UPLOAD_CONTACTS,
  PERMISSIONS.DOWNLOAD_VIDEOS,
  PERMISSIONS.DOWNLOAD_PHOTOS,
  PERMISSIONS.DOWNLOAD_DOCUMENTS,
  PERMISSIONS.DOWNLOAD_CONTACTS,
  PERMISSIONS.DELETE_OWN,
  PERMISSIONS.EDIT_OWN,
  PERMISSIONS.CREATE_ALBUMS,
  PERMISSIONS.CREATE_FOLDERS,
  PERMISSIONS.USE_FAVORITES,
  PERMISSIONS.QR_LOGIN,
  PERMISSIONS.ADVANCED_VIDEO_PLAY,
];

export function hasPermission(perms: string[] | null | undefined, key: string): boolean {
  if (!perms) return false;
  return perms.includes(key);
}

export function parsePermissions(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function serializePermissions(perms: string[]): string {
  return JSON.stringify(perms);
}
