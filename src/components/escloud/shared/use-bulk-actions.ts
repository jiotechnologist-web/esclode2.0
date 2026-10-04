"use client";
import { useState, useCallback } from "react";
import { deleteMedia } from "./use-media-list";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth";
import { toast } from "sonner";

/**
 * useBulkActions — shared hook for multi-select + bulk actions on media lists.
 *
 * Used by: VideosView, PhotosView, PrivateView.
 *
 * Provides:
 *   - selectMode (boolean)
 *   - selectedIds (Set<string>)
 *   - enterSelectMode / exitSelectMode
 *   - toggleSelect(id) / selectAll(items) / selectNone
 *   - bulkDelete() — with confirm dialog
 *   - bulkMoveToPrivate() — requires private_access permission
 *   - bulkMoveToPublic()
 *   - bulkDownload() — opens each file's download URL in sequence
 *   - anyPrivate / allPrivate / showMoveToPrivate / showMoveToPublic (derived)
 *   - busy (boolean — true while an action is running)
 */
export function useBulkActions(items: { id: string; visibility: string; type: string; name: string }[], refresh: () => Promise<any>) {
  const user = useAuthStore((s) => s.user)!;
  const hasPrivateAccess = hasPermission(user.permissions, PERMISSIONS.PRIVATE_ACCESS);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const enterSelectMode = useCallback(() => {
    setSelectMode(true);
    setSelectedIds(new Set());
  }, []);
  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((p) => p.id)));
  }, [items]);

  const selectNone = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const broadcastChange = useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("escloud-data-changed", { detail: { type: "bulk" } }));
    }
  }, []);

  const bulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.error("Select at least one item");
      return;
    }
    const count = selectedIds.size;
    if (!confirm(`Delete ${count} ${count === 1 ? "item" : "items"}? This cannot be undone.`)) return;
    setBusy(true);
    let okCount = 0;
    let failCount = 0;
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      try {
        await deleteMedia(id);
        okCount++;
      } catch {
        failCount++;
      }
    }
    setBusy(false);
    if (okCount > 0) toast.success(`Deleted ${okCount} ${okCount === 1 ? "item" : "items"}`);
    if (failCount > 0) toast.error(`${failCount} failed to delete`);
    broadcastChange();
    exitSelectMode();
    await refresh();
  }, [selectedIds, broadcastChange, exitSelectMode, refresh]);

  const bulkMoveToPrivate = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.error("Select at least one item");
      return;
    }
    if (!hasPrivateAccess) {
      toast.error("You need Private Access permission to move content to private");
      return;
    }
    setBusy(true);
    let okCount = 0;
    let failCount = 0;
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      try {
        const r = await fetch(`/api/media/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visibility: "private" }),
        });
        if (r.ok) okCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }
    setBusy(false);
    if (okCount > 0) toast.success(`Moved ${okCount} ${okCount === 1 ? "item" : "items"} to Private`);
    if (failCount > 0) toast.error(`${failCount} failed to move`);
    broadcastChange();
    exitSelectMode();
    await refresh();
  }, [selectedIds, hasPrivateAccess, broadcastChange, exitSelectMode, refresh]);

  const bulkMoveToPublic = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.error("Select at least one item");
      return;
    }
    setBusy(true);
    let okCount = 0;
    let failCount = 0;
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      try {
        const r = await fetch(`/api/media/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visibility: "public" }),
        });
        if (r.ok) okCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }
    setBusy(false);
    if (okCount > 0) toast.success(`Moved ${okCount} ${okCount === 1 ? "item" : "items"} to Public`);
    if (failCount > 0) toast.error(`${failCount} failed to move`);
    broadcastChange();
    exitSelectMode();
    await refresh();
  }, [selectedIds, broadcastChange, exitSelectMode, refresh]);

  const bulkDownload = useCallback(async () => {
    if (selectedIds.size === 0) {
      toast.error("Select at least one item");
      return;
    }
    const ids = Array.from(selectedIds);
    // Open each download URL in a new tab with a small delay so the browser
    // doesn't block them as popups. For more than 5 items, ask for confirmation.
    if (ids.length > 5) {
      if (!confirm(`Download ${ids.length} files? This will open ${ids.length} tabs.`)) return;
    }
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      setTimeout(() => {
        window.open(`/api/media/${id}/download`, "_blank");
      }, i * 300);
    }
    toast.success(`Downloading ${ids.length} ${ids.length === 1 ? "file" : "files"}…`);
    exitSelectMode();
  }, [selectedIds, exitSelectMode]);

  // Derived state
  const selectedItems = items.filter((p) => selectedIds.has(p.id));
  const anyPrivate = selectedItems.some((p) => p.visibility === "private");
  const allPrivate = selectedItems.length > 0 && selectedItems.every((p) => p.visibility === "private");
  const showMoveToPrivate = !allPrivate && hasPrivateAccess;
  const showMoveToPublic = anyPrivate;

  return {
    selectMode,
    selectedIds,
    busy,
    enterSelectMode,
    exitSelectMode,
    toggleSelect,
    selectAll,
    selectNone,
    bulkDelete,
    bulkMoveToPrivate,
    bulkMoveToPublic,
    bulkDownload,
    showMoveToPrivate,
    showMoveToPublic,
  };
}
