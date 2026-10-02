import { scorePuzzle } from '@/engine/difficulty';
import type { Puzzle } from '@/engine/boardTypes';

const SCORE_CACHE_KEY = 'eb_puzzle_score_cache_v1';

function loadScoreCache(): Record<string, number> {
  try {
    const raw = localStorage.getItem(SCORE_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

// scorePuzzle() runs a full solver — cheap for most puzzles, but a few are
// pathologically slow (one measured on-device taking several seconds on its
// own; the same handful that made the mobile build's static export start
// timing out — see next.config.ts's staticPageGenerationTimeout comment).
// Scoring any real list of puzzles — eagerly, all at once, at module load —
// reliably reproduced a multi-second main-thread hang blocking first paint.
// Processing a couple at a time and rescheduling each step via
// requestAnimationFrame (not setTimeout — that didn't actually guarantee a
// paint happened between chunks, confirmed on-device) keeps every individual
// chunk short enough that rendering can interleave between them. Results are
// cached in localStorage so this only ever runs once per puzzle per device.
const CHUNK_SIZE = 2;

export function computeScoresChunked(
  puzzles: Puzzle[],
  onDone: (scores: Map<string, number>) => void,
): () => void {
  const cache = loadScoreCache();
  if (puzzles.every(p => cache[p.id] != null)) {
    onDone(new Map(puzzles.map(p => [p.id, cache[p.id]])));
    return () => {};
  }

  const scores = new Map<string, number>();
  const nextCache = { ...cache };
  let i = 0;
  let cancelled = false;
  let handle: number | null = null;

  function step() {
    const end = Math.min(i + CHUNK_SIZE, puzzles.length);
    for (; i < end; i++) {
      const p = puzzles[i];
      const s = cache[p.id] ?? scorePuzzle(p);
      scores.set(p.id, s);
      nextCache[p.id] = s;
    }
    if (cancelled) return;
    if (i < puzzles.length) {
      handle = requestAnimationFrame(step);
    } else {
      onDone(scores);
      try { localStorage.setItem(SCORE_CACHE_KEY, JSON.stringify(nextCache)); } catch { /* best-effort */ }
    }
  }

  handle = requestAnimationFrame(step);
  return () => { cancelled = true; if (handle != null) cancelAnimationFrame(handle); };
}
