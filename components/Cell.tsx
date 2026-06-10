'use client';

import { memo } from 'react';
import type { CellState } from '@/engine/boardTypes';
import { TERRITORY_COLORS, WARD_PNG } from '@/theme/colors';
import Watcher from './Watcher';
import Ward from './Ward';

const TILE_COUNT = 10;
// Pseudo-random but stable per (row, col): cheap hashes, no Math.random.
function tileIndex(row: number, col: number): number {
  return ((row * 31 + col * 17) % TILE_COUNT + TILE_COUNT) % TILE_COUNT;
}
function tileRotation(row: number, col: number): number {
  return (((row * 13 + col * 19) % 4) + 4) % 4 * 90;
}

interface CellProps {
  row: number;
  col: number;
  territory: number;
  state: CellState;
  isHighlighted: boolean;
  isSecondaryHighlighted: boolean;
  isDimmed: boolean;
  isPrimaryHint: boolean;
  isContradiction: boolean;
  isFlash: boolean;
  isGhost: boolean;
  isGhostWard: boolean;
  isConstraintWard: boolean;
  isCompleted: boolean;
  isFreshWin: boolean;
  size: number;
  thickTop?: boolean;
  thickRight?: boolean;
  thickBottom?: boolean;
  thickLeft?: boolean;
}

function cellPx(boardSize: number): number {
  switch (boardSize) {
    case 5:  return 72;
    case 6:  return 64;
    case 7:  return 56;
    case 8:  return 50;
    case 9:  return 40;
    case 10: return 36;
    default: return Math.max(36, Math.floor(360 / boardSize));
  }
}

function Cell({
  row,
  col,
  territory,
  state,
  isHighlighted,
  isSecondaryHighlighted,
  isDimmed,
  isPrimaryHint,
  isContradiction,
  isFlash,
  isGhost,
  isGhostWard,
  isConstraintWard,
  isCompleted,
  isFreshWin,
  size,
  thickTop,
  thickRight,
  thickBottom,
  thickLeft,
}: CellProps) {
  const px = cellPx(size);
  const colors = TERRITORY_COLORS[territory] ?? TERRITORY_COLORS[0];

  const watcherSize = Math.round(px * 0.8);
  const wardSize    = Math.round(px * 0.5);

  // Territory borders: only the thick (between-territory) edges are drawn.
  // Internal cell-to-cell lines are dropped — the tile's transparent corners
  // already imply cell boundaries, so the rigid grid is gone. The remaining
  // territory edges use a translucent sepia (not pure black) so they read as
  // organic ink lines rather than a hard outline.
  const TERRITORY_EDGE = 'rgba(45, 28, 14, 0.55)';
  const borderStyle: React.CSSProperties = {
    borderTopWidth:    thickTop    ? '2px' : '0px',
    borderRightWidth:  thickRight  ? '2px' : '0px',
    borderBottomWidth: thickBottom ? '2px' : '0px',
    borderLeftWidth:   thickLeft   ? '2px' : '0px',
    borderTopColor:    thickTop    ? TERRITORY_EDGE : 'transparent',
    borderRightColor:  thickRight  ? TERRITORY_EDGE : 'transparent',
    borderBottomColor: thickBottom ? TERRITORY_EDGE : 'transparent',
    borderLeftColor:   thickLeft   ? TERRITORY_EDGE : 'transparent',
    borderStyle:     'solid',
    width:  `${px}px`,
    height: `${px}px`,
  };

  let ringClass = '';
  if (isContradiction || isFlash) {
    ringClass = 'outline outline-2 outline-red-ink outline-offset-[-2px] shake';
  } else if (isGhost) {
    ringClass = 'outline outline-2 outline-red-ink outline-offset-[-2px] animate-pulse';
  }

  const tileIdx = String(tileIndex(row, col) + 1).padStart(2, '0');
  const tileRot = tileRotation(row, col);

  const tileUrl = `/tiles/processed/plain_tile_${tileIdx}.png`;

  return (
    <div
      data-cell="true"
      data-row={row}
      data-col={col}
      style={{
        ...borderStyle,
        backgroundColor: colors.bg,
      }}
      className={`relative flex items-center justify-center select-none ${ringClass}`}
    >
      {isDimmed && <div className="absolute inset-0 bg-ink opacity-40 pointer-events-none z-10" />}
      {isHighlighted          && <div className="absolute inset-0 pointer-events-none z-10 hint-glow-red" />}
      {isSecondaryHighlighted && <div className="absolute inset-0 pointer-events-none z-10 hint-glow-brass" />}
      {state === 'watcher' && (
        <div className="relative z-20">
          <Watcher territory={territory} size={watcherSize} isFreshWin={isFreshWin} />
        </div>
      )}
      {state === 'ward'    && <div className="relative z-20"><Ward territory={territory} size={wardSize} /></div>}
      {isPrimaryHint && state === 'empty' && !isGhost && (
        <img
          src="/svg/watcher_spinner.svg"
          width={watcherSize}
          height={watcherSize}
          alt=""
          draggable={false}
          className="absolute pointer-events-none z-30"
          style={{ opacity: 0.8 }}
        />
      )}
      {isGhost && state === 'empty' && (
        <div className="ghost-watcher absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <div style={{ opacity: 0.9 }}>
            <Watcher territory={territory} size={watcherSize} />
          </div>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'rgba(139, 26, 26, 0.45)' }}
          />
        </div>
      )}
      {isConstraintWard && state === 'empty' && (
        <div className="ghost-ward absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <img
            src={WARD_PNG}
            width={wardSize}
            height={wardSize}
            alt=""
            draggable={false}
            style={{ opacity: 0.5 }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'rgba(181, 134, 13, 0.3)' }}
          />
        </div>
      )}
      {isGhostWard && state === 'empty' && (
        <div className="ghost-ward absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <img
            src={WARD_PNG}
            width={wardSize}
            height={wardSize}
            alt=""
            draggable={false}
            style={{ opacity: 0.55 }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'rgba(139, 26, 26, 0.25)' }}
          />
        </div>
      )}
    </div>
  );
}

export default memo(Cell);
