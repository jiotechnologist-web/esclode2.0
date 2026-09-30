"use client";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth";
import { useUIStore, type UserView } from "@/stores/ui";
import { useUploadStore } from "@/stores/upload";
import { hasPermission } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/permissions";
import { UserShell } from "./user-shell";
import { HomeView } from "./views/home-view";
import { VideosView } from "./views/videos-view";
import { VideoPlayerView } from "./views/video-player-view";
import { PhotosView } from "./views/photos-view";
import { PhotoViewerView } from "./views/photo-viewer-view";
import { PrivateView } from "./views/private-view";
import { DocumentsView } from "./views/documents-view";
import { ContactsView } from "./views/contacts-view";
import { UploadsView } from "./views/uploads-view";
import { FavoritesView } from "./views/favorites-view";
import { RecentView } from "./views/recent-view";
import { ProfileView } from "./views/profile-view";
import { UploadManagerPanel } from "@/components/escloud/upload/upload-manager-panel";
import { ImpersonationBanner } from "../shared/impersonation-banner";

export function UserApp() {
  const user = useAuthStore((s) => s.user);
  const view = useUIStore((s) => s.view) as UserView;

  if (!user) return null;

  const canViewPrivate = hasPermission(user.permissions, PERMISSIONS.VIEW_PRIVATE);
  const canUpload = user.uploadEnabled;
  const canViewVideos = hasPermission(user.permissions, PERMISSIONS.VIEW_VIDEOS);
  const canViewPhotos = hasPermission(user.permissions, PERMISSIONS.VIEW_PHOTOS);
  const canViewDocuments = hasPermission(user.permissions, PERMISSIONS.VIEW_DOCUMENTS);
  const canViewContacts = hasPermission(user.permissions, PERMISSIONS.VIEW_CONTACTS);
  const canViewFavorites = hasPermission(user.permissions, PERMISSIONS.VIEW_FAVORITES);
  const canViewRecent = hasPermission(user.permissions, PERMISSIONS.VIEW_RECENT);
  const canViewUploads = hasPermission(user.permissions, PERMISSIONS.VIEW_UPLOADS);

  const navItems: { key: UserView; label: string; icon: any; enabled: boolean; mobile?: boolean }[] = [
    { key: "home", label: "Home", icon: Home, enabled: true, mobile: true },
    { key: "videos", label: "Videos", icon: Video, enabled: canViewVideos, mobile: true },
    { key: "photos", label: "Photos", icon: Image, enabled: canViewPhotos, mobile: true },
    { key: "private", label: "Private", icon: Lock, enabled: canViewPrivate },
    { key: "documents", label: "Documents", icon: FileText, enabled: canViewDocuments, mobile: true },
    { key: "contacts", label: "Contacts", icon: Users, enabled: canViewContacts },
    { key: "uploads", label: "Uploads", icon: Upload, enabled: canViewUploads && canUpload },
    { key: "favorites", label: "Favorites", icon: Heart, enabled: canViewFavorites, mobile: true },
    { key: "recent", label: "Recent", icon: History, enabled: canViewRecent },
    { key: "profile", label: "Profile", icon: UserCircle, enabled: true, mobile: true },
  ];

  return (
    <>
      <ImpersonationBanner />
      <UserShell navItems={navItems}>
        <div className="fade-in">
          {view === "home" && <HomeView />}
          {view === "videos" && <VideosView />}
          {view === "video-player" && <VideoPlayerView />}
          {view === "photos" && <PhotosView />}
          {view === "photo-viewer" && <PhotoViewerView />}
          {view === "private" && <PrivateView />}
          {view === "documents" && <DocumentsView />}
          {view === "contacts" && <ContactsView />}
          {view === "uploads" && <UploadsView />}
          {view === "favorites" && <FavoritesView />}
          {view === "recent" && <RecentView />}
          {view === "profile" && <ProfileView />}
        </div>
      </UserShell>
      <UploadManagerPanel />
    </>
  );
}

// Lazy icon imports
import {
  Home,
  Video,
  Image,
  Lock,
  FileText,
  Users,
  Upload,
  Heart,
  History,
  UserCircle,
} from "lucide-react";
