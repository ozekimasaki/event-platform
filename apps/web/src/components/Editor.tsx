import { useState, useRef, useCallback } from 'react';

interface EditorProps {
  content: string;
  onChange: (html: string) => void;
}

export default function Editor({ content, onChange }: EditorProps) {
  const [isPreview, setIsPreview] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const toolbarButtons = [
    { label: 'B', command: 'bold', title: '太字' },
    { label: 'I', command: 'italic', title: '斜体' },
    { label: 'U', command: 'underline', title: '下線' },
    { label: 'H2', command: 'formatBlock', value: 'h2', title: '見出し2' },
    { label: 'H3', command: 'formatBlock', value: 'h3', title: '見出し3' },
    { label: '•', command: 'insertUnorderedList', title: '箇条書き' },
    { label: '1.', command: 'insertOrderedList', title: '番号付きリスト' },
    { label: '""', command: 'formatBlock', value: 'blockquote', title: '引用' },
  ];

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
        {toolbarButtons.map((btn) => (
          <button
            key={btn.label + (btn.value || '')}
            type="button"
            title={btn.title}
            onClick={() => execCommand(btn.command, btn.value)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              border: '1px solid var(--border-default)',
              borderRadius: '4px',
              backgroundColor: 'var(--surface-base)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: btn.label === 'B' ? 700 : btn.label === 'I' ? 400 : 500,
              fontStyle: btn.label === 'I' ? 'italic' : 'normal',
              textDecoration: btn.label === 'U' ? 'underline' : 'none',
              transition: 'background-color 150ms',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = 'var(--surface-medium)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = 'var(--surface-base)';
            }}
          >
            {btn.label}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        <button
          type="button"
          onClick={() => setIsPreview(!isPreview)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '36px',
            padding: '0 12px',
            border: '1px solid var(--border-default)',
            borderRadius: '4px',
            backgroundColor: isPreview ? 'var(--accent-blue)' : 'var(--surface-base)',
            color: isPreview ? 'var(--text-on-accent)' : 'var(--text-primary)',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            transition: 'all 150ms',
          }}
        >
          {isPreview ? '編集' : 'プレビュー'}
        </button>
      </div>

      {/* Editor / Preview area */}
      {isPreview ? (
        <div
          style={{
            padding: '16px',
            minHeight: '200px',
            color: 'var(--text-primary)',
            fontSize: '1rem',
            lineHeight: 1.7,
          }}
          className="prose prose-neutral max-w-none"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          dangerouslySetInnerHTML={{ __html: content }}
          style={{
            padding: '16px',
            minHeight: '200px',
            color: 'var(--text-primary)',
            fontSize: '1rem',
            lineHeight: 1.7,
            outline: 'none',
          }}
          data-placeholder="イベントの説明を入力してください..."
        />
      )}
    </div>
  );
}
