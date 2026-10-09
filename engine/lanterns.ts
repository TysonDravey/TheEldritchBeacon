import type { Difficulty, PuzzleMode } from './boardTypes';

// Lantern rating: how cleanly a puzzle was solved, based on hints that
// actually gave forward progress (HintResult.costsLantern) — see
// PlayerState.hintsUsed, which only counts those.
//
// Shattered Realms (SR) and Twin Watchers (DW) keep the original flat curve
// below — it was retuned against a real sample of 14 Daily Beacon
// completions (hints 0-14, mostly Archon/Unbound on 6x6-8x8 boards), which
// is exactly that difficulty band, so it still fits there.
//
// The base campaign (mode: 'initiate') is comparatively easy, especially in
// its early regions, so reusing that same curve there let a trivial
// Landfall/Survey puzzle earn full marks even after needing a hint. Tiered
// by difficulty instead — which tracks region 1:1 in the base campaign
// (Landfall=Initiate, Survey=Scholar, Lower Level=Occultist, Lantern
// Room=High Priest, West Wall=Eldritch) — so the easiest tiers drop out of
// the top rating the moment ANY hint is used, and the curve only loosens
// back toward the SR/DW shape at West Wall, the campaign's own ceiling.
export function getLanternRating(hintsUsed: number, mode: PuzzleMode, difficulty: Difficulty): 1 | 2 | 3 {
  if (mode === 'shattered-realms' || mode === 'twin-watchers') {
    if (hintsUsed <= 1) return 3;
    if (hintsUsed <= 5) return 2;
    return 1;
  }

  switch (difficulty) {
    case 'Initiate':
    case 'Scholar':
      if (hintsUsed === 0) return 3;
      if (hintsUsed === 1) return 2;
      return 1;
    case 'Occultist':
    case 'High Priest':
      if (hintsUsed === 0) return 3;
      if (hintsUsed <= 2) return 2;
      return 1;
    default: // Eldritch, plus the handful of orphaned Archon/Unbound initiate-mode puzzles
      if (hintsUsed <= 1) return 3;
      if (hintsUsed <= 4) return 2;
      return 1;
  }
}
