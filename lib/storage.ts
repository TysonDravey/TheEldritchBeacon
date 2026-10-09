import type { PlayerState, CellState } from '@/engine/boardTypes';

const STORAGE_KEY_PREFIX = 'eldritch_beacon_state_';

export const LANTERNS_CHANGED_EVENT = 'eb-lanterns-changed';

// localStorage's own 'storage' event only fires in OTHER tabs, never the one
// that made the write (same reason lib/settings.ts broadcasts its own
// CustomEvent) — needed so a persistent LanternBadge mounted elsewhere on
// the page updates live without prop-threading through every call site.
function broadcastLanternTotal(total: number): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<number>(LANTERNS_CHANGED_EVENT, { detail: total }));
}

export function savePlayerState(state: PlayerState): void {
  try {
    const key = STORAGE_KEY_PREFIX + state.puzzleId;
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // SSR or storage unavailable — silently ignore
  }
}

export function loadPlayerState(puzzleId: string): PlayerState | null {
  try {
    const key = STORAGE_KEY_PREFIX + puzzleId;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as PlayerState;
  } catch {
    return null;
  }
}

export function clearPlayerState(puzzleId: string): void {
  try {
    const key = STORAGE_KEY_PREFIX + puzzleId;
    localStorage.removeItem(key);
  } catch {
    // SSR or storage unavailable — silently ignore
  }
}

const LANTERN_TOTAL_KEY = 'eldritch_beacon_lantern_total';

export function getLanternTotal(): number {
  try {
    const raw = localStorage.getItem(LANTERN_TOTAL_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export function addLanterns(amount: number): number {
  const total = getLanternTotal() + amount;
  try {
    localStorage.setItem(LANTERN_TOTAL_KEY, String(total));
  } catch {
    // SSR or storage unavailable — silently ignore
  }
  broadcastLanternTotal(total);
  return total;
}

const LANTERNS_AWARDED_KEY = 'eldritch_beacon_lanterns_awarded';

// Tracks which puzzles/days have ever contributed to the lantern total —
// separate from PlayerState.completed, which Restart legitimately resets
// (so a replayed puzzle doesn't re-award lanterns and double-count).
function loadAwardedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(LANTERNS_AWARDED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function hasAwardedLanterns(key: string): boolean {
  return loadAwardedSet().has(key);
}

export function markLanternsAwarded(key: string): void {
  try {
    const set = loadAwardedSet();
    set.add(key);
    localStorage.setItem(LANTERNS_AWARDED_KEY, JSON.stringify([...set]));
  } catch {
    // SSR or storage unavailable — silently ignore
  }
}

/** Deducts `amount` Lanterns if the balance can cover it. Returns false (no
 *  change made) if the balance is insufficient. */
export function spendLanterns(amount: number): boolean {
  const total = getLanternTotal();
  if (total < amount) return false;
  const next = total - amount;
  try {
    localStorage.setItem(LANTERN_TOTAL_KEY, String(next));
  } catch {
    // SSR or storage unavailable — silently ignore
  }
  broadcastLanternTotal(next);
  return true;
}

const AUTOWARD_CHARGES_KEY = 'eldritch_beacon_autoward_charges';

export function getAutoWardCharges(): number {
  try {
    const raw = localStorage.getItem(AUTOWARD_CHARGES_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export function addAutoWardCharges(amount: number): number {
  const total = getAutoWardCharges() + amount;
  try {
    localStorage.setItem(AUTOWARD_CHARGES_KEY, String(total));
  } catch {
    // SSR or storage unavailable — silently ignore
  }
  return total;
}

/** Decrements the charge balance by 1. Returns false (no change made) if
 *  there are no charges left. */
export function spendAutoWardCharge(): boolean {
  const total = getAutoWardCharges();
  if (total <= 0) return false;
  try {
    localStorage.setItem(AUTOWARD_CHARGES_KEY, String(total - 1));
  } catch {
    // SSR or storage unavailable — silently ignore
  }
  return true;
}

const AUTOWARD_CONSUMED_KEY = 'eldritch_beacon_autoward_consumed';

// Tracks which puzzles have already consumed a charge — one charge buys
// Auto-Ward for the puzzle's full lifetime (including Restart), not per
// watcher placement, so a replay must not drain a second charge.
function loadAutoWardConsumedSet(): Set<string> {
  try {
    const raw = localStorage.getItem(AUTOWARD_CONSUMED_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function hasConsumedAutoWardCharge(puzzleId: string): boolean {
  return loadAutoWardConsumedSet().has(puzzleId);
}

export function markAutoWardChargeConsumed(puzzleId: string): void {
  try {
    const set = loadAutoWardConsumedSet();
    set.add(puzzleId);
    localStorage.setItem(AUTOWARD_CONSUMED_KEY, JSON.stringify([...set]));
  } catch {
    // SSR or storage unavailable — silently ignore
  }
}

export function createFreshPlayerState(puzzleId: string, size: number): PlayerState {
  return {
    puzzleId,
    cells: Array(size).fill(null).map(() => Array(size).fill('empty' as CellState)),
    undoStack: [],
    hintsUsed: 0,
    mistakes: 0,
    startTime: Date.now(),
    elapsedTime: 0,
    completed: false,
  };
}
