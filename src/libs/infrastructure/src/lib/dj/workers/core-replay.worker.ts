// The linked package's replay worker, re-entered as a first-party worker entry point.
//
// The package ships its own worker and can start it unaided under a plain ESM loader, but not under
// this build: the Angular builder rewrites `new URL(..., import.meta.url)` worker specifiers with a
// TypeScript transformer that only walks sources in its own program, so the copy compiled into the
// package's `dist` is never rewritten and its URL resolves to a file the output does not contain.
// Re-exporting the worker through a file the transformer does see is what makes it resolve.
import '@sidablist/core/replay.worker';
