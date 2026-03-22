'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if chatbot is enabled
  useEffect(() => {
    fetch('/api/chat')
      .then((r) => r.json())
      .then((d) => setIsEnabled(d.enabled))
      .catch(() => setIsEnabled(false))
      .finally(() => setIsChecking(false));
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on load
  useEffect(() => {
    if (isEnabled) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isEnabled]);

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || isLoading) return;

    const userMessage: Message = { role: 'user', content: messageText };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedMessages }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Something went wrong.');
        setIsLoading(false);
        return;
      }

      setMessages([...updatedMessages, { role: 'assistant', content: data.message }]);
    } catch {
      setError('Failed to connect. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f0f4f8', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)',
        padding: '1rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
            <Image src="/images/logo.png" alt="DW Logo" width={44} height={44} style={{ borderRadius: 4, background: 'white', padding: 2 }} />
          </Link>
          <Image src="/images/VulcanAIAvatar.png" alt="Vulcan" width={40} height={40} style={{ borderRadius: '50%' }} />
          <div>
            <h1 style={{ margin: 0, color: 'white', fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.025em' }}>Vulcan AI</h1>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>Product Manual Assistant</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Link
            href="/support/manuals"
            style={{
              color: 'white',
              textDecoration: 'none',
              fontSize: '0.85rem',
              padding: '0.4rem 0.85rem',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 6,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            Manual Library
          </Link>
          <Link
            href="/"
            style={{
              color: 'white',
              textDecoration: 'none',
              fontSize: '0.85rem',
              padding: '0.4rem 0.85rem',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 6,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            ← Home
          </Link>
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={{
        flex: 1,
        maxWidth: 800,
        width: '100%',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        padding: '0 1rem',
      }}>
        {/* Messages */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.5rem 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}>
          {/* Loading/Disabled state */}
          {isChecking && (
            <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#6b7280' }}>
              Loading...
            </div>
          )}

          {!isChecking && !isEnabled && (
            <div style={{
              textAlign: 'center',
              padding: '4rem 1rem',
            }}>
              <Image src="/images/VulcanAIAvatar.png" alt="Vulcan" width={80} height={80} style={{ borderRadius: '50%', marginBottom: '1rem', opacity: 0.5 }} />
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#374151', margin: '0 0 0.5rem' }}>Vulcan is Offline</h2>
              <p style={{ fontSize: '0.95rem', color: '#6b7280', maxWidth: 400, margin: '0 auto' }}>
                The AI assistant is currently disabled. Please check back later or contact the administrator.
              </p>
            </div>
          )}

          {/* Welcome message when enabled but no messages */}
          {!isChecking && isEnabled && messages.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '3rem 1rem 1rem',
            }}>
              <Image src="/images/VulcanAIAvatar.png" alt="Vulcan" width={90} height={90} style={{ borderRadius: '50%', marginBottom: '1rem' }} />
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e3a5f', margin: '0 0 0.5rem' }}>
                Hey! I&apos;m Vulcan.
              </h2>
              <p style={{ fontSize: '1rem', color: '#6b7280', lineHeight: 1.6, maxWidth: 500, margin: '0 auto 1.5rem' }}>
                I can help you find product manuals, spec sheets, and installation guides. I know about Daktronics, Fair-Play, Nevco, Porter, Gill, Interkal, Hufcor, and more.
              </p>

              {/* Suggested questions */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.6rem',
                justifyContent: 'center',
                maxWidth: 520,
                margin: '0 auto',
              }}>
                {[
                  'Porter POWR-TOUCH 2.5 programming',
                  'Hufcor 600 Series specs',
                  'Daktronics wiring diagrams',
                  'Interkal bleacher installation',
                  'Fair-Play scoreboard manuals',
                  'Porter volleyball systems',
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    style={{
                      padding: '0.5rem 1rem',
                      fontSize: '0.85rem',
                      backgroundColor: 'white',
                      border: '1px solid #d1d5db',
                      borderRadius: '9999px',
                      cursor: 'pointer',
                      color: '#374151',
                      transition: 'all 0.15s',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#eff6ff';
                      e.currentTarget.style.borderColor = '#93c5fd';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'white';
                      e.currentTarget.style.borderColor = '#d1d5db';
                      e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)';
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat messages */}
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                gap: '0.75rem',
                alignItems: 'flex-start',
                maxWidth: '85%',
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              {msg.role === 'assistant' && (
                <Image
                  src="/images/VulcanAIAvatar.png"
                  alt="Vulcan"
                  width={36}
                  height={36}
                  style={{ borderRadius: '50%', flexShrink: 0, marginTop: '2px' }}
                />
              )}
              <div
                style={{
                  padding: '0.85rem 1.15rem',
                  borderRadius:
                    msg.role === 'user'
                      ? '1.25rem 1.25rem 0.25rem 1.25rem'
                      : '1.25rem 1.25rem 1.25rem 0.25rem',
                  backgroundColor: msg.role === 'user' ? '#1e3a5f' : 'white',
                  color: msg.role === 'user' ? 'white' : '#1f2937',
                  fontSize: '0.95rem',
                  lineHeight: 1.6,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <Image
                src="/images/VulcanAIAvatar.png"
                alt="Vulcan"
                width={36}
                height={36}
                style={{ borderRadius: '50%', flexShrink: 0, marginTop: '2px' }}
              />
              <div
                style={{
                  padding: '0.85rem 1.15rem',
                  borderRadius: '1.25rem 1.25rem 1.25rem 0.25rem',
                  backgroundColor: 'white',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                  display: 'flex',
                  gap: '0.35rem',
                  alignItems: 'center',
                }}
              >
                <span className="vulcan-dot" style={{ animationDelay: '0s' }}>●</span>
                <span className="vulcan-dot" style={{ animationDelay: '0.2s' }}>●</span>
                <span className="vulcan-dot" style={{ animationDelay: '0.4s' }}>●</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{
              padding: '0.65rem 1rem',
              backgroundColor: '#fef2f2',
              color: '#dc2626',
              borderRadius: '0.5rem',
              fontSize: '0.85rem',
              textAlign: 'center',
              maxWidth: 400,
              margin: '0 auto',
            }}>
              {error}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        {isEnabled && (
          <div style={{
            padding: '1rem 0 1.5rem',
            display: 'flex',
            gap: '0.75rem',
            position: 'sticky',
            bottom: 0,
          }}>
            <div style={{
              flex: 1,
              display: 'flex',
              gap: '0.5rem',
              background: 'white',
              borderRadius: '9999px',
              padding: '0.35rem 0.35rem 0.35rem 1.25rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              border: '1px solid #e5e7eb',
            }}>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Vulcan a question..."
                disabled={isLoading}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  fontSize: '1rem',
                  backgroundColor: 'transparent',
                  color: '#111',
                }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={isLoading || !input.trim()}
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor:
                    isLoading || !input.trim() ? '#d1d5db' : '#1e3a5f',
                  color: 'white',
                  cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.1rem',
                  flexShrink: 0,
                  transition: 'background-color 0.15s',
                }}
              >
                ↑
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Styles */}
      <style jsx global>{`
        .vulcan-dot {
          font-size: 1.25rem;
          color: #f59e0b;
          animation: vulcanPulse 1.2s infinite;
        }
        @keyframes vulcanPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
