'use client';

import { useState, useCallback, useRef } from 'react';
import { generatePuzzle } from '@/engine/generator';
import { rateDifficulty } from '@/engine/difficulty';
import { buildSolveTrace } from '@/engine/solveTrace';
import type { Puzzle } from '@/engine/boardTypes';
import type { SolveTrace } from '@/engine/solveTrace';
import { TERRITORY_NAMES, TERRITORY_COLORS, WATCHER_SVGS } from '@/theme/colors';

// ---------------------------------------------------------------------------
// Tiny board preview
// ---------------------------------------------------------------------------

function MiniBoard({
  puzzle,
  highlightCell,
  revealUpTo,
}: {
  puzzle: Puzzle;
  highlightCell?: [number, number];
  revealUpTo?: { row: number; col: number; type: 'watcher' | 'ward' }[];
}) {
  const n = puzzle.size;
  const px = Math.min(52, Math.floor(340 / n));
  const placed = new Map<string, 'watcher' | 'ward'>();
  for (const s of revealUpTo ?? []) placed.set(`${s.row},${s.col}`, s.type);

  return (
    <div className="inline-block border-2 border-ink" style={{ lineHeight: 0 }}>
      {Array.from({ length: n }, (_, row) => (
        <div key={row} className="flex">
          {Array.from({ length: n }, (_, col) => {
            const t = puzzle.territoryMap[row][col];
            const colors = TERRITORY_COLORS[t] ?? TERRITORY_COLORS[0];
            const isHL = highlightCell?.[0] === row && highlightCell?.[1] === col;
            const state = placed.get(`${row},${col}`);
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
                  outline: isHL ? '2px solid #8B1A1A' : undefined,
                  outlineOffset: isHL ? -2 : undefined,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {state === 'watcher' && (
                  <img src={WATCHER_SVGS[t]} width={px * 0.8} height={px * 0.8} alt="" />
                )}
                {state === 'ward' && (
                  <img src="/svg/ward_sigil.svg" width={px * 0.7} height={px * 0.7} alt="" style={{ opacity: 0.6 }} />
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
            <div className="flex flex-col gap-1.5 mt-1">
              {wave.steps.map((step, si) => {
                const tStyle = TECHNIQUE_COLORS[step.technique] ?? 'bg-parchment border-ink text-ink';
                const t = step.deduction.affectedTerritories?.[0];
                const tname = t !== undefined ? TERRITORY_NAMES[t] ?? `T${t+1}` : '';
                return (
                  <button
                    key={si}
                    onClick={(e) => { e.stopPropagation(); onSelectStep(wi, si); }}
                    className={`text-left border px-2 py-1.5 rounded-sm font-serif text-xs transition-colors ${tStyle} ${
                      wi === activeWave && si === activeStep ? 'ring-1 ring-ink' : ''
                    }`}
                  >
                    <span className="font-bold">{step.technique}</span>
                    {tname && <span className="ml-1 opacity-70">— {tname}</span>}
                    <span className="ml-1 opacity-60">
                      → {step.deduction.type === 'watcher' ? 'Watcher' : 'Ward'} ({step.deduction.row + 1},{step.deduction.col + 1})
                    </span>
                  </button>
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

  const cancelledRef = useRef(false);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
  }, []);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPuzzle(null);
    setTrace(null);
    setActiveWave(0);
    setActiveStep(0);
    cancelledRef.current = false;

    // For depth-1 each attempt can take 5–25s, so we cap lower and yield every attempt.
    // For depth-0 each attempt is fast, so we yield every 5.
    const maxAttempts = maxDepth >= 1 ? 150 : 500;
    const yieldEvery  = maxDepth >= 1 ? 1    : 5;

    setProgress({ tried: 0, max: maxAttempts });

    for (let i = 0; i < maxAttempts; i++) {
      if (cancelledRef.current) {
        setLoading(false);
        setProgress(null);
        setError('Generation cancelled.');
        return;
      }

      // Yield to the UI periodically
      if (i % yieldEvery === 0) {
        setProgress({ tried: i, max: maxAttempts });
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      const trySeed = `${seed}-${i}`;
      const p = generatePuzzle({ size, seed: trySeed, maxAttempts: 1, maxDepth });
      if (!p) continue;

      const difficulty = rateDifficulty(p);
      const finalPuzzle = { ...p, difficulty };
      const t = buildSolveTrace(finalPuzzle);
      setPuzzle(finalPuzzle);
      setTrace(t);
      setLoading(false);
      setProgress(null);
      return;
    }

    setError(
      maxDepth >= 1
        ? `No depth-${maxDepth} puzzle found in ${maxAttempts} attempts for ${size}×${size}. Try a different base seed.`
        : `No puzzle found in ${maxAttempts} attempts for ${size}×${size} from base seed "${seed}". Try a different seed.`
    );
    setLoading(false);
    setProgress(null);
  }, [size, seed, maxDepth]);

  // Collect placed cells up to the active wave/step
  const revealUpTo: { row: number; col: number; type: 'watcher' | 'ward' }[] = [];
  if (trace) {
    for (let wi = 0; wi <= activeWave; wi++) {
      const wave = trace.waves[wi];
      if (!wave) break;
      const maxStep = wi === activeWave ? activeStep : wave.steps.length - 1;
      for (let si = 0; si <= maxStep; si++) {
        const step = wave.steps[si];
        if (!step) break;
        revealUpTo.push({ row: step.deduction.row, col: step.deduction.col, type: step.deduction.type });
      }
    }
  }

  const activeStepObj = trace?.waves[activeWave]?.steps[activeStep];

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
              <span>Searching… attempt {progress.tried} of {progress.max}</span>
              {maxDepth >= 1 && <span>Hard mode — each attempt takes several seconds</span>}
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
                highlightCell={activeStepObj ? [activeStepObj.deduction.row, activeStepObj.deduction.col] : undefined}
                revealUpTo={revealUpTo}
              />

              {activeStepObj && (
                <div className="border border-ink p-4 rounded-sm bg-parchment-dark max-w-xs w-full">
                  <p className="text-xs text-ink-light tracking-widest uppercase mb-1">
                    Wave {activeWave + 1} · Step {activeStep + 1}
                  </p>
                  <p className="text-xs font-bold text-ink mb-1">{activeStepObj.technique}</p>
                  <p className="text-sm italic text-ink leading-relaxed">
                    {activeStepObj.deduction.type === 'watcher' ? 'Place Watcher' : 'Place Ward'}{' '}
                    at row {activeStepObj.deduction.row + 1}, col {activeStepObj.deduction.col + 1}
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
