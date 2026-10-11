import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function run(command, cwd) {
  console.log(`> ${command}`);
  execSync(command, { cwd, stdio: 'inherit' });
}

// A fresh git worktree has its own package.json but no node_modules - each
// worktree needs its own `pnpm install`. Detect that case (rather than just
// checking the folder exists) by checking for a devDependency bin (rimraf,
// used by the `prestart` script) so a partial/corrupt install is caught too.
const rimrafBin = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'rimraf.cmd' : 'rimraf');

if (!existsSync(join(root, 'node_modules')) || !existsSync(rimrafBin)) {
  console.log('Frontend node_modules missing or incomplete (fresh worktree?). Running pnpm install...');
  try {
    run('pnpm install', root);
  } catch {
    console.error(
      '\npnpm install failed. If the error above mentions a missing "SIDablist" directory, ' +
        'this worktree is missing its sibling SIDablist checkout (see package.json "@sidablist/*" ' +
        'dependencies) - set that up first, then re-run this task.'
    );
    process.exit(1);
  }
}
