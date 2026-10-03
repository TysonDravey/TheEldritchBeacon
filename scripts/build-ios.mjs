// Builds the static export consumed by the Capacitor iOS app.
//
// `output: 'export'` (turned on via MOBILE_BUILD=1, see next.config.ts) does
// not support API routes at all, so app/api is moved out of the way for the
// duration of this build and restored afterward — even if the build fails.
// The route it contains (add-puzzle) is a local dev-only authoring tool
// anyway; it already 403s outside development and the shipped game never
// calls it.
//
// app/prototype gets the same treatment: it's dev-only experimentation
// (currently the Dual Realms prototype), never linked from the shipped
// app's UI, and its check/route.ts uses `export const dynamic =
// 'force-dynamic'` for live progress polling — which `output: 'export'`
// rejects outright, failing the whole build if left in place.
//
// app/test and app/generate are internal puzzle-authoring/rating tools —
// also never linked from the shipped app's own UI — that built fine into
// the mobile export but had no business actually shipping inside the App
// Store binary. app/generate's "save" action calls /api/add-puzzle, which
// already doesn't exist in this build (see above), so it was already a
// dead button on mobile; excluding the whole page is just not shipping
// unreachable dev tooling at all. Neither is touched for the web build.
//
// tsconfig.json's `include` sweeps up every .ts file in the repo (not just
// app/), so the standalone search-allwatcher{2,3}.ts scripts — which import
// from app/prototype/dual-realms/lib — also need to move aside, or the
// build's typecheck pass fails on the now-missing import even though these
// scripts are never bundled into the app itself.
import { existsSync, renameSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();
const movePairs = [
  [join(root, 'app', 'api'), join(root, '.api-tmp-mobile-build')],
  [join(root, 'app', 'prototype'), join(root, '.prototype-tmp-mobile-build')],
  [join(root, 'app', 'test'), join(root, '.test-tmp-mobile-build')],
  [join(root, 'app', 'generate'), join(root, '.generate-tmp-mobile-build')],
  [join(root, 'scripts', 'search-allwatcher2.ts'), join(root, 'scripts', '.search-allwatcher2.ts.mobile-build-bak')],
  [join(root, 'scripts', 'search-allwatcher3.ts'), join(root, 'scripts', '.search-allwatcher3.ts.mobile-build-bak')],
];

const moved = [];
for (const [dir, tmp] of movePairs) {
  if (existsSync(dir)) {
    renameSync(dir, tmp);
    moved.push([dir, tmp]);
  }
}

function restore() {
  for (const [dir, tmp] of moved) {
    if (existsSync(tmp) && !existsSync(dir)) {
      renameSync(tmp, dir);
    }
  }
}

process.on('exit', restore);
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

const result = spawnSync('npx', ['next', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, MOBILE_BUILD: '1' },
});

process.exit(result.status ?? 1);
