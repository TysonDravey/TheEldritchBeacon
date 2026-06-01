import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { Puzzle } from '@/engine/boardTypes';

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  let puzzle: Puzzle;
  let title: string | undefined;
  try {
    ({ puzzle, title } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const filePath = join(process.cwd(), 'data', 'samplePuzzles.ts');
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return NextResponse.json({ error: 'Could not read samplePuzzles.ts' }, { status: 500 });
  }

  // Find next sequential ID for this board size
  const sizeStr = `${puzzle.size}x${puzzle.size}`;
  const idPattern = new RegExp(`"id":"eb-${sizeStr}-(\\d+)"`, 'g');
  const nums: number[] = [];
  for (const m of content.matchAll(idPattern)) nums.push(parseInt(m[1]));
  const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  const id = `eb-${sizeStr}-${String(nextNum).padStart(3, '0')}`;

  // Strip difficulty (it's computed at load time, not stored)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { difficulty: _d, ...rest } = puzzle;
  const entry = { ...rest, id, title: title ?? puzzle.title };

  // Insert before the closing ]; of RAW_PUZZLES
  const insertPoint = content.lastIndexOf('\n];');
  if (insertPoint === -1) {
    return NextResponse.json({ error: 'Could not find insertion point in samplePuzzles.ts' }, { status: 500 });
  }

  const newContent =
    content.slice(0, insertPoint) +
    ',\n' + JSON.stringify(entry) +
    content.slice(insertPoint);

  try {
    writeFileSync(filePath, newContent, 'utf-8');
  } catch {
    return NextResponse.json({ error: 'Could not write samplePuzzles.ts' }, { status: 500 });
  }

  return NextResponse.json({ id, title: entry.title });
}
