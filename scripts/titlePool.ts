/**
 * Shared title pool for puzzle generation scripts.
 *
 * Titles are divided into four tiers that match puzzle difficulty:
 *   Tier 1 (Initiate, Scholar)      — mundane maritime, real-sounding
 *   Tier 2 (Occultist, High Priest) — maritime unease, something is wrong
 *   Tier 3 (Eldritch, Harbinger)    — supernatural Lovecraftian horror
 *   Tier 4 (Archon)                 — cosmic horror, incomprehensible
 *
 * PUZZLE_TITLES is the flat union of all tiers, used for deduplication
 * checks across the whole puzzle file (backward-compatible).
 */

import type { Difficulty } from '../engine/boardTypes';

// ---------------------------------------------------------------------------
// Tier 1 — mundane maritime (Initiate, Scholar)
// ---------------------------------------------------------------------------

const TIER_1: string[] = [
  'Low Tide',
  'Dead Reckoning',
  'The Grey Shoals',
  'Night Watch',
  'Bearings',
  'Drift',
  'The Missing Pilot',
  'Chart of the Outer Banks',
  'The Lighthouse at Dusk',
  'Fog on the Meridian',
  'The Harbour Master\'s Log',
  'An Unmarked Reef',
  'The Old Signal Tower',
  'Wreck of the Pale Sands',
  'The Cartographer\'s First Chart',
  'Where the Tide Turns',
  'Keeper of the Eastern Light',
  'The Old Harbour Chart',
  'Before the Storm',
  'The Glass-Still Bay',
  'The Outer Shoals',
  'A Mariner\'s Doubt',
  'The Quiet Coast',
  'The Navigation Error',
  'The Iron Coast',
  'Soundings',
  'The Lost Buoy',
  'The Harbour at Dusk',
  'The Warden\'s Notes',
  'Reckoning',
];

// ---------------------------------------------------------------------------
// Tier 2 — maritime unease (Occultist, High Priest)
// ---------------------------------------------------------------------------

const TIER_2: string[] = [
  'The Chart That Changes',
  'Whispers in the Signal Room',
  'The Keeper Who Stayed',
  'Stars That Should Not Set',
  'The Light That Answers Back',
  'What the Tide Left',
  'The Cartographer\'s Last Entry',
  'A Course Through Strange Waters',
  'The Lighthouse With No Door',
  'The Chart Below the Chart',
  'The Tide Came In Twice',
  'Letters from the Outer Station',
  'The Warden Who Listened',
  'Voices in the Fog',
  'The Reef That Moved',
  'Currents That Pull Inward',
  'The Drowned Bell',
  'The Unanswered Signal',
  'A Knock from Below the Hull',
  'The Light Goes Out',
  'The Wrong Shore',
  'The Warden\'s Last Entry',
  'Something in the Deep Channel',
  'The Tide That Did Not Ebb',
  'The Compass That Wanders',
  'The Other Lighthouse',
  'Three Bells, No Watch',
  'The Log That Writes Itself',
  'The Shoal That Wasn\'t There',
  'Dead Water',
  'The Signal That Repeats',
  'The Log\'s Final Page',
  'Where the Current Bends',
  'The Keeper\'s Private Chart',
  'Another Ship in the Harbour',
  'The Tide Came Early',
  'The Fog That Followed',
  'The Returning Wave',
  'Something Answers the Fog Horn',
  'The Cartographer\'s Error',
  'The Harbour That Moved',
  'A Note Found in the Lighthouse',
  'The Sound Beneath the Keel',
  'The Map Has New Edges',
  'What Washed Ashore',
  'The Bell Still Rings',
  'The Chart That Adds Itself',
  'The Keeper Did Not Come Down',
  'The Fog Came from Below',
  'A Current With No Wind Behind It',
  'The Harbour Is Not Where It Was',
  'The Long Tide',
  'The Chart the Pilot Used',
  'Something Moves Below the Buoy',
  'The Wrong Course',
  'The Navigator\'s Private Notes',
  'The Lighthouse Blinks in Pattern',
  'A Message Left in the Tower',
  'The Storm That Stayed',
  'What the Fog Hid',
  'The Bell Below the Waterline',
  'A Chart With Too Many Coasts',
  'The Second Tide',
  'The Lighthouse Keeper\'s Confession',
  'The Strange Current',
  'An Anchor With No Ship',
  'The Pilot\'s Second Shadow',
  'The Course That Curves Back',
  'The Unmarked Wreck',
  'The Shoal With No Name',
  'The Depth Below the Depth',
  'Undertow',
  'The Warden\'s Other Log',
  'Where the Soundings End',
  'The Keeper\'s Unmarked Chart',
  'The Fog Does Not Lift',
  'The Light on the Wrong Shore',
  'The Pilot\'s Uncorrected Error',
  'High Water',
  'The Channel That Isn\'t There',
  'The Tide Answers Back',
  'The Other Log',
  'The Harbour After Dark',
  'The Last Bearing',
  'The Sounding Line Went Slack',
  'Low Water Mark',
  'What the Depth Finder Found',
];

// ---------------------------------------------------------------------------
// Tier 3 — supernatural Lovecraftian horror (Eldritch, Harbinger)
// ---------------------------------------------------------------------------

const TIER_3: string[] = [
  'The Hollowed Meridian',
  'Covenant of the Sunken Chart',
  'The Abyssal Warden',
  'Hymn of Fractured Stars',
  'The Tidal Concordat',
  'Reliquary of the Drowned Eye',
  'The Corroded Sigil',
  'Rites of the Bone Shoal',
  'The Whispering Astrolabe',
  'Congregation of the Pale Deep',
  'The Kelp Cathedral',
  'Scrolls of the Outer Flood',
  'The Unmarked Vigil',
  'Litany of the Sunken Spire',
  'The Ink-Black Compass',
  'Voices from the Abyssal Chart',
  'The Corroded Zodiac',
  'Omen of the Second Tide',
  'The Warden of Drowned Light',
  'Codex of the Hollow Shore',
  'The Pale Congregation',
  'Echoes Below the Meridian',
  'The Fractured Reliquary',
  'Rite of the Outer Dark',
  'Shards of the Forgotten Flood',
  'The Obsidian Vigil',
  'Hymn of the Corroded Gate',
  'The Second Congregation',
  'Depths of the Bone Compass',
  'Covenant of the Hollow Spire',
  'The Tidal Reliquary',
  'Scrolls of the Drowned Zodiac',
  'The Crumbling Cartography',
  'Litany of Sunken Stars',
  'The Pale Sigil',
  'Voices of the Outer Flood',
  'The Ossified Concordat',
  'Omen Below the Broken Shore',
  'The Kelp Meridian',
  'Rites of the Hollow Eye',
  'The Sunken Vigil',
  'Codex of the Abyssal Gate',
  'The Second Cartography',
  'Echoes of the Corroded Tide',
  'The Fractured Zodiac',
  'Hymn of the Bone Warden',
  'The Pale Astrolabe',
  'Congregation of Drowned Omens',
  'The Obsidian Concordat',
  'Shards of the Broken Astrolabe',
  'The Warden of Sunken Light',
  'Rite of the Seventh Tide',
  'The Corroded Vigil',
  'Echoes in the Abyssal Chart',
  'The Leviathan Meridian',
  'Codex of Drowned Stars',
  'Hymn of the Outer Dark',
  'The Unmarked Reliquary',
  'Depths of the Final Cartography',
  'The Crumbling Zodiac',
  'Voices from the Kelp Choir',
  'The Architect of Forgotten Tides',
  'The Leviathan Cartography',
  'The Vesper Codex',
  'Crown of the Sunken Concordat',
  'The Drifting Reliquary',
  'Hymn of the Last Tide',
  'The Sigil of Bone and Brine',
  'Wards of the Saltcrown',
  'The Sextant of Pale Hours',
  'Litany of the Salt Choir',
  'The Glass-Eyed Cartographer',
  'Omen of the Black Quay',
];

// ---------------------------------------------------------------------------
// Tier 4 — cosmic horror, incomprehensible (Archon)
// ---------------------------------------------------------------------------

const TIER_4: string[] = [
  'The Warden of Seven Tides',
  'The Deepwell Codex',
  'Throne of the Sunken Empire',
  'The Final Cartography',
  'Tides Beneath the Tenth Star',
  'The Ossuary of Drowned Kings',
  'Echoes of the Hundred Wards',
  'The Loom of Forgotten Tides',
  'Vault of the Pale Antiquarian',
  'The Cipher of the Ten Veils',
  'Hymnal of the Final Meridian',
  'The Compass of Drowned Saints',
  'Rite of the Seventh Spire',
  'The Cradle of Wet Stars',
  'Vigil Beneath the Tower',
  'The Tide-Warden Codex',
  'Hymn of the Sunken Choir',
  'The Anchor of Forgotten Names',
  'Litany of the Glass Tide',
  'Throne of the Salt-Eaten Crown',
  'The Lighthouse of Pale Stars',
  'Codex of the Listening Tide',
  'The Reef of Hollow Kings',
  'Concordat of the Salt-Eaten Throne',
  'The Mariner\'s Doubt',
  'Echo of the Eel-Black Door',
  'The Salt-Choked Antiphon',
  'Cartography of Drowned Bells',
  'The Tower of Brine and Bone',
  'Vigil of the Black Pelagic',
  'Hymn for the Saltless Hour',
  'The Lantern of Wet Saints',
  'Concordat of the Tenth Wave',
  'The Astrolabe of Wet Iron',
  'Litany of the Drifting Choir',
  'Codex of the Salt-Pale Vigil',
  'The Reef-Warden\'s Hymn',
  'Throne of the Hollowed Lighthouse',
  'The Compass That Lies',
  'Echoes Beneath the Tidewall',
  'Rite of the Brine-Bound Crown',
  'The Cartography of Drowned Hours',
  'Vesper of the Salt Concordat',
  'The Anchorite\'s Sigil',
  'Hymn for a Silent Buoy',
  'The Ledger of Drowned Pilots',
  'Codex of the Eel-King',
  'The Bell of Wet Wards',
  'Vigil at the Saltline',
  'The Cartwright of Drowned Stars',
  'Litany of the Lampless Coast',
  'Hymn of the Iron-Bound Reef',
  'The Mariner\'s Forgotten Map',
  'Throne of the Buried Sextant',
  'Echo of the Glass Bell',
  'The Ossuary Concordat',
  'Compass of the Pale Anchorite',
  'Codex of the Quiet Surge',
  'The Salt-Pricked Liturgy',
  'Vigil of the Hollow Tide',
  'Hymn of the Listening Reef',
  'The Sigil of Tideless Hours',
  'Litany of the Brackish Hour',
  'The Atlas of Wet Names',
  'Throne of the Saltless Crown',
  'Echo of the Iron-Bound Choir',
  'The Cartography of Brine',
  'Hymn for the Wet Lantern',
  'Codex of the Tideborn Saint',
  'The Beacon That Drowned',
  'Litany of the Saltbound Vow',
  'Throne of the Black Quay',
  'The Mariner\'s Last Page',
  'Hymn for the Listening Buoy',
  'Codex of the Pelagic Hour',
  'The Anchor of Salt-Eaten Vows',
  'Echoes of the Tideless Tower',
  'The Drifting Cartography',
  'Vigil of the Brine Concordat',
  'Litany of the Iron-Bound Tide',
  'Hymn of the Buried Lighthouse',
  'The Codex of Drowned Bells',
  'Throne of the Hollow Reef',
  'The Compass of Tideless Saints',
  'Echo of the Salt-Pale Crown',
  'The Reef of Forgotten Vows',
  'Vigil of the Eel-Black Hour',
  'Hymn for a Drowned Lantern',
  'Litany of the Tideborn Choir',
  'The Codex of Salt-Eaten Hours',
  'Throne of the Brackish Pelagic',
  'Echo of the Wet Sextant',
  'The Cartography of Wet Bells',
  'Vigil of the Saltless Buoy',
  'Hymn for the Quiet Reef',
  'Litany of the Tideless Lantern',
  'The Codex of Iron-Bound Vows',
  'Throne of the Drifting Antiphon',
  'Echo of the Brine Concordat',
  'The Compass of Hollow Saints',
  'Vigil of the Salt-Pale Reef',
  'Hymn for the Listening Tide',
];

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/** Tiered pools indexed by tier number. */
export const TITLE_TIERS: Record<1 | 2 | 3 | 4, string[]> = {
  1: TIER_1,
  2: TIER_2,
  3: TIER_3,
  4: TIER_4,
};

/**
 * Flat union of all tiers — used for whole-file deduplication checks.
 * Backward-compatible: callers that don't pass a difficulty still get
 * a valid title drawn from any tier.
 */
export const PUZZLE_TITLES: string[] = [
  ...TIER_1,
  ...TIER_2,
  ...TIER_3,
  ...TIER_4,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function difficultyTier(d: Difficulty): 1 | 2 | 3 | 4 {
  switch (d) {
    case 'Initiate':   case 'Scholar':    return 1;
    case 'Occultist':  case 'High Priest': return 2;
    case 'Eldritch':   case 'Harbinger':  return 3;
    case 'Archon':     case 'Unbound':    return 4;
  }
}

/**
 * Returns the first title in the appropriate tier pool not already in
 * the `used` set.  If `difficulty` is omitted, falls back to the full
 * flat PUZZLE_TITLES pool (backward-compatible).
 * Appends a Roman-numeral suffix once the pool is exhausted.
 */
export function nextUnusedTitle(used: Set<string>, difficulty?: Difficulty): string {
  const pool = difficulty ? TITLE_TIERS[difficultyTier(difficulty)] : PUZZLE_TITLES;
  for (const t of pool) {
    if (!used.has(t)) return t;
  }
  // Pool exhausted — append suffixes (II, III, IV…)
  for (let suffix = 2; suffix < 100; suffix++) {
    for (const t of pool) {
      const candidate = `${t} ${toRoman(suffix)}`;
      if (!used.has(candidate)) return candidate;
    }
  }
  throw new Error('Title pool exhausted beyond reasonable limits');
}

function toRoman(n: number): string {
  const map: [number, string][] = [
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let result = '';
  for (const [v, s] of map) {
    while (n >= v) { result += s; n -= v; }
  }
  return result;
}

export function existingTitles(content: string): Set<string> {
  const used = new Set<string>();
  for (const m of content.matchAll(/"title":"((?:[^"\\]|\\.)*)"/g)) {
    // Unescape any \" sequences from the JSON encoding
    used.add(m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
  }
  return used;
}
