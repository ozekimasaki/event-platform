import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { useCallback, useEffect } from 'react';

interface BlogEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export default function BlogEditor({ content, onChange, placeholder = '記事の内容を入力してください...' }: BlogEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-accent-blue underline hover:opacity-80',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-neutral max-w-none focus:outline-none min-h-[300px] px-4 py-3 text-text-primary',
        'data-placeholder': placeholder,
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('URLを入力:');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const addImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt('画像URLを入力:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  if (!editor) return null;

  const btnClass = (active: boolean) =>
    `inline-flex items-center justify-center min-w-[36px] min-h-[36px] px-2 border rounded-sm text-sm transition-colors ${
      active
        ? 'bg-accent-blue text-text-on-accent border-accent-blue'
        : 'bg-surface-base text-text-primary border-border-default hover:bg-surface-medium'
    }`;

  return (
    <div className="border border-border-default rounded-sm overflow-hidden bg-surface-base">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b border-border-default bg-surface-soft flex-wrap">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btnClass(editor.isActive('bold'))} title="太字">
          <strong>B</strong>
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btnClass(editor.isActive('italic'))} title="斜体">
          <em>I</em>
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btnClass(editor.isActive('strike'))} title="取り消し線">
          <s>S</s>
        </button>

        <span className="w-px h-6 bg-border-default mx-1" />

        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btnClass(editor.isActive('heading', { level: 2 }))} title="見出し2">
          H2
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btnClass(editor.isActive('heading', { level: 3 }))} title="見出し3">
          H3
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} className={btnClass(editor.isActive('heading', { level: 4 }))} title="見出し4">
          H4
        </button>

        <span className="w-px h-6 bg-border-default mx-1" />

        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive('bulletList'))} title="箇条書き">
          •
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnClass(editor.isActive('orderedList'))} title="番号リスト">
          1.
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btnClass(editor.isActive('blockquote'))} title="引用">
          &ldquo;
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={btnClass(editor.isActive('codeBlock'))} title="コードブロック">
          {'<>'}
        </button>

        <span className="w-px h-6 bg-border-default mx-1" />

        <button type="button" onClick={setLink} className={btnClass(editor.isActive('link'))} title="リンク">
          🔗
        </button>
        <button type="button" onClick={addImage} className={btnClass(false)} title="画像">
          🖼
        </button>

        <div className="flex-1" />

        <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className={btnClass(false)} title="元に戻す">
          ↩
        </button>
        <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className={btnClass(false)} title="やり直し">
          ↪
        </button>
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />

      {/* TipTap placeholder styles */}
      <style>{`
        .tiptap p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--text-secondary);
          pointer-events: none;
          height: 0;
        }
        .tiptap img {
          max-width: 100%;
          height: auto;
          border-radius: 4px;
          margin: 1rem 0;
        }
        .tiptap blockquote {
          border-left: 3px solid var(--border-default);
          padding-left: 1rem;
          margin: 1rem 0;
          color: var(--text-secondary);
        }
        .tiptap pre {
          background: var(--surface-medium);
          border-radius: 4px;
          padding: 0.75rem 1rem;
          margin: 1rem 0;
          overflow-x: auto;
        }
        .tiptap code {
          font-size: 0.875em;
        }
      `}</style>
    </div>
  );
}
