'use client';

import { useEffect, useState } from 'react';
import { TERRITORY_COLORS } from '@/theme/colors';

interface Progress {
  seeds: number;
  totalSeedBudget: number;
  bestNearMissObvious: number | null;
  twoCleanCount: number;
  elapsedSec: number;
  mathPassed: number;
}

interface Tile {
  row: number;
  col: number;
  colorOnA: number;
  colorOnB: number;
}

interface Candidate {
  size: number;
  baseTerritoryMapA: number[][];
  baseTerritoryMapB: number[][];
  reversibleTiles: Tile[];
  obviousCount: number;
  obviousTotal: number;
}

interface FullSuccess {
  size: number;
  baseTerritoryMapA: number[][];
  baseTerritoryMapB: number[][];
  reversibleTiles: Tile[];
  solutionA: [number, number][];
  solutionB: [number, number][];
  visualRisk: number;
}

function deriveHome(base: number[][], tiles: Tile[], pickColor: (t: Tile) => number): number[][] {
  const map = base.map(row => [...row]);
  tiles.forEach(t => { map[t.row][t.col] = pickColor(t); });
  return map;
}

function MiniBoard({ label, map, tiles }: {
  label: string;
  map: number[][];
  tiles: Tile[];
}) {
  const size = map.length;
  const tileKey = new Set(tiles.map(t => `${t.row},${t.col}`));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ fontWeight: 'bold' }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${size}, 32px)`, gap: 2 }}>
        {map.map((row, r) =>
          row.map((color, c) => {
            const isTile = tileKey.has(`${r},${c}`);
            return (
              <div
                key={`${r}-${c}`}
                style={{
                  width: 32,
                  height: 32,
                  background: TERRITORY_COLORS[color]?.bg ?? '#999',
                  border: isTile ? '3px solid #ffea00' : '1px solid rgba(0,0,0,0.2)',
                  boxSizing: 'border-box',
                }}
                title={isTile ? 'Rift' : undefined}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}

function SearchPanel({ title, rifts, progress, nearMiss, twoClean, fullSuccess }: {
  title: string;
  rifts: number;
  progress: Progress | null;
  nearMiss: Candidate | null;
  twoClean: Candidate[];
  fullSuccess: FullSuccess[];
}) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.9)', borderRadius: 8, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%', maxWidth: 720 }}>
      <h2 style={{ fontSize: 18, margin: 0 }}>{title}</h2>

      {!progress && <div>Waiting for search to report progress…</div>}

      {progress && (
        <div style={{ background: '#f5f5f5', borderRadius: 8, padding: 16, display: 'grid', gridTemplateColumns: 'auto auto', gap: '4px 16px', fontFamily: 'monospace', fontSize: 14, width: '100%' }}>
          <div>Seeds searched:</div><div>{progress.seeds.toLocaleString()} / {progress.totalSeedBudget.toLocaleString()}</div>
          <div>Elapsed:</div><div>{progress.elapsedSec}s</div>
          <div>Passed visual + math (full success):</div><div>{progress.mathPassed}</div>
          <div>Best near-miss so far:</div>
          <div style={{ fontWeight: 'bold', color: progress.bestNearMissObvious === null ? '#999' : progress.bestNearMissObvious === 0 ? '#2e7d32' : '#d32f2f' }}>
            {progress.bestNearMissObvious === null ? 'none yet' : `${progress.bestNearMissObvious} bad flip-combo(s)`}
          </div>
          <div>Near-clean examples saved:</div><div>{progress.twoCleanCount} / 6</div>
        </div>
      )}

      {nearMiss && (
        <>
          <div style={{ fontSize: 14, fontWeight: 'bold' }}>
            Closest candidate found: {nearMiss.obviousCount} of {nearMiss.obviousTotal} non-intended flip-combinations
            look visually broken (checked ALL combos, not just single-Rift flips)
          </div>
          <div style={{ display: 'flex', gap: 32 }}>
            <MiniBoard
              label="Face A (home)"
              map={deriveHome(nearMiss.baseTerritoryMapA, nearMiss.reversibleTiles, t => t.colorOnA)}
              tiles={nearMiss.reversibleTiles}
            />
            <MiniBoard
              label="Face B (home)"
              map={deriveHome(nearMiss.baseTerritoryMapB, nearMiss.reversibleTiles, t => t.colorOnB)}
              tiles={nearMiss.reversibleTiles}
            />
          </div>
        </>
      )}

      {twoClean.length > 0 && (
        <>
          <div style={{ fontSize: 16, fontWeight: 'bold', marginTop: 8 }}>
            Near-clean examples ({twoClean.length}) — only 1 bad flip-combo out of {rifts} Rifts
          </div>
          {twoClean.map((candidate, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, borderTop: '1px solid rgba(0,0,0,0.15)', paddingTop: 12, width: '100%' }}>
              <div style={{ fontSize: 13, opacity: 0.7 }}>Example {idx + 1} ({candidate.obviousCount} of {candidate.obviousTotal} combos bad)</div>
              <div style={{ display: 'flex', gap: 32 }}>
                <MiniBoard
                  label="Face A (home)"
                  map={deriveHome(candidate.baseTerritoryMapA, candidate.reversibleTiles, t => t.colorOnA)}
                  tiles={candidate.reversibleTiles}
                />
                <MiniBoard
                  label="Face B (home)"
                  map={deriveHome(candidate.baseTerritoryMapB, candidate.reversibleTiles, t => t.colorOnB)}
                  tiles={candidate.reversibleTiles}
                />
              </div>
            </div>
          ))}
        </>
      )}

      {fullSuccess.length > 0 && (
        <>
          <div style={{ fontSize: 16, fontWeight: 'bold', marginTop: 8, color: '#2e7d32' }}>
            FULLY CLEAN examples ({fullSuccess.length}) — EVERY flip-combination stays contiguous, hard math-correct
          </div>
          {fullSuccess.map((candidate, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, borderTop: '1px solid rgba(0,0,0,0.15)', paddingTop: 12, width: '100%' }}>
              <div style={{ fontSize: 13, opacity: 0.7 }}>Example {idx + 1} (visualRisk {candidate.visualRisk})</div>
              <div style={{ display: 'flex', gap: 32 }}>
                <MiniBoard
                  label="Face A (home)"
                  map={deriveHome(candidate.baseTerritoryMapA, candidate.reversibleTiles, t => t.colorOnA)}
                  tiles={candidate.reversibleTiles}
                />
                <MiniBoard
                  label="Face B (home)"
                  map={deriveHome(candidate.baseTerritoryMapB, candidate.reversibleTiles, t => t.colorOnB)}
                  tiles={candidate.reversibleTiles}
                />
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default function ProgressClient() {
  const [progress3, setProgress3] = useState<Progress | null>(null);
  const [nearMiss3, setNearMiss3] = useState<Candidate | null>(null);
  const [twoClean3, setTwoClean3] = useState<Candidate[]>([]);
  const [fullSuccess3, setFullSuccess3] = useState<FullSuccess[]>([]);
  const [progress2, setProgress2] = useState<Progress | null>(null);
  const [nearMiss2, setNearMiss2] = useState<Candidate | null>(null);
  const [twoClean2, setTwoClean2] = useState<Candidate[]>([]);
  const [fullSuccess2, setFullSuccess2] = useState<FullSuccess[]>([]);
  const [progress3x7, setProgress3x7] = useState<Progress | null>(null);
  const [nearMiss3x7, setNearMiss3x7] = useState<Candidate | null>(null);
  const [twoClean3x7, setTwoClean3x7] = useState<Candidate[]>([]);
  const [fullSuccess3x7, setFullSuccess3x7] = useState<FullSuccess[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch('/prototype/dual-realms/check?progress=1', { cache: 'no-store' });
        const data = await res.json();
        if (cancelled) return;
        if (data.progress) setProgress3(data.progress);
        if (data.nearMiss) setNearMiss3(data.nearMiss);
        if (data.twoClean) setTwoClean3(data.twoClean);
        if (data.fullSuccess3) setFullSuccess3(data.fullSuccess3);
        if (data.progress2) setProgress2(data.progress2);
        if (data.nearMiss2) setNearMiss2(data.nearMiss2);
        if (data.twoClean2) setTwoClean2(data.twoClean2);
        if (data.fullSuccess2) setFullSuccess2(data.fullSuccess2);
        if (data.progress3x7) setProgress3x7(data.progress3x7);
        if (data.nearMiss3x7) setNearMiss3x7(data.nearMiss3x7);
        if (data.twoClean3x7) setTwoClean3x7(data.twoClean3x7);
        if (data.fullSuccess3x7) setFullSuccess3x7(data.fullSuccess3x7);
        setLastUpdated(new Date().toLocaleTimeString());
      } catch {
        // best-effort, ignore transient fetch failures
      }
    }
    poll();
    const interval = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>All-Watcher Rift Search — live progress</h1>
        <div style={{ fontSize: 12, opacity: 0.6 }}>auto-refreshes every 3s · last updated {lastUpdated || '—'}</div>
      </div>

      <SearchPanel title="3-Rift search (6×6)" rifts={3} progress={progress3} nearMiss={nearMiss3} twoClean={twoClean3} fullSuccess={fullSuccess3} />
      <SearchPanel title="2-Rift search (6×6)" rifts={2} progress={progress2} nearMiss={nearMiss2} twoClean={twoClean2} fullSuccess={fullSuccess2} />
      <SearchPanel title="3-Rift search (7×7)" rifts={3} progress={progress3x7} nearMiss={nearMiss3x7} twoClean={twoClean3x7} fullSuccess={fullSuccess3x7} />
    </div>
  );
}
