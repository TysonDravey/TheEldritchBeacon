// Lantern rating: how cleanly a puzzle was solved, based on hints that
// actually gave forward progress (HintResult.costsLantern) — see
// PlayerState.hintsUsed, which only counts those. Retuned against a real
// sample of 14 Daily Beacon completions (hints 0-14, mostly Archon/Unbound
// on 6x6-8x8 boards): the original 0/1-2/3+ split put 71% of completions
// in the bottom tier. Flat thresholds, not scaled by puzzle size/difficulty.
export function getLanternRating(hintsUsed: number): 1 | 2 | 3 {
  if (hintsUsed <= 1) return 3;
  if (hintsUsed <= 5) return 2;
  return 1;
}
