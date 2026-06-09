/**
 * buildMonthlyCalendar.ts
 *
 * Assigns Shattered Realms puzzles to calendar dates for the Daily Beacon feature.
 * Monday = easiest tier, Sunday = hardest tier (7 tiers total, by score percentile).
 * Each puzzle is only assigned once across all months.
 *
 * Usage:
 *   npx tsx scripts/buildMonthlyCalendar.ts --month 2026-07
 *   npx tsx scripts/buildMonthlyCalendar.ts --month 2026-07 --month 2026-08
 */

import './loadEnv';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { SAMPLE_PUZZLES } from '../data/samplePuzzles';
import { scorePuzzle } from '../engine/difficulty';

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK ?? '';

async function discordPing(msg: string): Promise<void> {
  if (!DISCORD_WEBHOOK) return;
  try {
    await fetch(DISCORD_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: msg }),
    });
  } catch { /* non-fatal */ }
}

function parseArgs(): { months: string[] } {
  const args = process.argv.slice(2);
  const months: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--month' && args[i + 1]) months.push(args[++i]);
  }
  if (months.length === 0) {
    console.error('Usage: npx tsx scripts/buildMonthlyCalendar.ts --month YYYY-MM [--month YYYY-MM ...]');
    process.exit(1);
  }
  return { months };
}

function datesInMonth(yearMonth: string): string[] {
  const [year, month] = yearMonth.split('-').map(Number);
  const days: string[] = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    days.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

// Returns 0 (Monday) through 6 (Sunday)
function dayOfWeekMon0(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00Z');
  return (d.getUTCDay() + 6) % 7;
}

function usedPuzzleIds(content: string): Set<string> {
  const used = new Set<string>();
  for (const m of content.matchAll(/"([^"]+)":\s*"([^"]+)"/g)) {
    used.add(m[2]); // the puzzle ID value
  }
  return used;
}

function main() {
  const { months } = parseArgs();
  const calendarPath = join(process.cwd(), 'data', 'dailyCalendar.ts');

  // Build the sorted SR pool.
  // Sort by a composite score that treats board size as the primary axis:
  //   effectiveScore = (size - 5) * 200 + rawScore
  // This ensures every 5×5 puzzle sorts before every 6×6, every 6×6 before
  // every 7×7, etc., so Monday (easiest tier) can only receive small boards.
  const srPuzzles = SAMPLE_PUZZLES
    .filter(p => p.mode === 'shattered-realms')
    .map(p => ({ id: p.id, size: p.size, score: scorePuzzle(p) }))
    .map(p => ({ ...p, effectiveScore: (p.size - 5) * 200 + p.score }))
    .sort((a, b) => a.effectiveScore - b.effectiveScore);

  if (srPuzzles.length < 7) {
    console.error(`Only ${srPuzzles.length} SR puzzles found — need at least 7.`);
    process.exit(1);
  }

  // Divide into 7 tiers by percentile (Mon=tier 0 = easiest, Sun=tier 6 = hardest)
  const tierSize = srPuzzles.length / 7;
  const tiers: string[][] = Array.from({ length: 7 }, (_, t) => {
    const start = Math.floor(t * tierSize);
    const end   = t === 6 ? srPuzzles.length : Math.floor((t + 1) * tierSize);
    return srPuzzles.slice(start, end).map(p => p.id);
  });

  console.log('SR puzzle pool:', srPuzzles.length);
  tiers.forEach((t, i) => {
    const dayName = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i];
    const puzzles = t.map(id => srPuzzles.find(p => p.id === id)!);
    const sizes   = [...new Set(puzzles.map(p => p.size))].sort((a,b)=>a-b);
    const scores  = puzzles.map(p => p.score);
    console.log(`  Tier ${i} (${dayName}): ${t.length} puzzles, sizes ${sizes.join('/')}, scores ${Math.min(...scores)}–${Math.max(...scores)}`);
  });

  let content = readFileSync(calendarPath, 'utf-8');
  const usedIds = usedPuzzleIds(content);

  // Pointer into each tier (per-run state, not persisted — we shuffle remaining unused)
  const tierRemaining: string[][] = tiers.map(tier =>
    tier.filter(id => !usedIds.has(id))
  );

  let totalAssigned = 0;
  const newEntries: string[] = [];

  for (const month of months) {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      console.error(`Invalid month format: ${month} (expected YYYY-MM)`);
      process.exit(1);
    }

    const dates = datesInMonth(month);
    console.log(`\n── ${month} (${dates.length} days) ──`);

    for (const date of dates) {
      // Skip if already assigned
      const existingMatch = content.match(new RegExp(`"${date}":\\s*"([^"]+)"`));
      if (existingMatch) {
        console.log(`  skip ${date}: already assigned (${existingMatch[1]})`);
        continue;
      }

      const tier = dayOfWeekMon0(date);
      const pool = tierRemaining[tier];

      if (pool.length === 0) {
        console.error(`  ERROR ${date}: tier ${tier} exhausted! Need more SR puzzles.`);
        process.exit(1);
      }

      // Pick first available (pool is pre-sorted by score within tier)
      const puzzleId = pool.shift()!;
      usedIds.add(puzzleId);
      newEntries.push(`  "${date}": "${puzzleId}"`);
      const dayName = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][tier];
      console.log(`  ✓ ${date} (${dayName}) → ${puzzleId}`);
      totalAssigned++;
    }
  }

  if (newEntries.length === 0) {
    console.log('\nNothing to add — all dates already assigned.');
    return;
  }

  // Insert new entries before the closing brace
  const insertPoint = content.lastIndexOf('\n};');
  if (insertPoint === -1) {
    console.error('ERROR: could not find insertion point in dailyCalendar.ts');
    process.exit(1);
  }

  // Add a comma to the last existing entry if there is one
  const existingEntries = content.slice(0, insertPoint).includes('": "');
  const prefix = existingEntries ? ',\n' : '\n';

  const newContent =
    content.slice(0, insertPoint) +
    prefix + newEntries.join(',\n') +
    content.slice(insertPoint);

  writeFileSync(calendarPath, newContent, 'utf-8');
  console.log(`\nDone. Assigned ${totalAssigned} dates.`);
  discordPing(`🗓️ Daily calendar updated: ${totalAssigned} date${totalAssigned !== 1 ? 's' : ''} assigned (${months.join(', ')})`);
}

main();
