// Loads one of sidablist's built libraries (`libs/<name>/dist/index.js`) for the tune scripts.
// SIDABLIST names the sidablist repo root; by default it is the sibling of this teensyrom-web
// checkout, as a rad-orc worktree lays them out (<worktree>/teensyrom-web, <worktree>/sidablist).
// Build first: `pnpm build` in the sidablist repo.
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = process.env.SIDABLIST ?? resolve(here, '../../../../../../..', 'sidablist');

export async function loadSidablist(name) {
  const entry = resolve(root, 'libs', name, 'dist', 'index.js');
  if (!existsSync(entry)) {
    throw new Error(`sidablist ${name} is not built at ${entry} — set SIDABLIST to the repo root and run pnpm build there`);
  }
  return import(pathToFileURL(entry).href);
}
