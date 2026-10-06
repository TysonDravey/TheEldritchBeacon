import type { PuzzleMode } from '@/engine/boardTypes';

export interface RuleChangeEntry {
  title: string;
  body: string;
  flavour: string; // in-world voice
}

export const RULE_CHANGES: Partial<Record<PuzzleMode, RuleChangeEntry>> = {
  'shattered-realms': {
    title: 'The Boundaries No Longer Hold',
    body: 'A territory no longer needs to be one unbroken shape. The same colour can now appear scattered across the chart in pieces that never touch — each piece still part of the same claim, still needing exactly one Watcher somewhere among all of them.\n\nThe rule itself is unchanged: one Watcher per territory, per row, per column. Only the shape of a territory can no longer be trusted to mean anything.',
    flavour: 'I laid the drawings over one another by lamplight. The centres do not agree, and should not agree, and yet the same shape persists through every one of them.',
  },
  'twin-watchers': {
    title: 'Two Must Stand Where One Stood',
    body: 'Every row, every column, and every territory now requires two Watchers instead of one. They still may not stand adjacent to each other, nor to anyone else — the old rule simply applies twice over, everywhere, at once.\n\nWhat was a single, certain answer is now a pair. Find both, or find neither.',
    flavour: 'The drawing was patient, and calm, and correct in every particular. I wrote beneath it that I did not draw this. The reply was already waiting for me, in a hand that was not mine.',
  },
};

const SEEN_KEY = 'eldritch_beacon_seen_rule_changes';

function getSeenRuleChanges(): Set<PuzzleMode> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

export function markRuleChangeSeen(mode: PuzzleMode): void {
  try {
    const existing = getSeenRuleChanges();
    existing.add(mode);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...existing]));
  } catch { /* storage unavailable */ }
}

export function isRuleChangeNew(mode: PuzzleMode): boolean {
  return !getSeenRuleChanges().has(mode);
}
