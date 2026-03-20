'use client';
import Link from 'next/link';
import Image from 'next/image';

export default function AssistantPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'white' }}>
      {/* Header */}
      <div style={{
        background: '#00457c',
        padding: '1.5rem 2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
            <Image src="/images/logo.png" alt="DW Logo" width={50} height={50} style={{ borderRadius: 4, background: 'white', padding: 2 }} />
          </Link>
          <div>
            <h1 style={{ margin: 0, color: 'white', fontSize: '1.35rem', fontWeight: 700 }}>Install & Service AI</h1>
            <p style={{ margin: 0, color: '#93c5fd', fontSize: '0.8rem' }}>Degler Whiting</p>
          </div>
        </div>
        <Link
          href="/"
          style={{
            color: 'white',
            textDecoration: 'none',
            fontSize: '0.9rem',
            padding: '0.5rem 1rem',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 6,
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
        >
          ← Back to Home
        </Link>
      </div>

      {/* Coming Soon Content */}
      <div style={{
        maxWidth: 600,
        margin: '0 auto',
        padding: '4rem 1.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
      }}>
        {/* AI Icon */}
        <div style={{
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.5rem',
          border: '3px solid #bfdbfe',
        }}>
          <span style={{ fontSize: '3rem' }}>🤖</span>
        </div>

        <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#00457c', margin: '0 0 0.75rem' }}>
          Coming Soon
        </h2>

        <p style={{ fontSize: '1.05rem', color: '#374151', lineHeight: 1.6, margin: '0 0 2rem', maxWidth: 450 }}>
          An AI-powered assistant to help with installation, troubleshooting, and service questions — trained on Degler Whiting product manuals and guides.
        </p>

        {/* Feature Preview Cards */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          width: '100%',
          maxWidth: 420,
          marginBottom: '2.5rem',
        }}>
          {[
            { icon: '💬', title: 'Ask Questions in Plain English', desc: 'Describe your problem and get step-by-step guidance' },
            { icon: '📖', title: 'References Your Manuals', desc: 'Answers grounded in official Degler Whiting documentation' },
            { icon: '🔧', title: 'Troubleshooting Help', desc: 'Diagnose scoreboard issues, wiring problems, and more' },
            { icon: '📱', title: 'Works on Any Device', desc: 'Use it right from your phone on the job site' },
          ].map((feature) => (
            <div
              key={feature.title}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.85rem',
                padding: '0.85rem 1rem',
                background: '#f9fafb',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '1.35rem', flexShrink: 0, marginTop: 1 }}>{feature.icon}</span>
              <div>
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#111' }}>{feature.title}</p>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: '#6b7280' }}>{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Fake chat preview */}
        <div style={{
          width: '100%',
          maxWidth: 420,
          border: '2px solid #e5e7eb',
          borderRadius: 12,
          overflow: 'hidden',
          opacity: 0.5,
        }}>
          <div style={{
            background: '#00457c',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <span style={{ fontSize: '1rem' }}>🤖</span>
            <span style={{ color: 'white', fontSize: '0.85rem', fontWeight: 600 }}>DW Service Assistant</span>
            <span style={{
              marginLeft: 'auto',
              fontSize: '0.65rem',
              padding: '0.15rem 0.5rem',
              background: 'rgba(255,255,255,0.2)',
              borderRadius: 12,
              color: 'white',
            }}>Preview</span>
          </div>
          <div style={{ padding: '1rem', background: '#f9fafb', minHeight: 120 }}>
            <div style={{
              background: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '12px 12px 12px 4px',
              padding: '0.65rem 0.85rem',
              maxWidth: '80%',
              fontSize: '0.8rem',
              color: '#374151',
              marginBottom: '0.5rem',
            }}>
              How can I help you today? Ask me about installation, wiring, troubleshooting, or maintenance for any Degler Whiting equipment.
            </div>
          </div>
          <div style={{
            padding: '0.75rem 1rem',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            gap: '0.5rem',
          }}>
            <div style={{
              flex: 1,
              padding: '0.6rem 0.85rem',
              background: '#f3f4f6',
              borderRadius: 8,
              fontSize: '0.8rem',
              color: '#9ca3af',
            }}>
              Type your question...
            </div>
            <div style={{
              padding: '0.6rem 1rem',
              background: '#d1d5db',
              borderRadius: 8,
              fontSize: '0.8rem',
              color: 'white',
              fontWeight: 600,
            }}>
              Send
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
