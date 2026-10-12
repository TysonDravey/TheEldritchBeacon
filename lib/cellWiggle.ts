// Shared between PuzzleClient.tsx and app/daily/page.tsx's Auto-Ward wave
// trigger (kept in one place rather than duplicated — see memory/session
// history on that exact mistake). Same technique already used by both
// files' win-cascade sequence: a direct DOM query + classList toggle,
// double-rAF so re-adding the class actually restarts the animation even
// if it's still playing from a moment ago.
export function wiggleCell(row: number, col: number): void {
  const el = document.querySelector(`[data-cell="true"][data-row="${row}"][data-col="${col}"]`);
  if (!el) return;
  el.classList.remove('tile-wiggle');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('tile-wiggle')));
}
