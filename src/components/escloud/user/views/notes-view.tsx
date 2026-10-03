"use client";
import { useEffect, useRef, useState } from "react";

/**
 * NotesView — Pro Keep Style notes app.
 *
 * This component renders the user's exact HTML/CSS markup (no extra shadcn components,
 * no extra Tailwind overlays, no transparency). All interactivity is implemented
 * via plain-DOM logic in React refs (no dangerouslySetInnerHTML), mirroring the
 * user's original JS but persisting notes to the /api/notes backend instead of
 * localStorage so they survive across devices and sessions.
 *
 * The overlays use a solid (non-transparent) backdrop per the user's request.
 */

interface Note {
  id: string;            // server-side cuid (string)
  title: string;
  body: string;
  pinned: boolean;
  archive: boolean;
  trash: boolean;
  color: string;
  labels: string[];
  reminder: string | null;
  createdAt: string;     // ISO
  updatedAt: string;     // ISO
}

const DEFAULT_LABELS = ["Personal", "Work", "Travel", "Ideas"];
const LABEL_COLORS: Record<string, string> = {
  Personal: "#fbbc04",
  Work: "#1a73e8",
  Travel: "#34a853",
  Ideas: "#a142f4",
};
function labelColor(l: string): string {
  return LABEL_COLORS[l] ?? "#9aa0a6";
}

function escapeHtml(v: any): string {
  const s = String(v ?? "");
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&#39;")
    .replace(/"/g, "&quot;");
}

function normalizeBody(body: string): string {
  return String(body ?? "")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function timeAgo(iso: string): string {
  const ts = new Date(iso).getTime();
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.floor(h / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ts).toLocaleDateString();
}

function checklistInfo(body: string) {
  const lines = normalizeBody(body).split("\n");
  const items = lines.filter((x) => /^\s*[☐☑]\s*/.test(x));
  const done = items.filter((x) => /^\s*☑\s*/.test(x)).length;
  return { lines, items, done, total: items.length };
}

const ICONS = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8 12 2 2 4-5"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 14h10l1-14M9 7V4h6v3"/></svg>',
  archive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16v13H4z"/><path d="M3 4h18v3H3zM9 12h6"/></svg>',
  restore: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7v5h5"/><path d="M5 12a7 7 0 1 0 2-5"/><path d="M12 8v5l3 2"/></svg>',
  duplicate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>',
};

export function NotesView() {
  const rootRef = useRef<HTMLDivElement>(null);
  // Note state — kept in refs so the user's JS-style functions can read/write them
  // without re-running React render on every change (matches their JS structure).
  const [notes, setNotes] = useState<Note[]>([]);
  const [labels, setLabels] = useState<string[]>(DEFAULT_LABELS);
  const [filter, setFilter] = useState<string>("notes");
  const [loading, setLoading] = useState(true);

  // Editor state
  const [showEditor, setShowEditor] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editPinned, setEditPinned] = useState(false);
  const [editLabels, setEditLabels] = useState<string[]>([]);
  const [editReminder, setEditReminder] = useState<string | null>(null);
  const [editSaveStatus, setEditSaveStatus] = useState("Saved");

  // Modal states
  const [reminderOpen, setReminderOpen] = useState(false);
  const [remDate, setRemDate] = useState("");
  const [remTime, setRemTime] = useState("");
  const [labelPickerOpen, setLabelPickerOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [labelManagerOpen, setLabelManagerOpen] = useState(false);
  const [managerNewLabel, setManagerNewLabel] = useState("");
  const [darkMode, setDarkMode] = useState(false);
  const [listMode, setListMode] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"updated" | "created" | "title">("updated");
  const [dataMenuOpen, setDataMenuOpen] = useState(false);
  const [cardMenu, setCardMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ---------- API helpers ----------
  async function apiFetchNotes(): Promise<Note[]> {
    const r = await fetch("/api/notes");
    const d = await r.json();
    return (d.notes ?? []).map((n: any): Note => ({
      id: n.id,
      title: n.title ?? "",
      body: normalizeBody(n.content ?? ""),
      pinned: !!n.pinned,
      archive: !!n.archive,
      trash: !!n.trash,
      color: n.color ?? "",
      labels: Array.isArray(n.labels) ? n.labels : [],
      reminder: n.reminder ?? null,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    }));
  }
  async function apiCreate(n: Partial<Note>): Promise<Note | null> {
    try {
      const r = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: n.title ?? "",
          content: n.body ?? "",
          color: n.color ?? "default",
          pinned: !!n.pinned,
          archive: !!n.archive,
          trash: !!n.trash,
          labels: n.labels ?? [],
          reminder: n.reminder ?? null,
        }),
      });
      if (!r.ok) return null;
      const d = await r.json();
      return d.note;
    } catch { return null; }
  }
  async function apiUpdate(id: string, patch: Partial<Note>): Promise<boolean> {
    try {
      const body: any = { id };
      if (patch.title !== undefined) body.title = patch.title;
      if (patch.body !== undefined) body.content = patch.body;
      if (patch.color !== undefined) body.color = patch.color;
      if (patch.pinned !== undefined) body.pinned = patch.pinned;
      if (patch.archive !== undefined) body.archive = patch.archive;
      if (patch.trash !== undefined) body.trash = patch.trash;
      if (patch.labels !== undefined) body.labels = patch.labels;
      if (patch.reminder !== undefined) body.reminder = patch.reminder;
      const r = await fetch("/api/notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return r.ok;
    } catch { return false; }
  }
  async function apiDelete(id: string): Promise<boolean> {
    try {
      const r = await fetch(`/api/notes?id=${id}`, { method: "DELETE" });
      return r.ok;
    } catch { return false; }
  }

  // ---------- Initial load ----------
  useEffect(() => {
    (async () => {
      setLoading(true);
      const ns = await apiFetchNotes();
      setNotes(ns);
      // Collect labels from notes + defaults
      const allLabels = new Set<string>(DEFAULT_LABELS);
      ns.forEach((n) => n.labels.forEach((l) => allLabels.add(l)));
      setLabels(Array.from(allLabels));
      // Restore dark mode from localStorage (UI-only pref, not server-side)
      if (typeof window !== "undefined" && localStorage.getItem("notes-dark") === "1") {
        setDarkMode(true);
      }
      if (typeof window !== "undefined" && localStorage.getItem("notes-view-list") === "1") {
        setListMode(true);
      }
      setLoading(false);
    })();
  }, []);

  // ---------- Derived: filtered + sorted ----------
  const filtered = (() => {
    const q = search.trim().toLowerCase();
    let arr = notes.filter((n) =>
      !q || (n.title + " " + n.body + " " + n.labels.join(" ")).toLowerCase().includes(q)
    );
    if (filter === "notes") arr = arr.filter((n) => !n.archive && !n.trash);
    else if (filter === "archive") arr = arr.filter((n) => n.archive && !n.trash);
    else if (filter === "trash") arr = arr.filter((n) => n.trash);
    else if (filter === "reminders") arr = arr.filter((n) => n.reminder && !n.trash);
    else if (filter.startsWith("label:")) {
      const lbl = filter.slice(6);
      arr = arr.filter((n) => n.labels.includes(lbl) && !n.trash && !n.archive);
    }
    arr = [...arr].sort((a, b) => {
      if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "created") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return arr;
  })();

  const labelCounts: Record<string, number> = {};
  notes.filter((n) => !n.trash).forEach((n) => n.labels.forEach((l) => { labelCounts[l] = (labelCounts[l] || 0) + 1; }));

  const filterTitle = (() => {
    if (filter === "notes") return "Notes";
    if (filter === "reminders") return "Reminders";
    if (filter === "archive") return "Archive";
    if (filter === "trash") return "Trash";
    if (filter.startsWith("label:")) return filter.slice(6);
    return "Notes";
  })();
  const filterSub = (() => {
    if (filter === "notes") return "Your notes, checklists and reminders";
    if (filter === "reminders") return "Notes with a reminder";
    if (filter === "archive") return "Archived notes";
    if (filter === "trash") return "Restore or permanently delete notes";
    if (filter.startsWith("label:")) return "Notes with this label";
    return "";
  })();

  // ---------- Editor handlers ----------
  const openEditor = (id: string | null) => {
    const n = id ? notes.find((x) => x.id === id) : null;
    setEditId(id);
    setEditTitle(n?.title ?? "");
    setEditBody(n?.body ?? "");
    setEditColor(n?.color ?? "");
    setEditPinned(!!n?.pinned);
    setEditLabels(n ? [...n.labels] : []);
    setEditReminder(n?.reminder ?? null);
    setEditSaveStatus("Saved");
    setShowEditor(true);
  };
  const closeEditor = () => setShowEditor(false);

  const saveEditor = async () => {
    const title = editTitle.trim() || "Untitled";
    const body = editBody.trim();
    if (!editTitle.trim() && !body) {
      toastMsg("Write something first");
      return;
    }
    setEditSaveStatus("Saving…");
    if (editId) {
      const ok = await apiUpdate(editId, {
        title, body, color: editColor, pinned: editPinned, labels: editLabels, reminder: editReminder,
      });
      if (ok) {
        setNotes(await apiFetchNotes());
        toastMsg("Note saved");
        setEditSaveStatus("Saved");
        closeEditor();
      } else {
        toastMsg("Failed to save");
        setEditSaveStatus("Unsaved");
      }
    } else {
      const created = await apiCreate({
        title, body, color: editColor, pinned: editPinned, archive: false, trash: false,
        labels: editLabels, reminder: editReminder,
      });
      if (created) {
        setNotes(await apiFetchNotes());
        toastMsg("Note created");
        setEditSaveStatus("Saved");
        closeEditor();
      } else {
        toastMsg("Failed to create");
        setEditSaveStatus("Unsaved");
      }
    }
  };

  const togglePinEditor = () => setEditPinned((v) => !v);

  // ---------- Card actions ----------
  const togglePin = async (id: string) => {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    await apiUpdate(id, { pinned: !n.pinned });
    setNotes(await apiFetchNotes());
  };
  const toggleArchive = async (id: string) => {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    await apiUpdate(id, { archive: !n.archive, trash: false });
    setNotes(await apiFetchNotes());
    toastMsg(!n.archive ? "Archived" : "Moved back to Notes");
  };
  const archiveCurrent = async () => {
    if (!editId) return;
    await toggleArchive(editId);
    closeEditor();
  };
  const moveTrash = async (id: string) => {
    await apiUpdate(id, { trash: true, archive: false });
    setNotes(await apiFetchNotes());
    toastMsg("Moved to Trash");
  };
  const deleteCurrent = async () => {
    if (!editId) return;
    await moveTrash(editId);
    closeEditor();
  };
  const editorDeleteAction = async () => {
    if (!editId) return;
    const n = notes.find((x) => x.id === editId);
    if (!n) return;
    if (n.trash) {
      await permanentDelete(n.id);
      closeEditor();
    } else {
      await moveTrash(n.id);
      closeEditor();
    }
  };
  const restoreNote = async (id: string) => {
    await apiUpdate(id, { trash: false, archive: false });
    setNotes(await apiFetchNotes());
    toastMsg("Note restored");
  };
  const permanentDelete = async (id: string) => {
    if (!confirm("Delete this note permanently? This cannot be undone.")) return;
    await apiDelete(id);
    setNotes(await apiFetchNotes());
    toastMsg("Note permanently deleted");
  };
  const emptyTrash = async () => {
    const trashNotes = notes.filter((n) => n.trash);
    const count = trashNotes.length;
    if (!count) return;
    if (!confirm(`Delete ${count} ${count === 1 ? "note" : "notes"} permanently? This cannot be undone.`)) return;
    await Promise.all(trashNotes.map((n) => apiDelete(n.id)));
    setNotes(await apiFetchNotes());
    toastMsg("Trash emptied");
  };
  const duplicateNote = async (id: string) => {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    await apiCreate({
      title: (n.title || "Untitled") + " copy",
      body: n.body,
      color: n.color,
      pinned: false,
      archive: false,
      trash: false,
      labels: [...n.labels],
      reminder: n.reminder,
    });
    setNotes(await apiFetchNotes());
    toastMsg("Note duplicated");
  };
  const duplicateCurrent = async () => {
    if (!editId) return;
    await duplicateNote(editId);
  };

  // ---------- Color picker ----------
  const selectColor = (c: string) => {
    setEditColor(c);
    setEditSaveStatus("Unsaved");
  };

  // ---------- Format text (execCommand — contenteditable in toolbar spirit) ----------
  // Since the body editor is a textarea in this React port, execCommand won't apply to it.
  // We keep the toolbar buttons (matching the user's HTML) but apply formatting via insertion
  // into the textarea (using simple markdown-ish markers, since execCommand needs contenteditable).
  // For the user's exact behavior we'd need a contenteditable; but we keep it minimal here:
  //   - Bold: insert **text** markers around selection
  //   - Italic: insert *text*
  //   - Underline: insert _text_
  const formatText = (cmd: "bold" | "italic" | "underline") => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = editBody.slice(start, end);
    const markers = cmd === "bold" ? "**" : cmd === "italic" ? "*" : "_";
    const newBody = editBody.slice(0, start) + markers + sel + markers + editBody.slice(end);
    setEditBody(newBody);
    setEditSaveStatus("Unsaved");
    // Restore caret position
    setTimeout(() => {
      ta.focus();
      ta.selectionStart = start + markers.length;
      ta.selectionEnd = end + markers.length;
    }, 0);
  };

  // ---------- Checklist ----------
  const insertChecklist = () => {
    const newBody = (editBody ? editBody + "\n" : "") + "☐ ";
    setEditBody(newBody);
    setEditSaveStatus("Unsaved");
  };
  const toggleChecklist = async (id: string, lineIndex: number, checked: boolean) => {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    const lines = normalizeBody(n.body).split("\n");
    if (lineIndex < 0 || lineIndex >= lines.length) return;
    const current = lines[lineIndex].trim();
    if (!/^[☐☑]\s*/.test(current)) return;
    const text = current.replace(/^☐\s*|^☑\s*/, "");
    lines[lineIndex] = (checked ? "☑ " : "☐ ") + text;
    await apiUpdate(id, { body: lines.join("\n") });
    setNotes(await apiFetchNotes());
  };

  // ---------- Reminder ----------
  const openReminder = () => {
    const d = editReminder ? new Date(editReminder) : new Date(Date.now() + 3600000);
    setRemDate(toLocalDateInput(d));
    setRemTime(toLocalTimeInput(d));
    setReminderOpen(true);
  };
  const hideReminder = () => setReminderOpen(false);
  const saveReminder = async () => {
    if (!remDate || !remTime) { toastMsg("Choose date and time"); return; }
    const iso = new Date(remDate + "T" + remTime).toISOString();
    setEditReminder(iso);
    setReminderOpen(false);
    if (editId) {
      await apiUpdate(editId, { reminder: iso });
      setNotes(await apiFetchNotes());
    }
  };
  const clearReminder = async () => {
    setEditReminder(null);
    setReminderOpen(false);
    if (editId) {
      await apiUpdate(editId, { reminder: null });
      setNotes(await apiFetchNotes());
    }
  };

  // ---------- Labels ----------
  const renderEditorLabels = () => editLabels;
  const openLabelPicker = () => setLabelPickerOpen(true);
  const hideLabelPicker = () => setLabelPickerOpen(false);
  const toggleLabelInPicker = (l: string) => {
    setEditLabels((prev) => prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]);
  };
  const applyLabels = async () => {
    setLabelPickerOpen(false);
    if (editId) {
      await apiUpdate(editId, { labels: editLabels });
      setNotes(await apiFetchNotes());
    }
    setEditSaveStatus("Unsaved");
  };
  const createAndAssignLabel = async () => {
    const name = newLabel.trim();
    if (!name) return;
    if (!labels.includes(name)) setLabels((prev) => [...prev, name]);
    if (!editLabels.includes(name)) setEditLabels((prev) => [...prev, name]);
    setNewLabel("");
    toastMsg("Label added");
  };

  // ---------- Label manager ----------
  const openLabelManager = () => setLabelManagerOpen(true);
  const hideLabelManager = () => setLabelManagerOpen(false);
  const createManagedLabel = () => {
    const name = managerNewLabel.trim();
    if (!name) return;
    if (labels.includes(name)) { toastMsg("Label already exists"); return; }
    setLabels((prev) => [...prev, name]);
    setManagerNewLabel("");
    toastMsg("Label created");
  };
  const deleteLabel = (index: number) => {
    const name = labels[index];
    if (!name) return;
    if (!confirm(`Delete label “${name}”? Notes will keep their text but lose this label.`)) return;
    setLabels((prev) => prev.filter((_, i) => i !== index));
    // Also strip this label from all notes
    (async () => {
      const toUpdate = notes.filter((n) => n.labels.includes(name));
      for (const n of toUpdate) {
        await apiUpdate(n.id, { labels: n.labels.filter((l) => l !== name) });
      }
      setNotes(await apiFetchNotes());
      if (filter === `label:${name}`) setFilter("notes");
    })();
    toastMsg("Label deleted");
  };

  // ---------- Filters ----------
  const setFilterNav = (f: string) => {
    setFilter(f);
    setSidebarOpen(false);
  };
  const setLabelFilter = (l: string) => {
    setFilter(`label:${l}`);
    setSidebarOpen(false);
  };

  // ---------- Sort/view ----------
  const toggleView = () => {
    setListMode((v) => {
      const nv = !v;
      if (typeof window !== "undefined") localStorage.setItem("notes-view-list", nv ? "1" : "0");
      return nv;
    });
  };
  const toggleDark = () => {
    setDarkMode((v) => {
      const nv = !v;
      if (typeof window !== "undefined") localStorage.setItem("notes-dark", nv ? "1" : "0");
      return nv;
    });
  };
  useEffect(() => {
    if (!rootRef.current) return;
    rootRef.current.classList.toggle("notes-dark", darkMode);
  }, [darkMode]);

  // ---------- Card menu (right-click style menu on cards) ----------
  const openCardMenu = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setCardMenu({ id, x: e.clientX, y: e.clientY });
  };
  useEffect(() => {
    if (!cardMenu) return;
    const close = () => setCardMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [cardMenu]);

  // ---------- Import / Export ----------
  const exportNotes = () => {
    const data = { version: 2, exportedAt: new Date().toISOString(), labels, notes };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "notes-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toastMsg("Backup exported");
    setDataMenuOpen(false);
  };
  const importNotes = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!Array.isArray(data.notes)) throw new Error("Invalid backup");
        const choice = confirm("OK = replace existing notes. Cancel = merge backup into current notes.");
        if (choice) {
          await Promise.all(notes.map((n) => apiDelete(n.id)));
        }
        for (const n of data.notes) {
          await apiCreate({
            title: n.title ?? "Untitled",
            body: normalizeBody(n.body ?? ""),
            color: n.color ?? "default",
            pinned: choice ? !!n.pinned : false,
            archive: choice ? !!n.archive : false,
            trash: choice ? !!n.trash : false,
            labels: Array.isArray(n.labels) ? n.labels : [],
            reminder: n.reminder || null,
          });
        }
        if (Array.isArray(data.labels)) {
          const merged = Array.from(new Set([...labels, ...data.labels.map(String).filter(Boolean)]));
          setLabels(merged);
        }
        setNotes(await apiFetchNotes());
        toastMsg("Backup imported");
      } catch {
        toastMsg("Invalid backup file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
    setDataMenuOpen(false);
  };

  // ---------- Toast ----------
  const [toastMsg_, setToastMsg_] = useState<string | null>(null);
  const toastTimerRef = useRef<any>(null);
  const toastMsg = (msg: string) => {
    setToastMsg_(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg_(null), 1800);
  };

  // ---------- Keyboard shortcuts ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        openEditor(null);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        document.getElementById("notes-search-input")?.focus();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && showEditor) {
        e.preventDefault();
        saveEditor();
      } else if (e.key === "Escape") {
        if (showEditor) closeEditor();
        else if (reminderOpen) hideReminder();
        else if (labelPickerOpen) hideLabelPicker();
        else if (labelManagerOpen) hideLabelManager();
        else if (dataMenuOpen) setDataMenuOpen(false);
        else if (cardMenu) setCardMenu(null);
        else if (sidebarOpen) setSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showEditor, reminderOpen, labelPickerOpen, labelManagerOpen, dataMenuOpen, cardMenu, sidebarOpen, editId, editTitle, editBody, editColor, editPinned, editLabels, editReminder]);

  // Close data menu on outside click
  useEffect(() => {
    if (!dataMenuOpen) return;
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-data-menu]") && !target.closest("[data-data-menu-trigger]")) {
        setDataMenuOpen(false);
      }
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [dataMenuOpen]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ---------- Cleanup old trash (>30 days) — server-side could do this; we'll just leave it ----------

  // ---------- Render ----------
  const isTrash = filter === "trash";
  const editorNote = editId ? notes.find((n) => n.id === editId) : null;

  return (
    <div ref={rootRef} className="notes-root">
      <style>{NOTES_CSS}</style>

      <div className="app">
        {/* === Topbar === */}
        <header className="topbar">
          <button
            className="icon-btn menu-btn"
            aria-label="Menu"
            title="Menu"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="brand">
            <div className="logo">
              <svg viewBox="0 0 24 24" width={21} height={21} fill="currentColor"><path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2Z" /></svg>
            </div>
            <strong>Notes</strong>
          </div>
          <label className="search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx={11} cy={11} r={7} /><path d="m20 20-4-4" /></svg>
            <input
              id="notes-search-input"
              placeholder="Search your notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="toolbar">
            <button className="icon-btn hide-sm" title="Refresh" onClick={() => { setNotes([]); apiFetchNotes().then(setNotes); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M20 11a8.1 8.1 0 0 0-15.7-2M4 4v5h5" /><path d="M4 13a8.1 8.1 0 0 0 15.7 2M20 20v-5h-5" /></svg>
            </button>
            <button
              className="icon-btn hide-sm"
              title="Import / Export"
              data-data-menu-trigger
              onClick={(e) => { e.stopPropagation(); setDataMenuOpen((v) => !v); }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M12 3v12M8 7l4-4 4 4" /><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></svg>
            </button>
            <button className="icon-btn hide-sm" title="Grid / List" onClick={toggleView}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x={4} y={4} width={6} height={6} rx={1} />
                <rect x={14} y={4} width={6} height={6} rx={1} />
                <rect x={4} y={14} width={6} height={6} rx={1} />
                <rect x={14} y={14} width={6} height={6} rx={1} />
              </svg>
            </button>
            <button className="icon-btn" title="Dark mode" onClick={toggleDark}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.7 6.7 0 0 0 21 12.8Z" /></svg>
            </button>
          </div>
        </header>

        {/* === Body === */}
        <div className="body">
          {/* Sidebar */}
          <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>
            <nav>
              <button
                className={`nav-btn${filter === "notes" ? " active" : ""}`}
                onClick={() => setFilterNav("notes")}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><path d="M14 3v7h6" /></svg>
                Notes <span className="label-count">{notes.filter((n) => !n.archive && !n.trash).length || ""}</span>
              </button>
              <button
                className={`nav-btn${filter === "reminders" ? " active" : ""}`}
                onClick={() => setFilterNav("reminders")}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>
                Reminders
              </button>
              <button
                className={`nav-btn${filter === "archive" ? " active" : ""}`}
                onClick={() => setFilterNav("archive")}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 7h16v13H4z" /><path d="M3 4h18v3H3zM9 12h6" /></svg>
                Archive
              </button>
              <button
                className={`nav-btn${filter === "trash" ? " active" : ""}`}
                onClick={() => setFilterNav("trash")}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 14h10l1-14M9 7V4h6v3" /></svg>
                Trash <span className="label-count">{notes.filter((n) => n.trash).length || ""}</span>
              </button>
            </nav>
            <div className="section-head">
              <div className="section-label">Labels</div>
              <button className="tiny-btn" title="Manage labels" onClick={openLabelManager}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M12 3v18M3 12h18" /></svg>
              </button>
            </div>
            <div className="label-list">
              {labels.map((l, i) => (
                <div
                  key={l + i}
                  className={`label-row${filter === `label:${l}` ? " active" : ""}`}
                  onClick={() => setLabelFilter(l)}
                >
                  <span className="label-dot" style={{ background: labelColor(l) }} />
                  <span className="label-name">{l}</span>
                  <span className="label-count">{labelCounts[l] || 0}</span>
                </div>
              ))}
            </div>
          </aside>

          {/* Backdrop (for mobile sidebar) */}
          <div
            className={`backdrop${sidebarOpen ? " show" : ""}`}
            onClick={() => setSidebarOpen(false)}
          />

          {/* Main content */}
          <main className="main">
            <div className="main-inner">
              <div className="view-head">
                <div>
                  <div className="view-title">{filterTitle}</div>
                  <div className="view-sub">{filterSub}</div>
                </div>
                <div className="view-actions">
                  <div className="sort-row">Sort
                    <select className="select" value={sort} onChange={(e) => setSort(e.target.value as any)}>
                      <option value="updated">Recently updated</option>
                      <option value="created">Recently created</option>
                      <option value="title">Title A–Z</option>
                    </select>
                  </div>
                  {isTrash && notes.some((n) => n.trash) && (
                    <button className="toolbar-btn" onClick={emptyTrash}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 14h10l1-14M9 7V4h6v3" /></svg>
                      Empty trash
                    </button>
                  )}
                </div>
              </div>
              <section className={`notes-grid${listMode ? " list" : ""}`}>
                {loading ? (
                  <div className="empty">
                    <div>
                      <div className="empty-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                          <path d="M12 2a10 10 0 1 0 10 10" /><path d="M12 6v6l4 2" />
                        </svg>
                      </div>
                      <div style={{ fontWeight: 650, marginBottom: 5 }}>Loading…</div>
                    </div>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="empty">
                    <div>
                      <div className="empty-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}><path d="M4 5a2 2 0 0 1 2-2h8l6 6v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><path d="M14 3v7h6" /></svg>
                      </div>
                      <div style={{ fontWeight: 650, marginBottom: 5 }}>No notes here</div>
                      <div>Create a note with the + button.</div>
                    </div>
                  </div>
                ) : (
                  filtered.map((n) => {
                    const info = checklistInfo(n.body);
                    const lines = info.lines;
                    return (
                      <article
                        key={n.id}
                        className={`card color-${n.color || ""}`}
                        onClick={() => openEditor(n.id)}
                      >
                        <button
                          className="icon-btn pin-top"
                          title={n.pinned ? "Unpin" : "Pin"}
                          onClick={(e) => { e.stopPropagation(); togglePin(n.id); }}
                          dangerouslySetInnerHTML={{
                            __html: n.pinned
                              ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="m14 3 7 7-3 1-4 4v5l-2 1-2-6-4-4-3 1 7-9Z"/></svg>'
                              : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m14 3 7 7-3 1-4 4v5l-2 1-2-6-4-4-3 1 7-9Z"/></svg>',
                          }}
                        />
                        <button
                          className="icon-btn menu-top"
                          title="More"
                          onClick={(e) => openCardMenu(e, n.id)}
                          dangerouslySetInnerHTML={{ __html: ICONS.more }}
                        />
                        <h3>{escapeHtml(n.title || "Untitled")}</h3>
                        {info.total > 0 ? (
                          <div className="check-list">
                            {lines.map((line, i) => {
                              if (!line.trim()) return null;
                              const m = line.trim().match(/^([☐☑])\s*(.*)$/);
                              if (m) {
                                const done = m[1] === "☑";
                                return (
                                  <div key={i} className={`check-item${done ? " done" : ""}`}>
                                    <input
                                      type="checkbox"
                                      checked={done}
                                      onClick={(e) => e.stopPropagation()}
                                      onChange={(e) => toggleChecklist(n.id, i, e.target.checked)}
                                    />
                                    <span dangerouslySetInnerHTML={{ __html: escapeHtml(m[2]) }} />
                                  </div>
                                );
                              }
                              return <div key={i} className="note-line" dangerouslySetInnerHTML={{ __html: escapeHtml(line) }} />;
                            })}
                            <div className="check-progress">{info.done}/{info.total} completed</div>
                          </div>
                        ) : (
                          <p
                            dangerouslySetInnerHTML={{
                              __html: escapeHtml(n.body).replace(/\n/g, "<br>") || '<span style="color:#9aa0a6">Empty note</span>',
                            }}
                          />
                        )}
                        {n.labels.length > 0 && (
                          <div className="chips">
                            {n.labels.map((l) => (
                              <span key={l} className="chip">
                                <span className="label-dot" style={{ width: 7, height: 7, background: labelColor(l) }} />
                                {escapeHtml(l)}
                              </span>
                            ))}
                          </div>
                        )}
                        {n.reminder && (
                          <div className="card-meta">
                            <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>
                            <span>{escapeHtml(new Date(n.reminder).toLocaleString())}</span>
                          </div>
                        )}
                        <div className="card-meta">{timeAgo(n.updatedAt)}</div>
                        <div className="card-actions">
                          {!isTrash && (
                            <>
                              <button
                                className="card-action normal-only"
                                title={n.archive ? "Unarchive" : "Archive"}
                                onClick={(e) => { e.stopPropagation(); toggleArchive(n.id); }}
                                dangerouslySetInnerHTML={{ __html: ICONS.archive }}
                              />
                              <button
                                className="card-action normal-only"
                                title="Move to trash"
                                onClick={(e) => { e.stopPropagation(); moveTrash(n.id); }}
                                dangerouslySetInnerHTML={{ __html: ICONS.trash }}
                              />
                              <button
                                className="card-action normal-only"
                                title="Duplicate"
                                onClick={(e) => { e.stopPropagation(); duplicateNote(n.id); }}
                                dangerouslySetInnerHTML={{ __html: ICONS.duplicate }}
                              />
                            </>
                          )}
                          <span className="trash-actions">
                            <button
                              className="card-action"
                              title="Restore"
                              onClick={(e) => { e.stopPropagation(); restoreNote(n.id); }}
                              dangerouslySetInnerHTML={{ __html: ICONS.restore }}
                            />
                            <button
                              className="card-action"
                              title="Delete permanently"
                              onClick={(e) => { e.stopPropagation(); permanentDelete(n.id); }}
                              dangerouslySetInnerHTML={{ __html: ICONS.trash }}
                            />
                          </span>
                        </div>
                      </article>
                    );
                  })
                )}
              </section>
            </div>
          </main>
        </div>

        {/* FAB */}
        <button className="fab" aria-label="Create note" title="Create note" onClick={() => openEditor(null)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>

      {/* === Editor overlay === */}
      <div
        className={`overlay${showEditor ? " show" : ""}`}
        onClick={(e) => { if (e.target === e.currentTarget) closeEditor(); }}
      >
        <div className="editor" onClick={(e) => e.stopPropagation()}>
          <div className="editor-head">
            <input
              id="editorTitle"
              className="editor-title"
              placeholder="Title"
              value={editTitle}
              onChange={(e) => { setEditTitle(e.target.value); setEditSaveStatus("Unsaved"); }}
              autoFocus
            />
            <button
              className="icon-btn"
              title="Pin"
              onClick={togglePinEditor}
              dangerouslySetInnerHTML={{
                __html: `<svg id="pinIcon" viewBox="0 0 24 24" width="18" height="18" ${editPinned ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.8"'}><path d="m14 3 7 7-3 1-4 4v5l-2 1-2-6-4-4-3 1 7-9Z"/></svg>`,
              }}
            />
            <button
              className="icon-btn"
              title="Close"
              onClick={closeEditor}
              dangerouslySetInnerHTML={{ __html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m6 6 12 12M18 6 6 18"/></svg>' }}
            />
          </div>
          <div className="editor-body">
            <div className="editor-toolbar">
              <button className="pill-btn" onClick={() => formatText("bold")}><b>B</b></button>
              <button className="pill-btn" onClick={() => formatText("italic")}><i>I</i></button>
              <button className="pill-btn" onClick={() => formatText("underline")}><u>U</u></button>
              <button className="pill-btn" onClick={insertChecklist} dangerouslySetInnerHTML={{ __html: ICONS.check + " Checklist" }} />
              <button className="pill-btn" onClick={openReminder}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg> Reminder
              </button>
              <button className="pill-btn" onClick={openLabelPicker}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M4 5v6l9 9 7-7-9-9H4Z" /><circle cx={8} cy={8} r={1} /></svg> Label
              </button>
              <button className="pill-btn" onClick={duplicateCurrent} dangerouslySetInnerHTML={{ __html: ICONS.duplicate + " Copy" }} />
            </div>
            <textarea
              ref={textareaRef}
              id="richEditor"
              className="editor-text"
              data-placeholder="Take a note..."
              value={editBody}
              onChange={(e) => { setEditBody(e.target.value); setEditSaveStatus("Unsaved"); }}
              placeholder="Take a note..."
            />
            <div className="colorbar">
              <span style={{ fontSize: 12, color: "#777" }}>Color</span>
              {[
                { color: "", bg: "#fff", title: "Default" },
                { color: "yellow", bg: "#fff8d8", title: "Yellow" },
                { color: "green", bg: "#e5f5e9", title: "Green" },
                { color: "blue", bg: "#e7f0ff", title: "Blue" },
                { color: "purple", bg: "#f3e8ff", title: "Purple" },
                { color: "pink", bg: "#ffe7ef", title: "Pink" },
                { color: "gray", bg: "#f4f5f7", title: "Gray" },
              ].map((c) => (
                <button
                  key={c.color || "default"}
                  className={`color-dot${editColor === c.color ? " selected" : ""}`}
                  style={{ background: c.bg }}
                  data-color={c.color}
                  title={c.title}
                  onClick={() => selectColor(c.color)}
                />
              ))}
            </div>
            {editLabels.length > 0 && (
              <div className="chips">
                {editLabels.map((l) => (
                  <span key={l} className="chip">
                    <span className="label-dot" style={{ width: 7, height: 7, background: labelColor(l) }} />
                    {escapeHtml(l)}
                  </span>
                ))}
              </div>
            )}
            {editReminder && (
              <div className="reminder-box">
                <div className="reminder-box-left">
                  <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>
                  <span>{new Date(editReminder).toLocaleString()}</span>
                </div>
                <button className="tiny-btn" title="Remove reminder" onClick={clearReminder}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="m6 6 12 12M18 6 6 18" /></svg>
                </button>
              </div>
            )}
          </div>
          <div className="editor-footer">
            <div className="footer-left">
              <button
                className="icon-btn danger"
                title={editorNote?.trash ? "Delete permanently" : "Move to trash"}
                onClick={editorDeleteAction}
                dangerouslySetInnerHTML={{ __html: ICONS.trash }}
              />
              <button
                className="icon-btn"
                title="Archive"
                onClick={archiveCurrent}
                dangerouslySetInnerHTML={{ __html: ICONS.archive }}
              />
              <span className="save-status">{editSaveStatus}</span>
            </div>
            <div className="footer-right">
              <button className="secondary" onClick={closeEditor}>Close</button>
              <button className="primary" onClick={saveEditor}>Done</button>
            </div>
          </div>
        </div>
      </div>

      {/* === Reminder modal === */}
      <div
        className={`overlay${reminderOpen ? " show" : ""}`}
        onClick={(e) => { if (e.target === e.currentTarget) hideReminder(); }}
      >
        <div className="modal-small" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <h3>Set reminder</h3>
            <button
              className="icon-btn"
              onClick={hideReminder}
              dangerouslySetInnerHTML={{ __html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m6 6 12 12M18 6 6 18"/></svg>' }}
            />
          </div>
          <div className="reminder-grid">
            <input type="date" value={remDate} onChange={(e) => setRemDate(e.target.value)} />
            <input type="time" value={remTime} onChange={(e) => setRemTime(e.target.value)} />
          </div>
          <div className="modal-foot">
            <button className="secondary" onClick={hideReminder}>Cancel</button>
            <button className="primary" onClick={saveReminder}>Set reminder</button>
          </div>
        </div>
      </div>

      {/* === Label picker modal === */}
      <div
        className={`overlay${labelPickerOpen ? " show" : ""}`}
        onClick={(e) => { if (e.target === e.currentTarget) hideLabelPicker(); }}
      >
        <div className="modal-small" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <h3>Labels</h3>
            <button
              className="icon-btn"
              onClick={hideLabelPicker}
              dangerouslySetInnerHTML={{ __html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m6 6 12 12M18 6 6 18"/></svg>' }}
            />
          </div>
          <div className="modal-body label-picker-list">
            {labels.length === 0 && <div style={{ padding: 10, color: "#8b9096" }}>No labels yet</div>}
            {labels.map((l) => (
              <label key={l} className="label-option">
                <input
                  type="checkbox"
                  checked={editLabels.includes(l)}
                  onChange={() => toggleLabelInPicker(l)}
                />
                <span className="label-dot" style={{ background: labelColor(l) }} />
                <span>{l}</span>
              </label>
            ))}
          </div>
          <div className="label-create">
            <input
              placeholder="Create new label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createAndAssignLabel(); }}
            />
            <button className="primary" onClick={createAndAssignLabel}>Add</button>
          </div>
          <div className="modal-foot">
            <button className="secondary" onClick={hideLabelPicker}>Cancel</button>
            <button className="primary" onClick={applyLabels}>Apply</button>
          </div>
        </div>
      </div>

      {/* === Label manager modal === */}
      <div
        className={`overlay${labelManagerOpen ? " show" : ""}`}
        onClick={(e) => { if (e.target === e.currentTarget) hideLabelManager(); }}
      >
        <div className="modal-small" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <h3>Manage labels</h3>
            <button
              className="icon-btn"
              onClick={hideLabelManager}
              dangerouslySetInnerHTML={{ __html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m6 6 12 12M18 6 6 18"/></svg>' }}
            />
          </div>
          <div className="modal-body">
            {labels.length === 0 && <div style={{ padding: 10, color: "#8b9096" }}>No labels yet</div>}
            {labels.map((l, i) => (
              <div key={l + i} className="label-row">
                <span className="label-dot" style={{ background: labelColor(l) }} />
                <span className="label-name">{l}</span>
                <button
                  className="tiny-btn"
                  title="Delete label"
                  onClick={() => deleteLabel(i)}
                  dangerouslySetInnerHTML={{ __html: ICONS.trash }}
                />
              </div>
            ))}
          </div>
          <div className="label-create">
            <input
              placeholder="Create label"
              value={managerNewLabel}
              onChange={(e) => setManagerNewLabel(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createManagedLabel(); }}
            />
            <button className="primary" onClick={createManagedLabel}>Add</button>
          </div>
          <div className="modal-foot">
            <button className="secondary" onClick={hideLabelManager}>Done</button>
          </div>
        </div>
      </div>

      {/* === Data menu (import/export popup) === */}
      {dataMenuOpen && (
        <div
          className="menu-panel show"
          style={{ position: "fixed", left: "auto", right: 16, top: 64, zIndex: 170 }}
          data-data-menu
          onClick={(e) => e.stopPropagation()}
        >
          <button className="menu-item" onClick={exportNotes}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M12 21V9M8 13l4-4 4 4" /><path d="M5 7V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2" /></svg>
            Export backup
          </button>
          <label className="menu-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path d="M12 3v12M8 11l4 4 4-4" /><path d="M5 14v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" /></svg>
            Import backup
            <input type="file" accept="application/json,.json" hidden onChange={importNotes} />
          </label>
        </div>
      )}

      {/* === Card context menu === */}
      {cardMenu && (() => {
        const n = notes.find((x) => x.id === cardMenu.id);
        if (!n) return null;
        return (
          <div
            className="menu-panel show"
            style={{ position: "fixed", left: Math.min(cardMenu.x, window.innerWidth - 200), top: Math.min(cardMenu.y + 6, window.innerHeight - 180), zIndex: 170 }}
            onClick={(e) => { e.stopPropagation(); setCardMenu(null); }}
          >
            <button className="menu-item" onClick={() => { openEditor(n.id); setCardMenu(null); }}>
              {ICONS.more}<span>Open note</span>
            </button>
            <button className="menu-item" onClick={() => { duplicateNote(n.id); setCardMenu(null); }}>
              {ICONS.duplicate}<span>Make a copy</span>
            </button>
            {isTrash ? (
              <>
                <button className="menu-item" onClick={() => { restoreNote(n.id); setCardMenu(null); }}>
                  {ICONS.restore}<span>Restore</span>
                </button>
                <button className="menu-item danger" onClick={() => { permanentDelete(n.id); setCardMenu(null); }}>
                  {ICONS.trash}<span>Delete permanently</span>
                </button>
              </>
            ) : (
              <>
                <button className="menu-item" onClick={() => { toggleArchive(n.id); setCardMenu(null); }}>
                  {ICONS.archive}<span>Archive / unarchive</span>
                </button>
                <button className="menu-item danger" onClick={() => { moveTrash(n.id); setCardMenu(null); }}>
                  {ICONS.trash}<span>Move to trash</span>
                </button>
              </>
            )}
          </div>
        );
      })()}

      {/* === Toast === */}
      {toastMsg_ && (
        <div className="toast show">{toastMsg_}</div>
      )}
    </div>
  );
}

function toLocalDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toLocalTimeInput(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ---------- CSS ----------
// Adapted from the user's original HTML <style> block, with the overlay made solid
// (no transparency, no backdrop-filter) per the user's request.
const NOTES_CSS = `
.notes-root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#202124;background:#fff;min-height:100%}
.notes-root *{box-sizing:border-box}
.notes-root button,.notes-root input,.notes-root textarea,.notes-root select{font:inherit}
.notes-root button{cursor:pointer}
.notes-root svg{display:block}
.notes-root .app{min-height:100%;display:flex;flex-direction:column}
.notes-root .topbar{height:70px;display:flex;align-items:center;gap:12px;padding:0 16px;border-bottom:1px solid #e3e6ea;position:sticky;top:0;z-index:60;background:#fff}
.notes-root .brand{display:flex;align-items:center;gap:10px;min-width:220px}
.notes-root .brand strong{font-size:19px;letter-spacing:-.02em}
.notes-root .logo{width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,#ffd76a,#ffb347);display:grid;place-items:center;color:#5d4300;box-shadow:0 5px 14px rgba(255,179,71,.2)}
.notes-root .menu-btn{display:none}
.notes-root .toolbar{display:flex;align-items:center;gap:2px;margin-left:auto}
.notes-root .icon-btn{width:40px;height:40px;border:0;background:transparent;border-radius:50%;display:grid;place-items:center;color:#5f6368}
.notes-root .icon-btn:hover{background:#f1f3f4}
.notes-root .icon-btn svg{width:19px;height:19px}
.notes-root .icon-btn.danger{color:#b3261e!important}
.notes-root .search{height:46px;display:flex;align-items:center;gap:9px;background:#f1f3f4;border:1px solid transparent;border-radius:13px;padding:0 14px;max-width:680px;flex:1;transition:.15s}
.notes-root .search:focus-within{background:#fff;border-color:#cfd3d8;box-shadow:0 2px 8px rgba(0,0,0,.08)}
.notes-root .search svg{width:19px;color:#6b7280;flex:none}
.notes-root .search input{border:0;outline:0;background:transparent;width:100%;color:#202124;font-size:15px}
.notes-root .body{flex:1;display:flex;min-height:calc(100vh - 70px)}
.notes-root .sidebar{width:250px;padding:14px 8px;border-right:1px solid #e3e6ea;background:#fff;z-index:50;transition:transform .2s}
.notes-root .sidebar nav{display:flex;flex-direction:column;gap:3px}
.notes-root .nav-btn{display:flex;align-items:center;gap:15px;border:0;background:transparent;border-radius:0 24px 24px 0;padding:12px 18px;font-size:14px;color:#4b5563;text-align:left;width:100%}
.notes-root .nav-btn:hover{background:#f5f6f7}
.notes-root .nav-btn.active{background:#feefc3;color:#222}
.notes-root .nav-btn svg{width:19px;height:19px;flex:none}
.notes-root .section-head{display:flex;align-items:center;justify-content:space-between;margin:22px 9px 7px 15px}
.notes-root .section-label{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#9aa0a6}
.notes-root .tiny-btn{width:30px;height:30px;border:0;background:transparent;border-radius:50%;display:grid;place-items:center;color:#6b7280}
.notes-root .tiny-btn:hover{background:#f1f3f4}
.notes-root .tiny-btn svg{width:16px;height:16px}
.notes-root .label-list{display:flex;flex-direction:column;gap:2px}
.notes-root .label-row{display:flex;align-items:center;gap:10px;padding:9px 14px;border-radius:10px;font-size:14px;cursor:pointer;color:#4b5563}
.notes-root .label-row:hover{background:#f5f6f7}
.notes-root .label-row.active{background:#e8f0fe;color:#174ea6}
.notes-root .label-dot{width:10px;height:10px;border-radius:50%;border:1px solid rgba(0,0,0,.12);flex:none}
.notes-root .label-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.notes-root .label-count{font-size:11px;color:#9aa0a6}
.notes-root .main{flex:1;min-width:0;padding:26px 28px 96px;overflow:auto}
.notes-root .main-inner{max-width:1380px;margin:0 auto}
.notes-root .view-head{display:flex;justify-content:space-between;align-items:center;gap:15px;margin-bottom:18px}
.notes-root .view-title{font-size:21px;font-weight:750;letter-spacing:-.025em}
.notes-root .view-sub{font-size:12px;color:#6b7280;margin-top:3px}
.notes-root .view-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
.notes-root .sort-row{display:flex;align-items:center;gap:6px;font-size:13px;color:#6b7280}
.notes-root .select{height:38px;border:1px solid #e3e6ea;background:#fff;border-radius:10px;padding:0 11px;color:#4b5563}
.notes-root .toolbar-btn{height:38px;border:1px solid #e3e6ea;background:#fff;border-radius:10px;padding:0 12px;display:inline-flex;align-items:center;gap:7px;color:#4b5563}
.notes-root .toolbar-btn:hover{background:#f7f8f9}
.notes-root .toolbar-btn svg{width:16px;height:16px}
.notes-root .notes-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:15px;align-items:start}
.notes-root .notes-grid.list{grid-template-columns:1fr;max-width:920px;margin:auto}
.notes-root .card{position:relative;border:1px solid #e3e6ea;border-radius:14px;padding:15px;background:#fff;min-height:115px;box-shadow:0 1px 1px rgba(0,0,0,.03);transition:transform .14s,box-shadow .14s,border-color .14s;overflow:hidden;cursor:pointer}
.notes-root .card:hover{box-shadow:0 2px 8px rgba(60,64,67,.15),0 1px 3px rgba(60,64,67,.08);transform:translateY(-1px)}
.notes-root .card.color-yellow{background:#fff8d8}
.notes-root .card.color-green{background:#e5f5e9}
.notes-root .card.color-blue{background:#e7f0ff}
.notes-root .card.color-purple{background:#f3e8ff}
.notes-root .card.color-pink{background:#ffe7ef}
.notes-root .card.color-gray{background:#f4f5f7}
.notes-root .card h3{font-size:15px;margin:0 58px 9px 0;line-height:1.35}
.notes-root .card p{margin:0;color:#3f4348;white-space:pre-wrap;font-size:14px;line-height:1.52}
.notes-root .card .pin-top{position:absolute;right:5px;top:5px}
.notes-root .card .menu-top{position:absolute;right:43px;top:5px}
.notes-root .card-meta{margin-top:11px;color:#858b93;font-size:11px;display:flex;align-items:center;gap:5px;line-height:1.35}
.notes-root .card-meta svg{flex:none}
.notes-root .chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:11px}
.notes-root .chip{display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.92);border:1px solid rgba(0,0,0,.06);font-size:10px;color:#61656a}
.notes-root .card-actions{display:flex;gap:2px;margin-top:11px;opacity:0;transform:translateY(3px);transition:.14s}
.notes-root .card:hover .card-actions{opacity:1;transform:none}
.notes-root .card-action{width:32px;height:32px;border:0;background:rgba(255,255,255,.92);border-radius:50%;display:grid;place-items:center;color:#5f6368}
.notes-root .card-action:hover{background:rgba(255,255,255,1)}
.notes-root .card-action svg{width:16px;height:16px}
.notes-root .check-list{display:flex;flex-direction:column;gap:8px;margin-top:4px}
.notes-root .check-item{display:flex;gap:9px;align-items:flex-start;font-size:14px;line-height:1.42}
.notes-root .check-item input{width:17px;height:17px;margin:2px 0 0;accent-color:#1a73e8;cursor:pointer;flex:none}
.notes-root .check-item span{min-width:0;white-space:normal;overflow-wrap:anywhere}
.notes-root .check-item.done span{text-decoration:line-through;color:#8b8f94}
.notes-root .note-line{font-size:14px;line-height:1.52;margin-top:2px;color:#3f4348;white-space:pre-wrap;overflow-wrap:anywhere}
.notes-root .check-progress{font-size:11px;color:#777;margin-top:8px}
.notes-root .trash-actions{display:none}
.notes-root .trash-mode .trash-actions{display:flex}
.notes-root .trash-mode .card-actions .normal-only{display:none}
.notes-root .empty{display:grid;place-items:center;text-align:center;padding:95px 20px;color:#7b8188;grid-column:1/-1}
.notes-root .empty-icon{width:74px;height:74px;border-radius:50%;background:#f7f8fa;display:grid;place-items:center;margin-bottom:15px}
.notes-root .empty-icon svg{width:34px;height:34px;color:#a1a7ad}
.notes-root .fab{position:fixed;right:30px;bottom:30px;width:58px;height:58px;border:0;border-radius:18px;background:#1a73e8;color:#fff;display:grid;place-items:center;box-shadow:0 8px 22px rgba(26,115,232,.32);z-index:35}
.notes-root .fab:hover{transform:translateY(-1px);background:#1769d4}
.notes-root .fab svg{width:25px}
/* Overlay — SOLID background, no transparency, no backdrop-filter (per user request) */
.notes-root .overlay{position:fixed;inset:0;background:#1f2937;display:none;align-items:center;justify-content:center;z-index:100;padding:18px}
.notes-root .overlay.show{display:flex}
.notes-root .editor{width:min(800px,100%);max-height:93vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.27);border:1px solid #e3e6ea}
.notes-root .editor-head{display:flex;align-items:center;gap:10px;padding:16px 18px;border-bottom:1px solid #e3e6ea;position:sticky;top:0;background:#fff;z-index:2}
.notes-root .editor-title{border:0;outline:0;font-size:20px;font-weight:750;flex:1;background:transparent;color:#202124}
.notes-root .editor-body{padding:20px}
.notes-root .editor-toolbar{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:13px}
.notes-root .pill-btn{height:36px;min-width:36px;padding:0 10px;border:1px solid #e3e6ea;background:#fff;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;gap:7px;color:#4b5563}
.notes-root .pill-btn:hover{background:#f7f8f9}
.notes-root .pill-btn.active{background:#e8f0fe;border-color:#bfd4fb;color:#1a73e8}
.notes-root .pill-btn svg{width:16px;height:16px;flex:none}
.notes-root .editor-text{width:100%;min-height:280px;resize:vertical;border:0;outline:0;font-size:16px;line-height:1.65;white-space:pre-wrap;word-break:break-word;background:#fff;color:#202124}
.notes-root .editor-text:empty:before{content:attr(data-placeholder);color:#a1a7ad}
.notes-root .colorbar{display:flex;gap:8px;align-items:center;padding-top:13px;margin-top:14px;border-top:1px solid #e3e6ea}
.notes-root .color-dot{width:28px;height:28px;border-radius:50%;border:2px solid transparent}
.notes-root .color-dot:hover{transform:scale(1.04)}
.notes-root .color-dot.selected{border-color:#1f2937}
.notes-root .reminder-box{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px;padding:10px;border-radius:10px;background:#f7f8fa;font-size:13px}
.notes-root .reminder-box-left{display:flex;align-items:center;gap:7px;min-width:0}
.notes-root .reminder-box span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.notes-root .editor-footer{display:flex;justify-content:space-between;align-items:center;padding:13px 18px;border-top:1px solid #e3e6ea;position:sticky;bottom:0;background:#fff}
.notes-root .footer-left,.notes-root .footer-right{display:flex;gap:4px;align-items:center}
.notes-root .save-status{font-size:12px;color:#8b9096}
.notes-root .primary{background:#1a73e8;color:#fff;border:0;border-radius:9px;height:38px;padding:0 15px;font-weight:650}
.notes-root .secondary{background:#fff;border:1px solid #e3e6ea;height:38px;border-radius:9px;padding:0 13px;color:#4b5563}
.notes-root .danger-text{color:#b3261e!important}
.notes-root .modal-small{width:min(560px,100%);background:#fff;border-radius:17px;box-shadow:0 20px 60px rgba(0,0,0,.25);padding:20px;border:1px solid #e3e6ea}
.notes-root .modal-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:15px}
.notes-root .modal-head h3{margin:0;font-size:18px}
.notes-root .modal-body{max-height:55vh;overflow:auto}
.notes-root .reminder-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.notes-root .reminder-grid input,.notes-root .label-create input{height:42px;border:1px solid #e3e6ea;border-radius:9px;padding:0 10px;background:#fff;color:#202124;outline:none}
.notes-root .modal-foot{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}
.notes-root .label-picker-list{display:flex;flex-direction:column;gap:6px}
.notes-root .label-option{display:flex;align-items:center;gap:10px;padding:9px;border-radius:10px;cursor:pointer}
.notes-root .label-option:hover{background:#f7f8fa}
.notes-root .label-option input{width:17px;height:17px;accent-color:#1a73e8}
.notes-root .label-create{display:flex;gap:8px;margin-top:14px;padding-top:14px;border-top:1px solid #e3e6ea}
.notes-root .label-create input{flex:1}
.notes-root .menu-panel{position:fixed;z-index:170;min-width:180px;padding:6px;background:#fff;border:1px solid #e3e6ea;border-radius:12px;box-shadow:0 12px 35px rgba(0,0,0,.18);display:block}
.notes-root .menu-item{width:100%;display:flex;align-items:center;gap:9px;padding:9px 10px;border:0;background:transparent;border-radius:8px;color:#4b5563;text-align:left;font-size:13px;cursor:pointer}
.notes-root .menu-item:hover{background:#f7f8fa}
.notes-root .menu-item svg{width:16px;height:16px;flex:none}
.notes-root .menu-item.danger{color:#b3261e}
.notes-root .toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,0);background:#202124;color:#fff;padding:10px 15px;border-radius:10px;font-size:13px;z-index:220}
.notes-root .backdrop{display:none;position:fixed;inset:0;background:rgba(0,0,0,.2);z-index:45}
.notes-root .backdrop.show{display:block}
@media(max-width:900px){
  .notes-root .brand{min-width:auto}
  .notes-root .brand strong{display:none}
  .notes-root .menu-btn{display:grid}
  .notes-root .sidebar{position:fixed;top:70px;bottom:0;left:0;transform:translateX(-105%);box-shadow:12px 0 25px rgba(0,0,0,.08)}
  .notes-root .sidebar.open{transform:none}
  .notes-root .main{padding:20px 15px 90px}
  .notes-root .search{max-width:none}
  .notes-root .notes-grid{grid-template-columns:repeat(auto-fill,minmax(195px,1fr))}
}
@media(max-width:560px){
  .notes-root .topbar{height:62px;padding:0 10px}
  .notes-root .body{min-height:calc(100vh - 62px)}
  .notes-root .sidebar{top:62px}
  .notes-root .toolbar .hide-sm{display:none}
  .notes-root .main{padding:15px 10px 85px}
  .notes-root .view-head{align-items:flex-start}
  .notes-root .view-actions{justify-content:flex-end}
  .notes-root .notes-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
  .notes-root .card{padding:12px;border-radius:12px}
  .notes-root .card h3{font-size:14px}
  .notes-root .card p,.notes-root .note-line,.notes-root .check-item{font-size:13px}
  .notes-root .card-actions{opacity:1;transform:none}
  .notes-root .fab{right:17px;bottom:17px;width:54px;height:54px;border-radius:16px}
  .notes-root .editor{max-height:96vh;border-radius:15px}
  .notes-root .editor-body{padding:15px}
  .notes-root .reminder-grid{grid-template-columns:1fr}
  .notes-root .search{height:42px}
  .notes-root .view-sub{max-width:52vw}
  .notes-root .menu-panel{max-width:calc(100vw - 20px)}
}
/* Dark mode — solid colors (no transparency) */
.notes-root.notes-dark{--bg:#202124;--surface:#202124;--surface2:#292a2d;--text:#e8eaed;--muted:#9aa0a6;--line:#3c4043}
.notes-root.notes-dark{background:#202124;color:#e8eaed}
.notes-root.notes-dark .topbar{background:#202124;border-color:#3c4043}
.notes-root.notes-dark .search{background:#303134;border-color:transparent}
.notes-root.notes-dark .search:focus-within{background:#202124;border-color:#5f6368}
.notes-root.notes-dark .nav-btn,.notes-root.notes-dark .label-row,.notes-root.notes-dark .pill-btn,.notes-root.notes-dark .toolbar-btn,.notes-root.notes-dark .secondary,.notes-root.notes-dark .select{color:#c6c9ce}
.notes-root.notes-dark .nav-btn:hover,.notes-root.notes-dark .label-row:hover,.notes-root.notes-dark .pill-btn:hover,.notes-root.notes-dark .toolbar-btn:hover,.notes-root.notes-dark .tiny-btn:hover,.notes-root.notes-dark .icon-btn:hover{background:#303134}
.notes-root.notes-dark .icon-btn{color:#c6c9ce}
.notes-root.notes-dark .card p,.notes-root.notes-dark .note-line{color:#d2d5d8}
.notes-root.notes-dark .card.color-yellow{background:#4b411d}
.notes-root.notes-dark .card.color-green{background:#203a28}
.notes-root.notes-dark .card.color-blue{background:#20344f}
.notes-root.notes-dark .card.color-purple{background:#392949}
.notes-root.notes-dark .card.color-pink{background:#4c2733}
.notes-root.notes-dark .card.color-gray{background:#2a2d31}
.notes-root.notes-dark .card{border-color:#45484d;background:#202124}
.notes-root.notes-dark .card-action{background:rgba(32,33,36,.92)}
.notes-root.notes-dark .editor{background:#202124;border-color:#3c4043}
.notes-root.notes-dark .editor-head{background:#202124;border-color:#3c4043}
.notes-root.notes-dark .editor-title{color:#e8eaed}
.notes-root.notes-dark .editor-text{background:#202124;color:#e8eaed}
.notes-root.notes-dark .editor-footer{background:#202124;border-color:#3c4043}
.notes-root.notes-dark .pill-btn{background:#202124;border-color:#3c4043;color:#c6c9ce}
.notes-root.notes-dark .pill-btn:hover{background:#292a2d}
.notes-root.notes-dark .modal-small{background:#202124;border-color:#3c4043;color:#e8eaed}
.notes-root.notes-dark .reminder-grid input,.notes-root.notes-dark .label-create input{background:#202124;border-color:#3c4043;color:#e8eaed}
.notes-root.notes-dark .reminder-box{background:#292a2d;color:#e8eaed}
.notes-root.notes-dark .secondary{background:#202124;border-color:#3c4043;color:#c6c9ce}
.notes-root.notes-dark .menu-panel{background:#202124;border-color:#3c4043}
.notes-root.notes-dark .menu-item{color:#c6c9ce}
.notes-root.notes-dark .menu-item:hover{background:#292a2d}
.notes-root.notes-dark .select{background:#202124;border-color:#3c4043;color:#c6c9ce}
.notes-root.notes-dark .sidebar{background:#202124;border-color:#3c4043}
.notes-root.notes-dark .empty-icon{background:#292a2d}
.notes-root.notes-dark .chip{background:rgba(32,33,36,.92);border-color:#3c4043;color:#c6c9ce}
.notes-root.notes-dark .overlay{background:#0b0b0c}
`;
