// Lantern rating: how cleanly a puzzle was solved, based on hints that
// actually gave forward progress (HintResult.costsLantern) — see
// PlayerState.hintsUsed, which only counts those. Thresholds are a first
// guess, not tuned against real usage data yet.
export function getLanternRating(hintsUsed: number): 1 | 2 | 3 {
  if (hintsUsed === 0) return 3;
  if (hintsUsed <= 2) return 2;
  return 1;
}
