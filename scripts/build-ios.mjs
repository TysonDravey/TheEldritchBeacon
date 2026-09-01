// Builds the static export consumed by the Capacitor iOS app.
//
// `output: 'export'` (turned on via MOBILE_BUILD=1, see next.config.ts) does
// not support API routes at all, so app/api is moved out of the way for the
// duration of this build and restored afterward — even if the build fails.
// The route it contains (add-puzzle) is a local dev-only authoring tool
// anyway; it already 403s outside development and the shipped game never
// calls it.
import { existsSync, renameSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();
const apiDir = join(root, 'app', 'api');
const apiTmp = join(root, '.api-tmp-mobile-build');

let moved = false;
if (existsSync(apiDir)) {
  renameSync(apiDir, apiTmp);
  moved = true;
}

function restore() {
  if (moved && existsSync(apiTmp) && !existsSync(apiDir)) {
    renameSync(apiTmp, apiDir);
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
