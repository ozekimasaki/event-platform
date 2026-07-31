import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { useCallback, useEffect } from 'react';

interface BlogEditorProps {
  content: string;
  onChange: (html: string) => void;
}

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({ onClick, isActive, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '36px',
        height: '36px',
        border: '1px solid var(--border-default)',
        borderRadius: '4px',
        backgroundColor: isActive ? 'var(--surface-medium)' : 'var(--surface-elevated)',
        color: isActive ? 'var(--accent-blue)' : 'var(--text-primary)',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: 500,
        transition: 'background-color 150ms, color 150ms',
      }}
      onMouseEnter={(e) => {
        if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface-soft)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface-elevated)';
      }}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return (
    <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-default)', margin: '0 4px' }} />
  );
}

export default function BlogEditor({ content, onChange }: BlogEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Image.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: { class: 'blog-editor-image' },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'blog-editor-link', rel: 'noopener noreferrer', target: '_blank' },
      }),
    ],
    content: content || '',
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'blog-editor-content',
        'data-placeholder': '記事の内容を入力してください...',
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || '');
    }
  }, [content]);

  const addImage = useCallback(() => {
    const url = window.prompt('画像のURLを入力してください:');
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const addLink = useCallback(() => {
    const prevUrl = editor?.getAttributes('link').href || '';
    const url = window.prompt('リンクURLを入力してください:', prevUrl);
    if (url === null) return;
    if (url === '' && editor) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    if (editor) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  }, [editor]);

  if (!editor) return null;

  return (
    <div
      style={{
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        backgroundColor: 'var(--surface-base)',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '8px',
          borderBottom: '1px solid var(--border-default)',
          backgroundColor: 'var(--surface-soft)',
          flexWrap: 'wrap',
        }}
      >
        {/* Text formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="太字"
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="斜体"
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          title="取り消し線"
        >
          <s>S</s>
        </ToolbarButton>

        <ToolbarDivider />

        {/* Headings */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="見出し2"
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title="見出し3"
        >
          H3
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
          isActive={editor.isActive('heading', { level: 4 })}
          title="見出し4"
        >
          H4
        </ToolbarButton>

        <ToolbarDivider />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="箇条書き"
        >
          •
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="番号付きリスト"
        >
          1.
        </ToolbarButton>

        <ToolbarDivider />

        {/* Block elements */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="引用"
        >
          "
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          isActive={editor.isActive('codeBlock')}
          title="コードブロック"
        >
          {'<>'}
        </ToolbarButton>

        <ToolbarDivider />

        {/* Insert */}
        <ToolbarButton onClick={addLink} isActive={editor.isActive('link')} title="リンク挿入">
          🔗
        </ToolbarButton>
        <ToolbarButton onClick={addImage} title="画像挿入">
          🖼
        </ToolbarButton>

        <ToolbarDivider />

        {/* Undo/Redo */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          title="元に戻す"
        >
          ←
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          title="やり直す"
        >
          →
        </ToolbarButton>
      </div>

      {/* Editor Content */}
      <EditorContent
        editor={editor}
        style={{
          minHeight: '300px',
          padding: '16px',
          color: 'var(--text-primary)',
          backgroundColor: 'var(--surface-elevated)',
        }}
      />

      <style>{`
        .blog-editor-content {
          outline: none !important;
          font-size: 1rem;
          line-height: 1.7;
          min-height: 280px;
        }
        .blog-editor-content p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--text-secondary);
          pointer-events: none;
          height: 0;
          font-style: italic;
        }
        .blog-editor-content h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 1.5rem 0 0.75rem;
          color: var(--text-primary);
        }
        .blog-editor-content h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 1.25rem 0 0.5rem;
          color: var(--text-primary);
        }
        .blog-editor-content h4 {
          font-size: 1.1rem;
          font-weight: 600;
          margin: 1rem 0 0.5rem;
          color: var(--text-primary);
        }
        .blog-editor-content p {
          margin: 0.5rem 0;
        }
        .blog-editor-content ul,
        .blog-editor-content ol {
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        .blog-editor-content li {
          margin: 0.25rem 0;
        }
        .blog-editor-content blockquote {
          border-left: 3px solid var(--accent-blue);
          padding-left: 1rem;
          margin: 1rem 0;
          color: var(--text-secondary);
          font-style: italic;
        }
        .blog-editor-content pre {
          background: var(--surface-medium);
          border: 1px solid var(--border-default);
          border-radius: 6px;
          padding: 1rem;
          overflow-x: auto;
          margin: 1rem 0;
          font-family: var(--font-mono);
          font-size: 0.875rem;
        }
        .blog-editor-content code {
          font-family: var(--font-mono);
          font-size: 0.875em;
          background: var(--surface-medium);
          padding: 0.15em 0.4em;
          border-radius: 3px;
        }
        .blog-editor-content pre code {
          background: none;
          padding: 0;
        }
        .blog-editor-content a,
        .blog-editor-link {
          color: var(--accent-blue);
          text-decoration: underline;
          cursor: pointer;
        }
        .blog-editor-content img,
        .blog-editor-image {
          max-width: 100%;
          height: auto;
          border-radius: 6px;
          margin: 1rem 0;
        }
        .blog-editor-content hr {
          border: none;
          border-top: 1px solid var(--border-default);
          margin: 1.5rem 0;
        }
      `}</style>
    </div>
  );
}
