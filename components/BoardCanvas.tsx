'use client';

import { useRef, useEffect } from 'react';
import type { Puzzle } from '@/engine/boardTypes';
import { TERRITORY_COLORS } from '@/theme/colors';

const TILE_COUNT = 10;
const TERRITORY_EDGE = 'rgba(45, 28, 14, 0.55)';

function tileIndex(row: number, col: number): number {
  return ((row * 31 + col * 17) % TILE_COUNT + TILE_COUNT) % TILE_COUNT;
}
function tileRotation(row: number, col: number): number {
  return (((row * 13 + col * 19) % 4) + 4) % 4;
}

export function cellPx(boardSize: number): number {
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

function prebakeCell(
  color: string,
  tileImg: HTMLImageElement,
  rotQuarters: number,
  size: number,
): HTMLCanvasElement {
  const off = document.createElement('canvas');
  off.width = size;
  off.height = size;
  const ctx = off.getContext('2d')!;

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.translate(size / 2, size / 2);
  ctx.rotate(rotQuarters * Math.PI / 2);
  ctx.drawImage(tileImg, -size / 2, -size / 2, size, size);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.7;
  ctx.translate(size / 2, size / 2);
  ctx.rotate(rotQuarters * Math.PI / 2);
  ctx.drawImage(tileImg, -size / 2, -size / 2, size, size);
  ctx.restore();

  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0,    'rgba(255,255,255,0.07)');
  grad.addColorStop(0.45, 'rgba(0,0,0,0)');
  grad.addColorStop(1,    'rgba(0,0,0,0.10)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = 'rgba(26,18,9,0.55)';
  ctx.fillRect(0, size - 3, size, 3);
  ctx.fillRect(size - 3, 0, 3, size);

  return off;
}

export default function BoardCanvas({ puzzle }: { puzzle: Puzzle }) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const tilesRef    = useRef<HTMLImageElement[]>([]);
  const prebakedRef = useRef<HTMLCanvasElement[][]>([]);
  const drawRef     = useRef<() => void>(() => {});

  const px      = cellPx(puzzle.size);
  const { size, territoryMap } = puzzle;
  const totalPx = px * size;

  function buildAndDraw() {
    const tiles = tilesRef.current;
    if (tiles.length < TILE_COUNT) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const baked: HTMLCanvasElement[][] = [];
    for (let r = 0; r < size; r++) {
      baked[r] = [];
      for (let c = 0; c < size; c++) {
        const territory = territoryMap[r][c];
        const colors = TERRITORY_COLORS[territory] ?? TERRITORY_COLORS[0];
        const tileImg = tiles[tileIndex(r, c)];
        const rotQ    = tileRotation(r, c);
        baked[r][c] = prebakeCell(colors.bg, tileImg, rotQ, px);
      }
    }
    prebakedRef.current = baked;

    ctx.clearRect(0, 0, totalPx, totalPx);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        ctx.drawImage(baked[r][c], c * px, r * px);
      }
    }

    ctx.strokeStyle = TERRITORY_EDGE;
    ctx.lineWidth = 2;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const x = c * px;
        const y = r * px;
        const t = territoryMap[r][c];
        ctx.beginPath();
        if (r === 0        || territoryMap[r - 1][c] !== t) { ctx.moveTo(x,        y + 1);      ctx.lineTo(x + px,   y + 1); }
        if (r === size - 1 || territoryMap[r + 1][c] !== t) { ctx.moveTo(x,        y + px - 1); ctx.lineTo(x + px,   y + px - 1); }
        if (c === 0        || territoryMap[r][c - 1] !== t) { ctx.moveTo(x + 1,    y);          ctx.lineTo(x + 1,    y + px); }
        if (c === size - 1 || territoryMap[r][c + 1] !== t) { ctx.moveTo(x + px-1, y);          ctx.lineTo(x + px-1, y + px); }
        ctx.stroke();
      }
    }
  }

  drawRef.current = buildAndDraw;

  useEffect(() => {
    const imgs: HTMLImageElement[] = new Array(TILE_COUNT);
    let loaded = 0;
    for (let i = 0; i < TILE_COUNT; i++) {
      const img = new Image();
      img.src = `/tiles/processed/plain_tile_${String(i + 1).padStart(2, '0')}.png`;
      imgs[i] = img;
      img.onload = () => {
        loaded++;
        if (loaded === TILE_COUNT) {
          tilesRef.current = imgs;
          drawRef.current();
        }
      };
    }
    if (imgs.every(img => img.complete)) {
      tilesRef.current = imgs;
      drawRef.current();
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { buildAndDraw(); }, [puzzle]);

  return (
    <canvas
      ref={canvasRef}
      width={totalPx}
      height={totalPx}
      aria-hidden
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width:  `${totalPx}px`,
        height: `${totalPx}px`,
        pointerEvents: 'none',
      }}
    />
  );
}
