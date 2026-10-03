"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Plus, Pin, Trash2, Search, StickyNote, Loader2, X, Check,
  Archive, ArchiveRestore, Bell, Tag, Copy as CopyIcon, MoreVertical,
  Sun, Moon, List as ListIcon, Grid as GridIcon, ChevronLeft, ChevronRight,
  Menu, Download, Upload, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface Note {
  id: string;
  title: string;
  content: string;
  color: string;
  pinned: boolean;
  archive: boolean;
  trash: boolean;
  trashAt: string | null;
  labels: string[];
  reminder: string | null;
  createdAt: string;
  updatedAt: string;
}

const COLORS = [
  { key: "default", bg: "bg-card", border: "border-border", dot: "#9aa0a6" },
  { key: "yellow", bg: "bg-amber-50 dark:bg-amber-900/30", border: "border-amber-200 dark:border-amber-800/50", dot: "#fbbc04" },
  { key: "green", bg: "bg-emerald-50 dark:bg-emerald-900/30", border: "border-emerald-200 dark:border-emerald-800/50", dot: "#34a853" },
  { key: "blue", bg: "bg-sky-50 dark:bg-sky-900/30", border: "border-sky-200 dark:border-sky-800/50", dot: "#1a73e8" },
  { key: "pink", bg: "bg-pink-50 dark:bg-pink-900/30", border: "border-pink-200 dark:border-pink-800/50", dot: "#e84393" },
  { key: "purple", bg: "bg-violet-50 dark:bg-violet-900/30", border: "border-violet-200 dark:border-violet-800/50", dot: "#a142f4" },
  { key: "gray", bg: "bg-slate-100 dark:bg-slate-800/40", border: "border-slate-200 dark:border-slate-700/50", dot: "#5f6368" },
];

function getColorMeta(color: string) {
  return COLORS.find((c) => c.key === color) ?? COLORS[0];
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

// Plain-text <-> internal content. Notes are stored as plain text (one paragraph per line),
// with checklist lines prefixed by "☐ " (unchecked) or "☑ " (checked).
function plainToHtml(text: string): string {
  return text.split(/\r?\n/).map((l) => l.trim() ? `<p>${escapeHtml(l)}</p>` : "<p></p>").join("");
}
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function stripHtml(html: string): string {
  return html?.replace(/<\/(p|h1|h2|h3|li|blockquote)>/gi, " ").replace(/<[^>]+>/g, "").trim() ?? "";
}

// Detect checklist lines in plain-text body
function checklistInfo(body: string) {
  const lines = body.split(/\r?\n/);
  const items = lines.filter((x) => /^\s*[☐☑]\s*/.test(x));
  const done = items.filter((x) => /^\s*☑\s*/.test(x)).length;
  return { lines, items, done, total: items.length };
}

export function NotesView() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [labels, setLabels] = useState<string[]>(DEFAULT_LABELS);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"notes" | "reminders" | "archive" | "trash" | `label:${string}`>("notes");
  const [sort, setSort] = useState<"updated" | "created" | "title">("updated");
  const [listMode, setListMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [cardMenuId, setCardMenuId] = useState<string | null>(null);

  // Editor state
  const [showEditor, setShowEditor] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editColor, setEditColor] = useState("default");
  const [editPinned, setEditPinned] = useState(false);
  const [editLabels, setEditLabels] = useState<string[]>([]);
  const [editReminder, setEditReminder] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reminder modal state
  const [reminderOpen, setReminderOpen] = useState(false);
  const [remDate, setRemDate] = useState("");
  const [remTime, setRemTime] = useState("");

  // Label picker state
  const [labelPickerOpen, setLabelPickerOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  // Load all notes
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/notes");
      const d = await r.json();
      const ns: Note[] = d.notes ?? [];
      setNotes(ns);
      // Collect labels from notes
      const allLabels = new Set<string>(DEFAULT_LABELS);
      ns.forEach((n) => n.labels.forEach((l) => allLabels.add(l)));
      setLabels(Array.from(allLabels));
    } catch {
      toast.error("Failed to load notes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Close card menu on outside click
  useEffect(() => {
    const handler = () => setCardMenuId(null);
    if (cardMenuId) {
      window.addEventListener("click", handler);
      return () => window.removeEventListener("click", handler);
    }
  }, [cardMenuId]);

  const openNew = () => {
    setEditId(null);
    setEditTitle("");
    setEditBody("");
    setEditColor("default");
    setEditPinned(false);
    setEditLabels([]);
    setEditReminder(null);
    setShowEditor(true);
    setTimeout(() => document.getElementById("note-title-input")?.focus(), 30);
  };

  const openEdit = (note: Note) => {
    setEditId(note.id);
    setEditTitle(note.title);
    setEditBody(note.content);
    setEditColor(note.color);
    setEditPinned(note.pinned);
    setEditLabels([...note.labels]);
    setEditReminder(note.reminder);
    setShowEditor(true);
    setTimeout(() => document.getElementById("note-title-input")?.focus(), 30);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setEditId(null);
  };

  // Save (create or update)
  const save = async () => {
    const title = editTitle.trim();
    const body = editBody.trim();
    if (!title && !body) {
      toast.error("Write something first");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title || "Untitled",
        content: body,
        color: editColor,
        pinned: editPinned,
        labels: editLabels,
        reminder: editReminder,
      };
      if (editId) {
        const r = await fetch("/api/notes", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editId, ...payload }),
        });
        if (!r.ok) throw new Error("Failed");
        toast.success("Note saved");
      } else {
        const r = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error("Failed");
        toast.success("Note created");
      }
      closeEditor();
      await load();
    } catch {
      toast.error("Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  // Quick action: toggle pin
  const togglePin = async (id: string) => {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    await fetch("/api/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, pinned: !n.pinned }),
    });
    await load();
  };

  // Toggle archive
  const toggleArchive = async (id: string) => {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    await fetch("/api/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, archive: !n.archive, trash: false, trashAt: null }),
    });
    toast.success(n.archive ? "Moved back to Notes" : "Archived");
    await load();
  };

  // Move to trash
  const moveTrash = async (id: string) => {
    await fetch("/api/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, trash: true, archive: false }),
    });
    toast.success("Moved to Trash");
    await load();
  };

  // Restore from trash
  const restoreNote = async (id: string) => {
    await fetch("/api/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, trash: false, archive: false, trashAt: null }),
    });
    toast.success("Note restored");
    await load();
  };

  // Permanently delete
  const permanentDelete = async (id: string) => {
    if (!confirm("Delete this note permanently? This cannot be undone.")) return;
    await fetch(`/api/notes?id=${id}`, { method: "DELETE" });
    toast.success("Note permanently deleted");
    await load();
  };

  // Empty trash
  const emptyTrash = async () => {
    const count = notes.filter((n) => n.trash).length;
    if (!count) return;
    if (!confirm(`Delete ${count} ${count === 1 ? "note" : "notes"} permanently? This cannot be undone.`)) return;
    const trashNotes = notes.filter((n) => n.trash);
    await Promise.all(trashNotes.map((n) => fetch(`/api/notes?id=${n.id}`, { method: "DELETE" })));
    toast.success("Trash emptied");
    await load();
  };

  // Duplicate note
  const duplicateNote = async (id: string) => {
    const n = notes.find((x) => x.id === id);
    if (!n) return;
    const r = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: (n.title || "Untitled") + " copy",
        content: n.content,
        color: n.color,
        pinned: false,
        archive: false,
        trash: false,
        labels: n.labels,
        reminder: n.reminder,
      }),
    });
    if (r.ok) {
      toast.success("Note duplicated");
      await load();
    }
  };

  // Toggle a checklist line in the editor body
  const toggleChecklistLine = (lineIndex: number, checked: boolean) => {
    const lines = editBody.split(/\r?\n/);
    if (lineIndex < 0 || lineIndex >= lines.length) return;
    const text = lines[lineIndex].replace(/^☐\s*|^☑\s*/, "").trim();
    lines[lineIndex] = (checked ? "☑ " : "☐ ") + text;
    setEditBody(lines.join("\n"));
  };

  // Add a new checklist line at the end
  const addChecklistLine = () => {
    const newBody = (editBody ? editBody + "\n" : "") + "☐ ";
    setEditBody(newBody);
  };

  // Toggle a checklist line on a saved note (renders in card)
  const toggleChecklistOnCard = async (note: Note, lineIndex: number, checked: boolean) => {
    const lines = note.content.split(/\r?\n/);
    if (lineIndex < 0 || lineIndex >= lines.length) return;
    const text = lines[lineIndex].replace(/^☐\s*|^☑\s*/, "").trim();
    lines[lineIndex] = (checked ? "☑ " : "☐ ") + text;
    await fetch("/api/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: note.id, content: lines.join("\n") }),
    });
    await load();
  };

  // Reminder modal handlers
  const openReminderModal = () => {
    const d = editReminder ? new Date(editReminder) : new Date(Date.now() + 3600000);
    setRemDate(toLocalDateInput(d));
    setRemTime(toLocalTimeInput(d));
    setReminderOpen(true);
  };

  const saveReminder = async () => {
    if (!editId) {
      // For new notes, save the reminder locally first (will be sent on save)
      if (!remDate || !remTime) {
        toast.error("Choose date and time");
        return;
      }
      setEditReminder(new Date(remDate + "T" + remTime).toISOString());
      setReminderOpen(false);
      return;
    }
    if (!remDate || !remTime) {
      toast.error("Choose date and time");
      return;
    }
    const iso = new Date(remDate + "T" + remTime).toISOString();
    setEditReminder(iso);
    setReminderOpen(false);
    await fetch("/api/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editId, reminder: iso }),
    });
    await load();
  };

  const clearReminder = async () => {
    setEditReminder(null);
    setReminderOpen(false);
    if (editId) {
      await fetch("/api/notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editId, reminder: null }),
      });
      await load();
    }
  };

  // Label picker
  const toggleLabelOnEdit = (label: string) => {
    setEditLabels((prev) => prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]);
  };

  const createAndAssignLabel = () => {
    const name = newLabel.trim();
    if (!name) return;
    if (!labels.includes(name)) setLabels([...labels, name]);
    if (!editLabels.includes(name)) setEditLabels([...editLabels, name]);
    setNewLabel("");
    toast.success("Label added");
  };

  // Save labels on the edit note immediately if it exists
  const saveLabelsToNote = async () => {
    if (!editId) return;
    await fetch("/api/notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editId, labels: editLabels }),
    });
    await load();
  };

  // Export backup
  const exportNotes = () => {
    const data = { version: 2, exportedAt: new Date().toISOString(), labels, notes };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "notes-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast.success("Backup exported");
    setMoreMenuOpen(false);
  };

  // Import backup
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
          // Delete all existing
          await Promise.all(notes.map((n) => fetch(`/api/notes?id=${n.id}`, { method: "DELETE" })));
          // Create all incoming
          for (const n of data.notes) {
            await fetch("/api/notes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: n.title || "Untitled",
                content: n.content || "",
                color: n.color || "default",
                pinned: !!n.pinned,
                archive: !!n.archive,
                trash: !!n.trash,
                labels: Array.isArray(n.labels) ? n.labels : [],
                reminder: n.reminder || null,
              }),
            });
          }
        } else {
          // Merge: keep existing, add incoming as new
          for (const n of data.notes) {
            await fetch("/api/notes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: (n.title || "Untitled") + " (imported)",
                content: n.content || "",
                color: n.color || "default",
                pinned: false,
                archive: !!n.archive,
                trash: !!n.trash,
                labels: Array.isArray(n.labels) ? n.labels : [],
                reminder: n.reminder || null,
              }),
            });
          }
        }
        if (Array.isArray(data.labels)) {
          const newLabels = Array.from(new Set([...labels, ...data.labels.map(String).filter(Boolean)]));
          setLabels(newLabels);
        }
        await load();
        toast.success("Backup imported");
      } catch {
        toast.error("Invalid backup file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
    setMoreMenuOpen(false);
  };

  // Filtered + sorted notes
  const filtered = (() => {
    const q = search.trim().toLowerCase();
    let arr = notes.filter((n) =>
      !q || (n.title + " " + n.content + " " + n.labels.join(" ")).toLowerCase().includes(q)
    );
    if (filter === "notes") arr = arr.filter((n) => !n.archive && !n.trash);
    else if (filter === "archive") arr = arr.filter((n) => n.archive && !n.trash);
    else if (filter === "trash") arr = arr.filter((n) => n.trash);
    else if (filter === "reminders") arr = arr.filter((n) => n.reminder && !n.trash);
    else if (filter.startsWith("label:")) {
      const lbl = filter.slice(6);
      arr = arr.filter((n) => n.labels.includes(lbl) && !n.trash && !n.archive);
    }
    arr.sort((a, b) => {
      if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "created") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return arr;
  })();

  const pinnedNotes = filtered.filter((n) => n.pinned);
  const otherNotes = filtered.filter((n) => !n.pinned);

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

  return (
    <div className="min-h-[calc(100vh-64px)] md:min-h-screen bg-background">
      {/* Topbar */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border/60">
        <div className="flex items-center gap-2 px-3 md:px-6 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shrink-0">
              <StickyNote className="w-4 h-4 text-white" />
            </div>
            <div className="hidden md:block">
              <div className="font-semibold text-base leading-tight">Notes</div>
              <div className="text-[11px] text-muted-foreground">Pro Keep Style</div>
            </div>
          </div>
          {/* Search */}
          <div className="relative flex-1 max-w-md ml-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes…"
              className="pl-9 h-10 bg-muted/40 border-0 focus-visible:ring-1"
            />
          </div>
          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="hidden sm:block h-10 rounded-lg border border-border/60 bg-background px-3 text-sm cursor-pointer"
          >
            <option value="updated">Last updated</option>
            <option value="created">Created date</option>
            <option value="title">Title A-Z</option>
          </select>
          {/* View toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10"
            onClick={() => setListMode((v) => !v)}
            title={listMode ? "Grid view" : "List view"}
          >
            {listMode ? <GridIcon className="w-5 h-5" /> : <ListIcon className="w-5 h-5" />}
          </Button>
          {/* More menu */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={(e) => { e.stopPropagation(); setMoreMenuOpen((v) => !v); }}
              title="Import / Export"
            >
              <MoreVertical className="w-5 h-5" />
            </Button>
            <AnimatePresence>
              {moreMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-12 z-50 w-44 bg-popover border border-border rounded-xl shadow-premium-lg overflow-hidden"
                >
                  <button
                    onClick={exportNotes}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-accent text-left"
                  >
                    <Download className="w-4 h-4" /> Export backup
                  </button>
                  <label className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-accent text-left cursor-pointer">
                    <Upload className="w-4 h-4" /> Import backup
                    <input type="file" accept="application/json,.json" hidden onChange={importNotes} />
                  </label>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {/* New note */}
          <Button onClick={openNew} className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white shrink-0">
            <Plus className="w-4 h-4 mr-1.5" /> <span className="hidden sm:inline">New</span>
          </Button>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar (desktop) + drawer (mobile) */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-40 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>
        <motion.aside
          initial={false}
          className={cn(
            "fixed md:sticky md:top-[64px] z-40 md:z-0 top-[64px] left-0 h-[calc(100vh-64px)] w-64 bg-sidebar/95 md:bg-transparent backdrop-blur-xl border-r border-border/60 md:border-r-0 md:w-56 shrink-0 p-3 overflow-y-auto scroll-thin transition-transform duration-200",
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          )}
        >
          <NavItem
            icon={<StickyNote className="w-4 h-4" />}
            label="Notes"
            count={notes.filter((n) => !n.archive && !n.trash).length}
            active={filter === "notes"}
            onClick={() => { setFilter("notes"); setSidebarOpen(false); }}
          />
          <NavItem
            icon={<Bell className="w-4 h-4" />}
            label="Reminders"
            count={notes.filter((n) => n.reminder && !n.trash).length}
            active={filter === "reminders"}
            onClick={() => { setFilter("reminders"); setSidebarOpen(false); }}
          />
          <NavItem
            icon={<Archive className="w-4 h-4" />}
            label="Archive"
            count={notes.filter((n) => n.archive && !n.trash).length}
            active={filter === "archive"}
            onClick={() => { setFilter("archive"); setSidebarOpen(false); }}
          />
          <NavItem
            icon={<Trash2 className="w-4 h-4" />}
            label="Trash"
            count={notes.filter((n) => n.trash).length}
            active={filter === "trash"}
            onClick={() => { setFilter("trash"); setSidebarOpen(false); }}
          />
          <div className="mt-4 pt-3 border-t border-border/60">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-3 mb-1.5">Labels</div>
            {labels.map((l) => (
              <button
                key={l}
                onClick={() => { setFilter(`label:${l}`); setSidebarOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-left hover:bg-accent",
                  filter === `label:${l}` && "bg-accent text-foreground"
                )}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: labelColor(l) }} />
                <span className="flex-1 truncate">{l}</span>
                <span className="text-[11px] text-muted-foreground">{labelCounts[l] || 0}</span>
              </button>
            ))}
          </div>
          {filter === "trash" && notes.some((n) => n.trash) && (
            <Button
              variant="outline"
              size="sm"
              onClick={emptyTrash}
              className="mt-4 w-full text-rose-600 hover:text-rose-700 border-rose-200"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Empty trash
            </Button>
          )}
        </motion.aside>

        {/* Main grid */}
        <main className="flex-1 px-3 md:px-6 py-4 min-w-0">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">{filterTitle}</h1>
              <p className="text-xs text-muted-foreground truncate">{filterSub}</p>
            </div>
            <div className="text-xs text-muted-foreground shrink-0">{filtered.length} items</div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <StickyNote className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold">No notes here</h3>
              <p className="text-sm text-muted-foreground mt-1">Create a note with the + button.</p>
            </div>
          ) : (
            <>
              {pinnedNotes.length > 0 && (
                <div className="mb-4">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Pin className="w-3 h-3 fill-amber-500 text-amber-500" /> Pinned
                  </div>
                  <NotesGrid
                    notes={pinnedNotes}
                    listMode={listMode}
                    filter={filter}
                    onOpen={openEdit}
                    onTogglePin={togglePin}
                    onToggleArchive={toggleArchive}
                    onTrash={moveTrash}
                    onRestore={restoreNote}
                    onPermanentDelete={permanentDelete}
                    onDuplicate={duplicateNote}
                    onChecklistToggle={toggleChecklistOnCard}
                    cardMenuId={cardMenuId}
                    setCardMenuId={setCardMenuId}
                  />
                </div>
              )}
              {otherNotes.length > 0 && (
                <div>
                  {pinnedNotes.length > 0 && (
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Others</div>
                  )}
                  <NotesGrid
                    notes={otherNotes}
                    listMode={listMode}
                    filter={filter}
                    onOpen={openEdit}
                    onTogglePin={togglePin}
                    onToggleArchive={toggleArchive}
                    onTrash={moveTrash}
                    onRestore={restoreNote}
                    onPermanentDelete={permanentDelete}
                    onDuplicate={duplicateNote}
                    onChecklistToggle={toggleChecklistOnCard}
                    cardMenuId={cardMenuId}
                    setCardMenuId={setCardMenuId}
                  />
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Floating action button on mobile */}
      <button
        onClick={openNew}
        className="md:hidden fixed bottom-24 right-4 z-30 w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-yellow-500 text-white shadow-xl flex items-center justify-center"
        title="New note"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Editor overlay */}
      <AnimatePresence>
        {showEditor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
            onClick={closeEditor}
          >
            <motion.div
              initial={{ y: 60, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 60, opacity: 0, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 280, damping: 28 }}
              className={cn(
                "w-full sm:max-w-xl max-h-[92vh] sm:max-h-[88vh] rounded-t-3xl sm:rounded-2xl shadow-2xl border overflow-hidden flex flex-col",
                getColorMeta(editColor).bg,
                getColorMeta(editColor).border
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Editor header */}
              <div className="flex items-center gap-2 p-3 border-b border-border/40 bg-background/40 backdrop-blur">
                <Input
                  id="note-title-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Title"
                  className="flex-1 text-base font-medium border-0 bg-transparent focus-visible:ring-0 px-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => setEditPinned((v) => !v)}
                  title={editPinned ? "Unpin" : "Pin"}
                >
                  <Pin className={cn("w-4 h-4", editPinned && "fill-amber-500 text-amber-500")} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={closeEditor}
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Editor toolbar */}
              <div className="flex flex-wrap gap-1.5 px-3 pt-3 bg-background/30">
                <ToolbarButton onClick={() => document.execCommand("bold")} label="B" className="font-bold" />
                <ToolbarButton onClick={() => document.execCommand("italic")} label="I" className="italic" />
                <ToolbarButton onClick={() => document.execCommand("underline")} label="U" className="underline" />
                <ToolbarButton onClick={addChecklistLine} icon={<Check className="w-4 h-4" />} label="Checklist" />
                <ToolbarButton onClick={openReminderModal} icon={<Bell className="w-4 h-4" />} label="Reminder" />
                <ToolbarButton onClick={() => setLabelPickerOpen(true)} icon={<Tag className="w-4 h-4" />} label="Label" />
                <ToolbarButton onClick={() => editId && duplicateNote(editId)} icon={<CopyIcon className="w-4 h-4" />} label="Copy" />
              </div>

              {/* Body editor */}
              <div className="flex-1 overflow-y-auto p-3">
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  placeholder="Take a note…"
                  className="w-full min-h-[240px] resize-none border-0 bg-transparent outline-none text-sm leading-relaxed p-1"
                />
                {/* Checklist visual editor (when body has checklist items) */}
                {checklistInfo(editBody).total > 0 && (
                  <div className="mt-3 p-3 rounded-xl bg-muted/40 border border-border/60">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[11px] font-semibold uppercase text-muted-foreground">Checklist</div>
                      <div className="text-[11px] text-muted-foreground">
                        {checklistInfo(editBody).done}/{checklistInfo(editBody).total} done
                      </div>
                    </div>
                    {editBody.split(/\r?\n/).map((line, i) => {
                      const m = line.trim().match(/^([☐☑])\s*(.*)$/);
                      if (!m) return null;
                      const done = m[1] === "☑";
                      const text = m[2];
                      return (
                        <div key={i} className="flex items-center gap-2 mb-1.5">
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={(e) => toggleChecklistLine(i, e.target.checked)}
                            className="w-4 h-4 accent-amber-500"
                          />
                          <span className={cn("text-sm flex-1", done && "line-through text-muted-foreground")}>{text}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Active labels */}
                {editLabels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {editLabels.map((l) => (
                      <span key={l} className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-full bg-muted/60">
                        <span className="w-2 h-2 rounded-full" style={{ background: labelColor(l) }} />
                        {l}
                        <button
                          onClick={() => toggleLabelOnEdit(l)}
                          className="ml-0.5 hover:text-rose-500"
                          title="Remove label"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {/* Reminder display */}
                {editReminder && (
                  <div className="mt-3 flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <Bell className="w-3.5 h-3.5 text-amber-600" />
                    <span className="flex-1">{new Date(editReminder).toLocaleString()}</span>
                    <button onClick={clearReminder} className="text-rose-500 hover:text-rose-700">Remove</button>
                  </div>
                )}
              </div>

              {/* Color picker + save */}
              <div className="flex items-center gap-2 px-3 py-3 border-t border-border/40 bg-background/40 backdrop-blur">
                <div className="flex items-center gap-1.5 flex-wrap flex-1">
                  {COLORS.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setEditColor(c.key)}
                      className={cn(
                        "w-7 h-7 rounded-full border-2 transition-all",
                        editColor === c.key ? "border-foreground scale-110" : "border-transparent"
                      )}
                      style={{ background: c.dot }}
                      title={c.key}
                    />
                  ))}
                </div>
                <Button
                  onClick={save}
                  disabled={saving}
                  size="sm"
                  className="bg-amber-500 text-white hover:bg-amber-600"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                  Save
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reminder modal */}
      <AnimatePresence>
        {reminderOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
            onClick={() => setReminderOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-card rounded-2xl shadow-2xl border border-border p-5 w-full max-w-sm space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-500" />
                <h3 className="font-semibold">Set reminder</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Date</label>
                  <input
                    type="date"
                    value={remDate}
                    onChange={(e) => setRemDate(e.target.value)}
                    className="w-full h-9 px-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Time</label>
                  <input
                    type="time"
                    value={remTime}
                    onChange={(e) => setRemTime(e.target.value)}
                    className="w-full h-9 px-2 rounded-lg border border-border bg-background text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 pt-2">
                <Button variant="ghost" size="sm" onClick={clearReminder} className="text-rose-600">Remove</Button>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setReminderOpen(false)}>Cancel</Button>
                  <Button size="sm" onClick={saveReminder} className="bg-amber-500 text-white hover:bg-amber-600">Save</Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Label picker modal */}
      <AnimatePresence>
        {labelPickerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
            onClick={() => setLabelPickerOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-card rounded-2xl shadow-2xl border border-border p-5 w-full max-w-sm space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Labels</h3>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLabelPickerOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-1 max-h-60 overflow-y-auto scroll-thin">
                {labels.map((l) => (
                  <label key={l} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editLabels.includes(l)}
                      onChange={() => toggleLabelOnEdit(l)}
                      className="w-4 h-4 accent-amber-500"
                    />
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: labelColor(l) }} />
                    <span className="text-sm">{l}</span>
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Create new label"
                  className="h-9"
                  onKeyDown={(e) => { if (e.key === "Enter") createAndAssignLabel(); }}
                />
                <Button size="sm" onClick={createAndAssignLabel} className="bg-amber-500 text-white hover:bg-amber-600">
                  Add
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={async () => { await saveLabelsToNote(); setLabelPickerOpen(false); }}
              >
                Done
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors text-left",
        active ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 font-medium" : "hover:bg-accent text-sidebar-foreground"
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-[11px] text-muted-foreground">{count}</span>
      )}
    </button>
  );
}

function ToolbarButton({
  onClick,
  label,
  icon,
  className = "",
}: {
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 px-2.5 rounded-lg border border-border/60 bg-background hover:bg-accent text-xs flex items-center gap-1.5 transition-colors",
        className
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function NotesGrid({
  notes,
  listMode,
  filter,
  onOpen,
  onTogglePin,
  onToggleArchive,
  onTrash,
  onRestore,
  onPermanentDelete,
  onDuplicate,
  onChecklistToggle,
  cardMenuId,
  setCardMenuId,
}: {
  notes: Note[];
  listMode: boolean;
  filter: string;
  onOpen: (n: Note) => void;
  onTogglePin: (id: string) => void;
  onToggleArchive: (id: string) => void;
  onTrash: (id: string) => void;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onChecklistToggle: (n: Note, lineIndex: number, checked: boolean) => void;
  cardMenuId: string | null;
  setCardMenuId: (id: string | null) => void;
}) {
  const gridClass = listMode
    ? "grid grid-cols-1 gap-2"
    : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3";
  return (
    <div className={gridClass}>
      <AnimatePresence>
        {notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            listMode={listMode}
            isTrash={filter === "trash"}
            onOpen={() => onOpen(note)}
            onTogglePin={() => onTogglePin(note.id)}
            onToggleArchive={() => onToggleArchive(note.id)}
            onTrash={() => onTrash(note.id)}
            onRestore={() => onRestore(note.id)}
            onPermanentDelete={() => onPermanentDelete(note.id)}
            onDuplicate={() => onDuplicate(note.id)}
            onChecklistToggle={(lineIndex, checked) => onChecklistToggle(note, lineIndex, checked)}
            menuOpen={cardMenuId === note.id}
            setMenuOpen={(v) => setCardMenuId(v ? note.id : null)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function NoteCard({
  note,
  listMode,
  isTrash,
  onOpen,
  onTogglePin,
  onToggleArchive,
  onTrash,
  onRestore,
  onPermanentDelete,
  onDuplicate,
  onChecklistToggle,
  menuOpen,
  setMenuOpen,
}: {
  note: Note;
  listMode: boolean;
  isTrash: boolean;
  onOpen: () => void;
  onTogglePin: () => void;
  onToggleArchive: () => void;
  onTrash: () => void;
  onRestore: () => void;
  onPermanentDelete: () => void;
  onDuplicate: () => void;
  onChecklistToggle: (lineIndex: number, checked: boolean) => void;
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
}) {
  const colorMeta = getColorMeta(note.color);
  const info = checklistInfo(note.content);
  const lines = note.content.split(/\r?\n/);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", stiffness: 280, damping: 25 }}
      className={cn(
        "relative rounded-xl border shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden",
        colorMeta.bg,
        colorMeta.border,
        listMode && "flex items-start gap-3 p-3"
      )}
      onClick={onOpen}
    >
      <div className={cn(!listMode && "p-3.5", "flex-1 min-w-0")}>
        {/* Top-right pin & menu */}
        <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5">
          {!isTrash && (
            <button
              onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
              className="w-7 h-7 rounded-full hover:bg-black/10 flex items-center justify-center"
              title={note.pinned ? "Unpin" : "Pin"}
            >
              <Pin className={cn("w-3.5 h-3.5", note.pinned ? "fill-amber-500 text-amber-500" : "text-muted-foreground")} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className="w-7 h-7 rounded-full hover:bg-black/10 flex items-center justify-center"
            title="More"
          >
            <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
        {/* Title */}
        {note.title && (
          <div className="font-semibold text-sm pr-16 mb-1.5 leading-tight">{note.title}</div>
        )}
        {/* Body */}
        {info.total > 0 ? (
          <div className="space-y-1">
            {lines.map((line, i) => {
              if (!line.trim()) return null;
              const m = line.trim().match(/^([☐☑])\s*(.*)$/);
              if (m) {
                const done = m[1] === "☑";
                return (
                  <div key={i} className="flex items-start gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={done}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => onChecklistToggle(i, e.target.checked)}
                      className="w-3.5 h-3.5 mt-0.5 accent-amber-500"
                    />
                    <span className={cn("flex-1 leading-snug", done && "line-through text-muted-foreground")}>{m[2]}</span>
                  </div>
                );
              }
              return <div key={i} className="text-xs text-muted-foreground whitespace-pre-wrap leading-snug">{line}</div>;
            })}
            <div className="text-[10px] text-muted-foreground mt-1">{info.done}/{info.total} completed</div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-6 leading-relaxed">
            {note.content || <span className="italic opacity-70">Empty note</span>}
          </div>
        )}
        {/* Labels */}
        {note.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {note.labels.map((l) => (
              <span key={l} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-muted/60">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: labelColor(l) }} />
                {l}
              </span>
            ))}
          </div>
        )}
        {/* Reminder */}
        {note.reminder && (
          <div className="flex items-center gap-1 text-[10px] text-amber-600 mt-2">
            <Bell className="w-3 h-3" />
            <span>{new Date(note.reminder).toLocaleString()}</span>
          </div>
        )}
        {/* Meta */}
        <div className="text-[10px] text-muted-foreground mt-2">{timeAgo(note.updatedAt)}</div>
      </div>
      {/* Card actions row */}
      <div className="flex items-center gap-1 px-3 py-2 border-t border-border/30">
        {isTrash ? (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onRestore(); }}
              className="p-1.5 rounded hover:bg-black/10"
              title="Restore"
            >
              <ArchiveRestore className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onPermanentDelete(); }}
              className="p-1.5 rounded hover:bg-rose-500/10 text-rose-500"
              title="Delete permanently"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleArchive(); }}
              className="p-1.5 rounded hover:bg-black/10"
              title={note.archive ? "Unarchive" : "Archive"}
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onTrash(); }}
              className="p-1.5 rounded hover:bg-rose-500/10 text-rose-500"
              title="Move to trash"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
              className="p-1.5 rounded hover:bg-black/10"
              title="Duplicate"
            >
              <CopyIcon className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
      {/* Dropdown menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute top-9 right-1.5 z-30 w-40 bg-popover border border-border rounded-lg shadow-premium-lg overflow-hidden"
          >
            <button
              onClick={() => { onOpen(); setMenuOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent text-left"
            >
              <MoreVertical className="w-3.5 h-3.5" /> Open note
            </button>
            <button
              onClick={() => { onDuplicate(); setMenuOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent text-left"
            >
              <CopyIcon className="w-3.5 h-3.5" /> Make a copy
            </button>
            {isTrash ? (
              <>
                <button
                  onClick={() => { onRestore(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent text-left"
                >
                  <ArchiveRestore className="w-3.5 h-3.5" /> Restore
                </button>
                <button
                  onClick={() => { onPermanentDelete(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-rose-500/10 text-rose-600 text-left"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete permanently
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { onToggleArchive(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent text-left"
                >
                  <Archive className="w-3.5 h-3.5" /> Archive / unarchive
                </button>
                <button
                  onClick={() => { onTrash(); setMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-rose-500/10 text-rose-600 text-left"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Move to trash
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function toLocalDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toLocalTimeInput(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
