'use client';

import type { CellState } from '@/engine/boardTypes';
import { TERRITORY_COLORS } from '@/theme/colors';
import Watcher from './Watcher';
import Ward from './Ward';

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

export default function Cell({
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

  const borderStyle: React.CSSProperties = {
    borderTopWidth:    thickTop    ? '2px' : '1px',
    borderRightWidth:  thickRight  ? '2px' : '1px',
    borderBottomWidth: thickBottom ? '2px' : '1px',
    borderLeftWidth:   thickLeft   ? '2px' : '1px',
    borderColor:     '#1A1209',
    borderStyle:     'solid',
    backgroundColor: colors.bg,
    width:  `${px}px`,
    height: `${px}px`,
  };

  let ringClass = '';
  if (isContradiction || isFlash) {
    ringClass = 'outline outline-2 outline-red-ink outline-offset-[-2px] shake';
  } else if (isHighlighted) {
    ringClass = 'outline outline-2 outline-red-ink outline-offset-[-2px]';
  } else if (isSecondaryHighlighted) {
    ringClass = 'outline outline-2 outline-brass outline-offset-[-2px]';
  }

  return (
    <div
      data-cell="true"
      data-row={row}
      data-col={col}
      style={borderStyle}
      className={`relative flex items-center justify-center select-none ${ringClass}`}
    >
      {state === 'watcher' && <Watcher territory={territory} size={watcherSize} />}
      {state === 'ward'    && <Ward size={wardSize} />}
      {isDimmed && <div className="absolute inset-0 bg-ink opacity-40 pointer-events-none" />}
      {isPrimaryHint && state === 'empty' && !isGhost && (
        <img
          src="/svg/watcher_spinner.svg"
          width={watcherSize}
          height={watcherSize}
          alt=""
          draggable={false}
          className="absolute animate-pulse pointer-events-none"
          style={{ opacity: 0.35 }}
        />
      )}
      {isGhost && state === 'empty' && (
        <div className="ghost-watcher absolute inset-0 flex items-center justify-center pointer-events-none">
          <img
            src="/svg/watcher_spinner.svg"
            width={watcherSize}
            height={watcherSize}
            alt=""
            draggable={false}
            className="absolute animate-pulse"
            style={{ opacity: 0.35 }}
          />
          <div style={{ opacity: 0.55 }}>
            <Watcher territory={territory} size={watcherSize} />
          </div>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'rgba(139, 26, 26, 0.35)' }}
          />
        </div>
      )}
      {isGhostWard && state === 'empty' && (
        <div className="ghost-ward absolute inset-0 flex items-center justify-center pointer-events-none">
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
