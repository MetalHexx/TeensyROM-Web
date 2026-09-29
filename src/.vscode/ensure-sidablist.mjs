import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sidablist = join(root, '..', '..', 'SIDablist');

if (!existsSync(sidablist)) {
  console.warn(`SIDablist repo not found at ${sidablist} - skipping link/build check.`);
  process.exit(0);
}

const libs = ['core', 'analysis', 'tunes', 'asid'];

function run(command, cwd) {
  console.log(`> ${command}`);
  execSync(command, { cwd, stdio: 'inherit' });
}

const distMissing = libs.filter((lib) => !existsSync(join(sidablist, 'libs', lib, 'dist')));
if (distMissing.length > 0) {
  console.log(`SIDablist libs missing a build: ${distMissing.join(', ')}. Installing and building...`);
  run('pnpm install', sidablist);
  run('pnpm -r run build', sidablist);
}

// Check the resolved dist, not just the node_modules path: @sidablist/core is a `file:`
// dependency, which pnpm snapshots at install time rather than symlinking live. If that
// snapshot was taken before core had a dist build, the symlink exists but stays stale
// until pnpm install runs again - so an existence check on the path alone would miss it.
const resolvedDistMissing = libs.filter(
  (lib) => !existsSync(join(root, 'node_modules', '@sidablist', lib, 'dist'))
);
if (resolvedDistMissing.length > 0) {
  console.log(`Frontend node_modules missing built output for: ${resolvedDistMissing.join(', ')}. Running pnpm install...`);
  run('pnpm install', root);
}
