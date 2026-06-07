import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div
        className="w-full max-w-lg relative select-none"
        style={{ filter: 'drop-shadow(3px 7px 3px rgba(0,0,0,0.75))' }}
      >
        <img
          src="/scrolls/scroll_01.png"
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: 'fill' }}
        />
        <div className="relative text-center" style={{ padding: '10% 16%' }}>
          <div style={{
            background: 'rgba(242,233,216,0.88)',
            padding: '14px 20px',
            borderRadius: 6,
            boxShadow: '0 0 24px 18px rgba(242,233,216,0.88)',
          }}>
            <h1 className="font-lovecraftian text-3xl text-ink leading-snug mb-2">
              The Path Is Lost
            </h1>
            <p className="font-serif text-sm text-ink italic mb-4">
              The sigil you seek has faded from the record.
            </p>
            <Link
              href="/"
              className="font-serif text-sm"
              style={{ color: '#8B1A1A', textDecoration: 'underline' }}
            >
              Return to the Beacon
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
