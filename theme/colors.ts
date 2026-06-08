export const TERRITORY_NAMES = [
  'Crimson', 'Ochre', 'Sea Green', 'Bone', 'Storm Grey',
  'Faded Indigo', 'Emerald', 'Violet', 'Copper', 'Rose'
] as const;

export type TerritoryName = typeof TERRITORY_NAMES[number];

// Muted, parchment-friendly colors — NOT bright candy colors
export const TERRITORY_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  0: { bg: '#C9736B', border: '#8B3A3A', text: '#fff' },        // Crimson
  1: { bg: '#C9A85C', border: '#7A6030', text: '#1A1209' },     // Ochre
  2: { bg: '#5A8EA0', border: '#2E5C70', text: '#fff' },        // Sea Green
  3: { bg: '#D4C9A8', border: '#8B7D5A', text: '#1A1209' },     // Bone
  4: { bg: '#9BA4AF', border: '#4A525C', text: '#fff' },        // Storm Grey
  5: { bg: '#7B8EC4', border: '#3A4E8B', text: '#fff' },        // Faded Indigo
  6: { bg: '#4E7A45', border: '#2A4A22', text: '#fff' },        // Emerald
  7: { bg: '#9B7BB8', border: '#5A3A7A', text: '#fff' },        // Violet
  8: { bg: '#B87333', border: '#7A4A1A', text: '#fff' },        // Copper
  9: { bg: '#C98B9E', border: '#7A3A52', text: '#fff' },        // Rose
};

// SVG watcher filenames per territory index
export const WATCHER_SVGS: Record<number, string> = {
  0: '/tiles/watchers/watcher_red_02.png',
  1: '/tiles/watchers/watcher_ochre_01.png',
  2: '/tiles/watchers/watcher_seagreen_01.png',
  3: '/tiles/watchers/watcher_bone_01.png',
  4: '/tiles/watchers/watcher_storm_01.png',
  5: '/tiles/watchers/watcher_indigo_01.png',
  6: '/tiles/watchers/watcher_emerald_01.png',
  7: '/tiles/watchers/watcher_violet_01.png',
  8: '/tiles/watchers/watcher_copper_01.png',
  9: '/tiles/watchers/watcher_rose_01.png',
};

// Ward rune PNGs per territory index
export const WARD_PNG = '/tiles/wards/genericward_01.png';

// Territory texture pattern SVGs (for accessibility — not color-only)
export const TERRITORY_PATTERNS: Record<number, string | null> = {
  0: '/svg/territory_pattern_coral.svg',
  1: '/svg/territory_pattern_chart.svg',
  2: '/svg/territory_pattern_sea.svg',
  3: '/svg/territory_pattern_fog.svg',
  4: '/svg/territory_pattern_stone.svg',
  5: '/svg/territory_pattern_current.svg',
  6: null,
  7: null,
  8: null,
  9: null,
};
