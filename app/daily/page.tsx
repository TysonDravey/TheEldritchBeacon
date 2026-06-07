'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';
import { haptic } from '@/lib/haptic';
import NextImage from 'next/image';
import { getPuzzleById } from '@/data/samplePuzzles';
import { DAILY_CALENDAR } from '@/data/dailyCalendar';
import { loadPlayerState, savePlayerState, createFreshPlayerState } from '@/lib/storage';
import { getHint } from '@/engine/hints';
import { scorePuzzle } from '@/engine/difficulty';
import { isSolved, canPlaceWatcher, watcherRejectionReason } from '@/engine/rules';
import { findContradictions } from '@/engine/solver';
import type { PlayerState, CellState, HintResult, ContradictionResult } from '@/engine/boardTypes';
import Board from '@/components/Board';
import GameControls from '@/components/GameControls';
import HintOverlay from '@/components/HintOverlay';
import { WATCHER_SVGS, WARD_PNG } from '@/theme/colors';

const UNDO_LIMIT = 50;
const DAILY_COMPLETED_KEY = 'eldritch_beacon_daily_completed';
const DAILY_STREAK_KEY    = 'eldritch_beacon_daily_streak';

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadCompletedDates(): Set<string> {
  try {
    const raw = localStorage.getItem(DAILY_COMPLETED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function loadStartedDates(yearMonth: string): Set<string> {
  const started = new Set<string>();
  try {
    const days = daysInMonth(yearMonth);
    for (const date of days) {
      const puzzleId = DAILY_CALENDAR[date];
      if (!puzzleId) continue;
      const key = `eldritch_beacon_state_daily_${date}_${puzzleId}`;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const state = JSON.parse(raw);
      if (state?.completed) continue;
      const hasMove = state?.cells?.some((row: string[]) => row.some((c: string) => c !== 'empty'));
      if (hasMove) started.add(date);
    }
  } catch { /* ignore */ }
  return started;
}

function saveCompletedDate(date: string): void {
  try {
    const existing = loadCompletedDates();
    existing.add(date);
    localStorage.setItem(DAILY_COMPLETED_KEY, JSON.stringify([...existing]));
  } catch { /* storage unavailable */ }
}

interface StreakData { date: string; count: number }

function loadStreak(): StreakData {
  try {
    const raw = localStorage.getItem(DAILY_STREAK_KEY);
    return raw ? JSON.parse(raw) : { date: '', count: 0 };
  } catch { return { date: '', count: 0 }; }
}

function updateStreak(completedDate: string): StreakData {
  try {
    const prev = loadStreak();
    const yesterday = new Date(completedDate + 'T12:00:00Z');
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const newCount = prev.date === yesterdayStr
      ? prev.count + 1
      : prev.date === completedDate ? prev.count : 1;
    const streak: StreakData = { date: completedDate, count: newCount };
    localStorage.setItem(DAILY_STREAK_KEY, JSON.stringify(streak));
    return streak;
  } catch { return { date: completedDate, count: 1 }; }
}

// 0 = Monday … 6 = Sunday
function dayOfWeekMon0(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00Z');
  return (d.getUTCDay() + 6) % 7;
}

function daysInMonth(yearMonth: string): string[] {
  const [year, month] = yearMonth.split('-').map(Number);
  const days: string[] = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    days.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

// Tier colour — Mon lightest (ivory), Sun darkest (deep crimson)
const TIER_COLORS = [
  'rgba(200,180,140,0.25)',  // Mon — barely tinted
  'rgba(180,145,100,0.30)',  // Tue
  'rgba(160,110,80,0.35)',   // Wed
  'rgba(140,80,60,0.38)',    // Thu
  'rgba(120,50,40,0.42)',    // Fri
  'rgba(100,25,25,0.48)',    // Sat
  'rgba(80,10,10,0.58)',     // Sun — deep crimson
];

const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function scrollIndexForId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (Math.abs(h) % 3) + 1;
}

// ─── Calendar component ───────────────────────────────────────────────────────

function MonthCalendar({
  yearMonth,
  completedDates,
  startedDates,
  todayStr,
  onSelectDate,
}: {
  yearMonth: string;
  completedDates: Set<string>;
  startedDates: Set<string>;
  todayStr: string;
  onSelectDate: (date: string) => void;
}) {
  const days     = daysInMonth(yearMonth);
  const firstDow = dayOfWeekMon0(days[0]);
  const todayPuzzleId  = DAILY_CALENDAR[todayStr] ?? null;
  const todayCompleted = completedDates.has(todayStr);

  const [year, month] = yearMonth.split('-').map(Number);
  const monthName = new Date(year, month - 1, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const cells: (string | null)[] = [...Array(firstDow).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="w-full max-w-md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-lovecraftian text-xl text-ink">{monthName}</h2>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((d, i) => (
          <div
            key={d}
            className="text-center font-serif text-xs"
            style={{ color: i === 6 ? 'rgba(139,26,26,0.85)' : 'rgba(26,18,9,0.45)', paddingBottom: 4 }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((dateStr, i) => {
          if (!dateStr) return <div key={`empty-${i}`} style={{ aspectRatio: '1', borderRadius: 4 }} />;

          const dow       = dayOfWeekMon0(dateStr);
          const hasPuzzle = !!DAILY_CALENDAR[dateStr];
          const completed = completedDates.has(dateStr);
          const started   = !completed && startedDates.has(dateStr);
          const isToday   = dateStr === todayStr;
          const isFuture  = dateStr > todayStr;
          const isPast    = dateStr < todayStr;
          const day       = parseInt(dateStr.slice(8), 10);
          const clickable = hasPuzzle && !isFuture;

          let bg     = TIER_COLORS[dow];
          let opacity = 1;
          let border  = '1px solid rgba(26,18,9,0.12)';

          if (!hasPuzzle) {
            bg = 'rgba(26,18,9,0.04)';
            opacity = 0.35;
          } else if (isFuture) {
            opacity = 0.4;
          } else if (isPast && !completed) {
            bg = 'rgba(26,18,9,0.10)';
          }

          if (isToday) border = '2px solid rgba(26,18,9,0.7)';

          return (
            <div
              key={dateStr}
              onClick={clickable ? () => onSelectDate(dateStr) : undefined}
              style={{
                aspectRatio: '1',
                borderRadius: 4,
                background: bg,
                border,
                opacity,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: clickable ? 'pointer' : 'default',
              }}
            >
              <span
                className="font-serif text-xs select-none"
                style={{
                  color: isToday ? 'rgba(26,18,9,0.9)' : 'rgba(26,18,9,0.65)',
                  fontWeight: isToday ? 'bold' : 'normal',
                  lineHeight: 1,
                }}
              >
                {day}
              </span>
              {completed && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <NextImage src="/svg/completion_stamp.svg" alt="done" width={18} height={18} style={{ opacity: 0.75 }} />
                </div>
              )}
              {started && (
                <div style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 5, height: 5, borderRadius: '50%', background: 'rgba(181,134,13,0.85)', boxShadow: '0 0 3px rgba(181,134,13,0.5)' }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Play today */}
      <div className="mt-6 flex flex-col items-center gap-2">
        {todayPuzzleId ? (
          <>
            <button
              onClick={() => onSelectDate(todayStr)}
              className="transition-all duration-100 hover:brightness-110 active:scale-95 relative"
              style={{ filter: 'drop-shadow(3px 7px 3px rgba(0,0,0,0.75))' }}
            >
              <img
                src="/buttons/left_button_01.png"
                alt="Play Today's Beacon"
                draggable={false}
                style={{ height: 64, display: 'block', transform: 'scaleX(-1)' }}
              />
              <span
                className="absolute inset-0 flex items-center justify-center font-serif text-sm font-bold"
                style={{ color: 'rgba(242,233,210,0.95)', textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
              >
                {todayCompleted ? 'View Today' : "Today's Beacon"}
              </span>
            </button>
            {todayCompleted && (
              <p className="font-serif text-xs text-ink-light italic" style={{ opacity: 0.6 }}>
                Beacon already restored — return tomorrow
              </p>
            )}
          </>
        ) : (
          <p className="font-serif text-xs text-ink-light italic" style={{ opacity: 0.5 }}>
            No puzzle set for today
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DailyPage() {
  const router    = useRouter();
  const todayStr  = getTodayStr();
  const yearMonth = todayStr.slice(0, 7);

  const [view,            setView]           = useState<'calendar' | 'puzzle'>('calendar');
  const [selectedDate,    setSelectedDate]   = useState<string>(todayStr);
  const [completedDates,  setCompletedDates] = useState<Set<string>>(new Set());
  const [startedDates,    setStartedDates]   = useState<Set<string>>(new Set());

  const puzzleId = DAILY_CALENDAR[selectedDate] ?? null;
  const puzzle   = puzzleId ? getPuzzleById(puzzleId) : null;
  const [playerState,     setPlayerState]    = useState<PlayerState | null>(null);
  const [hintResult,      setHintResult]     = useState<HintResult | null>(null);
  const [showCompletion,  setShowCompletion] = useState(false);
  const [tilesReady,      setTilesReady]     = useState(false);
  const [loadProgress,    setLoadProgress]   = useState(0);
  const [contradiction,   setContradiction]  = useState<ContradictionResult>({ found: false });
  const [flashCells,      setFlashCells]     = useState<[number, number][]>([]);
  const [rejectionMessage,setRejectionMessage] = useState<string | null>(null);
  const [cascadeGhosts,   setCascadeGhosts]  = useState<[number, number][]>([]);
  const [cascadeWards,    setCascadeWards]   = useState<[number, number][]>([]);
  const [constraintWards, setConstraintWards] = useState<[number, number][]>([]);
  const [isFreshWin,      setIsFreshWin]     = useState(false);
  const [streak,          setStreak]         = useState<StreakData>({ date: '', count: 0 });
  const [alreadyCompleted,setAlreadyCompleted] = useState(false);

  const hintDepthRef    = useRef(0);
  const flashTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cascadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const winTimersRef    = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isDraggingRef   = useRef(false);
  const preDragCellsRef = useRef<CellState[][] | null>(null);
  const playerStateRef  = useRef<PlayerState | null>(null);

  // Load completed dates, started dates and streak from localStorage on mount
  useEffect(() => {
    setCompletedDates(loadCompletedDates());
    setStartedDates(loadStartedDates(yearMonth));
    setStreak(loadStreak());
  }, [yearMonth]);

  // Preload tile images
  useEffect(() => {
    const srcs = [
      ...Array.from({ length: 10 }, (_, i) =>
        `/tiles/processed/plain_tile_${String(i + 1).padStart(2, '0')}.png`
      ),
      ...Object.values(WATCHER_SVGS).filter(s => s.endsWith('.png')),
      WARD_PNG,
    ];
    let loaded = 0;
    const total = srcs.length;
    const onLoad = () => { loaded++; setLoadProgress(Math.round((loaded / total) * 100)); };
    Promise.all(
      srcs.map(src => {
        const img = new Image();
        img.src = src;
        return img.decode().catch(() => {}).then(onLoad);
      })
    ).then(() => setTilesReady(true));
  }, []);

  // Load puzzle player state when selected date / puzzle changes
  useEffect(() => {
    if (!puzzle) return;
    const storageKey = `daily_${selectedDate}_${puzzle.id}`;
    const saved = loadPlayerState(storageKey);
    setShowCompletion(false);
    setAlreadyCompleted(false);
    setHintResult(null);
    setContradiction({ found: false });
    if (saved) {
      setPlayerState(saved);
      if (saved.completed) {
        setShowCompletion(true);
        setAlreadyCompleted(true);
      }
    } else {
      setPlayerState(createFreshPlayerState(storageKey, puzzle.size));
    }
  }, [puzzle, selectedDate]);

  // Cascade hint animation
  useEffect(() => {
    if (cascadeTimerRef.current) { clearTimeout(cascadeTimerRef.current); cascadeTimerRef.current = null; }

    const primary      = hintResult?.primaryCell;
    const steps        = hintResult?.cascadeSteps ?? [];
    const watcherWaves = hintResult?.cascadeConstraintWaves ?? [];
    const victimCells  = hintResult?.cascadeVictimCells ?? [];

    if (!primary) { setCascadeGhosts([]); setCascadeWards([]); setConstraintWards([]); return; }

    const watcherPositions: [number, number][] = [primary, ...steps];
    setCascadeGhosts([watcherPositions[0]]);
    setCascadeWards([]);
    setConstraintWards([]);

    let wi = 0, wvi = 0, vi = 0;

    function animateWaves() {
      const waves = watcherWaves[wi] ?? [];
      if (wvi < waves.length) {
        const wave = waves[wvi];
        if (Array.isArray(wave) && wave.length > 0 && Array.isArray(wave[0]))
          setConstraintWards(prev => [...prev, ...(wave as [number, number][])]);
        wvi++;
        cascadeTimerRef.current = setTimeout(animateWaves, 380);
      } else {
        wi++; wvi = 0;
        if (wi < watcherPositions.length) {
          const next = watcherPositions[wi];
          if (next != null) setCascadeGhosts(prev => [...prev, next]);
          cascadeTimerRef.current = setTimeout(animateWaves, 500);
        } else if (victimCells.length > 0) {
          cascadeTimerRef.current = setTimeout(animateVictims, 450);
        }
      }
    }

    function animateVictims() {
      if (vi < victimCells.length) {
        const next = victimCells[vi];
        if (next != null) setCascadeWards(prev => [...prev, next]);
        vi++;
        cascadeTimerRef.current = setTimeout(animateVictims, 350);
      }
    }

    cascadeTimerRef.current = setTimeout(animateWaves, 500);
    return () => { if (cascadeTimerRef.current) { clearTimeout(cascadeTimerRef.current); cascadeTimerRef.current = null; } };
  }, [hintResult]);

  useEffect(() => () => { winTimersRef.current.forEach(clearTimeout); }, []);
  useEffect(() => { playerStateRef.current = playerState; }, [playerState]);

  const applyChange = useCallback(
    (row: number, col: number, next: CellState) => {
      const current = playerStateRef.current;
      if (!current || !puzzle || current.completed) return;

      const newCells: CellState[][] = current.cells.map((r) => [...r]);
      newCells[row][col] = next;

      let newUndoStack: CellState[][][];
      if (isDraggingRef.current && preDragCellsRef.current) {
        newUndoStack = [...current.undoStack, preDragCellsRef.current].slice(-UNDO_LIMIT);
        preDragCellsRef.current = null;
      } else if (isDraggingRef.current) {
        newUndoStack = current.undoStack;
      } else {
        newUndoStack = [...current.undoStack, current.cells.map((r) => [...r])].slice(-UNDO_LIMIT);
      }

      if (next === 'watcher' || (next === 'empty' && current.cells[row][col] === 'watcher')) haptic('medium');
      else haptic('light');

      hintDepthRef.current = 0;
      setHintResult(null);
      const contra = findContradictions(puzzle, newCells);
      const solved = isSolved(puzzle, newCells);
      const storageKey = `daily_${selectedDate}_${puzzle.id}`;
      const newState: PlayerState = { ...current, cells: newCells, undoStack: newUndoStack, completed: solved };

      playerStateRef.current = newState;
      setContradiction(contra);
      setPlayerState(newState);
      savePlayerState({ ...newState, puzzleId: storageKey });

      if (solved) {
        saveCompletedDate(selectedDate);
        setCompletedDates(prev => new Set([...prev, selectedDate]));
        setStartedDates(prev => { const n = new Set(prev); n.delete(selectedDate); return n; });
        const isToday = selectedDate === todayStr;
        let streakCount = streak.count;
        if (isToday) {
          const newStreak = updateStreak(todayStr);
          setStreak(newStreak);
          streakCount = newStreak.count;
        }
        posthog.capture('daily_completed', {
          date:        selectedDate,
          is_today:    isToday,
          puzzle_id:   puzzle.id,
          size:        puzzle.size,
          score:       scorePuzzle(puzzle),
          hints_used:  newState.hintsUsed,
          streak:      streakCount,
        });
        setIsFreshWin(true);

        winTimersRef.current.forEach(clearTimeout);
        winTimersRef.current = [];
        const watcherCells: [number, number][] = [];
        for (let r = 0; r < puzzle.size; r++)
          for (let c = 0; c < puzzle.size; c++)
            if (newCells[r][c] === 'watcher') watcherCells.push([r, c]);

        let maxDelay = 0;
        for (let r = 0; r < puzzle.size; r++) {
          for (let c = 0; c < puzzle.size; c++) {
            if (newCells[r][c] === 'ward') {
              const dist = Math.min(...watcherCells.map(([wr, wc]) => Math.abs(wr - r) + Math.abs(wc - c)));
              const delay = 2000 + dist * 60;
              if (delay > maxDelay) maxDelay = delay;
              const t = setTimeout(() => {
                haptic('win-ward');
                const el = document.querySelector(`[data-cell="true"][data-row="${r}"][data-col="${c}"]`);
                if (el) { el.classList.remove('tile-wiggle'); void (el as HTMLElement).offsetWidth; el.classList.add('tile-wiggle'); }
              }, delay);
              winTimersRef.current.push(t);
            }
          }
        }
        const completionT = setTimeout(() => setShowCompletion(true), maxDelay + 500);
        winTimersRef.current.push(completionT);
      }
    },
    [puzzle, selectedDate, todayStr],
  );

  const handleDragStart = useCallback(() => {
    if (!playerState) return;
    isDraggingRef.current   = true;
    preDragCellsRef.current = playerState.cells.map((r) => [...r]);
  }, [playerState]);

  const handleDragEnd = useCallback(() => {
    isDraggingRef.current   = false;
    preDragCellsRef.current = null;
  }, []);

  const handleCellDrag = useCallback(
    (row: number, col: number, action: 'place' | 'remove') => {
      const current = playerStateRef.current;
      if (!current || current.completed) return;
      const prev = current.cells[row][col];
      if (action === 'place'  && prev === 'empty') applyChange(row, col, 'ward');
      if (action === 'remove' && prev === 'ward')  applyChange(row, col, 'empty');
    },
    [applyChange],
  );

  const handleCellWard = useCallback(
    (row: number, col: number) => {
      const current = playerStateRef.current;
      if (!current) return;
      const prev = current.cells[row][col];
      if (prev === 'watcher') return;
      applyChange(row, col, prev === 'empty' ? 'ward' : 'empty');
    },
    [applyChange],
  );

  const handleCellWatcher = useCallback(
    (row: number, col: number) => {
      const current = playerStateRef.current;
      if (!current || !puzzle) return;
      const prev = current.cells[row][col];
      if (prev === 'ward') return;
      if (prev === 'watcher') { applyChange(row, col, 'empty'); return; }
      if (!canPlaceWatcher(puzzle, current.cells, row, col)) {
        const reason = watcherRejectionReason(puzzle, current.cells, row, col);
        haptic('error');
        applyChange(row, col, 'ward');
        setRejectionMessage(reason);
        setFlashCells([[row, col]]);
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => { setFlashCells([]); setRejectionMessage(null); }, 1600);
        return;
      }
      applyChange(row, col, 'watcher');
    },
    [puzzle, applyChange],
  );

  const handleHint = useCallback(() => {
    if (!puzzle || !playerState) return;
    const hint = getHint(puzzle, playerState.cells, hintDepthRef.current);
    posthog.capture('hint_used', {
      puzzle_id:    puzzle.id,
      date:         selectedDate,
      hint_level:   hint.level,
      hints_so_far: playerState.hintsUsed + 1,
      mode:         'daily',
    });
    hintDepthRef.current += 1;
    const storageKey = `daily_${selectedDate}_${puzzle.id}`;
    const newState = { ...playerState, hintsUsed: playerState.hintsUsed + 1 };
    setPlayerState(newState);
    savePlayerState({ ...newState, puzzleId: storageKey });
    setHintResult(hint);
  }, [puzzle, playerState, selectedDate]);

  const handleUndo = useCallback(() => {
    if (!playerState || playerState.undoStack.length === 0) return;
    const stack     = [...playerState.undoStack];
    const prevCells = stack.pop()!;
    const storageKey = `daily_${selectedDate}_${puzzle!.id}`;
    const newState: PlayerState = { ...playerState, cells: prevCells, undoStack: stack, completed: false };
    setPlayerState(newState);
    savePlayerState({ ...newState, puzzleId: storageKey });
    setContradiction(findContradictions(puzzle!, prevCells));
    setShowCompletion(false);
    setIsFreshWin(false);
    winTimersRef.current.forEach(clearTimeout);
    winTimersRef.current = [];
  }, [playerState, puzzle, selectedDate]);

  const handleRestart = useCallback(() => {
    if (!puzzle) return;
    const storageKey = `daily_${selectedDate}_${puzzle.id}`;
    const fresh = createFreshPlayerState(storageKey, puzzle.size);
    setPlayerState(fresh);
    savePlayerState(fresh);
    setContradiction({ found: false });
    setShowCompletion(false);
    setIsFreshWin(false);
    setHintResult(null);
    winTimersRef.current.forEach(clearTimeout);
    winTimersRef.current = [];
  }, [puzzle, selectedDate]);

  // ── Calendar view ──────────────────────────────────────────────────────────
  if (view === 'calendar') {
    return (
      <main className="min-h-screen flex flex-col items-center px-6 py-8">

        {/* Back button */}
        <div className="w-full max-w-md mb-4">
          <button
            onClick={() => router.push('/')}
            className="transition-all duration-100 hover:brightness-110 active:scale-95"
          >
            <img
              src="/buttons/left_button_01.png"
              alt="Back"
              draggable={false}
              style={{ height: 64, display: 'block', filter: 'drop-shadow(3px 7px 3px rgba(0,0,0,0.75))' }}
            />
          </button>
        </div>

        {/* Header */}
        <div className="w-full max-w-md mb-6 text-center">
          <h1 className="font-lovecraftian text-3xl text-ink" style={{ textShadow: '-1px -1px 0 rgba(242,233,216,0.9), 1px 1px 0 rgba(242,233,216,0.9)' }}>
            The Daily Beacon
          </h1>
          <p className="font-serif text-sm text-ink-light italic mt-1">
            A new challenge every day — harder as the week progresses
          </p>
          {streak.count >= 2 && (
            <p className="font-serif text-sm text-ink mt-2" style={{ opacity: 0.75 }}>
              {streak.count}-day streak
            </p>
          )}
        </div>

        {/* Difficulty legend */}
        <div className="w-full max-w-md mb-5">
          <div className="flex gap-1 items-center justify-center">
            {DAY_LABELS.map((d, i) => (
              <div key={d} className="flex flex-col items-center gap-1">
                <div style={{
                  width: 28, height: 10, borderRadius: 3,
                  background: TIER_COLORS[i],
                  border: '1px solid rgba(26,18,9,0.15)',
                }} />
                <span className="font-serif" style={{ fontSize: 9, color: 'rgba(26,18,9,0.45)' }}>{d}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Calendar — parchment card */}
        <div style={{
          background: 'rgba(242,233,216,0.96)',
          border: '1px solid rgba(26,18,9,0.2)',
          borderRadius: 8,
          padding: '20px 20px 24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
          width: '100%',
          maxWidth: 400,
        }}>
          <MonthCalendar
            yearMonth={yearMonth}
            completedDates={completedDates}
            startedDates={startedDates}
            todayStr={todayStr}
            onSelectDate={(date) => { setSelectedDate(date); setView('puzzle'); }}
          />
        </div>

      </main>
    );
  }

  // ── Puzzle view ────────────────────────────────────────────────────────────

  if (!puzzle || !playerState) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="font-serif text-ink opacity-60">Loading…</p>
      </main>
    );
  }

  const scrollIdx = scrollIndexForId(puzzle.id);

  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-8">

      {/* Back to calendar */}
      <div className="w-full max-w-2xl mb-4">
        <button
          onClick={() => setView('calendar')}
          className="transition-all duration-100 hover:brightness-110 active:scale-95"
        >
          <img
            src="/buttons/left_button_01.png"
            alt="Calendar"
            draggable={false}
            style={{ height: 64, display: 'block', filter: 'drop-shadow(3px 7px 3px rgba(0,0,0,0.75))' }}
          />
        </button>
      </div>

      {/* Title scroll */}
      <div
        className="w-full max-w-2xl mb-6 relative select-none"
        style={{ filter: 'drop-shadow(3px 7px 3px rgba(0,0,0,0.75))' }}
      >
        <img src={`/scrolls/scroll_0${scrollIdx}.png`} alt="" draggable={false}
          className="absolute inset-0 w-full h-full" style={{ objectFit: 'fill', display: 'block' }} />
        <div className="relative text-center" style={{ padding: '10% 16%' }}>
          <div style={{ background: 'rgba(242,233,216,0.88)', padding: '10px 18px', borderRadius: 6, boxShadow: '0 0 24px 18px rgba(242,233,216,0.88)' }}>
            <p className="font-serif text-xs text-ink-light uppercase tracking-widest mb-1">The Daily Beacon</p>
            <h1 className="font-lovecraftian text-2xl text-ink leading-snug" style={{ textWrap: 'balance' } as React.CSSProperties}>
              {puzzle.title}
            </h1>
            <p className="font-serif text-sm text-ink-light mt-1">
              {new Date(selectedDate + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })}
              {selectedDate !== todayStr && ' — Past Beacon'}
              {' '}&mdash;{' '}{puzzle.size}&times;{puzzle.size}
            </p>
            {streak.count >= 2 && (
              <p className="font-serif text-xs text-ink mt-1" style={{ opacity: 0.7 }}>
                {streak.count}-day streak
              </p>
            )}
            {playerState.hintsUsed > 0 && (
              <p className="font-serif text-xs text-red-ink mt-1">
                {playerState.hintsUsed} hint{playerState.hintsUsed !== 1 ? 's' : ''} used
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Board */}
      <div style={{ opacity: tilesReady ? 1 : 0, transition: 'opacity 0.4s ease', position: 'relative' }}>
        {!tilesReady && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-50 gap-3" style={{ minWidth: 200 }}>
            <p className="font-serif text-sm text-ink opacity-60 italic">Summoning the Watchers…</p>
            <div className="w-48 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(26,18,9,0.15)' }}>
              <div className="h-full rounded-full transition-all duration-200" style={{ width: `${loadProgress}%`, background: 'rgba(139,26,26,0.7)' }} />
            </div>
            <p className="font-serif text-xs opacity-40">{loadProgress}%</p>
          </div>
        )}
        <Board
          puzzle={puzzle}
          playerCells={playerState.cells}
          onCellWard={handleCellWard}
          onCellWatcher={handleCellWatcher}
          onCellDrag={handleCellDrag}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          primaryCell={hintResult?.primaryCell}
          highlightCells={hintResult?.highlightCells}
          secondaryHighlightCells={hintResult?.secondaryHighlightCells}
          highlightTerritories={hintResult?.highlightTerritories}
          secondaryHighlightTerritories={hintResult?.secondaryHighlightTerritories}
          highlightRows={hintResult?.highlightRows}
          highlightCols={hintResult?.highlightCols}
          hintActive={!!hintResult}
          contradiction={contradiction}
          flashCells={flashCells}
          ghostCells={cascadeGhosts}
          ghostWardCells={cascadeWards}
          constraintWardCells={constraintWards}
          isCompleted={playerState.completed}
          isFreshWin={isFreshWin}
        />
      </div>

      {/* Controls */}
      <div className="mt-6">
        <GameControls
          onHint={handleHint}
          onUndo={handleUndo}
          onRestart={handleRestart}
          hintsUsed={playerState.hintsUsed}
          canUndo={playerState.undoStack.length > 0}
          completed={playerState.completed}
        />
      </div>

      {/* Status messages */}
      <div className="mt-4 w-full max-w-2xl space-y-3">
        {showCompletion && (
          <div className="flex justify-center">
            <div className="relative select-none" style={{ width: '52%', filter: 'drop-shadow(3px 7px 3px rgba(0,0,0,0.75))' }}>
              <img src={`/scrolls/scroll_0${(scrollIdx % 3) + 1}.png`} alt="" draggable={false}
                className="absolute inset-0 w-full h-full" style={{ objectFit: 'fill', display: 'block' }} />
              <div className="relative text-center" style={{ padding: '10% 16%' }}>
                <div style={{ background: 'rgba(242,233,216,0.88)', padding: '8px 14px', borderRadius: 6, boxShadow: '0 0 24px 18px rgba(242,233,216,0.88)' }}>
                  <div className="flex items-center justify-center gap-2">
                    <NextImage src="/svg/completion_stamp.svg" alt="Completed" width={28} height={28} />
                    <h2 className="font-lovecraftian text-base text-ink leading-snug" style={{ textWrap: 'balance' } as React.CSSProperties}>
                      Beacon Restored
                    </h2>
                  </div>
                  <p className="font-serif text-xs text-ink-light italic mt-1" style={{ textWrap: 'balance' } as React.CSSProperties}>
                    {alreadyCompleted ? 'You already lit this beacon today.' : 'The Watchers stand vigilant. The wards hold.'}
                  </p>
                  {!alreadyCompleted && streak.count >= 2 && (
                    <p className="font-serif text-xs text-ink mt-2" style={{ opacity: 0.75 }}>
                      {streak.count}-day streak
                    </p>
                  )}
                  <p className="font-serif text-xs text-ink-light mt-2" style={{ opacity: 0.6 }}>
                    Return tomorrow for the next beacon.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        {rejectionMessage && (
          <div className="border border-red-ink bg-parchment px-4 py-2 rounded-sm">
            <p className="font-serif text-sm text-red-ink italic">{rejectionMessage}</p>
          </div>
        )}
        {contradiction.found && !showCompletion && !rejectionMessage && (
          <div className="border border-red-ink bg-parchment px-4 py-2 rounded-sm">
            <p className="font-serif text-sm text-red-ink">
              {contradiction.message ?? 'A contradiction lurks in the arrangement.'}
            </p>
          </div>
        )}
      </div>

      <HintOverlay hint={hintResult} onDismiss={() => setHintResult(null)} />
    </main>
  );
}
