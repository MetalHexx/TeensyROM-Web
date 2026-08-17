#!/usr/bin/env node
// Boots a single Vite server to load the component-docs CLI's own TypeScript and to satisfy the
// data layer's StoryModuleLoader, then runs the CLI against process.argv. Run from the workspace
// root: `pnpm component-docs <list|get|coverage> [...]`.
import { createServer } from 'vite';

// libs/ui/components has no tsconfig.app.json — only tsconfig.lib.json and tsconfig.spec.json —
// and @analogjs/vite-plugin-angular defaults to tsconfig.app.json outside NODE_ENV=test. Without
// this, the Angular compiler's program excludes tools/**, and ssrLoadModule silently returns an
// empty module for cli.ts instead of erroring. tsconfig.spec.json is the one that includes tools/.
process.env.NODE_ENV ??= 'test';

const server = await createServer({
  configFile: 'libs/ui/components/vite.config.mts',
  root: 'libs/ui/components',
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  logLevel: 'error',
  // This CLI only ever calls ssrLoadModule — no browser ever requests a page — so Vite's default
  // dependency scan (which crawls every .html under root, including all ~48 component templates,
  // looking for client entry points) is dead work. Skipping it turns an 8s+ startup dominated by
  // esbuild scanning into a near-instant one.
  optimizeDeps: { noDiscovery: true, entries: [] },
});

try {
  const { run } = await server.ssrLoadModule('./tools/component-docs/cli.ts');
  process.exitCode = await run(process.argv.slice(2), {
    // libRelativePath is relative to the Vite root above, e.g.
    // './src/lib/card-layout/card-layout.component.stories.ts'
    loadStoryModule: (libRelativePath) => server.ssrLoadModule(libRelativePath),
  });
} finally {
  await server.close();
}

// The Angular compiler plugin leaves at least one handle open (observed: the process still
// doesn't exit on its own after server.close() resolves) even though every request has completed,
// so exit explicitly with the code `run` produced instead of hanging indefinitely.
process.exit(process.exitCode ?? 0);
