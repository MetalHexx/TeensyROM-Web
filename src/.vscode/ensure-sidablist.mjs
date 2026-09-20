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

const libs = ['analysis', 'tunes'];

function run(command, cwd) {
  console.log(`> ${command}`);
  execSync(command, { cwd, stdio: 'inherit' });
}

const distMissing = libs.filter((lib) => !existsSync(join(sidablist, 'libs', lib, 'dist')));
if (distMissing.length > 0) {
  console.log(`SIDablist libs missing a build: ${distMissing.join(', ')}. Installing and building...`);
  run('pnpm install', sidablist);
  run('pnpm --filter @sidablist/analysis --filter @sidablist/tunes run build', sidablist);
}

const linksMissing = libs.filter((lib) => !existsSync(join(root, 'node_modules', '@sidablist', lib)));
if (linksMissing.length > 0) {
  console.log(`Frontend node_modules missing links: ${linksMissing.join(', ')}. Running pnpm install...`);
  run('pnpm install', root);
}
