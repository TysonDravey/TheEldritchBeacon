'use client';

import { useState, useCallback, useRef } from 'react';
import { generatePuzzle } from '@/engine/generator';
import { rateDifficulty } from '@/engine/difficulty';
import { buildSolveTrace } from '@/engine/solveTrace';
import type { Puzzle, CellState } from '@/engine/boardTypes';
import type { SolveTrace, TraceStep } from '@/engine/solveTrace';
import { TERRITORY_NAMES, TERRITORY_COLORS, WATCHER_SVGS } from '@/theme/colors';
import { SAMPLE_PUZZLES } from '@/data/samplePuzzles';

// ---------------------------------------------------------------------------
// Tiny board preview
// ---------------------------------------------------------------------------

function MiniBoard({
  puzzle,
  boardState,
  activeCells,
  highlightRows,
  highlightCols,
  highlightTerritories,
  secondaryCells,
}: {
  puzzle: Puzzle;
  boardState?: CellState[][] | null;
  activeCells?: [number, number][];
  highlightRows?: number[];
  highlightCols?: number[];
  highlightTerritories?: number[];
  secondaryCells?: [number, number][];
}) {
  const n = puzzle.size;
  const px = Math.min(52, Math.floor(340 / n));

  const hasHighlight = !!(
    highlightRows?.length || highlightCols?.length ||
    highlightTerritories?.length || activeCells?.length || secondaryCells?.length
  );

  function isLit(row: number, col: number, territory: number) {
    if (!hasHighlight) return true;
    if (activeCells?.some(([r, c]) => r === row && c === col)) return true;
    if (secondaryCells?.some(([r, c]) => r === row && c === col)) return true;
    if (highlightRows?.includes(row)) return true;
    if (highlightCols?.includes(col)) return true;
    if (highlightTerritories?.includes(territory)) return true;
    return false;
  }

  return (
    <div className="inline-block border-2 border-ink" style={{ lineHeight: 0 }}>
      {Array.from({ length: n }, (_, row) => (
        <div key={row} className="flex">
          {Array.from({ length: n }, (_, col) => {
            const t = puzzle.territoryMap[row][col];
            const colors = TERRITORY_COLORS[t] ?? TERRITORY_COLORS[0];
            const state = boardState?.[row]?.[col] ?? 'empty';
            const isActive = activeCells?.some(([r, c]) => r === row && c === col) ?? false;
            const isSecondary = secondaryCells?.some(([r, c]) => r === row && c === col) ?? false;
            const lit = isLit(row, col, t);
            const thickT = row === 0 || puzzle.territoryMap[row-1][col] !== t;
            const thickB = row === n-1 || puzzle.territoryMap[row+1][col] !== t;
            const thickL = col === 0 || puzzle.territoryMap[row][col-1] !== t;
            const thickR = col === n-1 || puzzle.territoryMap[row][col+1] !== t;
            return (
              <div
                key={col}
                style={{
                  width: px, height: px,
                  backgroundColor: colors.bg,
                  borderTopWidth: thickT ? 2 : 1,
                  borderBottomWidth: thickB ? 2 : 1,
                  borderLeftWidth: thickL ? 2 : 1,
                  borderRightWidth: thickR ? 2 : 1,
                  borderColor: '#1A1209',
                  borderStyle: 'solid',
                  outline: isSecondary ? '2px solid #B5860D' : isActive ? '2px solid #8B1A1A' : undefined,
                  outlineOffset: (isSecondary || isActive) ? -2 : undefined,
                  opacity: lit ? 1 : 0.3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {state === 'watcher' && (
                  <img
                    src={WATCHER_SVGS[t]}
                    width={px * 0.8} height={px * 0.8} alt=""
                    className={isActive ? 'animate-pulse' : ''}
                  />
                )}
                {state === 'ward' && (
                  isActive ? (
                    <div className="animate-spin" style={{ animationDuration: '3s', display: 'flex' }}>
                      <img src="/svg/ward_sigil.svg" width={px * 0.7} height={px * 0.7} alt="" />
                    </div>
                  ) : (
                    <img src="/svg/ward_sigil.svg" width={px * 0.7} height={px * 0.7} alt="" style={{ opacity: 0.6 }} />
                  )
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wave inspector
// ---------------------------------------------------------------------------

const TECHNIQUE_COLORS: Record<string, string> = {
  'Adjacency / Row / Col / Territory Cleanup': 'bg-parchment-dark border-ink text-ink',
  'Naked Single':                              'bg-parchment-dark border-brass text-ink',
  'Row Confinement':                           'bg-parchment-dark border-red-ink text-red-ink',
  'Column Confinement':                        'bg-parchment-dark border-red-ink text-red-ink',
  'Group Elimination':                         'bg-parchment border-red-ink-light text-red-ink',
  'Contradiction Test':                        'bg-parchment border-ink-light text-ink-light',
};

// Left-border colour for technique groups (hex so it works with inline styles)
const TECHNIQUE_GROUP_COLOR: Record<string, string> = {
  'Adjacency / Row / Col / Territory Cleanup': '#1A1209',
  'Naked Single':                              '#B5860D',
  'Row Confinement':                           '#8B1A1A',
  'Column Confinement':                        '#8B1A1A',
  'Group Elimination':                         '#A03030',
  'Contradiction Test':                        '#555555',
};

type StepGroup = { technique: string; steps: Array<{ step: TraceStep; si: number }> };

function groupSteps(steps: TraceStep[]): StepGroup[] {
  const groups: StepGroup[] = [];
  for (let si = 0; si < steps.length; si++) {
    const step = steps[si];
    const last = groups[groups.length - 1];
    if (last && last.technique === step.technique) {
      last.steps.push({ step, si });
    } else {
      groups.push({ technique: step.technique, steps: [{ step, si }] });
    }
  }
  return groups;
}

function WavePanel({
  trace, activeWave, activeStep, onSelectWave, onSelectStep,
}: {
  trace: SolveTrace;
  activeWave: number;
  activeStep: number;
  onSelectWave: (w: number) => void;
  onSelectStep: (w: number, s: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {trace.waves.map((wave, wi) => (
        <div
          key={wi}
          className={`border rounded-sm p-3 cursor-pointer transition-colors ${
            wi === activeWave
              ? 'border-ink bg-parchment-dark'
              : 'border-ink opacity-60 bg-parchment hover:opacity-80'
          }`}
          onClick={() => onSelectWave(wi)}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="font-serif text-xs text-ink-light tracking-widest uppercase">Wave {wi + 1}</span>
            <span className="font-serif text-xs text-ink-light">
              — {wave.steps.length} step{wave.steps.length > 1 ? 's' : ''}
              {wave.parallel ? ' (can be spotted together)' : ''}
            </span>
          </div>
          {wi === activeWave && (
            <div className="flex flex-col gap-2 mt-1">
              {groupSteps(wave.steps).map((group, gi) => {
                const groupColor = TECHNIQUE_GROUP_COLOR[group.technique] ?? '#1A1209';
                return (
                  <div
                    key={gi}
                    className="pl-2.5"
                    style={{ borderLeft: `2px solid ${groupColor}` }}
                  >
                    {group.steps.length > 1 && (
                      <div className="text-[10px] tracking-wider uppercase mb-1" style={{ color: groupColor, opacity: 0.75 }}>
                        {group.technique} × {group.steps.length}
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      {group.steps.map(({ step, si }) => {
                        const tStyle = TECHNIQUE_COLORS[step.technique] ?? 'bg-parchment border-ink text-ink';
                        const t = step.deduction.affectedTerritories?.[0];
                        const tname = t !== undefined ? TERRITORY_NAMES[t] ?? `T${t+1}` : '';
                        return (
                          <button
                            key={si}
                            onClick={(e) => { e.stopPropagation(); onSelectStep(wi, si); }}
                            className={`text-left border px-2 py-1.5 rounded-sm font-serif text-xs transition-colors ${tStyle} ${
                              si === activeStep ? 'ring-1 ring-ink' : ''
                            }`}
                          >
                            <span className="font-bold">{step.technique}</span>
                            {tname && <span className="ml-1 opacity-70">— {tname}</span>}
                            <span className="ml-1 opacity-60">
                              {step.batchCells
                                ? `→ ${step.batchCells.length} wards`
                                : `→ ${step.deduction.type === 'watcher' ? 'Watcher' : 'Ward'} (${step.deduction.row + 1},${step.deduction.col + 1})`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
      {trace.stuck && (
        <div className="border border-red-ink px-3 py-2 rounded-sm">
          <p className="font-serif text-sm text-red-ink">Solver stuck — puzzle requires stronger techniques.</p>
        </div>
      )}
      {trace.solved && (
        <div className="border border-brass px-3 py-2 rounded-sm">
          <p className="font-serif text-sm text-brass font-bold">Puzzle fully solved by logical deduction.</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomSeed(): string {
  return 'eb-' + Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function GeneratePage() {
  const [size,       setSize]       = useState(6);
  const [seed,       setSeed]       = useState('eldritch-dev-01');
  const [maxDepth,   setMaxDepth]   = useState(0);
  const [puzzle,     setPuzzle]     = useState<Puzzle | null>(null);
  const [trace,      setTrace]      = useState<SolveTrace | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [progress,   setProgress]   = useState<{ tried: number; max: number } | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [activeWave, setActiveWave] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  // Puzzle source: 'generated' shows Add to Game, 'browsed' does not
  const [puzzleSource, setPuzzleSource] = useState<'generated' | 'browsed'>('generated');
  const [puzzleTitle,  setPuzzleTitle]  = useState('');
  const [addStatus,    setAddStatus]    = useState<string | null>(null);

  const cancelledRef = useRef(false);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const handleBrowse = useCallback((id: string) => {
    if (!id) { setPuzzle(null); setTrace(null); return; }
    const p = SAMPLE_PUZZLES.find(p => p.id === id);
    if (!p) return;
    setPuzzle(p);
    setTrace(buildSolveTrace(p));
    setActiveWave(0);
    setActiveStep(0);
    setPuzzleTitle(p.title);
    setPuzzleSource('browsed');
    setAddStatus(null);
    setError(null);
  }, []);

  const handleAddToGame = useCallback(async () => {
    if (!puzzle) return;
    setAddStatus('saving…');
    try {
      const res = await fetch('/api/add-puzzle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ puzzle, title: puzzleTitle }),
      });
      const data = await res.json();
      setAddStatus(res.ok ? `Saved as ${data.id}` : `Error: ${data.error}`);
    } catch (e) {
      setAddStatus(`Error: ${String(e)}`);
    }
  }, [puzzle, puzzleTitle]);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPuzzle(null);
    setTrace(null);
    setActiveWave(0);
    setActiveStep(0);
    cancelledRef.current = false;

    // depth-1 puzzles require exploring many territory maps per seed (not just the first one).
    // With maxAttempts:1, you only see each seed's first territory map; the hit rate is ~0.004%.
    // Using maxAttempts:200 per call gives each seed a proper 200-map exploration before moving on.
    // Most attempts fail pre-filters in <1ms; the occasional solver run may block for 5–25s.
    const outerMax   = maxDepth >= 1 ? 50  : 500;
    const innerMax   = maxDepth >= 1 ? 200 : 1;
    const totalMax   = outerMax * innerMax;

    setProgress({ tried: 0, max: totalMax });

    for (let i = 0; i < outerMax; i++) {
      if (cancelledRef.current) {
        setLoading(false);
        setProgress(null);
        setError('Generation cancelled.');
        return;
      }

      setProgress({ tried: i * innerMax, max: totalMax });
      await new Promise(resolve => setTimeout(resolve, 0));

      const trySeed = `${seed}-${i}`;
      const p = generatePuzzle({ size, seed: trySeed, maxAttempts: innerMax, maxDepth });
      if (!p) continue;

      const difficulty = rateDifficulty(p);
      const finalPuzzle = { ...p, difficulty };
      const t = buildSolveTrace(finalPuzzle);
      setPuzzle(finalPuzzle);
      setTrace(t);
      setPuzzleTitle(finalPuzzle.title);
      setPuzzleSource('generated');
      setAddStatus(null);
      setLoading(false);
      setProgress(null);
      return;
    }

    setError(
      maxDepth >= 1
        ? `No depth-${maxDepth} puzzle found in ${totalMax} territory map attempts for ${size}×${size}. Try a different base seed, or use the CLI script for bulk generation.`
        : `No puzzle found in ${totalMax} attempts for ${size}×${size} from base seed "${seed}". Try a different seed.`
    );
    setLoading(false);
    setProgress(null);
  }, [size, seed, maxDepth]);

  const activeStepObj = trace?.waves[activeWave]?.steps[activeStep];
  const boardState = activeStepObj?.cellsAfter ?? null;
  const activeCells = activeStepObj?.newCells;

  return (
    <main className="min-h-screen bg-parchment px-6 py-8 font-serif">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink">Puzzle Generator</h1>
            <p className="text-sm text-ink-light italic mt-0.5">
              Build a puzzle and inspect every logical step required to solve it.
            </p>
          </div>
          <a href="/" className="text-sm text-ink-light hover:text-ink border-b border-transparent hover:border-ink">
            ← Game
          </a>
        </div>

        {/* Browse existing puzzles */}
        <div className="flex items-center gap-3 mb-3 border border-ink px-4 py-3 rounded-sm bg-parchment">
          <label className="text-xs text-ink-light whitespace-nowrap">Browse game puzzles</label>
          <select
            value={puzzle && puzzleSource === 'browsed' ? puzzle.id : ''}
            onChange={e => handleBrowse(e.target.value)}
            disabled={loading}
            className="font-serif text-sm border border-ink bg-parchment px-2 py-1 rounded-sm flex-1"
          >
            <option value="">— pick a puzzle to inspect —</option>
            {SAMPLE_PUZZLES.map(p => (
              <option key={p.id} value={p.id}>
                {p.title}  ({p.difficulty} · {p.size}×{p.size})
              </option>
            ))}
          </select>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-4 items-end mb-6 border border-ink p-4 rounded-sm bg-parchment-dark">
          <div>
            <label className="block text-xs text-ink-light mb-1">Board size</label>
            <select
              value={size}
              onChange={e => setSize(Number(e.target.value))}
              disabled={loading}
              className="font-serif text-sm border border-ink bg-parchment px-2 py-1 rounded-sm"
            >
              {[5, 6, 7, 8].map(n => (
                <option key={n} value={n}>{n}×{n}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-ink-light mb-1">Difficulty</label>
            <select
              value={maxDepth}
              onChange={e => setMaxDepth(Number(e.target.value))}
              disabled={loading}
              className="font-serif text-sm border border-ink bg-parchment px-2 py-1 rounded-sm"
            >
              <option value={0}>Standard</option>
              <option value={1}>Hard (slow — 5–25s each)</option>
            </select>
          </div>

          <div className="flex-1 min-w-48">
            <label className="block text-xs text-ink-light mb-1">Base seed</label>
            <div className="flex gap-1">
              <input
                type="text"
                value={seed}
                onChange={e => setSeed(e.target.value)}
                disabled={loading}
                className="font-serif text-sm border border-ink bg-parchment px-2 py-1 rounded-sm flex-1"
              />
              <button
                onClick={() => setSeed(randomSeed())}
                disabled={loading}
                title="Random seed"
                className="font-serif text-sm border border-ink px-2 py-1 rounded-sm bg-parchment hover:bg-parchment-dark disabled:opacity-40"
              >
                ↻
              </button>
            </div>
          </div>

          {loading ? (
            <button
              onClick={handleCancel}
              className="font-serif text-sm border border-red-ink text-red-ink px-4 py-1.5 rounded-sm bg-parchment hover:bg-parchment-dark"
            >
              Cancel
            </button>
          ) : (
            <button
              onClick={handleGenerate}
              className="font-serif text-sm border border-ink px-4 py-1.5 rounded-sm bg-parchment hover:bg-parchment-dark"
            >
              Generate
            </button>
          )}
        </div>

        {/* Progress bar */}
        {loading && progress && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-ink-light mb-1">
              <span>Searching… {progress.tried.toLocaleString()} of {progress.max.toLocaleString()} maps tried</span>
              {maxDepth >= 1 && <span>Hard mode — may pause briefly when solver runs</span>}
            </div>
            <div className="w-full bg-parchment-dark border border-ink rounded-sm h-2 overflow-hidden">
              <div
                className="bg-ink h-full transition-all duration-300"
                style={{ width: `${Math.round((progress.tried / progress.max) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="border border-red-ink px-4 py-2 rounded-sm mb-4">
            <p className="text-sm text-red-ink">{error}</p>
          </div>
        )}

        {puzzle && trace && (
          <div className="flex flex-col lg:flex-row gap-6">

            {/* Left: board + step detail + metadata */}
            <div className="flex flex-col gap-4 items-start">
              <MiniBoard
                puzzle={puzzle}
                boardState={boardState}
                activeCells={activeCells}
                highlightRows={activeStepObj?.highlightRows}
                highlightCols={activeStepObj?.highlightCols}
                highlightTerritories={activeStepObj?.highlightTerritories}
                secondaryCells={activeStepObj?.secondaryCells}
              />

              {activeStepObj && (
                <div className="border border-ink p-4 rounded-sm bg-parchment-dark max-w-xs w-full">
                  <p className="text-xs text-ink-light tracking-widest uppercase mb-1">
                    Wave {activeWave + 1} · Step {activeStep + 1}
                  </p>
                  <p className="text-xs font-bold text-ink mb-1">{activeStepObj.technique}</p>
                  <p className="text-sm italic text-ink leading-relaxed">
                    {activeStepObj.batchCells
                      ? `Place ${activeStepObj.batchCells.length} wards (cleanup from watcher at ${activeStepObj.deduction.row + 1},${activeStepObj.deduction.col + 1})`
                      : `${activeStepObj.deduction.type === 'watcher' ? 'Place Watcher' : 'Place Ward'} at row ${activeStepObj.deduction.row + 1}, col ${activeStepObj.deduction.col + 1}`}
                  </p>
                  <p className="text-xs text-ink-light mt-2 leading-relaxed">
                    {activeStepObj.deduction.reason}
                  </p>
                  {activeStepObj.deduction.affectedTerritories && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {activeStepObj.deduction.affectedTerritories.map(t => {
                        const colors = TERRITORY_COLORS[t] ?? TERRITORY_COLORS[0];
                        return (
                          <span key={t} className="text-xs px-1.5 py-0.5 rounded-sm"
                            style={{ backgroundColor: colors.bg, color: colors.text }}>
                            {TERRITORY_NAMES[t] ?? `T${t+1}`}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="text-xs text-ink-light space-y-0.5">
                <p>ID: <span className="font-mono">{puzzle.id}</span></p>
                <p>Seed: <span className="font-mono">{puzzle.seed}</span></p>
                <p>Difficulty: <span className="font-semibold">{puzzle.difficulty}</span></p>
                <p>Waves: {trace.waves.length} &nbsp;·&nbsp; Steps: {trace.waves.reduce((s, w) => s + w.steps.length, 0)}</p>
              </div>

              {/* Add to game — only for freshly generated puzzles */}
              {puzzleSource === 'generated' && (
                <div className="border border-brass rounded-sm p-3 bg-parchment-dark w-full max-w-xs">
                  <p className="text-xs text-brass tracking-widest uppercase mb-2">Add to game</p>
                  <input
                    type="text"
                    value={puzzleTitle}
                    onChange={e => setPuzzleTitle(e.target.value)}
                    placeholder="Puzzle title"
                    className="font-serif text-sm border border-ink bg-parchment px-2 py-1 rounded-sm w-full mb-2"
                  />
                  <button
                    onClick={handleAddToGame}
                    disabled={!!addStatus && addStatus !== 'saving…' && addStatus.startsWith('Saved')}
                    className="font-serif text-sm border border-brass text-brass px-3 py-1 rounded-sm bg-parchment hover:bg-parchment-dark w-full disabled:opacity-50"
                  >
                    {addStatus === 'saving…' ? 'Saving…' : 'Add to samplePuzzles.ts'}
                  </button>
                  {addStatus && addStatus !== 'saving…' && (
                    <p className={`text-xs mt-1.5 font-mono ${addStatus.startsWith('Saved') ? 'text-brass' : 'text-red-ink'}`}>
                      {addStatus}
                    </p>
                  )}
                </div>
              )}

              {/* Export snippet */}
              <details className="w-full max-w-xs">
                <summary className="text-xs text-ink-light cursor-pointer hover:text-ink">Export JSON</summary>
                <textarea
                  readOnly
                  value={JSON.stringify(puzzle)}
                  className="mt-1 w-full font-mono text-xs border border-ink bg-parchment p-2 rounded-sm resize-y h-24"
                  onClick={e => (e.target as HTMLTextAreaElement).select()}
                />
              </details>
            </div>

            {/* Right: wave list */}
            <div className="flex-1 overflow-y-auto max-h-[80vh]">
              <WavePanel
                trace={trace}
                activeWave={activeWave}
                activeStep={activeStep}
                onSelectWave={(w) => { setActiveWave(w); setActiveStep(0); }}
                onSelectStep={(w, s) => { setActiveWave(w); setActiveStep(s); }}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
