export default function BuildBadge() {
  const version = process.env.NEXT_PUBLIC_BUILD_VERSION ?? '?';
  const sha = process.env.NEXT_PUBLIC_BUILD_SHA ?? '?';

  return (
    <div
      title={`commit ${sha}`}
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top) + 4px)',
        right: 'calc(env(safe-area-inset-right) + 6px)',
        zIndex: 9999,
        pointerEvents: 'none',
        fontFamily: 'Georgia, serif',
        fontSize: 10,
        letterSpacing: '0.03em',
        color: 'rgba(242,233,216,0.55)',
        background: 'rgba(26,18,9,0.35)',
        padding: '1px 6px',
        borderRadius: 4,
      }}
    >
      v{version}
    </div>
  );
}
