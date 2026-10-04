import type { PlayerState, CellState } from '@/engine/boardTypes';

const STORAGE_KEY_PREFIX = 'eldritch_beacon_state_';

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
  return total;
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
