'use client';

import { memo } from 'react';
import type { CellState } from '@/engine/boardTypes';
import { WARD_PNG } from '@/theme/colors';
import Watcher from './Watcher';
import Ward from './Ward';
import { cellPx } from './BoardCanvas';

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

  const watcherSize = Math.round(px * 0.8);
  const wardSize    = Math.round(px * 0.5);


  let ringClass = '';
  if (isContradiction || isFlash) {
    ringClass = 'outline outline-2 outline-red-ink outline-offset-[-2px] shake';
  } else if (isGhost) {
    ringClass = 'outline outline-2 outline-red-ink outline-offset-[-2px] animate-pulse';
  }

  return (
    <div
      data-cell="true"
      data-row={row}
      data-col={col}
      style={{ width: `${px}px`, height: `${px}px` }}
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
