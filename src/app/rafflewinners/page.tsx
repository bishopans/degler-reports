'use client';

import Link from 'next/link';
import Image from 'next/image';

// ─── Update these each quarter ───────────────────────────────────────────
const QUARTER_LABEL = 'Q2 • 2026';
const DRAWINGS = [
  {
    key: 'north',
    title: 'DW North',
    subtitle: 'Quarterly Report Raffle Drawing',
    src: '/videos/raffle-north-q2-2026.mp4',
    poster: '/videos/raffle-poster-north-q2-2026.jpg',
  },
  {
    key: 'south',
    title: 'DW South',
    subtitle: 'Quarterly Report Raffle Drawing',
    src: '/videos/raffle-south-q2-2026.mp4',
    poster: '/videos/raffle-poster-south-q2-2026.jpg',
  },
];
// ─────────────────────────────────────────────────────────────────────────

export default function RaffleWinners() {
  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', flexDirection: 'column' }}>

      {/* ─── Hero banner ─── */}
      <div
        style={{
          background: 'radial-gradient(ellipse at 50% 120%, #12315c 0%, #0a1c3a 55%, #060f20 100%)',
          padding: '2.5rem 1.5rem 2.75rem',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* subtle gold rays */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'conic-gradient(from 0deg at 50% 130%, transparent 0deg, rgba(242,183,34,0.07) 8deg, transparent 16deg, transparent 24deg, rgba(242,183,34,0.07) 32deg, transparent 40deg, transparent 48deg, rgba(242,183,34,0.07) 56deg, transparent 64deg, transparent 72deg, rgba(242,183,34,0.07) 80deg, transparent 88deg, transparent 96deg, rgba(242,183,34,0.07) 104deg, transparent 112deg, transparent 120deg, rgba(242,183,34,0.07) 128deg, transparent 136deg, transparent 144deg, rgba(242,183,34,0.07) 152deg, transparent 160deg, transparent 168deg, rgba(242,183,34,0.07) 176deg, transparent 184deg)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', maxWidth: 900, margin: '0 auto' }}>
          <div style={{ width: 130, margin: '0 auto 1rem' }}>
            <Image
              src="/images/logo.png"
              alt="Degler Whiting Logo"
              width={130}
              height={131}
              style={{ width: '100%', height: 'auto', filter: 'drop-shadow(0 0 18px rgba(255,230,160,0.45))' }}
              priority
            />
          </div>

          <div
            style={{
              fontSize: '0.85rem',
              fontWeight: 700,
              letterSpacing: '0.25em',
              color: '#ffe08a',
              marginBottom: '0.5rem',
              textTransform: 'uppercase',
            }}
          >
            Degler Whiting Presents
          </div>

          <h1
            style={{
              fontSize: 'clamp(1.6rem, 4.5vw, 2.6rem)',
              fontWeight: 800,
              color: 'white',
              margin: '0 0 1rem',
              lineHeight: 1.15,
              textShadow: '0 2px 12px rgba(0,0,0,0.5)',
            }}
          >
            Quarterly Report Raffle{' '}
            <span
              style={{
                background: 'linear-gradient(180deg, #fff3c4 0%, #ffd34d 40%, #e8a812 75%, #ffdf7e 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Winners
            </span>
          </h1>

          <span
            style={{
              display: 'inline-block',
              background: '#a6193c',
              border: '2px solid #f2b722',
              color: 'white',
              fontWeight: 700,
              fontSize: '0.95rem',
              letterSpacing: '0.12em',
              borderRadius: 999,
              padding: '0.45rem 1.4rem',
              boxShadow: '0 3px 10px rgba(0,0,0,0.35)',
            }}
          >
            {QUARTER_LABEL}
          </span>
        </div>
      </div>

      {/* ─── Videos ─── */}
      <div style={{ flex: 1, width: '100%', maxWidth: 1100, margin: '0 auto', padding: '2.25rem 1.5rem 3rem' }}>
        <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '1rem', margin: '0 0 2rem' }}>
          Watch the live drawings below — congratulations to this quarter&apos;s winners, and thank you to
          everyone who submitted reports!
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
            gap: '1.75rem',
          }}
        >
          {DRAWINGS.map((d) => (
            <div
              key={d.key}
              style={{
                background: 'white',
                border: '1px solid #e5e7eb',
                borderTop: '5px solid #f2b722',
                borderRadius: 12,
                boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ padding: '1.1rem 1.25rem 0.9rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: '#00457c' }}>{d.title}</h2>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.88rem', color: '#6b7280' }}>{d.subtitle}</p>
              </div>
              <div style={{ background: '#060f20' }}>
                <video
                  controls
                  preload="metadata"
                  playsInline
                  poster={d.poster}
                  style={{ display: 'block', width: '100%', aspectRatio: '16 / 9' }}
                >
                  <source src={d.src} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
            </div>
          ))}
        </div>

        {/* ─── Back link ─── */}
        <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
          <Link
            href="/"
            style={{
              display: 'inline-block',
              padding: '0.65rem 1.5rem',
              border: '2px solid #e5e7eb',
              borderRadius: 8,
              textDecoration: 'none',
              color: '#374151',
              fontWeight: 600,
              fontSize: '0.95rem',
              background: 'white',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            ← Back to Reports Home
          </Link>
        </div>
      </div>
    </div>
  );
}
