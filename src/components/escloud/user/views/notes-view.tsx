"use client";
import { useEffect, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Plus, Pin, Trash2, Search, StickyNote, Loader2, X, Check,
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
  createdAt: string;
  updatedAt: string;
}

const COLORS = [
  { key: "default", bg: "bg-card", border: "border-border" },
  { key: "yellow", bg: "bg-amber-100 dark:bg-amber-900/30", border: "border-amber-300/50" },
  { key: "green", bg: "bg-emerald-100 dark:bg-emerald-900/30", border: "border-emerald-300/50" },
  { key: "blue", bg: "bg-sky-100 dark:bg-sky-900/30", border: "border-sky-300/50" },
  { key: "pink", bg: "bg-pink-100 dark:bg-pink-900/30", border: "border-pink-300/50" },
  { key: "purple", bg: "bg-violet-100 dark:bg-violet-900/30", border: "border-violet-300/50" },
];

function getColorClass(color: string) {
  return COLORS.find((c) => c.key === color) ?? COLORS[0];
}

export function NotesView() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editColor, setEditColor] = useState("default");
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/notes");
      const d = await r.json();
      setNotes(d.notes ?? []);
    } catch {
      toast.error("Failed to load notes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditTitle("");
    setEditContent("");
    setEditColor("default");
    setEditId(null);
    setShowEditor(true);
  };

  const openEdit = (note: Note) => {
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditColor(note.color);
    setEditId(note.id);
    setShowEditor(true);
  };

  const save = async () => {
    if (!editTitle && !editContent) {
      setShowEditor(false);
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        // Update
        const r = await fetch("/api/notes", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editId, title: editTitle, content: editContent, color: editColor }),
        });
        if (!r.ok) throw new Error("Failed");
        toast.success("Note updated");
      } else {
        // Create
        const r = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: editTitle, content: editContent, color: editColor }),
        });
        if (!r.ok) throw new Error("Failed");
        toast.success("Note created");
      }
      setShowEditor(false);
      await load();
    } catch {
      toast.error("Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async (note: Note) => {
    try {
      await fetch("/api/notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: note.id, pinned: !note.pinned }),
      });
      await load();
    } catch {
      toast.error("Failed to pin note");
    }
  };

  const deleteNote = async (id: string) => {
    if (!confirm("Delete this note?")) return;
    try {
      await fetch(`/api/notes?id=${id}`, { method: "DELETE" });
      toast.success("Note deleted");
      await load();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const filtered = notes.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.content.toLowerCase().includes(search.toLowerCase())
  );

  const pinnedNotes = filtered.filter((n) => n.pinned);
  const otherNotes = filtered.filter((n) => !n.pinned);

  return (
    <div className="px-3 md:px-6 py-4 md:py-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-md">
            <StickyNote className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Notes</h1>
            <p className="text-xs text-muted-foreground">{notes.length} notes</p>
          </div>
        </div>
        <Button onClick={openNew} className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white">
          <Plus className="w-4 h-4 mr-1.5" /> New Note
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes…" className="pl-9 h-10" />
      </div>

      {/* Editor modal */}
      <AnimatePresence>
        {showEditor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowEditor(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className={cn("w-full max-w-lg rounded-2xl shadow-2xl border", getColorClass(editColor).bg, getColorClass(editColor).border)}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 space-y-3">
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Title"
                  className="text-base font-medium border-0 bg-transparent focus-visible:ring-0 px-0"
                  autoFocus
                />
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Take a note…"
                  className="border-0 bg-transparent focus-visible:ring-0 px-0 min-h-[200px] resize-none"
                />
                {/* Color picker */}
                <div className="flex items-center gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c.key}
                      onClick={() => setEditColor(c.key)}
                      className={cn("w-7 h-7 rounded-full border-2 transition-all", c.bg, editColor === c.key ? "border-primary scale-110" : "border-transparent")}
                    />
                  ))}
                </div>
                {/* Actions */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={() => setShowEditor(false)} size="sm">Cancel</Button>
                  <Button onClick={save} disabled={saving} size="sm" className="bg-amber-500 text-white hover:bg-amber-600">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                    Save
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pinned notes */}
      {pinnedNotes.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
            <Pin className="w-3 h-3" /> Pinned
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <AnimatePresence>
              {pinnedNotes.map((note) => (
                <NoteCard key={note.id} note={note} onEdit={() => openEdit(note)} onDelete={() => deleteNote(note.id)} onPin={() => togglePin(note)} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Other notes */}
      {otherNotes.length > 0 && (
        <div>
          {pinnedNotes.length > 0 && <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Others</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            <AnimatePresence>
              {otherNotes.map((note) => (
                <NoteCard key={note.id} note={note} onEdit={() => openEdit(note)} onDelete={() => deleteNote(note.id)} onPin={() => togglePin(note)} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && notes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <StickyNote className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold">No notes yet</h3>
          <p className="text-sm text-muted-foreground mt-1">Create your first note to get started.</p>
          <Button onClick={openNew} className="mt-4 bg-gradient-to-r from-amber-500 to-yellow-500 text-white">
            <Plus className="w-4 h-4 mr-1.5" /> Create Note
          </Button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function NoteCard({ note, onEdit, onDelete, onPin }: { note: Note; onEdit: () => void; onDelete: () => void; onPin: () => void }) {
  const colorClass = getColorClass(note.color);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
    >
      <Card
        className={cn("p-4 cursor-pointer hover:shadow-lg transition-shadow border", colorClass.bg, colorClass.border)}
        onClick={onEdit}
      >
        {note.title && <div className="font-medium text-sm mb-1">{note.title}</div>}
        <div className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">{note.content || "Empty note"}</div>
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30">
          <span className="text-[10px] text-muted-foreground">
            {new Date(note.updatedAt).toLocaleDateString()}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); onPin(); }}
              className="p-1 rounded hover:bg-black/10"
            >
              <Pin className={cn("w-3.5 h-3.5", note.pinned ? "fill-amber-500 text-amber-500" : "text-muted-foreground")} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1 rounded hover:bg-rose-500/10"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            </button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
