/**
 * genState.ts
 *
 * Prints a JSON snapshot of "how much Shattered Realms puzzle generation is
 * left to do" before the daily calendar can be built through TARGET_MONTHS.
 * Always re-derives everything fresh from data/samplePuzzles.ts and
 * data/dailyCalendar.ts — never trusts cached state — so it's safe to call
 * repeatedly from a long-running job that may be killed and restarted.
 *
 * Usage: npx tsx scripts/genState.ts
 */

import './loadEnv';
import { SAMPLE_PUZZLES } from '../data/samplePuzzles';
import { scorePuzzle } from '../engine/difficulty';
import { DAILY_CALENDAR } from '../data/dailyCalendar';

export const TARGET_MONTHS = ['2026-10', '2026-11', '2026-12'];

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

function dayOfWeekMon0(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00Z');
  return (d.getUTCDay() + 6) % 7;
}

function main() {
  const tierNeed = new Array(7).fill(0);
  for (const m of TARGET_MONTHS) for (const d of datesInMonth(m)) tierNeed[dayOfWeekMon0(d)]++;

  const srPuzzles = SAMPLE_PUZZLES
    .filter(p => p.mode === 'shattered-realms')
    .map(p => ({ id: p.id, size: p.size, score: scorePuzzle(p) }))
    .map(p => ({ ...p, effectiveScore: (p.size - 5) * 200 + p.score }))
    .sort((a, b) => a.effectiveScore - b.effectiveScore);

  const tierSize = srPuzzles.length / 7;
  const tiers = Array.from({ length: 7 }, (_, t) => {
    const start = Math.floor(t * tierSize);
    const end   = t === 6 ? srPuzzles.length : Math.floor((t + 1) * tierSize);
    return srPuzzles.slice(start, end);
  });

  const usedIds = new Set(Object.values(DAILY_CALENDAR));
  const tierRemaining      = tiers.map(t => t.filter(p => !usedIds.has(p.id)).length);
  const tierDeficit        = tierRemaining.map((r, i) => Math.max(0, tierNeed[i] - r));
  const sizesByTier        = tiers.map(t => t.map(p => p.size));
  const unusedSizesByTier  = tiers.map(t => t.filter(p => !usedIds.has(p.id)).map(p => p.size));

  console.log(JSON.stringify({
    targetMonths: TARGET_MONTHS,
    dayNames: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    tierNeed,
    tierRemaining,
    tierDeficit,
    totalDeficit: tierDeficit.reduce((a, b) => a + b, 0),
    poolTotal: srPuzzles.length,
    sizesByTier,
    unusedSizesByTier,
  }));
}

main();
