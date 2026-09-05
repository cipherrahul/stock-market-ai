'use client';

import React, { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App runtime error:', error);
  }, [error]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f6fb', padding: '1.5rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '2rem', maxWidth: '460px', width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', textAlign: 'center' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fee2e2', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', margin: '0 auto 1rem' }}>
          ⚠️
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem' }}>Application Error</h2>
        <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
          {error.message || 'An unexpected error occurred in the workspace interface.'}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button
            onClick={() => reset()}
            style={{
              padding: '0.625rem 1.25rem',
              borderRadius: '10px',
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
          <a
            href="/dashboard"
            style={{
              padding: '0.625rem 1.25rem',
              borderRadius: '10px',
              background: '#f1f5f9',
              color: '#334155',
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.875rem',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
