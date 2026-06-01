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
