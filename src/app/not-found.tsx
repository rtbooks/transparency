import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Page Not Found</h2>
      <p style={{ color: '#666', marginTop: '0.5rem' }}>
        The page you are looking for does not exist.
      </p>
      <Link
        href="/"
        style={{
          display: 'inline-block',
          marginTop: '1rem',
          padding: '0.5rem 1rem',
          borderRadius: '0.375rem',
          border: '1px solid #ccc',
          textDecoration: 'none',
          color: 'inherit',
        }}
      >
        Go Home
      </Link>
    </div>
  );
}
