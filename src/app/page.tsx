'use client';
import Link from 'next/link';
import Image from 'next/image';

export default function Home() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 1.5rem', background: 'white' }}>
      <div style={{ maxWidth: 300, width: '100%', marginBottom: '2rem' }}>
        <Image
          src="/images/logo.png"
          alt="Degler Whiting Logo"
          width={300}
          height={300}
          style={{ width: '100%', height: 'auto' }}
          priority
        />
      </div>

      {/* ─── Select a Report ─── */}
      <h1 style={{ fontSize: '1.875rem', fontWeight: 700, marginBottom: '1.5rem', textAlign: 'center' }}>Select a Report</h1>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1rem',
        maxWidth: 900,
        width: '100%',
      }} className="home-grid">
        {[
          { href: '/maintenance', label: 'Preventative Maintenance\n/Inspection' },
          { href: '/repair', label: 'Repair' },
          { href: '/material-delivery', label: 'Material Delivery' },
          { href: '/material-turnover', label: 'Material Turnover' },
          { href: '/training', label: 'Training' },
          { href: '/jobsite-progress', label: 'Job Site Progress' },
          { href: '/time-sheets', label: 'Time Sheets' },
          { href: '/accident', label: 'Accident/Incident' },
          { href: '/photo-upload', label: 'Photo Upload' },
        ].map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            style={{
              padding: '1rem 0.75rem',
              border: '2px solid #e5e7eb',
              borderRadius: 8,
              textAlign: 'center',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 60,
              textDecoration: 'none',
              color: '#111',
              fontSize: '1.05rem',
              fontWeight: 500,
              transition: 'all 0.15s',
              whiteSpace: 'pre-line',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#eff6ff'; e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.07)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)'; }}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* ─── Divider ─── */}
      <div style={{ width: '100%', maxWidth: 900, margin: '3rem 0', borderTop: '2px solid #e5e7eb' }} />

      {/* ─── Service & Install Support ─── */}
      <h2 style={{ fontSize: '1.875rem', fontWeight: 700, marginBottom: '0.75rem', textAlign: 'center', color: '#00457c' }}>
        Service & Install Support
      </h2>
      <p style={{ fontSize: '0.95rem', color: '#6b7280', marginBottom: '2rem', textAlign: 'center', maxWidth: 500 }}>
        Access installation manuals, troubleshooting guides, and AI-powered service assistance.
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '1.5rem',
        maxWidth: 620,
        width: '100%',
      }} className="support-grid">
        {/* Installation Manual Library */}
        <Link
          href="/support/manuals"
          style={{
            padding: '1.25rem 1rem',
            border: '2px solid #00457c',
            borderRadius: 8,
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,69,124,0.1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 100,
            textDecoration: 'none',
            color: '#111',
            transition: 'all 0.15s',
            background: 'white',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#eff6ff'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,69,124,0.15)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,69,124,0.1)'; }}
        >
          <span style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>📖</span>
          <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#00457c' }}>Installation Manuals</span>
          <span style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.35rem' }}>Browse guides by equipment</span>
        </Link>

        {/* Vulcan AI Assistant */}
        <Link
          href="/support/assistant"
          style={{
            padding: '1.25rem 1rem',
            border: '2px solid #00457c',
            borderRadius: 8,
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,69,124,0.1)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 100,
            textDecoration: 'none',
            color: '#111',
            transition: 'all 0.15s',
            background: 'white',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#eff6ff'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,69,124,0.15)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,69,124,0.1)'; }}
        >
          <Image src="/images/VulcanAIAvatar.png" alt="Vulcan AI" width={40} height={40} style={{ borderRadius: '50%', marginBottom: '0.35rem' }} />
          <span style={{ fontSize: '1.05rem', fontWeight: 600, color: '#00457c' }}>Vulcan AI</span>
          <span style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.35rem' }}>Degler Whiting&apos;s AI-powered field support</span>
        </Link>
      </div>

      <div style={{ height: '3rem' }} />
    </div>
  );
}
