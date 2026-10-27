"use client";

import { useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import Heading from "@tiptap/extension-heading";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { Placeholder } from "@tiptap/extensions";
import { isSafeHref } from "@/lib/safe-url";
import { MAX_IMAGE_BYTES, uploadImage } from "@/components/admin/upload-image";

const btn = "inline-flex shrink-0 min-h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm font-semibold text-forest-900 hover:bg-white disabled:opacity-40";
const on = "bg-forest-900 !text-white hover:!bg-forest-800";

function Btn({ label, active, onClick, disabled, children }: { label: string; active?: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} aria-pressed={active ?? false} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick} className={`${btn} ${active ? on : ""}`}>
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-6 w-px shrink-0 bg-line" aria-hidden="true" />;
}

function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      left: e.isActive({ textAlign: "left" }),
      center: e.isActive({ textAlign: "center" }),
      right: e.isActive({ textAlign: "right" }),
      justify: e.isActive({ textAlign: "justify" }),
      block: e.isActive("heading", { level: 2 }) ? "h2" : e.isActive("heading", { level: 3 }) ? "h3" : e.isActive("heading", { level: 4 }) ? "h4" : "p",
      color: (e.getAttributes("textStyle").color as string | undefined) ?? "#1d2b22",
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const [status, setStatus] = useState<{ kind: "busy" | "error"; text: string } | null>(null);

  function openLink() {
    setLinkUrl((editor.getAttributes("link").href as string | undefined) ?? "");
    setLinkError("");
    setLinkOpen(true);
  }
  function applyLink() {
    const url = linkUrl.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinkOpen(false);
      return;
    }
    if (!isSafeHref(url)) {
      setLinkError("Use an internal path (/contact), https:// link, mailto: or tel:");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    setLinkOpen(false);
  }
  async function pickImage(file: File | undefined) {
    if (!file) return;
    setStatus({ kind: "busy", text: "Uploading image…" });
    const res = await uploadImage(file, "blog");
    if (!res.ok) {
      setStatus({ kind: "error", text: res.error });
      return;
    }
    setStatus(null);
    editor.chain().focus().setImage({ src: `/media/${res.id}`, alt: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") }).run();
  }

  return (
    <div className="sticky top-0 z-10 border-b border-line bg-forest-50">
      {/* One scrollable row on phones (a wrapped toolbar would cover half the screen); wraps on larger screens. */}
      <div className="flex flex-nowrap items-center gap-1 overflow-x-auto p-2 md:flex-wrap md:overflow-visible" role="toolbar" aria-label="Text formatting">
        <select
          aria-label="Text style"
          value={s.block}
          onChange={(e) => {
            const v = e.target.value;
            const chain = editor.chain().focus();
            if (v === "p") chain.setParagraph().run();
            else chain.setHeading({ level: Number(v.slice(1)) as 2 | 3 | 4 }).run();
          }}
          className="min-h-9 shrink-0 rounded-md border border-line bg-white px-2 text-sm font-semibold"
        >
          <option value="p">Paragraph</option>
          <option value="h2">Heading</option>
          <option value="h3">Subheading</option>
          <option value="h4">Small heading</option>
        </select>
        <Divider />
        <Btn label="Bold" active={s.bold} onClick={() => editor.chain().focus().toggleBold().run()}><b>B</b></Btn>
        <Btn label="Italic" active={s.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><i>I</i></Btn>
        <Btn label="Underline" active={s.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></Btn>
        <Btn label="Strikethrough" active={s.strike} onClick={() => editor.chain().focus().toggleStrike().run()}><s>S</s></Btn>
        <label className={`${btn} cursor-pointer`} title="Text colour">
          <span aria-hidden="true" className="font-bold" style={{ borderBottom: `3px solid ${s.color}` }}>A</span>
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(s.color) ? s.color : "#1d2b22"}
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            className="sr-only"
            aria-label="Text colour"
          />
        </label>
        <Btn label="Clear text colour" onClick={() => editor.chain().focus().unsetColor().run()}>A×</Btn>
        <Divider />
        <Btn label="Bulleted list" active={s.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</Btn>
        <Btn label="Numbered list" active={s.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</Btn>
        <Btn label="Quote" active={s.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>“ ”</Btn>
        <Divider />
        <Btn label="Align left" active={s.left} onClick={() => editor.chain().focus().setTextAlign("left").run()}>⇤</Btn>
        <Btn label="Align centre" active={s.center} onClick={() => editor.chain().focus().setTextAlign("center").run()}>↔</Btn>
        <Btn label="Align right" active={s.right} onClick={() => editor.chain().focus().setTextAlign("right").run()}>⇥</Btn>
        <Btn label="Justify" active={s.justify} onClick={() => editor.chain().focus().setTextAlign("justify").run()}>☰</Btn>
        <Divider />
        <Btn label="Link" active={s.link} onClick={openLink}>Link</Btn>
        <Btn label="Insert image" onClick={() => fileRef.current?.click()}>Image</Btn>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          className="sr-only"
          aria-label="Choose an image to insert"
          onChange={(e) => {
            void pickImage(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Btn label="Horizontal line" onClick={() => editor.chain().focus().setHorizontalRule().run()}>―</Btn>
        <Divider />
        <Btn label="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}>Tx</Btn>
        <Btn label="Undo" disabled={!s.canUndo} onClick={() => editor.chain().focus().undo().run()}>↶</Btn>
        <Btn label="Redo" disabled={!s.canRedo} onClick={() => editor.chain().focus().redo().run()}>↷</Btn>
      </div>
      {linkOpen && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-white p-2">
          <label className="sr-only" htmlFor="rte-link">
            Link address
          </label>
          <input
            id="rte-link"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
              if (e.key === "Escape") setLinkOpen(false);
            }}
            placeholder="/contact or https://example.com (empty removes the link)"
            className="min-h-10 min-w-0 flex-1 rounded-md border border-[#cbd5cc] px-3"
            autoFocus
          />
          <button type="button" onClick={applyLink} className="min-h-10 rounded-md bg-forest-900 px-4 text-sm font-semibold text-white">
            Apply
          </button>
          <button type="button" onClick={() => setLinkOpen(false)} className="min-h-10 rounded-md px-3 text-sm font-semibold text-forest-900">
            Cancel
          </button>
          {linkError && (
            <p role="alert" className="w-full text-sm text-danger">
              {linkError}
            </p>
          )}
        </div>
      )}
      {status && (
        <p role={status.kind === "error" ? "alert" : "status"} className={`border-t border-line px-3 py-1.5 text-sm ${status.kind === "error" ? "text-danger" : "text-muted"}`}>
          {status.text}
        </p>
      )}
    </div>
  );
}

/**
 * Rich text editor for blog posts. Its HTML travels in a hidden `blocks` field as one `richtext` block (sanitised again
 * by the server action), so the surrounding form and action work as before. `html` is the initial content.
 */
export function RichTextEditor({ name = "blocks", html }: { name?: string; html: string }) {
  const [value, setValue] = useState(html);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: false, link: { openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer" } } }),
      // Page titles come from the post title, so a pasted Title/Heading 1 (Word, Google Docs) becomes a heading rather than a plain paragraph.
      Heading.extend({
        parseHTML() {
          return [1, 2, 3, 4].map((level) => ({ tag: `h${level}`, attrs: { level: Math.max(2, level) } }));
        },
      }).configure({ levels: [2, 3, 4] }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      Color,
      Image.configure({ inline: false }),
      Placeholder.configure({ placeholder: "Write your post here…" }),
    ],
    content: html,
    editorProps: {
      attributes: { "aria-label": "Post content", role: "textbox", "aria-multiline": "true" },
      handlePaste(_view, event) {
        // Pasted image files are uploaded instead of embedded as data: URLs (which would bloat the post and be stripped on save).
        const file = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
        if (!file) return false;
        event.preventDefault();
        if (file.size > MAX_IMAGE_BYTES) return true;
        void uploadImage(file, "blog").then((res) => {
          if (res.ok) editor?.chain().focus().setImage({ src: `/media/${res.id}`, alt: "" }).run();
        });
        return true;
      },
    },
    // Only real edits change the field: re-serialising untouched content on load would make the form look edited (false "unsaved changes").
    onUpdate: ({ editor: e }) => setValue(e.isEmpty ? "" : e.getHTML()),
  });

    // The editor keeps an empty paragraph after a trailing list or image; it is noise in the stored post.
  const trimmed = value.replace(/(<p>(<br[^>]*>)?<\/p>)+$/, "");
  const blocks = trimmed ? [{ type: "richtext", html: trimmed }] : [];
  return (
    <div className="rte-editor min-w-0 max-w-full overflow-hidden rounded-[var(--radius-field)] border border-[#cbd5cc] bg-white focus-within:border-forest-800">
      <input type="hidden" name={name} value={JSON.stringify(blocks)} />
      {editor ? <Toolbar editor={editor} /> : <div className="h-12 border-b border-line bg-forest-50" aria-hidden="true" />}
      <EditorContent editor={editor} />
    </div>
  );
}
