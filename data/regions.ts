import type { Difficulty, Puzzle, PuzzleMode } from '@/engine/boardTypes';
import { SAMPLE_PUZZLES } from '@/data/samplePuzzles';
import { hasForcedOpening } from '@/engine/difficulty';

export interface CampaignRegion {
  name: string;
  difficulty: Difficulty;
  ward: string;
  description: string;
  techniques: string[];
  // Captain Mercer's journal page unlocked on reaching this region — see
  // images/beaconjournalpages/ for the original high-res scans these were
  // resized/compressed from. Mapped to follow the journal's own escalation:
  // arrival, survey, the geometry stops making sense, blood enters, the
  // impossible window, the full realization, the quiet aftermath.
  journalPage: string;
  // CSS object-position for journalPage when shown full-bleed (campaign intro,
  // chapter-complete overlay) — each page's actual illustration sits in a
  // different part of the frame, not the center, so this anchors the crop
  // (and the journal-pan animation's oscillation) on the real subject instead
  // of generically panning around the middle. Defaults to 'center 42%'.
  journalFocus?: string;
  // Puzzle mode this region draws from — defaults to 'initiate' when absent,
  // so the five base-ruleset regions below need no changes.
  mode?: PuzzleMode;
  // When present, membership is "difficulty is one of these" instead of the
  // usual exact `campaignRegionDifficulty(puzzle) === difficulty` match.
  // Needed for regions whose nominal `difficulty` has no puzzles of its own
  // (e.g. nothing is ever solver-scored 'Harbinger') — this is checked
  // against the puzzle's RAW difficulty, deliberately bypassing
  // campaignRegionDifficulty's board-size cap below, since that cap exists
  // to preserve escalating board *size* across the initiate-only track and
  // doesn't apply to a region whose escalation signal is "the rules
  // changed," not "the board grew."
  difficultyPool?: Difficulty[];
  // Caps how many puzzles of a given board size land in this region (lowest
  // -score/easiest kept, rest dropped) — lets a region open with a handful
  // of small boards without being dominated by them.
  maxBoardCountBySize?: Partial<Record<number, number>>;
}

export const REGIONS: CampaignRegion[] = [
  {
    name: 'Landfall',
    difficulty: 'Initiate',
    ward: '/tiles/wards/genericward_01.png',
    description: 'Keeper Vale has gone silent. The light still turns.',
    techniques: ['Last Refuge', 'Full Row', 'Full Column', 'Touching Shadows'],
    journalPage: '/journal/page-01.jpg',
    journalFocus: '72% 58%', // the lighthouse sits right-of-center, lower half
    // A 5x5 board is barely a puzzle — fine as the very first level ever
    // seen, repetitive and padding-like anywhere after that. Every 5x5
    // initiate puzzle funnels here (MAX_REGION_BY_SIZE below), so without
    // this cap they dominated the region (15 of 32 puzzles).
    maxBoardCountBySize: { 5: 1 },
  },
  {
    name: 'The Survey',
    difficulty: 'Scholar',
    ward: '/tiles/wards/ward_seagreen_01.png',
    description: 'Marks cut above the entrance. Mason’s work, surely.',
    techniques: ['Territory Lock', 'Column Lock'],
    journalPage: '/journal/page-02.jpg',
    journalFocus: '64% 50%', // the tower runs full-height, right-of-center
  },
  {
    name: 'The Lower Level',
    difficulty: 'Occultist',
    ward: '/tiles/wards/ward_indigo_01.png',
    description: 'The measurements will not close. It is larger within.',
    techniques: ['Narrow Channel', 'Shared Horizon'],
    journalPage: '/journal/page-03.jpg',
    journalFocus: '60% 48%', // the spiral stair sits right-of-center
  },
  {
    name: 'The Lantern Room',
    difficulty: 'High Priest',
    ward: '/tiles/wards/ward_emerald_01.png',
    description: 'Thirty-six seconds by the gears. Forty-one by the light.',
    techniques: ['Beacon Pair', 'Territory Dead-End', 'Dual Confinement'],
    journalPage: '/journal/page-04.jpg',
    journalFocus: '56% 46%', // the blood-streaked lens sits center-right
  },
  {
    name: 'The West Wall',
    difficulty: 'Eldritch',
    ward: '/tiles/wards/ward_storm_01.png',
    description: 'Two windows without. Three within.',
    techniques: ['Mutual Exclusion', 'Forbidden Tide', 'Territory Network'],
    journalPage: '/journal/page-05.jpg',
    journalFocus: '24% 50%', // the window/doorway drawing sits on the left this time
  },
  {
    name: 'The Keeper’s Quarters',
    difficulty: 'Harbinger',
    ward: '/tiles/wards/ward_crimson_03.png',
    description: 'The observations converge. They should not match.',
    techniques: ['Forced Territory Chain', 'Chain of Madness'],
    journalPage: '/journal/page-06.jpg',
    journalFocus: '48% 40%', // busy/chaotic page — stair + lens both near center
    mode: 'shattered-realms',
    difficultyPool: ['Occultist', 'High Priest', 'Archon'],
    maxBoardCountBySize: { 5: 5 },
  },
  {
    name: 'The Reply',
    difficulty: 'Archon',
    ward: '/tiles/wards/ward_ochre_01.png',
    description: 'I did not draw this. Something already knew.',
    techniques: ['Deep Current', 'Watcher Network'],
    journalPage: '/journal/page-07.jpg',
    journalFocus: '58% 58%', // the figure at the desk sits center-right, lower half
    mode: 'twin-watchers',
  },
];

export const REGION_BY_DIFFICULTY: Record<string, typeof REGIONS[number]> = Object.fromEntries(
  REGIONS.map(r => [r.difficulty, r])
);

const DIFFICULTY_ORDER = REGIONS.map(r => r.difficulty);

// Board size alone can make a puzzle read as far easier than its
// solver-computed difficulty suggests — a 5x5 board scoring Occultist (or
// later) is still only 25 cells, and surfacing it deep into the campaign
// undercuts the sense of escalating scale regardless of how demanding its
// logic actually is. Caps which region a puzzle can be grouped into by
// board size, independent of (and without altering) its real difficulty.
// Every 5x5 initiate-mode puzzle funnels all the way down to Landfall (not
// just to Scholar) — keeps every small board as part of the easy opening
// stretch, and keeps The Survey (and every region after it) free of them.
const MAX_REGION_BY_SIZE: Partial<Record<number, Difficulty>> = {
  5: 'Initiate',
};

/** Which region's puzzle pool this puzzle should be grouped into for campaign
 *  progression — puzzle.difficulty itself (and its displayed badge) is left
 *  untouched; this only affects placement. */
export function campaignRegionDifficulty(puzzle: Puzzle): Difficulty {
  const cap = MAX_REGION_BY_SIZE[puzzle.size];
  if (!cap) return puzzle.difficulty;
  const capRank = DIFFICULTY_ORDER.indexOf(cap);
  const ownRank = DIFFICULTY_ORDER.indexOf(puzzle.difficulty);
  // -1 means the difficulty (e.g. Unbound) isn't one of the campaign's own
  // sequential regions at all — leave those alone rather than guess.
  if (ownRank === -1 || capRank === -1 || ownRank <= capRank) return puzzle.difficulty;
  return cap;
}

/** Does this puzzle belong to this campaign region? The one place mode +
 *  difficulty(-pool) membership logic lives — every call site that needs to
 *  group campaign puzzles by region should call this (or one of the helpers
 *  below) instead of inlining its own mode/difficulty check. */
export function puzzleBelongsToRegion(puzzle: Puzzle, region: CampaignRegion): boolean {
  if (puzzle.mode !== (region.mode ?? 'initiate')) return false;
  if (region.difficultyPool) return region.difficultyPool.includes(puzzle.difficulty);
  return campaignRegionDifficulty(puzzle) === region.difficulty;
}

/** Which single region (if any) this puzzle belongs to. Returns null for a
 *  puzzle that isn't part of any campaign region (e.g. a standalone
 *  Advanced-Modes puzzle whose difficulty isn't in a difficultyPool). */
export function findRegionForPuzzle(puzzle: Puzzle): CampaignRegion | null {
  return REGIONS.find(r => puzzleBelongsToRegion(puzzle, r)) ?? null;
}

/** All puzzles backing this region, from the given pool. Applies
 *  maxBoardCountBySize (lowest-score/easiest kept per size) when the region
 *  declares it. */
export function getRegionPuzzles(region: CampaignRegion, allPuzzles: Puzzle[] = SAMPLE_PUZZLES): Puzzle[] {
  const matches = allPuzzles.filter(p => puzzleBelongsToRegion(p, region));
  const cap = region.maxBoardCountBySize;
  if (!cap) return matches;
  const bySize = new Map<number, Puzzle[]>();
  for (const p of matches) {
    if (!bySize.has(p.size)) bySize.set(p.size, []);
    bySize.get(p.size)!.push(p);
  }
  const result: Puzzle[] = [];
  for (const [size, puzzles] of bySize) {
    const limit = cap[size];
    if (limit == null) { result.push(...puzzles); continue; }
    result.push(...[...puzzles].sort((a, b) => a.score - b.score).slice(0, limit));
  }
  return result;
}

/** Centralized "next puzzle" ordering so every surface (campaign map, the
 *  puzzle header's next-puzzle memo, the home page's Advanced Modes lists)
 *  stays in sync. For twin-watchers, puzzles with a guaranteed easy opening
 *  move (engine/difficulty.ts's hasForcedOpening) come first regardless of
 *  raw score — score alone doesn't know whether the first move is a fair
 *  one, and nearly every twin puzzle ends up Archon-or-harder overall
 *  anyway, so sorting by score alone buried easier-opening puzzles behind
 *  harder-opening ones with a coincidentally lower total score. */
export function sortPuzzlesForRegion(puzzles: Puzzle[], mode: PuzzleMode): Puzzle[] {
  return [...puzzles].sort((a, b) =>
    mode === 'twin-watchers'
      ? Number(hasForcedOpening(b)) - Number(hasForcedOpening(a)) || a.score - b.score
      : a.score - b.score
  );
}
