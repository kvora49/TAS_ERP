"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, List, ListOrdered, CheckSquare, Link as LinkIcon, Strikethrough } from "lucide-react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  minHeight?: string;
}

export function RichTextEditor({
  value = "",
  onChange,
  placeholder = "Write something...",
  className,
  readOnly = false,
  minHeight = "min-h-[120px]",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          "outline-none text-sm text-[var(--text-body)] leading-relaxed",
          "prose prose-sm max-w-none",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_li]:my-0.5",
          "[&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0",
          "[&_li[data-type=taskItem]]:flex [&_li[data-type=taskItem]]:items-start [&_li[data-type=taskItem]]:gap-2",
          "[&_li[data-type=taskItem]>label]:flex [&_li[data-type=taskItem]>label]:items-center [&_li[data-type=taskItem]>label]:mt-0.5",
          "[&_a]:text-[var(--primary)] [&_a]:underline",
          "[&_strong]:text-[var(--text-primary)] [&_strong]:font-semibold",
          "[&_s]:text-[var(--text-muted)]",
          minHeight,
          "px-1"
        ),
      },
    },
  });

  if (!editor) return null;

  const ToolbarButton = ({
    onClick,
    isActive,
    title,
    children,
  }: {
    onClick: () => void;
    isActive?: boolean;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "p-1.5 rounded-md transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--table-row-hover)]",
        isActive && "bg-[var(--primary-light)] text-[var(--primary)]"
      )}
    >
      {children}
    </button>
  );

  const handleLinkToggle = () => {
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
    } else {
      const url = window.prompt("Enter URL:");
      if (url) {
        editor.chain().focus().setLink({ href: url }).run();
      }
    }
  };

  if (readOnly) {
    return (
      <EditorContent
        editor={editor}
        className={cn(
          "text-sm text-[var(--text-body)] leading-relaxed",
          "[&_.ProseMirror]:outline-none",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_a]:text-[var(--primary)] [&_a]:underline",
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--input-border)] bg-[var(--input-bg)] focus-within:ring-2 focus-within:ring-[var(--input-focus)] focus-within:border-transparent transition-colors",
        className
      )}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-[var(--border)] flex-wrap">
        <ToolbarButton
          title="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Strikethrough"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive("strike")}
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="w-px h-4 bg-[var(--border)] mx-1" />

        <ToolbarButton
          title="Bullet List"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Numbered List"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Checklist"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          isActive={editor.isActive("taskList")}
        >
          <CheckSquare className="h-3.5 w-3.5" />
        </ToolbarButton>

        <div className="w-px h-4 bg-[var(--border)] mx-1" />

        <ToolbarButton
          title="Link"
          onClick={handleLinkToggle}
          isActive={editor.isActive("link")}
        >
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      {/* Editor Area */}
      <EditorContent
        editor={editor}
        className={cn(
          "px-3 py-2",
          "[&_.ProseMirror]:outline-none",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-[var(--text-faint)]",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left",
          "[&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0",
        )}
      />
    </div>
  );
}
