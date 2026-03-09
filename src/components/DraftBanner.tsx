'use client';

interface DraftBannerProps {
  draftRestored: boolean;
  draftTimestamp: string | null;
  lastSaveTime: string | null;
  onDismiss: () => void;
  onClear: () => void;
}

/**
 * Shows a banner when a draft has been restored, plus a subtle auto-save indicator.
 */
export function DraftBanner({ draftRestored, draftTimestamp, lastSaveTime, onDismiss, onClear }: DraftBannerProps) {
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  return (
    <>
      {/* Draft Restored Banner */}
      {draftRestored && draftTimestamp && (
        <div
          style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '0.5rem',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
            <span style={{ fontSize: '1.1rem' }}>📝</span>
            <span>
              <strong>Draft restored</strong> from {formatTime(draftTimestamp)}.
              {' '}Photos and signatures need to be re-attached.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={onDismiss}
              style={{
                padding: '0.25rem 0.75rem',
                fontSize: '0.8rem',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
              }}
            >
              Got it
            </button>
            <button
              type="button"
              onClick={onClear}
              style={{
                padding: '0.25rem 0.75rem',
                fontSize: '0.8rem',
                background: 'white',
                color: '#6b7280',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                cursor: 'pointer',
              }}
            >
              Clear draft
            </button>
          </div>
        </div>
      )}

      {/* Subtle auto-save indicator */}
      {lastSaveTime && !draftRestored && (
        <div
          style={{
            textAlign: 'right',
            fontSize: '0.75rem',
            color: '#9ca3af',
            marginBottom: '0.5rem',
            marginTop: '-0.25rem',
          }}
        >
          Draft saved {formatTime(lastSaveTime)}
        </div>
      )}
    </>
  );
}
