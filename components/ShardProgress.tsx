'use client';

// Streak celebration: 7 lens shards, one revealed per consecutive daily
// completion. On the 7th, they assemble into a complete lens that lights up
// — then a fresh set of 7 starts the next day, so the reward repeats for as
// long as the streak holds rather than being a one-time thing.
//
// Placeholder geometry (diamond shards, a radial "lens" glyph) stands in
// for the real artwork the user is providing separately — swap the two
// render branches below for actual <img>s once those land; the cadence
// logic (derived straight from streak.count, no new storage) doesn't change.
const SHARD_COUNT = 7;

export function ShardProgress({ streakCount, animate = false }: { streakCount: number; animate?: boolean }) {
  if (streakCount <= 0) return null;

  const collected = ((streakCount - 1) % SHARD_COUNT) + 1;
  const lensComplete = collected === SHARD_COUNT;

  if (lensComplete) {
    return (
      <div className="flex flex-col items-center gap-1 mt-2">
        <svg
          width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true"
          className={animate ? 'lens-complete-pop' : undefined}
        >
          <circle cx="28" cy="28" r="22" fill="#B5860D" opacity="0.22" />
          <circle cx="28" cy="28" r="15" fill="#B5860D" stroke="#8B1A1A" strokeWidth="2" />
          {Array.from({ length: SHARD_COUNT }, (_, i) => {
            const angle = (i / SHARD_COUNT) * Math.PI * 2 - Math.PI / 2;
            const x1 = 28 + Math.cos(angle) * 15, y1 = 28 + Math.sin(angle) * 15;
            const x2 = 28 + Math.cos(angle) * 22, y2 = 28 + Math.sin(angle) * 22;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3D2B1F" strokeWidth="1" opacity="0.5" />;
          })}
        </svg>
        <p className="font-lovecraftian text-sm" style={{ color: '#B5860D' }}>The Lens Is Whole</p>
        <p className="font-serif text-xs text-ink-light" style={{ opacity: 0.65 }}>{streakCount}-day streak</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1 mt-2">
      <div className="flex items-center justify-center gap-1">
        {Array.from({ length: SHARD_COUNT }, (_, i) => {
          const lit = i < collected;
          const justCollected = animate && i === collected - 1;
          return (
            <svg
              key={i} width="12" height="15" viewBox="0 0 14 16" fill="none" aria-hidden="true"
              className={justCollected ? 'shard-pop' : undefined}
            >
              <path
                d="M7 1 L13 8 L7 15 L1 8 Z"
                fill={lit ? '#B5860D' : 'none'}
                stroke={lit ? '#8B1A1A' : '#3D2B1F'}
                strokeWidth="1"
                opacity={lit ? 1 : 0.3}
              />
            </svg>
          );
        })}
      </div>
      <p className="font-serif text-xs text-ink-light" style={{ opacity: 0.65 }}>
        {streakCount}-day streak &middot; shard {collected}/{SHARD_COUNT}
      </p>
    </div>
  );
}
