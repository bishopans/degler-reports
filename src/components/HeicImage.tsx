'use client';
import { useState, useEffect } from 'react';
import { isHeicUrl, convertHeicUrlToJpeg } from '@/lib/heicSupport';

interface HeicImageProps {
  src: string;
  alt: string;
  style?: React.CSSProperties;
}

/**
 * Drop-in <img> replacement that auto-converts HEIC URLs to JPEG for display.
 * For non-HEIC URLs, renders a plain <img> with no overhead.
 */
export default function HeicImage({ src, alt, style }: HeicImageProps) {
  const [displayUrl, setDisplayUrl] = useState<string | null>(isHeicUrl(src) ? null : src);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isHeicUrl(src)) {
      setDisplayUrl(src);
      setError(false);
      return;
    }

    let cancelled = false;
    setDisplayUrl(null);
    setError(false);

    convertHeicUrlToJpeg(src).then((url) => {
      if (cancelled) return;
      if (url) {
        setDisplayUrl(url);
      } else {
        setError(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [src]);

  if (error) {
    return (
      <div
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f3f4f6',
          color: '#6b7280',
          fontSize: '0.75rem',
          textAlign: 'center',
          padding: '0.5rem',
        }}
      >
        HEIC photo — open to view
      </div>
    );
  }

  if (!displayUrl) {
    return (
      <div
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f3f4f6',
          color: '#6b7280',
          fontSize: '0.75rem',
        }}
      >
        Converting...
      </div>
    );
  }

  return <img src={displayUrl} alt={alt} style={style} />;
}
