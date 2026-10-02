import type { Difficulty, Puzzle } from '@/engine/boardTypes';

export const REGIONS: {
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
}[] = [
  {
    name: 'Landfall',
    difficulty: 'Initiate',
    ward: '/tiles/wards/genericward_01.png',
    description: 'Keeper Vale has gone silent. The light still turns.',
    techniques: ['Last Refuge', 'Full Row', 'Full Column', 'Touching Shadows'],
    journalPage: '/journal/page-01.jpg',
  },
  {
    name: 'The Survey',
    difficulty: 'Scholar',
    ward: '/tiles/wards/ward_seagreen_01.png',
    description: 'Marks cut above the entrance. Mason’s work, surely.',
    techniques: ['Territory Lock', 'Column Lock'],
    journalPage: '/journal/page-02.jpg',
  },
  {
    name: 'The Lower Level',
    difficulty: 'Occultist',
    ward: '/tiles/wards/ward_indigo_01.png',
    description: 'The measurements will not close. It is larger within.',
    techniques: ['Narrow Channel', 'Shared Horizon'],
    journalPage: '/journal/page-03.jpg',
  },
  {
    name: 'The Lantern Room',
    difficulty: 'High Priest',
    ward: '/tiles/wards/ward_emerald_01.png',
    description: 'Thirty-six seconds by the gears. Forty-one by the light.',
    techniques: ['Beacon Pair', 'Territory Dead-End', 'Dual Confinement'],
    journalPage: '/journal/page-04.jpg',
  },
  {
    name: 'The West Wall',
    difficulty: 'Eldritch',
    ward: '/tiles/wards/ward_storm_01.png',
    description: 'Two windows without. Three within.',
    techniques: ['Mutual Exclusion', 'Forbidden Tide', 'Territory Network'],
    journalPage: '/journal/page-05.jpg',
  },
  {
    name: 'The Keeper’s Quarters',
    difficulty: 'Harbinger',
    ward: '/tiles/wards/ward_crimson_03.png',
    description: 'The observations converge. They should not match.',
    techniques: ['Forced Territory Chain', 'Chain of Madness'],
    journalPage: '/journal/page-06.jpg',
  },
  {
    name: 'The Reply',
    difficulty: 'Archon',
    ward: '/tiles/wards/ward_ochre_01.png',
    description: 'I did not draw this. Something already knew.',
    techniques: ['Deep Current', 'Watcher Network'],
    journalPage: '/journal/page-07.jpg',
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
const MAX_REGION_BY_SIZE: Partial<Record<number, Difficulty>> = {
  5: 'Scholar',
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
