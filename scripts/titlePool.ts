/**
 * Shared title pool for puzzle generation scripts.
 *
 * All three generators (generateBatch, generateHard, generate10x10) pull from
 * this list and call nextUnusedTitle() to avoid the legacy bug where each
 * size's idNum=6 picked the 6th title regardless — producing duplicates like
 * "Reliquary of the Drowned Eye" across eb-5x5-006, eb-6x6-006, eb-7x7-006…
 */

export const PUZZLE_TITLES: string[] = [
  // Original generateBatch pool
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
  'The Leviathan Cartography',
  'Shards of the Forgotten Flood',
  'The Obsidian Vigil',
  'Hymn of the Corroded Gate',
  'The Second Congregation',
  'Depths of the Bone Compass',
  'The Warden of Seven Tides',
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
  // generateHard's earlier set
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
  // generate10x10's earlier set
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
  // Newly added — enough headroom for many more puzzles
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
  'The Mariner’s Doubt',
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
  'The Reef-Warden’s Hymn',
  'Throne of the Hollowed Lighthouse',
  'The Compass That Lies',
  'Echoes Beneath the Tidewall',
  'Rite of the Brine-Bound Crown',
  'The Cartography of Drowned Hours',
  'Vesper of the Salt Concordat',
  'The Anchorite’s Sigil',
  'Hymn for a Silent Buoy',
  'The Ledger of Drowned Pilots',
  'Codex of the Eel-King',
  'The Bell of Wet Wards',
  'Vigil at the Saltline',
  'The Cartwright of Drowned Stars',
  'Litany of the Lampless Coast',
  'Hymn of the Iron-Bound Reef',
  'The Mariner’s Forgotten Map',
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
  'The Mariner’s Last Page',
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

/**
 * Returns the first title in the pool not already in the `used` set.
 * Adds a Roman-numeral suffix once the pool is exhausted.
 */
export function nextUnusedTitle(used: Set<string>): string {
  for (const t of PUZZLE_TITLES) {
    if (!used.has(t)) return t;
  }
  // Pool exhausted — append suffixes (II, III, IV...)
  for (let suffix = 2; suffix < 100; suffix++) {
    for (const t of PUZZLE_TITLES) {
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
