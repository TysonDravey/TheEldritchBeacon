import type { Difficulty, Puzzle } from '@/engine/boardTypes';

export const REGIONS: {
  name: string;
  difficulty: Difficulty;
  ward: string;
  description: string;
  techniques: string[];
}[] = [
  {
    name: 'The Foundations',
    difficulty: 'Initiate',
    ward: '/tiles/wards/genericward_01.png',
    description: 'The base of the Beacon. Light still reaches here.',
    techniques: ['Last Refuge', 'Full Row', 'Full Column', 'Touching Shadows'],
  },
  {
    name: 'The Shore',
    difficulty: 'Scholar',
    ward: '/tiles/wards/ward_seagreen_01.png',
    description: 'Salt and stone. The tide carries strange things.',
    techniques: ['Territory Lock', 'Column Lock'],
  },
  {
    name: 'The Fog',
    difficulty: 'Occultist',
    ward: '/tiles/wards/ward_indigo_01.png',
    description: 'Visibility narrows. Shapes move in the grey.',
    techniques: ['Narrow Channel', 'Shared Horizon'],
  },
  {
    name: 'The Reefs',
    difficulty: 'High Priest',
    ward: '/tiles/wards/ward_emerald_01.png',
    description: 'Hidden dangers below the surface. Proceed carefully.',
    techniques: ['Beacon Pair', 'Territory Dead-End', 'Dual Confinement'],
  },
  {
    name: 'Deep Water',
    difficulty: 'Eldritch',
    ward: '/tiles/wards/ward_storm_01.png',
    description: 'No light reaches here. Something watches from below.',
    techniques: ['Mutual Exclusion', 'Forbidden Tide', 'Territory Network'],
  },
  {
    name: 'The Black Tide',
    difficulty: 'Harbinger',
    ward: '/tiles/wards/ward_crimson_03.png',
    description: 'The water has turned. The rules have not.',
    techniques: ['Forced Territory Chain', 'Chain of Madness'],
  },
  {
    name: 'The Lantern Room',
    difficulty: 'Archon',
    ward: '/tiles/wards/ward_ochre_01.png',
    description: 'The top of the Beacon. Whatever keeps the light burning lives here.',
    techniques: ['Deep Current', 'Watcher Network'],
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
