'use client';
import { useState, useEffect, useRef } from 'react';
import VulcanAvatar from './VulcanAvatar';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function VulcanChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [retryCountdown, setRetryCountdown] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Core fetch logic — used by both sendMessage and auto-retry
  const fetchChat = async (messagesToSend: Message[]): Promise<boolean> => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messagesToSend }),
      });

      const data = await response.json();

      if (!response.ok) {
        // If rate-limited with retryAfter, start auto-retry countdown
        if (data.retryAfter && data.retryAfter > 0) {
          setError('');
          let remaining = data.retryAfter;
          setRetryCountdown(remaining);

          return new Promise((resolve) => {
            const timer = setInterval(() => {
              remaining -= 1;
              setRetryCountdown(remaining);
              if (remaining <= 0) {
                clearInterval(timer);
                retryTimerRef.current = null;
                setRetryCountdown(0);
                // Auto-retry
                fetchChat(messagesToSend).then(resolve);
              }
            }, 1000);
            retryTimerRef.current = timer;
          });
        }

        setError(data.error || 'Something went wrong.');
        return false;
      }

      setMessages([...messagesToSend, { role: 'assistant', content: data.message }]);
      return true;
    } catch {
      setError('Failed to connect. Please try again.');
      return false;
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    // Cancel any pending retry
    if (retryTimerRef.current) {
      clearInterval(retryTimerRef.current);
      retryTimerRef.current = null;
      setRetryCountdown(0);
    }

    const userMessage: Message = { role: 'user', content: input.trim() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setError('');
    setIsLoading(true);

    await fetchChat(updatedMessages);
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Don't render anything if chatbot is disabled or still checking
  if (isChecking || !isEnabled) return null;

  return (
    <>
      {/* Floating bubble button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            background: 'white',
            overflow: 'hidden',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.08)';
            e.currentTarget.style.boxShadow = '0 6px 28px rgba(0,0,0,0.35)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.25)';
          }}
          title="Ask Vulcan"
        >
          <VulcanAvatar size={56} />
        </button>
      )}

      {/* Chat overlay panel */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            width: '380px',
            maxWidth: 'calc(100vw - 2rem)',
            height: '520px',
            maxHeight: 'calc(100vh - 6rem)',
            backgroundColor: 'white',
            borderRadius: '1rem',
            boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid #e5e7eb',
          }}
        >
          {/* Header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)',
              color: 'white',
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              flexShrink: 0,
            }}
          >
            <VulcanAvatar size={36} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', letterSpacing: '0.025em' }}>
                Vulcan
              </div>
              <div style={{ fontSize: '0.7rem', opacity: 0.8 }}>Product Manual Assistant</div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                color: 'white',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>

          {/* Messages area */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              backgroundColor: '#f8f9fb',
            }}
          >
            {/* Welcome message */}
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
                <div style={{ marginBottom: '0.75rem' }}>
                  <VulcanAvatar size={56} />
                </div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: '1rem',
                    color: '#1e3a5f',
                    marginBottom: '0.5rem',
                  }}
                >
                  Hey! I&apos;m Vulcan.
                </div>
                <div style={{ fontSize: '0.85rem', color: '#6b7280', lineHeight: 1.5 }}>
                  I can help you find product manuals, spec sheets, and installation guides. What are you looking for?
                </div>
                <div
                  style={{
                    marginTop: '1rem',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                    justifyContent: 'center',
                  }}
                >
                  {[
                    'Hufcor 600 Series specs',
                    'Daktronics wiring diagrams',
                    'Porter installation guides',
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setInput(q);
                        setTimeout(() => {
                          sendMessage();
                        }, 50);
                        setMessages([{ role: 'user', content: q }]);
                        setIsLoading(true);
                        fetch('/api/chat', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ messages: [{ role: 'user', content: q }] }),
                        })
                          .then((r) => r.json())
                          .then((d) => {
                            if (d.message) {
                              setMessages([
                                { role: 'user', content: q },
                                { role: 'assistant', content: d.message },
                              ]);
                            } else {
                              setError(d.error || 'Something went wrong.');
                            }
                          })
                          .catch(() => setError('Failed to connect.'))
                          .finally(() => {
                            setIsLoading(false);
                            setInput('');
                          });
                      }}
                      style={{
                        padding: '0.375rem 0.75rem',
                        fontSize: '0.75rem',
                        backgroundColor: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '9999px',
                        cursor: 'pointer',
                        color: '#374151',
                        transition: 'background-color 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#eff6ff';
                        e.currentTarget.style.borderColor = '#93c5fd';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'white';
                        e.currentTarget.style.borderColor = '#d1d5db';
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
                  gap: '0.5rem',
                  alignItems: 'flex-start',
                }}
              >
                {msg.role === 'assistant' && (
                  <div style={{ flexShrink: 0, marginTop: '2px' }}>
                    <VulcanAvatar size={28} />
                  </div>
                )}
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '0.625rem 0.875rem',
                    borderRadius:
                      msg.role === 'user'
                        ? '1rem 1rem 0.25rem 1rem'
                        : '1rem 1rem 1rem 0.25rem',
                    backgroundColor: msg.role === 'user' ? '#1e3a5f' : 'white',
                    color: msg.role === 'user' ? 'white' : '#1f2937',
                    fontSize: '0.85rem',
                    lineHeight: 1.5,
                    boxShadow: msg.role === 'assistant' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Loading / retry countdown indicator */}
            {isLoading && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                <div style={{ flexShrink: 0, marginTop: '2px' }}>
                  <VulcanAvatar size={28} />
                </div>
                <div
                  style={{
                    padding: '0.625rem 0.875rem',
                    borderRadius: '1rem 1rem 1rem 0.25rem',
                    backgroundColor: 'white',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                    display: 'flex',
                    gap: '0.3rem',
                    alignItems: 'center',
                  }}
                >
                  {retryCountdown > 0 ? (
                    <span style={{ fontSize: '0.8rem', color: '#92400e' }}>
                      ⏳ Reading the manual... retrying in {retryCountdown}s
                    </span>
                  ) : (
                    <>
                      <span style={{ animation: 'pulse 1.2s infinite', fontSize: '1.25rem', color: '#f59e0b' }}>
                        ●
                      </span>
                      <span
                        style={{
                          animation: 'pulse 1.2s infinite 0.2s',
                          fontSize: '1.25rem',
                          color: '#f59e0b',
                        }}
                      >
                        ●
                      </span>
                      <span
                        style={{
                          animation: 'pulse 1.2s infinite 0.4s',
                          fontSize: '1.25rem',
                          color: '#f59e0b',
                        }}
                      >
                        ●
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div
                style={{
                  padding: '0.5rem 0.75rem',
                  backgroundColor: '#fef2f2',
                  color: '#dc2626',
                  borderRadius: '0.5rem',
                  fontSize: '0.8rem',
                  textAlign: 'center',
                }}
              >
                {error}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div
            style={{
              padding: '0.75rem',
              borderTop: '1px solid #e5e7eb',
              backgroundColor: 'white',
              display: 'flex',
              gap: '0.5rem',
              flexShrink: 0,
            }}
          >
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
                padding: '0.625rem 0.875rem',
                fontSize: '0.85rem',
                border: '1px solid #d1d5db',
                borderRadius: '9999px',
                outline: 'none',
                backgroundColor: isLoading ? '#f3f4f6' : 'white',
              }}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                border: 'none',
                backgroundColor:
                  isLoading || !input.trim() ? '#d1d5db' : '#1e3a5f',
                color: 'white',
                cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                flexShrink: 0,
              }}
            >
              ↑
            </button>
          </div>
        </div>
      )}

      {/* Pulse animation for loading dots */}
      <style jsx global>{`
        @keyframes pulse {
          0%,
          100% {
            opacity: 0.3;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}
