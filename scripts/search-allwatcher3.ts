/**
 * search-allwatcher3.ts
 *
 * Standalone runner for tryBuildAllWatcherThreeTilePuzzle — searches for a
 * 6x6, 3-Rift, all-watcher-type Dual Realms puzzle where NONE of the Rifts
 * become visibly non-contiguous when flipped away from home.
 *
 * Runs as its own OS process, independent of the Next.js dev server. This
 * matters: running the same search inside a Next.js route handler was
 * found to fully block the dev server (a live /progress poll hung for 2+
 * minutes while the search ran), because Node is single-threaded and the
 * search is long-running CPU work. As a separate process, the dev server
 * stays free to serve app/prototype/dual-realms/progress the whole time —
 * that page polls check/route.ts's ?progress=1 branch, which just reads
 * the /tmp/allwatcher3-*.json files this script writes.
 *
 * Usage:
 *   npx tsx scripts/search-allwatcher3.ts
 *   npx tsx scripts/search-allwatcher3.ts --shattered
 *   npx tsx scripts/search-allwatcher3.ts --size=7
 */

import { tryBuildAllWatcherThreeTilePuzzle } from '../app/prototype/dual-realms/lib/allWatcherSearch';

async function main() {
  const shattered = process.argv.includes('--shattered');
  const mode = shattered ? 'shattered-realms' : 'initiate';
  const sizeArg = process.argv.find(a => a.startsWith('--size='));
  const size = sizeArg ? Number(sizeArg.split('=')[1]) : 6;

  console.log(`Starting all-watcher 3-Rift search (size: ${size}x${size}, mode: ${mode})...`);
  const result = await tryBuildAllWatcherThreeTilePuzzle(size, mode, true);

  if (result) {
    console.log('\n=== FOUND ===');
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`\n=== NOT FOUND within budget — check /tmp/allwatcher3-${size}-nearmiss.json for the closest miss ===`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
