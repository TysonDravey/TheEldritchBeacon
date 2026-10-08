import { runMutationSearch } from './mutationSearch';

const t0 = Date.now();
const report = runMutationSearch({
  n: 8,
  seed: 'smoke-1',
  maxIterations: 2000,
  restartAfterStale: 150,
  patchMutationChance: 0.3,
  acceptTolerance: 0.02,
  shortlistSize: 5,
});
console.log(`Smoke test: ${Date.now() - t0}ms`);
console.log(JSON.stringify({ ...report, shortlist: report.shortlist.map(s => ({ score: s.score, stall: { ...s.stall, candidateCountByTerritory: undefined, rowsWithCandidates: [...s.stall.rowsWithCandidates], colsWithCandidates: [...s.stall.colsWithCandidates] } })) }, null, 2));
