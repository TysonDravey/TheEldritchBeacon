'use client';

import { memo } from 'react';
import type { CellState } from '@/engine/boardTypes';
import { TERRITORY_COLORS } from '@/theme/colors';
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
    case 9:  return 46;
    case 10: return 42;
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
  size,
  thickTop,
  thickRight,
  thickBottom,
  thickLeft,
}: CellProps) {
  const px = cellPx(size);
  const colors = TERRITORY_COLORS[territory] ?? TERRITORY_COLORS[0];

  const watcherSize = Math.round(px * 0.8);
  const wardSize    = Math.round(px * 0.7);

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
  } else if (isHighlighted) {
    ringClass = 'outline outline-2 outline-red-ink outline-offset-[-2px]';
  } else if (isSecondaryHighlighted) {
    ringClass = 'outline outline-2 outline-brass outline-offset-[-2px]';
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
        boxShadow: 'inset 0 -4px 0 rgba(26,18,9,0.65), inset -4px 0 0 rgba(26,18,9,0.5), 0 4px 0 rgba(26,18,9,0.75), 4px 0 0 rgba(26,18,9,0.55)',
      }}
      className={`relative flex items-center justify-center select-none ${ringClass}`}
    >
      {/* Layer 1: territory color, masked by the tile's alpha so transparent
          edges of the tile show parchment underneath. Slight drop shadow
          gives each cell a touch of organic lift. */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundColor: colors.bg,
          maskImage: `url(${tileUrl})`,
          WebkitMaskImage: `url(${tileUrl})`,
          maskSize: 'cover',
          WebkitMaskSize: 'cover',
          maskPosition: 'center',
          WebkitMaskPosition: 'center',
          transform: `rotate(${tileRot}deg)`,
          filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))',
        }}
      />
      {/* Layer 2: the tile texture itself, multiplied for grunge. */}
      <img
        src={tileUrl}
        alt=""
        draggable={false}
        aria-hidden
        className="absolute inset-0 w-full h-full pointer-events-none select-none"
        style={{
          objectFit: 'cover',
          transform: `rotate(${tileRot}deg)`,
          mixBlendMode: 'multiply',
          opacity: 0.7,
        }}
      />
      {/* Layered stack from back to front:
            z-10  dim overlay   — darkens the tile bg only
            z-20  player content (watcher/ward) — always crisp on top of dim
            z-30  hint overlays (spinner, ghost watchers, ghost/constraint wards) */}
      {isDimmed && <div className="absolute inset-0 bg-ink opacity-40 pointer-events-none z-10" />}
      {state === 'watcher' && <div className="relative z-20"><Watcher territory={territory} size={watcherSize} /></div>}
      {state === 'ward'    && <div className="relative z-20"><Ward size={wardSize} /></div>}
      {isPrimaryHint && state === 'empty' && !isGhost && (
        <img
          src="/svg/watcher_spinner.svg"
          width={watcherSize}
          height={watcherSize}
          alt=""
          draggable={false}
          className="absolute animate-pulse pointer-events-none z-30"
          style={{ opacity: 0.35 }}
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
            src="/svg/ward_sigil.svg"
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
            src="/svg/ward_sigil.svg"
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
