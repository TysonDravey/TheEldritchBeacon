// Lantern icons for a completion screen — lit (brass) for earned, dim for
// not. Rating itself comes from engine/lanterns.ts (based on hints used).
// `animate` staggers an ignite pop-in, used only on a genuinely fresh win
// (see isFreshWin in the pages that render this) so revisiting an already-
// completed puzzle shows the rating plainly, with no re-triggered fanfare.
export function LanternRating({ rating, animate = false }: { rating: 1 | 2 | 3; animate?: boolean }) {
  return (
    <div className="flex items-center justify-center gap-2.5" aria-label={`${rating} of 3 lanterns`}>
      {[1, 2, 3].map(i => {
        const lit = i <= rating;
        return (
          <svg
            key={i}
            width="30" height="36" viewBox="0 0 20 24" fill="none" aria-hidden="true"
            className={animate ? 'lantern-ignite' : undefined}
            style={animate ? { animationDelay: `${(i - 1) * 180}ms` } : undefined}
          >
            <path
              d="M10 2c-2.2 2.6-3.6 4.8-3.6 7a3.6 3.6 0 0 0 7.2 0c0-2.2-1.4-4.4-3.6-7Z"
              fill={lit ? '#B5860D' : 'none'}
              stroke={lit ? '#8B1A1A' : '#3D2B1F'}
              strokeWidth="1.2"
              opacity={lit ? 1 : 0.35}
            />
            <rect x="7.2" y="10" width="5.6" height="9" rx="1" fill={lit ? '#8B1A1A' : 'none'} stroke={lit ? '#8B1A1A' : '#3D2B1F'} strokeWidth="1.2" opacity={lit ? 1 : 0.35} />
            <rect x="6" y="18.5" width="8" height="2" rx="0.5" fill={lit ? '#3D2B1F' : 'none'} stroke="#3D2B1F" strokeWidth="1" opacity={lit ? 1 : 0.35} />
          </svg>
        );
      })}
    </div>
  );
}
