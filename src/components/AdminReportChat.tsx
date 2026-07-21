'use client';
import React, { useState, useRef, useEffect } from 'react';

// Vulcan Reports Chat — collapsible admin dashboard panel for asking natural-
// language questions about submitted field reports ("Which job needed the
// batting cage motor swapped?"). Backed by /api/admin/report-chat.

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'Which sites have equipment flagged unsafe right now?',
  'What future parts have techs said we need?',
  'What repairs have we done in the last 30 days?',
];

// Render assistant text: markdown links become clickable, **bold** works,
// everything else is plain text with preserved line breaks.
function renderContent(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    if (match[1] !== undefined) {
      const href = match[2];
      nodes.push(
        <a
          key={key++}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#2563eb', textDecoration: 'underline', fontWeight: 500 }}
        >
          {match[1]}
        </a>
      );
    } else if (match[3] !== undefined) {
      nodes.push(<strong key={key++}>{match[3]}</strong>);
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export default function AdminReportChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const send = async (question?: string) => {
    const q = (question ?? input).trim();
    if (!q || isLoading) return;

    const updated: Message[] = [...messages, { role: 'user', content: q }];
    setMessages(updated);
    setInput('');
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/report-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
      } else {
        setMessages([...updated, { role: 'assistant', content: data.message }]);
      }
    } catch {
      setError('Failed to connect. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm mb-6">
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.875rem 1.25rem',
          backgroundColor: open ? '#fffbeb' : 'white',
          border: 'none',
          borderRadius: '0.5rem',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>🔥</span>
          <span className="font-bold" style={{ fontSize: '1rem' }}>Ask Vulcan About Reports</span>
          <span style={{ fontSize: '0.75rem', color: '#92400e', backgroundColor: '#fef3c7', padding: '0.125rem 0.5rem', borderRadius: '9999px', fontWeight: 600 }}>
            AI
          </span>
        </div>
        <span style={{ color: '#6b7280', fontSize: '0.875rem' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 1.25rem 1.25rem 1.25rem' }}>
          {/* Message thread */}
          <div
            style={{
              maxHeight: '24rem',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              padding: messages.length > 0 || isLoading ? '0.75rem 0' : '0',
            }}
          >
            {messages.length === 0 && !isLoading && (
              <div style={{ padding: '0.5rem 0' }}>
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                  Ask anything about submitted reports — job history, repairs, unsafe equipment, parts needed, and more.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      style={{
                        padding: '0.375rem 0.75rem',
                        backgroundColor: '#fffbeb',
                        color: '#92400e',
                        border: '1px solid #fde68a',
                        borderRadius: '9999px',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  padding: '0.625rem 0.875rem',
                  borderRadius: '0.75rem',
                  fontSize: '0.875rem',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  backgroundColor: msg.role === 'user' ? '#d97706' : '#f3f4f6',
                  color: msg.role === 'user' ? 'white' : '#111827',
                }}
              >
                {msg.role === 'assistant' ? renderContent(msg.content) : msg.content}
              </div>
            ))}

            {isLoading && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  padding: '0.625rem 0.875rem',
                  borderRadius: '0.75rem',
                  fontSize: '0.875rem',
                  backgroundColor: '#f3f4f6',
                  color: '#6b7280',
                }}
              >
                Searching reports…
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {error && (
            <div style={{ fontSize: '0.8rem', color: '#dc2626', marginBottom: '0.5rem' }}>{error}</div>
          )}

          {/* Input row */}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(); }}
              placeholder='e.g. "Which job needed the batting cage motor swapped?"'
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            />
            <button
              onClick={() => send()}
              disabled={isLoading || !input.trim()}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: isLoading || !input.trim() ? '#e5e7eb' : '#d97706',
                color: isLoading || !input.trim() ? '#9ca3af' : 'white',
                border: 'none',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                cursor: isLoading || !input.trim() ? 'default' : 'pointer',
              }}
            >
              Ask
            </button>
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); setError(''); }}
                disabled={isLoading}
                title="Clear conversation"
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: '#f3f4f6',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
