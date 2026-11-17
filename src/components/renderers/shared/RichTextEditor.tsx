"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  Bold,
  Code2,
  Eye,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Underline as UnderlineIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { sanitizeRichText } from "@/lib/sanitize-html";
import {
  htmlToMarkdown,
  markdownToHtml,
} from "@/lib/rich-text-markdown";
import type { DocumentFormat } from "@/lib/workspace-types";

interface RichTextEditorProps {
  id?: string;
  value: string;
  format: DocumentFormat;
  onChange: (value: string) => void;
  placeholder?: string;
}

function ToolbarButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant={active ? "secondary" : "ghost"}
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className="size-8"
    >
      {children}
    </Button>
  );
}

/**
 * Monochrome WYSIWYG editor with a Source/Markdown escape hatch.
 *
 * RICH_TEXT documents are stored as sanitized HTML; MARKDOWN documents keep
 * their canonical Markdown in the DB and are converted on load/save so seeded
 * content remains editable in either mode.
 */
export function RichTextEditor({
  id = "document-content",
  value,
  format,
  onChange,
  placeholder = "Write your document…",
}: RichTextEditorProps) {
  const [sourceMode, setSourceMode] = useState(false);
  const lastCanonical = useRef<string | null>(null);
  const isMarkdown = format === "MARKDOWN";

  const toHtml = useCallback(
    (canonical: string) =>
      isMarkdown ? markdownToHtml(canonical) : sanitizeRichText(canonical),
    [isMarkdown],
  );
  const fromHtml = (html: string) =>
    isMarkdown ? htmlToMarkdown(html) : sanitizeRichText(html);

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({ link: false, underline: false }),
        Underline,
        Link.configure({
          openOnClick: false,
          autolink: true,
          HTMLAttributes: {
            rel: "noopener noreferrer nofollow",
            target: "_blank",
          },
        }),
        Placeholder.configure({ placeholder }),
      ],
      content: toHtml(value),
      editorProps: {
        attributes: {
          "aria-label": "Document content",
          class: "min-h-48 outline-none",
        },
      },
      onUpdate: ({ editor: instance }: { editor: Editor }) => {
        const canonical = fromHtml(instance.getHTML());
        lastCanonical.current = canonical;
        onChange(canonical);
      },
    },
    [format],
  );

  // External value changes (async content fetch, format switch, source edits)
  // are pushed into Tiptap; edits originating in Tiptap are skipped to avoid
  // resetting the selection on every keystroke.
  useEffect(() => {
    if (!editor || sourceMode) return;
    if (lastCanonical.current === value) return;
    lastCanonical.current = value;
    editor.commands.setContent(toHtml(value), { emitUpdate: false });
  }, [editor, sourceMode, value, format, toHtml]);

  const setLink = () => {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const href = window.prompt("Link URL", previous ?? "https://");
    if (href === null) return;
    if (!href.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    const safe = /^(https?:|mailto:|\/|#)/i.test(href.trim())
      ? href.trim()
      : `https://${href.trim()}`;
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: safe })
      .run();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className="flex flex-wrap items-center gap-0.5 rounded-md border border-input bg-background p-1"
          role="toolbar"
          aria-label="Text formatting"
        >
          <ToolbarButton
            label="Heading 1"
            active={editor?.isActive("heading", { level: 1 })}
            disabled={!editor}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 1 }).run()
            }
          >
            <Heading1 className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Heading 2"
            active={editor?.isActive("heading", { level: 2 })}
            disabled={!editor}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            <Heading2 className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Heading 3"
            active={editor?.isActive("heading", { level: 3 })}
            disabled={!editor}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 3 }).run()
            }
          >
            <Heading3 className="size-4" />
          </ToolbarButton>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
          <ToolbarButton
            label="Bold"
            active={editor?.isActive("bold")}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          >
            <Bold className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Italic"
            active={editor?.isActive("italic")}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          >
            <Italic className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Underline"
            active={editor?.isActive("underline")}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon className="size-4" />
          </ToolbarButton>
          <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
          <ToolbarButton
            label="Bullet list"
            active={editor?.isActive("bulletList")}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          >
            <List className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Ordered list"
            active={editor?.isActive("orderedList")}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Blockquote"
            active={editor?.isActive("blockquote")}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          >
            <Quote className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Code block"
            active={editor?.isActive("codeBlock")}
            disabled={!editor}
            onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          >
            <Code2 className="size-4" />
          </ToolbarButton>
          <ToolbarButton
            label="Link"
            active={editor?.isActive("link")}
            disabled={!editor}
            onClick={setLink}
          >
            <Link2 className="size-4" />
          </ToolbarButton>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setSourceMode((current) => !current)}
        >
          {sourceMode ? (
            <>
              <Eye className="mr-1 size-4" />
              Rich
            </>
          ) : (
            <>
              <Code2 className="mr-1 size-4" />
              {isMarkdown ? "Markdown" : "Source"}
            </>
          )}
        </Button>
      </div>

      <Label htmlFor={id} className="sr-only">
        Document content
      </Label>

      {sourceMode ? (
        <Textarea
          id={id}
          value={value}
          onChange={(event) => {
            const next = isMarkdown
              ? event.target.value
              : sanitizeRichText(event.target.value);
            lastCanonical.current = next;
            onChange(next);
          }}
          placeholder={isMarkdown ? "# Heading…" : "<p>Write content…</p>"}
          className="min-h-48 font-mono text-xs"
        />
      ) : (
        <div
          className={cn(
            "min-h-48 rounded-md border border-input bg-background px-3 py-2 text-sm",
            "[&_.ProseMirror]:min-h-40 [&_.ProseMirror]:outline-none",
            "[&_.ProseMirror_p]:mb-2 [&_.ProseMirror_h1]:mb-2 [&_.ProseMirror_h1]:text-2xl [&_.ProseMirror_h1]:font-semibold",
            "[&_.ProseMirror_h2]:mb-2 [&_.ProseMirror_h2]:text-xl [&_.ProseMirror_h2]:font-semibold",
            "[&_.ProseMirror_h3]:mb-2 [&_.ProseMirror_h3]:text-lg [&_.ProseMirror_h3]:font-semibold",
            "[&_.ProseMirror_ul]:mb-2 [&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6",
            "[&_.ProseMirror_ol]:mb-2 [&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6",
            "[&_.ProseMirror_blockquote]:mb-2 [&_.ProseMirror_blockquote]:border-l-2 [&_.ProseMirror_blockquote]:border-border [&_.ProseMirror_blockquote]:pl-3 [&_.ProseMirror_blockquote]:text-muted-foreground",
            "[&_.ProseMirror_pre]:mb-2 [&_.ProseMirror_pre]:rounded [&_.ProseMirror_pre]:bg-muted [&_.ProseMirror_pre]:p-3 [&_.ProseMirror_pre]:font-mono [&_.ProseMirror_pre]:text-xs",
            "[&_.ProseMirror_code]:rounded [&_.ProseMirror_code]:bg-muted [&_.ProseMirror_code]:px-1",
            "[&_.ProseMirror_a]:underline",
            "[&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
          )}
        >
          <EditorContent editor={editor} />
        </div>
      )}
    </div>
  );
}
