/**
 * search-allwatcher2.ts
 *
 * Standalone runner for tryBuildAllWatcherTwoTilePuzzle — searches for a
 * 6x6, 2-Rift, all-watcher-type Dual Realms puzzle where NEITHER Rift
 * becomes visibly non-contiguous when flipped away from home. Same idea as
 * search-allwatcher3.ts but with 2 Rifts instead of 3 — only 2 independent
 * "stay clean when flipped" events need to align instead of 3, which
 * should be a meaningfully easier bar to clear.
 *
 * Usage:
 *   npx tsx scripts/search-allwatcher2.ts
 *   npx tsx scripts/search-allwatcher2.ts --shattered
 *   npx tsx scripts/search-allwatcher2.ts --size=7
 */

import { tryBuildAllWatcherTwoTilePuzzle } from '../app/prototype/dual-realms/lib/allWatcherSearch';

async function main() {
  const shattered = process.argv.includes('--shattered');
  const mode = shattered ? 'shattered-realms' : 'initiate';
  const sizeArg = process.argv.find(a => a.startsWith('--size='));
  const size = sizeArg ? Number(sizeArg.split('=')[1]) : 6;

  console.log(`Starting all-watcher 2-Rift search (size: ${size}x${size}, mode: ${mode})...`);
  const result = await tryBuildAllWatcherTwoTilePuzzle(size, mode, true);

  if (result) {
    console.log('\n=== FOUND ===');
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`\n=== NOT FOUND within budget — check /tmp/allwatcher2-${size}-nearmiss.json for the closest miss ===`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
