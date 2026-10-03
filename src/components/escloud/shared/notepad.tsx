"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

/**
 * Notepad — Tiptap-based rich text editor with a Google Keep-style toolbar.
 * Replaces the previous plain-textarea note editor.
 */
export function Notepad({ value, onChange, placeholder = "Take a note…" }: Props) {
  const editor = useEditor({
    extensions: [StarterKit],
    immediatelyRender: false,
    content: value || `<p></p>`,
    editorProps: {
      attributes: {
        class: "notepad-editor",
        "data-placeholder": placeholder,
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Keep editor content in sync if `value` changes externally (e.g. opening a different note)
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value && value !== current) {
      editor.commands.setContent(value || "<p></p>", { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="w-full overflow-hidden rounded-xl border bg-white dark:bg-card">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 border-b p-2 notepad-toolbar">
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          label="B"
          className="font-bold"
        />
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          label="I"
          className="italic"
        />
        <ToolbarButton
          active={editor.isActive("underline")}
          onClick={() => {
            // StarterKit doesn't ship Underline — use the standard strike toggle as a stand-in.
            editor.chain().focus().toggleStrike().run();
          }}
          label="U"
          className="underline"
        />
        <ToolbarButton
          active={editor.isActive("heading", { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          label="H1"
        />
        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          label="H2"
        />
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          label="• List"
        />
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          label="1. List"
        />
        <ToolbarButton
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          label="Quote"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          label="↶"
          title="Undo"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          label="↷"
          title="Redo"
        />
      </div>

      {/* Editor */}
      <EditorContent editor={editor} className="notepad-editor-wrap" />

      <style jsx global>{`
        .notepad-editor.ProseMirror {
          min-height: 240px;
          padding: 16px;
          outline: none;
          font-size: 16px;
          line-height: 1.7;
          color: var(--foreground);
        }
        .notepad-editor.ProseMirror:empty::before {
          content: attr(data-placeholder);
          color: var(--muted-foreground);
          float: left;
          pointer-events: none;
          height: 0;
        }
        .notepad-editor.ProseMirror p {
          margin: 0 0 12px;
        }
        .notepad-editor.ProseMirror h1 {
          font-size: 2rem;
          font-weight: 700;
          margin: 20px 0 12px;
        }
        .notepad-editor.ProseMirror h2 {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 18px 0 10px;
        }
        .notepad-editor.ProseMirror ul {
          padding-left: 25px;
          list-style: disc;
        }
        .notepad-editor.ProseMirror ol {
          padding-left: 25px;
          list-style: decimal;
        }
        .notepad-editor.ProseMirror blockquote {
          border-left: 4px solid var(--border);
          padding-left: 15px;
          margin: 15px 0;
          color: var(--muted-foreground);
        }
        .notepad-toolbar button {
          border-radius: 6px;
          padding: 6px 12px;
          background: transparent;
          color: var(--foreground);
          border: 0;
          cursor: pointer;
          font-size: 14px;
          transition: background-color 0.15s ease;
        }
        .notepad-toolbar button:hover {
          background: var(--muted);
        }
        .notepad-toolbar button.is-active {
          background: var(--primary);
          color: var(--primary-foreground);
        }
      `}</style>
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  label,
  className = "",
  title,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      className={`${active ? "is-active" : ""} ${className}`}
    >
      {label}
    </button>
  );
}
