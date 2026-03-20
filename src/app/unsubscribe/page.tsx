'use client';
import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'already' | 'error'>('loading');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }

    fetch(`/api/digest/unsubscribe?token=${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setEmail(data.email || '');
          setStatus(data.message === 'Already unsubscribed' ? 'already' : 'success');
        } else {
          setStatus('error');
        }
      })
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-[200px] mb-6">
        <Image
          src="/images/logo.png"
          alt="Degler Whiting Logo"
          width={200}
          height={200}
          className="w-full"
          priority
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm p-8 max-w-md w-full text-center">
        {status === 'loading' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⏳</div>
            <h1 className="text-xl font-bold mb-2">Processing...</h1>
            <p className="text-gray-500">Confirming your unsubscribe request.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>✅</div>
            <h1 className="text-xl font-bold mb-2">Unsubscribed</h1>
            <p className="text-gray-500">
              <strong>{email}</strong> has been removed from the weekly digest.
            </p>
            <p className="text-gray-400 text-sm mt-4">
              You can re-subscribe anytime from the admin panel.
            </p>
          </>
        )}

        {status === 'already' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>ℹ️</div>
            <h1 className="text-xl font-bold mb-2">Already Unsubscribed</h1>
            <p className="text-gray-500">
              <strong>{email}</strong> is already unsubscribed from the weekly digest.
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>❌</div>
            <h1 className="text-xl font-bold mb-2">Invalid Link</h1>
            <p className="text-gray-500">
              This unsubscribe link is invalid or has expired. Please contact an admin.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <UnsubscribeContent />
    </Suspense>
  );
}
