import type { Difficulty } from '@/engine/boardTypes';

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
