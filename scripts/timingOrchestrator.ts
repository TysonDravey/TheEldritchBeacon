/**
 * timingOrchestrator.ts
 *
 * Drives timingBatchWorker.ts in small batches, each as its own child
 * process with a hard wall-clock timeout. A `sample`-confirmed pathological
 * puzzle (real, continuous computation — not a hang — but slow enough to
 * stall an overnight run) can now only ever cost one batch (lost, logged,
 * skipped), never the whole sweep.
 *
 * Usage: npx tsx scripts/timingOrchestrator.ts
 */

import { execFileSync } from 'child_process';
import { join } from 'path';

const SIZES = [8, 9];
const TRIES_PER_SIZE = 40000;
const BATCH_SIZE = 250;
const BATCH_TIMEOUT_MS = 60000;
const BASE = 'timingbased-v1';
const WORKER = join(process.cwd(), 'scripts', 'timingBatchWorker.ts');

function ts() {
  return new Date().toISOString().slice(11, 19);
}

async function main() {
  console.log(`[${ts()}] Timing orchestrator starting. Sizes: ${SIZES.join(', ')}. Batch size ${BATCH_SIZE}, timeout ${BATCH_TIMEOUT_MS}ms/batch.`);

  for (const size of SIZES) {
    console.log(`\n[${ts()}] === ${size}x${size} ===`);
    let totalTried = 0, totalGenerated = 0, totalKept = 0, timedOutBatches = 0;

    for (let start = 0; start < TRIES_PER_SIZE; start += BATCH_SIZE) {
      try {
        const out = execFileSync('npx', ['tsx', WORKER, String(size), String(start), String(BATCH_SIZE), BASE], {
          timeout: BATCH_TIMEOUT_MS,
          encoding: 'utf-8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        for (const line of out.split('\n')) {
          if (line.startsWith('KEPT')) {
            console.log(`[${ts()}] ${line}`);
            totalKept++;
          } else if (line.startsWith('BATCH_DONE')) {
            const m = line.match(/tried=(\d+) generated=(\d+) kept=(\d+)/);
            if (m) { totalTried += +m[1]; totalGenerated += +m[2]; }
          }
        }
      } catch (err: any) {
        timedOutBatches++;
        console.log(`[${ts()}] [TIMEOUT] batch starting at seed ${start} (size ${size}) exceeded ${BATCH_TIMEOUT_MS}ms — skipped`);
        totalTried += BATCH_SIZE; // approximate; this batch's real count is unknown but bounded
      }

      if (start > 0 && start % 2000 === 0) {
        console.log(`[${ts()}] [${size}x${size}] ~tried=${totalTried} generated=${totalGenerated} kept=${totalKept} timedOutBatches=${timedOutBatches}`);
      }
    }

    console.log(`[${ts()}] === ${size}x${size} done: ~tried=${totalTried} generated=${totalGenerated} kept=${totalKept} timedOutBatches=${timedOutBatches} ===`);
  }

  console.log(`\n[${ts()}] Orchestrator complete.`);
}

main();
