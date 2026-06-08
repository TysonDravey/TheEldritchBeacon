export interface TechniqueEntry {
  name: string;
  description: string;
  flavour: string;  // in-world voice
}

export const TECHNIQUES: Record<string, TechniqueEntry> = {
  'Last Refuge': {
    name: 'Last Refuge',
    description: 'When a territory has only one remaining cell where its Watcher can stand, the Watcher must be placed there.',
    flavour: 'When all other shelters are taken, there is only one place left to hide.',
  },
  'Full Row': {
    name: 'Full Row',
    description: 'A row that already contains a Watcher is claimed. No second Watcher may occupy any cell in that row.',
    flavour: 'A Watcher\'s gaze extends across the entire horizon. None may stand in the same line of sight.',
  },
  'Full Column': {
    name: 'Full Column',
    description: 'A column that already contains a Watcher is claimed. No second Watcher may occupy any cell in that column.',
    flavour: 'From shore to sky, a single column of vigil. The watch is set.',
  },
  'Touching Shadows': {
    name: 'Touching Shadows',
    description: 'Watchers cannot stand adjacent to one another — not even diagonally. Their shadows overlap and drive each other out.',
    flavour: 'Two Watchers in proximity would observe each other. This is forbidden.',
  },
  'Territory Lock': {
    name: 'Territory Lock',
    description: 'When all of a territory\'s candidates fall within a single row, that row is locked for that territory. No other Watcher may claim it.',
    flavour: 'When a territory is confined to one horizon, that horizon belongs to it alone.',
  },
  'Column Lock': {
    name: 'Column Lock',
    description: 'When all of a territory\'s candidates fall within a single column, that column is locked. No other Watcher may claim it.',
    flavour: 'A territory pressed into a single channel holds that channel against all others.',
  },
  'Shared Horizon': {
    name: 'Shared Horizon',
    description: 'When several territories together can only place Watchers within the same set of rows or columns, those rows or columns are unavailable to all other territories.',
    flavour: 'When many are confined to few spaces, the few spaces belong to the many.',
  },
  'Dual Confinement': {
    name: 'Dual Confinement',
    description: 'When a territory\'s candidates span only one row and one column simultaneously, the cell at their intersection is a forced Watcher placement.',
    flavour: 'Caught between a single row and a single column, there is only one point of escape.',
  },
  'Territory Dead-End': {
    name: 'Territory Dead-End',
    description: 'Placing a Watcher in a cell would immediately leave another territory with no valid placements. The cell is forbidden.',
    flavour: 'Some choices do not merely fail — they doom what comes after.',
  },
  'Forbidden Tide': {
    name: 'Forbidden Tide',
    description: 'A candidate appears legal, but following its consequences reveals an unavoidable contradiction. The candidate is eliminated.',
    flavour: 'Not every path that opens leads somewhere. Some lead to doors that cannot be undone.',
  },
  'Forced Territory Chain': {
    name: 'Forced Territory Chain',
    description: 'A placement triggers a cascade of forced deductions that ends in contradiction. The chain passes through multiple territories before failing.',
    flavour: 'One stone placed wrongly. Then another, and another — each forced by the last. The Beacon does not forgive long mistakes.',
  },
  'Hidden Set': {
    name: 'Hidden Set',
    description: 'A set of territories that together can only fit in a limited group of rows or columns — the inverse of Shared Horizon.',
    flavour: 'Sometimes the pattern hides in what is not said.',
  },
};

const DISCOVERED_KEY = 'eldritch_beacon_discovered_techniques';

export function getDiscoveredTechniques(): Set<string> {
  try {
    const raw = localStorage.getItem(DISCOVERED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

export function markTechniqueDiscovered(name: string): void {
  try {
    const existing = getDiscoveredTechniques();
    existing.add(name);
    localStorage.setItem(DISCOVERED_KEY, JSON.stringify([...existing]));
  } catch { /* storage unavailable */ }
}

export function isTechniqueNew(name: string): boolean {
  return !getDiscoveredTechniques().has(name);
}
