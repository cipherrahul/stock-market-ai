import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '1.5rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '2rem', maxWidth: '460px', width: '100%', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 0.5rem' }}>404 - Page Not Found</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0 0 1.5rem', lineHeight: 1.5 }}>
          The page you are looking for does not exist in the trading workspace.
        </p>
        <Link
          href="/dashboard"
          style={{
            display: 'inline-block',
            padding: '0.625rem 1.25rem',
            borderRadius: '10px',
            background: 'var(--primary)',
            color: '#ffffff',
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: '0.875rem',
          }}
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
