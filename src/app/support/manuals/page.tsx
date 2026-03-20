'use client';
import Link from 'next/link';
import Image from 'next/image';

// Placeholder categories — will be replaced with real data once manuals are uploaded
const categories = [
  {
    name: 'Scoreboards',
    icon: '🏟️',
    description: 'LED scoreboards, controllers, and display systems',
    manualCount: 0,
  },
  {
    name: 'Shot Clocks',
    icon: '⏱️',
    description: 'Shot clock units, mounts, and controllers',
    manualCount: 0,
  },
  {
    name: 'Video Displays',
    icon: '📺',
    description: 'Video boards, processors, and media players',
    manualCount: 0,
  },
  {
    name: 'Sound Systems',
    icon: '🔊',
    description: 'Speakers, amplifiers, and PA systems',
    manualCount: 0,
  },
  {
    name: 'Timing Systems',
    icon: '⏲️',
    description: 'Game clocks, play clocks, and timing accessories',
    manualCount: 0,
  },
  {
    name: 'Other Equipment',
    icon: '🔧',
    description: 'Miscellaneous equipment and accessories',
    manualCount: 0,
  },
];

export default function ManualsPage() {
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
            <Image src="/images/logo.png" alt="DW Logo" width={50} height={50} style={{ borderRadius: 4 }} />
          </Link>
          <div>
            <h1 style={{ margin: 0, color: 'white', fontSize: '1.35rem', fontWeight: 700 }}>Installation Manuals</h1>
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

      {/* Content */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Search bar placeholder */}
        <div style={{
          marginBottom: '2rem',
          position: 'relative',
        }}>
          <input
            type="text"
            placeholder="Search manuals by equipment name, model, or keyword..."
            disabled
            style={{
              width: '100%',
              padding: '0.85rem 1rem 0.85rem 2.75rem',
              border: '2px solid #e5e7eb',
              borderRadius: 8,
              fontSize: '1rem',
              background: '#f9fafb',
              color: '#9ca3af',
              boxSizing: 'border-box',
            }}
          />
          <span style={{
            position: 'absolute',
            left: '0.85rem',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '1.1rem',
            color: '#9ca3af',
          }}>🔍</span>
        </div>

        {/* Info banner */}
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 8,
          padding: '1rem 1.25rem',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.75rem',
        }}>
          <span style={{ fontSize: '1.25rem', flexShrink: 0, marginTop: 1 }}>ℹ️</span>
          <div>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#1e40af', fontWeight: 600 }}>Manual Library Coming Soon</p>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#3b82f6' }}>
              Equipment categories are shown below. Installation manuals, wiring diagrams, and quick-start guides will be added here for easy field access.
            </p>
          </div>
        </div>

        {/* Equipment Categories Grid */}
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#00457c', marginBottom: '1rem' }}>
          Browse by Equipment
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1rem',
        }} className="manuals-grid">
          {categories.map((cat) => (
            <div
              key={cat.name}
              style={{
                border: '2px solid #e5e7eb',
                borderRadius: 8,
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                opacity: cat.manualCount === 0 ? 0.6 : 1,
                cursor: cat.manualCount === 0 ? 'default' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{cat.icon}</span>
              <span style={{ fontSize: '1rem', fontWeight: 600, color: '#111', marginBottom: '0.25rem' }}>{cat.name}</span>
              <span style={{ fontSize: '0.8rem', color: '#6b7280', lineHeight: 1.4 }}>{cat.description}</span>
              <span style={{
                marginTop: '0.75rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.2rem 0.6rem',
                borderRadius: 12,
                background: cat.manualCount > 0 ? '#dcfce7' : '#f3f4f6',
                color: cat.manualCount > 0 ? '#166534' : '#9ca3af',
              }}>
                {cat.manualCount > 0 ? `${cat.manualCount} manual${cat.manualCount !== 1 ? 's' : ''}` : 'No manuals yet'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
