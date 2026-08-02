/**
 * bumpBuildVersion.ts
 *
 * Increments data/buildVersion.json by 1. Run this before every commit meant
 * to be pushed — the version badge (components/BuildBadge.tsx) reads this
 * file at build time instead of deriving a count from git history, since
 * Vercel's shallow clone makes `git rev-list --count HEAD` unreliable there.
 *
 * Usage: npx tsx scripts/bumpBuildVersion.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const path = join(process.cwd(), 'data', 'buildVersion.json');
const current = JSON.parse(readFileSync(path, 'utf-8'));
const next = { version: current.version + 1 };
writeFileSync(path, JSON.stringify(next, null, 2) + '\n');
console.log(`Build version bumped: ${current.version} -> ${next.version}`);
