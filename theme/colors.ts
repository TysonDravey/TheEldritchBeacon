export const TERRITORY_NAMES = [
  'Crimson', 'Ochre', 'Sea Green', 'Bone', 'Storm Grey',
  'Faded Indigo', 'Emerald', 'Violet', 'Copper', 'Rose'
] as const;

export type TerritoryName = typeof TERRITORY_NAMES[number];

// Muted, parchment-friendly colors — NOT bright candy colors
export const TERRITORY_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  0: { bg: '#C9736B', border: '#8B3A3A', text: '#fff' },        // Crimson
  1: { bg: '#C9A85C', border: '#7A6030', text: '#1A1209' },     // Ochre
  2: { bg: '#6B9E8E', border: '#3A6B5E', text: '#fff' },        // Sea Green
  3: { bg: '#D4C9A8', border: '#8B7D5A', text: '#1A1209' },     // Bone
  4: { bg: '#9BA4AF', border: '#4A525C', text: '#fff' },        // Storm Grey
  5: { bg: '#7B8EC4', border: '#3A4E8B', text: '#fff' },        // Faded Indigo
  6: { bg: '#5E9E6B', border: '#2E5E38', text: '#fff' },        // Emerald
  7: { bg: '#9B7BB8', border: '#5A3A7A', text: '#fff' },        // Violet
  8: { bg: '#B87333', border: '#7A4A1A', text: '#fff' },        // Copper
  9: { bg: '#C98B9E', border: '#7A3A52', text: '#fff' },        // Rose
};

// SVG watcher filenames per territory index
export const WATCHER_SVGS: Record<number, string> = {
  0: '/svg/watcher_crimson.svg',
  1: '/svg/watcher_ochre.svg',
  2: '/svg/watcher_sea_green.svg',
  3: '/svg/watcher_bone.svg',
  4: '/svg/watcher_storm_grey.svg',
  5: '/svg/watcher_faded_indigo.svg',
  6: '/svg/watcher_emerald.svg',
  7: '/svg/watcher_violet.svg',
  8: '/svg/watcher_copper.svg',
  9: '/svg/watcher_rose.svg',
};

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
