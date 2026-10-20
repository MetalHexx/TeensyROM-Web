---
name: cli
description: 'Routing reference for the TeensyROM CLI (src/apps/cli), the terminal client that ships inside tr-web with the engine. Use when working on, running, testing or packaging the CLI, or when a task mentions TeensyRom.Cli, the engine lifecycle (start, restart, stop), the ~/.teensyrom home, or the CLI API client. NOT for engine internals — use backend-architecture; NOT for building a release — use release or release-local.'
---

# CLI Skill

Routing reference for the TeensyROM CLI, the terminal client of the engine's API, built from `src/apps/cli`.

## When to Use This Skill

- Working on, running, testing, or packaging the CLI (`src/apps/cli`)
- Starting, restarting, or stopping the engine through the CLI, or working out why an engine did or did not start
- Questions about the `~/.teensyrom` home, `TEENSYROM_DATA_DIR`, or which files the CLI and the engine write
- Regenerating or reading the CLI's API client
- Following device logs from a CLI listener through the log hub

**Not for**: engine internals (use `backend-architecture`); building a release (use `release` or `release-local`).

## Overview

- **One tool, one version**: the CLI ships with the engine and the web app as one package, and the engine and the CLI share `<Version>` in `src/apps/Version.props`.
- **Client of the API only**: the CLI calls the engine's HTTP API and its log hub. It never references an engine project.
- **Grammar**: `trom <noun> <verb>`, with the nouns `device`, `file`, `index`, `settings`, `engine`, `chipsynth` and `path`. `trom` alone opens the TUI. Every command takes `--json`; results go to stdout and diagnostics to stderr; exit codes are 0–5; no command prompts outside a terminal; `-` reads paths from stdin.
- **Engine lifecycle**: a packaged CLI starts the engine from beside itself; from source, the CLI builds the engine and starts it. A running engine whose version or build differs from the CLI's is restarted. `trom engine stop` shuts the engine down. Only one engine runs per home (the lock is `<home>/api/engine.lock`), and the engine keeps running after the CLI exits until it is stopped.
- **Device-free commands**: `chipsynth`, `settings`, `path`, `engine status`, `engine stop`, and the help and version flags (`-h`/`--help`, `-v`/`--version`) run without starting an engine.
- **Home**: the CLI keeps its state in `~/.teensyrom/cli` and the engine keeps its in `~/.teensyrom/api`. `TEENSYROM_DATA_DIR` moves the whole home; set it to a temp folder whenever you run the CLI by hand during development.
- **Source runs**: from source, the CLI rebuilds and restarts the engine when the engine's sources have changed, recording the sources it built from in `<home>/cli/source-engine.json`.
- **Windows file locks**: on Windows a running engine locks the DLLs in its `bin/Debug` folder. Stop it with `trom engine stop` (from source, run `dotnet run --project apps/cli/src/TeensyRom.Cli -- engine stop` in `src/`) before you build the engine yourself, for example for engine tests or `generate-api-client.ps1`.
- **Non-interactive shells**: without a terminal, a direct command runs and exits instead of showing the menu.
- **Log following**: a listener calls the log hub's `Subscribe` and `Unsubscribe` on `/api/logHub`, and lines arrive as `LogProduced`.

## Routing

Paths are relative to `src/` unless noted.

| Task | Where to go |
|------|-------------|
| CLI code: commands, engine lifecycle, services | `apps/cli/src/TeensyRom.Cli` (commands under `Commands/`, engine lifecycle under `Engine/`, home rules in `Common/TeensyRomHome.cs`) |
| API client | Regenerate with `pnpm run generate:cli-api-client` (runs `apps/cli/scripts/generate-api-client.ps1`). Never hand-edit `apps/cli/src/TeensyRom.Cli/Api/Generated/`. |
| Build and tests | `dotnet build apps/cli/TeensyRom.Cli.sln`; unit tests `dotnet test apps/cli/src/TeensyRom.Cli.Tests`; real-engine suite `dotnet test apps/cli/src/TeensyRom.Cli.Tests.Integration --filter "Category!=Hardware"`. The real-engine suite drives an engine through its `TestEngine` helper. `Category=Hardware` marks bench-only scenarios that need a TeensyROM attached. CI runs these in the repo-root `.github/workflows/pr-cli-checks.yml`. |
| Packaging the CLI | `distribution` skill (package layout, Homebrew formula); `release` for an official release, `release-local` for a local test build |
| Engine endpoints and hubs | `backend-architecture`; live debugging of a running engine against hardware: `api-live-debug` |
| Adding a reference file to this skill | `make-skill-template` |

## References

None yet. Future reference files go in `references/` beside this file.
