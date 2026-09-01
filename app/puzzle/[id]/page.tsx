import { SAMPLE_PUZZLES } from '@/data/samplePuzzles';
import PuzzleClient from './PuzzleClient';

// Required for `next build --output export` (the iOS/Capacitor build): every
// dynamic /puzzle/[id] page must be enumerable at build time since there's no
// server to render one on demand at request time. The web (Vercel) build
// doesn't strictly need this, but pre-rendering all puzzle pages there too is
// pure upside (faster, no server render cost per puzzle load).
export function generateStaticParams() {
  return SAMPLE_PUZZLES.map((p) => ({ id: p.id }));
}

export default function PuzzlePage() {
  return <PuzzleClient />;
}
